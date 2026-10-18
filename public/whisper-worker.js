// On-device speech to text: OpenAI's open Whisper weights (tiny.en) run in this
// browser through transformers.js. Audio never leaves the phone.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2";

env.allowLocalModels = false;
let asr = null;

self.onmessage = async (e) => {
  const { type, audio, id } = e.data;
  try {
    if (!asr) {
      asr = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
        dtype: "q8",
        progress_callback: (p) => { if (p.status === "progress" && p.file?.endsWith(".onnx")) self.postMessage({ type: "progress", pct: Math.round(p.progress ?? 0) }); },
      });
      self.postMessage({ type: "ready" });
    }
    if (type === "load") return;
    const t0 = performance.now();
    const out = await asr(audio, { chunk_length_s: 30 });
    self.postMessage({ type: "text", id, text: String(out?.text ?? "").trim(), ms: Math.round(performance.now() - t0) });
  } catch (err) {
    self.postMessage({ type: "error", id, error: String(err?.message ?? err) });
  }
};
