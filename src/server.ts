// Cubby server. Stateless: it serves the app and passes notes to Gemma. It stores
// nothing about children. Day data lives in the provider's browser.

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createHash } from "node:crypto";

if (existsSync(".env")) process.loadEnvFile(".env");
const { initTracing, span } = await import("./trace.ts");
const tracing = await initTracing();
const { extract, warmSheet, newUsage, LOCAL, MODEL } = await import("./gemma.ts");

const PORT = +(process.env.PORT ?? 8787);
const ROOT = join(import.meta.dirname, "..", "public");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

// A small per-IP budget so the public demo key can't be drained.
const hits = new Map<string, number[]>();
function allow(ip: string, perMin = 20) {
  const now = Date.now(), list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= perMin) return false;
  list.push(now); hits.set(ip, list); return true;
}

async function body(req: any, max = 200_000): Promise<any> {
  let size = 0; const chunks: Buffer[] = [];
  for await (const c of req) { size += c.length; if (size > max) throw Object.assign(new Error("too large"), { status: 413 }); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
const send = (res: any, code: number, obj: unknown) => { res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };

const ttsCache = new Map<string, Buffer>();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
  try {
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, model: MODEL, local: LOCAL, tracing, voice: !!process.env.ELEVENLABS });

    if (url.pathname === "/api/extract" && req.method === "POST") {
      if (!allow(ip)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const b = await body(req);
      const notes = (Array.isArray(b.notes) ? b.notes : []).slice(0, 80).map((n: any) => ({ id: String(n.id).slice(0, 12), t: String(n.t).slice(0, 8), text: String(n.text).slice(0, 600) }));
      const roster = (b.roster ?? []).slice(0, 16).map((r: any) => ({ name: String(r.name).slice(0, 40) }));
      const staff = (b.staff ?? []).slice(0, 6).map((r: any) => ({ name: String(r.name).slice(0, 40) }));
      const usage = newUsage(); const t0 = Date.now();
      const out = await span("cubby.extract", "extract notes", { "cubby.notes": notes.length }, () => extract(notes, roster, staff, usage));
      return send(res, 200, { notes: out, usage: { ...usage, wallMs: Date.now() - t0 } });
    }

    if (url.pathname === "/api/sheet" && req.method === "POST") {
      if (!allow(ip)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const b = await body(req, 20_000);
      const facts = (b.facts ?? []).slice(0, 40).map((f: any) => String(f).slice(0, 200));
      const lang = ["English", "Spanish", "Portuguese", "Haitian Creole", "Vietnamese", "Chinese (Simplified)", "Arabic", "French"].includes(b.lang) ? b.lang : "English";
      const usage = newUsage();
      const text = await warmSheet(String(b.child ?? "your child").slice(0, 40), facts, lang, usage);
      return send(res, 200, { text, usage });
    }

    // ElevenLabs reads the finished, checked sheet aloud for a parent.
    if (url.pathname === "/api/speak" && req.method === "POST") {
      if (!process.env.ELEVENLABS) return send(res, 503, { error: "Voice is off on this server." });
      if (!allow(ip, 6)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const b = await body(req, 8_000);
      const text = String(b.text ?? "").slice(0, 900);
      const k = createHash("sha256").update(text).digest("hex");
      let audio = ttsCache.get(k);
      if (!audio) {
        const voice = process.env.ELEVENLABS_VOICE ?? "EXAVITQu4vr4xnSDxMaL";
        const r = await span("cubby.tts", "elevenlabs tts", { "cubby.chars": text.length }, () => fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
          method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS!, "content-type": "application/json", accept: "audio/mpeg" },
          body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }), signal: AbortSignal.timeout(30_000),
        }));
        if (!r.ok) return send(res, 502, { error: `Voice service said ${r.status}` });
        audio = Buffer.from(await r.arrayBuffer());
        if (ttsCache.size > 200) ttsCache.clear();
        ttsCache.set(k, audio);
      }
      res.writeHead(200, { "content-type": "audio/mpeg", "content-length": audio.length, "cache-control": "no-store" });
      return res.end(audio);
    }

    // Static files.
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (p === "/" || p === "") p = "/index.html";
    const file = join(ROOT, p);
    if (!file.startsWith(ROOT)) return send(res, 403, { error: "no" });
    const s = await stat(file).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); return res.end("Not found"); }
    const ext = extname(file);
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": ext === ".html" ? "no-cache" : "public, max-age=300" });
    res.end(await readFile(file));
  } catch (e: any) {
    if (tracing) { const S: any = await import("@sentry/node"); S.captureException(e); }
    send(res, e?.status ?? 500, { error: e?.status === 413 ? "Too much text." : "Something went wrong. Your notes are still on your phone." });
  }
});

server.listen(PORT, () => console.log(`Cubby on http://localhost:${PORT} · ${LOCAL ? "local Ollama" : "AI Studio"} ${MODEL} · tracing ${tracing ? "on" : "off"}`));
