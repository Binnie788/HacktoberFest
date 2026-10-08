import React, { useEffect, useRef } from 'react';
import type { CameraOverlayState } from '../types/camera';

interface OverlayCanvasProps {
  state: CameraOverlayState;
  className?: string;
}

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({ state, className }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CameraOverlayState>(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;

    const render = () => {
      const s = stateRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Rule-of-Thirds Grid
      drawRuleOfThirds(ctx, width, height, s.gridPowerPointAligned);

      // 2. Draw Horizon Line / Level Indicator
      drawHorizonLevel(ctx, width, height, s.tiltAngle, s.isLevel);

      // 3. Draw Subject Bounding Box
      if (s.subjectBox) {
        drawSubjectBox(ctx, width, height, s.subjectBox, s.gridPowerPointAligned);
      }

      // 4. Draw Directional Guidance Arrow
      if (s.directionArrow && (Math.abs(s.directionArrow.dx) > 0.05 || Math.abs(s.directionArrow.dy) > 0.05)) {
        drawDirectionArrow(ctx, width, height, s.directionArrow);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none w-full h-full ${className || ''}`}
    />
  );
};

// Helper: Rule of Thirds Grid
function drawRuleOfThirds(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isPowerPointAligned: boolean
) {
  const x1 = width / 3;
  const x2 = (width * 2) / 3;
  const y1 = height / 3;
  const y2 = (height * 2) / 3;

  ctx.save();
  ctx.lineWidth = 1;

  if (isPowerPointAligned) {
    // Glowing emerald green when subject sits on a compositional power point
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.85)';
    ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
    ctx.shadowBlur = 8;
  } else {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.shadowBlur = 0;
  }

  // Vertical lines
  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, height);
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, height);

  // Horizontal lines
  ctx.moveTo(0, y1);
  ctx.lineTo(width, y1);
  ctx.moveTo(0, y2);
  ctx.lineTo(width, y2);
  ctx.stroke();

  // 4 Power points crosshairs
  const pts = [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x1, y: y2 },
    { x: x2, y: y2 },
  ];

  ctx.fillStyle = isPowerPointAligned ? 'rgba(52, 211, 153, 1.0)' : 'rgba(255, 255, 255, 0.45)';
  for (const pt of pts) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isPowerPointAligned ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Helper: Horizon Level Line
function drawHorizonLevel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tiltAngle: number,
  isLevel: boolean
) {
  const cx = width / 2;
  const cy = height / 2;
  const lineLength = width * 0.32;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-tiltAngle * Math.PI) / 180);

  ctx.lineWidth = isLevel ? 2.5 : 1.5;
  ctx.strokeStyle = isLevel ? 'rgba(56, 189, 248, 0.95)' : 'rgba(255, 255, 255, 0.55)';
  if (isLevel) {
    ctx.shadowColor = 'rgba(56, 189, 248, 0.7)';
    ctx.shadowBlur = 10;
  }

  // Left horizon segment
  ctx.beginPath();
  ctx.moveTo(-lineLength, 0);
  ctx.lineTo(-lineLength * 0.2, 0);
  // Center reticle
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  // Right horizon segment
  ctx.moveTo(lineLength * 0.2, 0);
  ctx.lineTo(lineLength, 0);
  ctx.stroke();

  // Level pitch ticks on ends
  ctx.beginPath();
  ctx.moveTo(-lineLength, -6);
  ctx.lineTo(-lineLength, 6);
  ctx.moveTo(lineLength, -6);
  ctx.lineTo(lineLength, 6);
  ctx.stroke();

  // Degrees text if tilted
  if (!isLevel && Math.abs(tiltAngle) > 0.5) {
    ctx.shadowBlur = 0;
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const text = `${tiltAngle > 0 ? '+' : ''}${tiltAngle.toFixed(1)}°`;
    ctx.fillText(text, 0, -10);
  }

  ctx.restore();
}

// Helper: Subject Bounding Box
function drawSubjectBox(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  box: { x: number; y: number; width: number; height: number },
  isPowerPoint: boolean
) {
  const bx = box.x * width;
  const by = box.y * height;
  const bw = box.width * width;
  const bh = box.height * height;
  const bracketLen = Math.min(bw, bh) * 0.25;

  ctx.save();
  ctx.lineWidth = isPowerPoint ? 2.5 : 1.8;
  ctx.strokeStyle = isPowerPoint ? 'rgba(52, 211, 153, 0.95)' : 'rgba(250, 204, 21, 0.85)';
  if (isPowerPoint) {
    ctx.shadowColor = 'rgba(52, 211, 153, 0.6)';
    ctx.shadowBlur = 8;
  }

  // Top-Left corner bracket
  ctx.beginPath();
  ctx.moveTo(bx, by + bracketLen);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + bracketLen, by);

  // Top-Right corner bracket
  ctx.moveTo(bx + bw - bracketLen, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + bracketLen);

  // Bottom-Left corner bracket
  ctx.moveTo(bx, by + bh - bracketLen);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + bracketLen, by + bh);

  // Bottom-Right corner bracket
  ctx.moveTo(bx + bw - bracketLen, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - bracketLen);
  ctx.stroke();

  // Subtle label badge
  ctx.shadowBlur = 0;
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isPowerPoint ? 'rgba(52, 211, 153, 0.95)' : 'rgba(250, 204, 21, 0.9)';
  ctx.textAlign = 'left';
  ctx.fillText(
    isPowerPoint ? 'POWER POINT LOCKED' : 'SUBJECT FOCUS',
    bx + 4,
    by - 6
  );

  ctx.restore();
}

// Helper: Directional Guidance Arrow
function drawDirectionArrow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  arrow: { dx: number; dy: number }
) {
  const cx = width / 2;
  const cy = height * 0.76; // Drawn neatly in lower third area
  const scale = 50;
  const targetX = cx + arrow.dx * scale;
  const targetY = cy + arrow.dy * scale;

  const angle = Math.atan2(arrow.dy, arrow.dx);

  ctx.save();
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.9)';
  ctx.fillStyle = 'rgba(244, 63, 94, 0.9)';
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(244, 63, 94, 0.7)';
  ctx.shadowBlur = 10;

  // Connecting ray
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(targetX, targetY);
  ctx.stroke();

  // Arrow Head
  const headLen = 12;
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  ctx.lineTo(
    targetX - headLen * Math.cos(angle - Math.PI / 6),
    targetY - headLen * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    targetX - headLen * Math.cos(angle + Math.PI / 6),
    targetY - headLen * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  // Guidance text caption
  let instruction = '';
  if (Math.abs(arrow.dx) > Math.abs(arrow.dy)) {
    instruction = arrow.dx < 0 ? 'PAN LEFT' : 'PAN RIGHT';
  } else {
    instruction = arrow.dy < 0 ? 'TILT UP' : 'TILT DOWN';
  }

  ctx.shadowBlur = 0;
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.textAlign = 'center';
  ctx.fillText(instruction, cx, cy + 24);

  ctx.restore();
}
