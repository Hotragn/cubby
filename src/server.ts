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
const BOOT = Date.now().toString(36);
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

// Temporal (optional, local): durable sleep-check and late-pickup timers. Off unless TEMPORAL_ADDRESS is set.
// TIMER_SCALE speeds timers up for a demo (60 = a minute becomes a second); 1 in real use.
const SCALE = Math.max(1, +(process.env.TIMER_SCALE ?? 1));
let temporal: any = null;
async function tclient() {
  if (temporal || !process.env.TEMPORAL_ADDRESS) return temporal;
  const { Client, Connection } = await import("@temporalio/client");
  temporal = new Client({ connection: await Connection.connect({ address: process.env.TEMPORAL_ADDRESS }), namespace: "default" });
  return temporal;
}
const reminders: any[] = [];

// MongoDB holds one thing: anonymous tester feedback from /feedback.html. Never child data.
let feedbackCol: any = null;
async function feedback() {
  if (feedbackCol || !process.env.MONGODB_URI) return feedbackCol;
  const { MongoClient } = await import("mongodb");
  const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  feedbackCol = client.db("cubby").collection("feedback");
  return feedbackCol;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const ip = String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();
  try {
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, model: MODEL, local: LOCAL, tracing, voice: !!process.env.ELEVENLABS, timers: !!process.env.TEMPORAL_ADDRESS, timerScale: SCALE });

    if (url.pathname === "/api/extract" && req.method === "POST") {
      if (!allow(ip)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const b = await body(req);
      const notes = (Array.isArray(b.notes) ? b.notes : []).slice(0, 120).map((n: any) => ({ id: String(n.id).slice(0, 12), t: String(n.t).slice(0, 8), text: String(n.text).slice(0, 600) }));
      const roster = (b.roster ?? []).slice(0, 16).map((r: any) => ({ name: String(r.name).slice(0, 40) }));
      const staff = (b.staff ?? []).slice(0, 6).map((r: any) => ({ name: String(r.name).slice(0, 40) }));
      const usage = newUsage(); const t0 = Date.now();
      const aliases: Record<string, string> = {};
      for (const [k, v] of Object.entries(b.aliases ?? {}).slice(0, 20)) aliases[String(k).slice(0, 30)] = String(v).slice(0, 40);
      const out = await span("cubby.extract", "extract notes", { "cubby.notes": notes.length }, () => extract(notes, roster, staff, usage, 12, aliases));
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

    if (url.pathname === "/api/timers" && req.method === "POST") {
      const c = await tclient().catch(() => null);
      if (!c) return send(res, 503, { error: "Timers are off on this server." });
      const b = await body(req, 20_000);
      const now = Date.now(), day = String(b.day).slice(0, 10), out: string[] = [];
      // Wall-clock times from the app, compressed toward "now" when TIMER_SCALE > 1 (demo only).
      const scaled = (ms: number) => now + (ms - now) / SCALE;
      for (const t of (b.timers ?? []).slice(0, 40)) {
        const kid = String(t.kid).slice(0, 40), name = String(t.name ?? "").slice(0, 40);
        try {
          if (t.kind === "nap") { const id = `nap-${day}-${kid}-${t.startMs}`; await c.workflow.start("napWatch", { taskQueue: "cubby-timers", workflowId: id, args: [{ day, kid, name, startMs: scaled(+t.startMs), everyMs: (+t.everyMin * 60000) / SCALE }] }); out.push(id); }
          if (t.kind === "check") { await c.workflow.getHandle(`nap-${day}-${kid}-${t.napStartMs}`).signal("checked", scaled(+t.atMs)); out.push("check"); }
          if (t.kind === "wake") { await c.workflow.getHandle(`nap-${day}-${kid}-${t.napStartMs}`).signal("woke"); out.push("wake"); }
          if (t.kind === "arrive") { const id = `pickup-${day}-${kid}`; await c.workflow.start("pickupWatch", { taskQueue: "cubby-timers", workflowId: id, args: [{ day, kid, name, closeMs: scaled(+t.closeMs) }] }); out.push(id); }
          if (t.kind === "depart") { await c.workflow.getHandle(`pickup-${day}-${kid}`).signal("departed"); out.push("depart"); }
        } catch (e: any) { out.push(`skip ${t.kind}: ${String(e?.message ?? e).slice(0, 60)}`); }
      }
      return send(res, 200, { ok: true, out, scale: SCALE });
    }
    if (url.pathname === "/api/reminders/push" && req.method === "POST") {
      if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(req.socket.remoteAddress))) return send(res, 403, { error: "local only" });
      const b = await body(req, 4_000); reminders.push({ ...b, id: reminders.length + 1, gotMs: Date.now() }); if (reminders.length > 500) reminders.shift();
      return send(res, 200, { ok: true });
    }
    if (url.pathname === "/api/reminders") return send(res, 200, { reminders: reminders.filter((r) => r.id > +(url.searchParams.get("after") ?? 0)) });

    if (url.pathname === "/api/feedback" && req.method === "POST") {
      if (!allow(ip, 5)) return send(res, 429, { error: "Too many requests. Wait a minute." });
      const b = await body(req, 6_000);
      const pickS = (v: any, n = 400) => String(v ?? "").slice(0, n);
      const doc = { at: new Date(), role: pickS(b.role, 40), state: pickS(b.state, 30), understood: pickS(b.understood, 40), flagsHelp: Math.max(0, Math.min(5, +b.flagsHelp || 0)), wouldPay: pickS(b.wouldPay, 40), sheetTone: pickS(b.sheetTone, 40), missing: pickS(b.missing, 1200), build: BOOT };
      const col = await feedback().catch(() => null);
      if (!col) return send(res, 503, { error: "Feedback storage is off right now." });
      await col.insertOne(doc);
      return send(res, 200, { ok: true });
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
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": p.startsWith("/build/chunk-") || p.includes("autotable") || p.includes("html2canvas") ? "public, max-age=86400" : "no-cache" });
    // index.html: stamp asset URLs with the boot time so a new deploy is never served stale.
    if (p === "/index.html") return res.end(String(await readFile(file)).replace(/(\/(?:build\/main|styles)\.(?:js|css))"/g, `$1?v=${BOOT}"`));
    res.end(await readFile(file));
  } catch (e: any) {
    if (tracing) { const S: any = await import("@sentry/node"); S.captureException(e); }
    send(res, e?.status ?? 500, { error: e?.status === 413 ? "Too much text." : "Something went wrong. Your notes are still on your phone." });
  }
});

server.listen(PORT, () => console.log(`Cubby on http://localhost:${PORT} · ${LOCAL ? "local Ollama" : "AI Studio"} ${MODEL} · tracing ${tracing ? "on" : "off"}`));
