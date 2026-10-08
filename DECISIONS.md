# Architectural & Technical Decisions: Lumina Camera

This document logs architectural choices, model verification findings, browser compatibility checks, and trade-offs made during development.

---

## 1. AI Models & Provider Integration

### Gemma 4 Verification & Identifiers
- **Models Verified:**
  - `gemma-4-26b-a4b-it`: Mixture-of-Experts (MoE) architecture with 25.2B total parameters and ~3.8B–4B active parameters per token. Chosen as the **default** model for cloud and local inference due to high multimodal intelligence combined with low latency and memory footprint.
  - `gemma-4-31b-it`: Dense multimodal model (~30.7B parameters). Configurable via `GEMMA_MODEL_NAME=gemma-4-31b-it` for environments demanding maximum compositional reasoning depth.
- **Multimodal Support:** Both models natively accept JPEG/PNG image bytes along with structured prompting.
- **Thinking Level Configuration:**
  - In modern Google GenAI SDK (`google-genai`), reasoning budget is set using `types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level="minimal"))` rather than legacy token counts.
  - Setting `thinking_level="minimal"` minimizes internal scratchpad tokens to meet our tight latency budget (< 2 seconds per coaching inference).
- **Dual Providers (Hosted vs. Self-Hosted):**
  - **Hosted Mode:** Uses Google GenAI API with `GEMINI_API_KEY`.
  - **Self-Hosted Mode:** Uses local Ollama instance (or any OpenAI-compatible server such as vLLM/llama.cpp) serving `gemma4:26b` or `gemma4:e4b` via `http://localhost:11434`.
  - Both modes share identical system prompt, schema constraints, and JSON recovery parsers.

---

## 2. Two-Loop Architecture (Never Blocking)

| Loop | Scope | Cadence | Execution Context | Failure Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Fast Loop** | On-device framing, face tracking, horizon level, blur/brightness, stability | ~30 FPS | Browser Main Thread & Web Worker | Fully local, zero network dependencies |
| **Slow Loop** | Gemma 4 photography coaching, composition critique, movement vectors | 2–3s (adaptive) | Asynchronous backend API | Silently degrades; on-device overlays continue unaffected |

- **State Decoupling:** Overlays are driven by a single unified reactive state (`CameraOverlayState`). The fast loop updates horizon, subject boxes, blur, and stability at 30 FPS. The slow loop injects advice, directional arrows, and score asynchronously.
- **Stale Response Invalidation:** If the user moves significantly between the dispatch of a coaching request and the receipt of the Gemma response, the response is discarded to prevent conflicting coaching cues.

---

## 3. Privacy & Security

- **Server-Side Secrets:** `GEMINI_API_KEY` is loaded exclusively into backend memory from `.env` or container environment variables. It is never transmitted to or bundled in client builds.
- **Ephemerality:** Frames transmitted to `/api/analyze` are processed in-memory as byte streams; no image data is persisted to backend disk or logged.
- **Client Transparency:** The UI explicitly displays whether the app is running in Hosted Mode (cloud inference) or Self-Hosted Mode (air-gapped local inference).

---

## 4. Browser & Mobile Device Compatibility

- **Camera Stream:** Uses `navigator.mediaDevices.getUserMedia` with `facingMode: { ideal: "environment" }` and fallbacks for desktop webcams.
- **Full-Resolution Still Capture:** Utilizes `ImageCapture.takePhoto()` where supported (Chromium Android); gracefully falls back to canvas video frame extraction at maximum video stream dimensions.
- **Horizon & Leveling:**
  - Android Chrome: Directly subscribes to `deviceorientationabsolute` or `deviceorientation`.
  - iOS Safari: Implements permission-request hook on first user touch (`DeviceOrientationEvent.requestPermission()`).
- **Haptic Feedback:** Safely feature-detects `navigator.vibrate`. Suppressed cleanly on unsupported devices (e.g. desktop, iOS Safari).
- **Persistent Storage:** Requests `navigator.storage.persist()` to guard IndexedDB photo captures from storage eviction.

---

## 5. Licensure & Open-Source Compliance

- All code authored under the **Apache-2.0** license.
- Core intelligence powered by Google's open-weight **Gemma 4** models (Apache-2.0).
- Frontend and backend libraries are restricted to permissive licenses (MIT, Apache-2.0, BSD-3-Clause).
