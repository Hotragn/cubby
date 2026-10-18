// Voice notes: record with MediaRecorder, decode to 16 kHz mono, transcribe with
// Whisper inside a worker on this device (public/whisper-worker.js).

let worker = null, ready = false, seq = 0;
const waiters = new Map();
let onStatus = () => {};

function getWorker() {
  if (worker) return worker;
  worker = new Worker("/whisper-worker.js", { type: "module" });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "progress") onStatus({ s: "load", label: `Loading on-device speech model (about 40 MB, once) · ${m.pct}%` });
    if (m.type === "ready") { ready = true; onStatus(null); }
    if ((m.type === "text" || m.type === "error") && waiters.has(m.id)) { const w = waiters.get(m.id); waiters.delete(m.id); m.type === "text" ? w.ok(m.text) : w.no(new Error(m.error)); }
  };
  worker.onerror = (e) => { for (const w of waiters.values()) w.no(new Error("worker failed")); waiters.clear(); onStatus(null); };
  return worker;
}

export function warmUpWhisper(status) {
  onStatus = status ?? onStatus;
  if (!ready) { try { getWorker().postMessage({ type: "load" }); } catch {} }
}

export async function recordAudio() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? "";
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  mr.start();
  return {
    stop: () => new Promise((res) => { mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: mr.mimeType })); }; mr.state !== "inactive" ? mr.stop() : res(new Blob(chunks)); }),
  };
}

async function toPcm16k(blob) {
  const buf = await blob.arrayBuffer();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  const decoded = await ctx.decodeAudioData(buf);
  ctx.close?.();
  const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
  const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  return out.getChannelData(0);
}

export async function transcribe(blob, status) {
  onStatus = status ?? onStatus;
  const audio = await toPcm16k(blob);
  if (audio.length < 16000 * 0.4) throw new Error("too short");
  const id = ++seq;
  if (!ready) onStatus({ s: "load", label: "Loading on-device speech model (about 40 MB, once)…" });
  return await new Promise((ok, no) => { waiters.set(id, { ok, no }); getWorker().postMessage({ type: "run", audio, id }, [audio.buffer]); });
}

// What this browser can do. In-app browsers (WhatsApp, Instagram, some Brave
// setups) may hide the mic or block module workers; then the app is text-only.
// Test switches for the phone checklist: ?novoice=1 behaves like a browser with no
// microphone API; ?micdenied=1 behaves like a user who said "Don't allow".
const q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
if (q.get("micdenied") === "1" && typeof navigator !== "undefined" && navigator.mediaDevices) {
  navigator.mediaDevices.getUserMedia = () => Promise.reject(Object.assign(new Error("Permission denied"), { name: "NotAllowedError" }));
}

export function voiceSupport() {
  if (typeof window === "undefined") return { ok: false, why: "No browser." };
  if (q.get("novoice") === "1") return { ok: false, why: "This browser doesn't give apps the microphone (common in in-app browsers). Type the note, or open the page in Safari or Chrome." };
  if (!window.isSecureContext) return { ok: false, why: "Voice needs a secure (https) page. Type the note instead." };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, why: "This browser doesn't give apps the microphone (common in in-app browsers). Type the note, or open the page in Safari or Chrome." };
  if (!window.MediaRecorder) return { ok: false, why: "This browser can't record audio. Type the note, or open the page in Safari or Chrome." };
  if (!window.Worker || !(window.AudioContext || window.webkitAudioContext)) return { ok: false, why: "This browser can't run speech-to-text on the device. Type the note instead." };
  return { ok: true };
}
