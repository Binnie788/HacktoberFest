// Lumina Fast Loop Vision Web Worker
// Processes downscaled frames off the main thread for zero UI jank.

interface FrameMessage {
  type: 'PROCESS_FRAME';
  imageBitmap: ImageBitmap;
}

let lastLumaArray: Float32Array | null = null;
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

// Worker downscaled analysis resolution (120x90 for fast 30+ FPS analysis)
const ANALYSIS_W = 120;
const ANALYSIS_H = 90;

self.onmessage = async (e: MessageEvent<FrameMessage>) => {
  if (e.data.type === 'PROCESS_FRAME') {
    const { imageBitmap } = e.data;
    try {
      if (!offscreenCanvas) {
        offscreenCanvas = new OffscreenCanvas(ANALYSIS_W, ANALYSIS_H);
        offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
      }

      if (!offscreenCtx) {
        imageBitmap.close();
        return;
      }

      // Draw downscaled frame
      offscreenCtx.drawImage(imageBitmap, 0, 0, ANALYSIS_W, ANALYSIS_H);
      imageBitmap.close(); // Clean up GPU bitmap resource immediately

      const imageData = offscreenCtx.getImageData(0, 0, ANALYSIS_W, ANALYSIS_H);
      const data = imageData.data;
      const totalPixels = ANALYSIS_W * ANALYSIS_H;

      // 1. Brightness & Grayscale Luma Array
      let totalLuma = 0;
      const currentLuma = new Float32Array(totalPixels);

      for (let i = 0; i < totalPixels; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        // Standard Rec. 709 luma
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        currentLuma[i] = y;
        totalLuma += y;
      }

      const avgBrightness = totalLuma / totalPixels;

      // 2. Sharpness / Blur score via Discrete Laplacian Filter
      // Kernel: [ 0,  1,  0,
      //           1, -4,  1,
      //           0,  1,  0 ]
      let laplacianSum = 0;
      let laplacianSqSum = 0;
      let evaluatedCount = 0;

      for (let y = 1; y < ANALYSIS_H - 1; y++) {
        const row = y * ANALYSIS_W;
        const rowAbove = (y - 1) * ANALYSIS_W;
        const rowBelow = (y + 1) * ANALYSIS_W;

        for (let x = 1; x < ANALYSIS_W - 1; x++) {
          const center = currentLuma[row + x];
          const lapVal =
            currentLuma[rowAbove + x] +
            currentLuma[rowBelow + x] +
            currentLuma[row + x - 1] +
            currentLuma[row + x + 1] -
            4 * center;

          laplacianSum += lapVal;
          laplacianSqSum += lapVal * lapVal;
          evaluatedCount++;
        }
      }

      const meanLap = laplacianSum / evaluatedCount;
      // Variance of Laplacian
      const blurScore = Math.max(0, laplacianSqSum / evaluatedCount - meanLap * meanLap);

      // 3. Motion / Frame Difference (MSE)
      let frameDelta = 0;
      if (lastLumaArray) {
        let diffSum = 0;
        for (let i = 0; i < totalPixels; i++) {
          const diff = currentLuma[i] - lastLumaArray[i];
          diffSum += diff * diff;
        }
        frameDelta = Math.sqrt(diffSum / totalPixels);
      }
      lastLumaArray = currentLuma;

      // 4. Fast Face / Subject Detection (Skin Chrominance & High Contrast Cluster)
      // YCbCr thresholding for fast face localization
      let skinPixelCount = 0;
      let minX = ANALYSIS_W,
        maxX = 0,
        minY = ANALYSIS_H,
        maxY = 0;

      for (let y = 0; y < ANALYSIS_H; y++) {
        const row = y * ANALYSIS_W;
        for (let x = 0; x < ANALYSIS_W; x++) {
          const offset = (row + x) * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];

          // Normalized Chrominance Cb, Cr
          const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
          const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

          // Standard human skin color bounding cluster
          if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
            skinPixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      let faceBox = null;
      const minFacePixels = totalPixels * 0.015; // At least 1.5% of frame
      if (skinPixelCount > minFacePixels && maxX > minX && maxY > minY) {
        const boxW = (maxX - minX) / ANALYSIS_W;
        const boxH = (maxY - minY) / ANALYSIS_H;
        // Verify aspect ratio is roughly face-like (0.4 to 1.8)
        const aspect = boxW / (boxH || 1);
        if (aspect >= 0.4 && aspect <= 1.8 && boxW >= 0.1 && boxH >= 0.1) {
          faceBox = {
            x: minX / ANALYSIS_W,
            y: minY / ANALYSIS_H,
            width: boxW,
            height: boxH,
          };
        }
      }

      self.postMessage({
        type: 'METRICS_RESULT',
        blurScore,
        brightness: avgBrightness,
        frameDelta,
        faceBox,
      });
    } catch (err) {
      console.warn('[VisionWorker] Processing error:', err);
    }
  }
};
