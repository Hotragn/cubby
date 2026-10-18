// Gemma reads a provider's quick notes and writes events. It copies, it never judges:
// no safety calls, no guessed times, no guessed doses. Unclear → a question.

import { createHash } from "node:crypto";
import { span } from "./trace.ts";

export const LOCAL = process.env.GEMMA_LOCAL === "1";
export const MODEL = LOCAL ? (process.env.OLLAMA_MODEL ?? "gemma4:e4b-it-q4_K_M") : (process.env.GEMMA_MODEL ?? "gemma-4-26b-a4b-it");
const FALLBACK = process.env.GEMMA_FALLBACK ?? "gemma-4-31b-it";
const OLLAMA = process.env.OLLAMA_URL ?? "http://localhost:11434";

export type Usage = { calls: number; inTokens: number; outTokens: number; ms: number; cached: number; retries: number; model: string };
export const newUsage = (): Usage => ({ calls: 0, inTokens: 0, outTokens: 0, ms: 0, cached: 0, retries: 0, model: MODEL });

export const EXTRACT_RULES = `You turn a home daycare provider's quick notes into events. You are a careful clerk, not a judge.
NEVER decide if something is safe, allowed or a problem. NEVER guess a time, a dose, a name or an amount that the note does not say.
If something is unclear (which child, what time, how much), leave the field null and add a short question.

Each note has an id like [N3] and the clock time it was logged. Return JSON:
{"notes":[{"id":"N3","events":[...],"questions":[{"quote":"...","ask":"..."}]}]}

Event fields (omit what the note doesn't say):
- "type": one of arrive, depart, staff_in, staff_out, meal, bottle, nap, sleep_check, diaper, incident, med, mood, activity, note
- "kids": the children's names exactly as on the roster, e.g. ["Ava","Leo"]. One note can be about several children. Use ["all"] only if the note says all/everyone.
- "quote": the exact words from the note this event comes from (copy them, do not reword)
- "time": the clock time the note states for this event, like "9:40" or "2:15pm". Use "now" if the note says now/just. Otherwise null.
- nap: "start" and "end" instead of "time" ("napped 1:10 to 2:40" -> start "1:10", end "2:40"; "down for nap at 12:30" -> start "12:30", end null; "woke up at 2" -> a nap event with end "2:00" and start null)
- meal: "food", "meal" (breakfast/lunch/snack/dinner), "amount" one of all, most, half, some, little, none ("ate all her pasta" -> all; "picked at" -> little; "a few bites" -> little)
- bottle: "oz" (number), "food" (formula/breast milk/milk)
- diaper: "kind" one of wet, bm, dry, wet+bm; "toilet": true if it was the potty/toilet
- sleep_check: a check on a sleeping child; "by" (who checked), "position" if said (back/side/tummy)
- incident: any bump, fall, bite, scratch, injury, or accident; "what" (what happened), "body" (body part), "action" (first aid given), "by" (who saw/helped)
- med: "med" (medicine name), "dose" (amount as written, e.g. "5 ml"), "by" (who gave it)
- arrive / depart: "by" (who dropped off / picked up, in the note's words, e.g. "mom", "Hana", "his grandma Ingrid")
- staff_in / staff_out: "staff" (the adult's name) instead of "kids"
- mood: "mood" in a few words; activity: "what"; note: "what" for anything else worth keeping
Clock times: write them as the note does. Do not convert or add am/pm.
Keep every field flat on the event object, for example:
{"type":"nap","kids":["Ava","Leo"],"quote":"Ava and Leo napped 1:10 to 2:40","start":"1:10","end":"2:40"}
{"type":"incident","kids":["Theo"],"quote":"...","time":null,"what":"bumped forehead on table","body":"forehead","action":"ice pack","by":"Dana"}
"Mila up 10:25" or "Theo awake at 2:20" (a child waking) -> {"type":"nap","kids":["Mila"],"start":null,"end":"10:25"}
"Ava and Leo napped 1:10 to 2:40" is ONE nap event with kids ["Ava","Leo"].
"Checked Mila 1:15, 1:30 back" is TWO sleep_check events (1:15 and 1:30), position back.`;

const cache = new Map<string, unknown>();
const key = (s: string) => createHash("sha256").update(MODEL + s).digest("hex");

async function callLocal(prompt: string, usage: Usage): Promise<string> {
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(600_000),
    body: JSON.stringify({ model: MODEL, stream: false, format: "json", think: false, options: { temperature: 0, num_ctx: 8192 }, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw Object.assign(new Error(`Ollama HTTP ${res.status}`), { status: res.status });
  const j: any = await res.json();
  usage.inTokens += j.prompt_eval_count ?? 0; usage.outTokens += j.eval_count ?? 0;
  return j.message?.content ?? "";
}

const parseJson = (t: string) => JSON.parse(t.trim().replace(/^```(?:json)?/, "").replace(/```$/, "").trim());

export async function callGemma(prompt: string, usage: Usage, label: string, opts: { json?: boolean; model?: string } = {}): Promise<any> {
  const json = opts.json ?? true;
  const k = key((opts.model ?? "") + prompt);
  if (cache.has(k)) { usage.cached++; return cache.get(k); }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !LOCAL) throw new Error("GEMINI_API_KEY is not set");
  const gen: any = { thinkingConfig: { thinkingLevel: "minimal" }, temperature: 0, maxOutputTokens: 8192 };
  if (json) gen.responseMimeType = "application/json";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    const t0 = Date.now();
    const model = opts.model ?? (!LOCAL && attempt >= 2 && attempt % 2 === 0 ? FALLBACK : MODEL);
    try {
      const out = await span("gen_ai.chat", `chat ${model}`, { "gen_ai.request.model": model, "gen_ai.system": LOCAL ? "ollama" : "google_ai_studio", "cubby.task": label, "cubby.attempt": attempt }, async (sp) => {
        if (LOCAL) { const t = await callLocal(prompt, usage); return json ? parseJson(t) : t.trim(); }
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST", headers: { "x-goog-api-key": apiKey!, "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: gen }), signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) {
          const err: any = await res.json().catch(() => ({}));
          const delay = err?.error?.details?.find((d: any) => d.retryDelay)?.retryDelay;
          throw Object.assign(new Error(`Gemma HTTP ${res.status}`), { status: res.status, retryMs: delay ? parseFloat(delay) * 1000 : undefined });
        }
        const j: any = await res.json();
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        const txt = parts.filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("");
        const u = j.usageMetadata ?? {};
        usage.inTokens += u.promptTokenCount ?? 0; usage.outTokens += (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
        sp?.setAttribute?.("gen_ai.usage.input_tokens", u.promptTokenCount ?? 0);
        sp?.setAttribute?.("gen_ai.usage.output_tokens", u.candidatesTokenCount ?? 0);
        return json ? parseJson(txt) : txt.trim();
      });
      usage.calls++; usage.ms += Date.now() - t0;
      cache.set(k, out);
      return out;
    } catch (e: any) {
      lastErr = e; usage.retries++;
      if (process.env.DEBUG_RAW) console.error(`[err ${label} attempt ${attempt}]`, e?.status ?? "", String(e?.message ?? e).slice(0, 200));
      const wait = e?.status === 429 ? Math.min(e.retryMs ?? 6000 * (attempt + 1), 20_000) : 800 * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

export type Note = { id: string; t: string; text: string };
export type Person = { name: string; ageMonths?: number | null };

// Notes go in batches so a long day stays fast and one bad answer only costs a few notes.
export async function extract(notes: Note[], roster: Person[], staff: Person[], usage: Usage, batch = 12, aliases: Record<string, string> = {}) {
  const out: Record<string, any> = {};
  const chunks: Note[][] = [];
  for (let i = 0; i < notes.length; i += batch) chunks.push(notes.slice(i, i + batch));
  await Promise.all(chunks.map(async (chunk, ci) => {
    const prompt = `${EXTRACT_RULES}

Children on today's roster: ${roster.map((r) => r.name).join(", ")}
Adults (staff): ${staff.map((s) => s.name).join(", ")}${Object.keys(aliases).length ? `\nNicknames the provider confirmed today: ${Object.entries(aliases).map(([a, n]) => `"${a}" = ${n}`).join("; ")}` : ""}

Notes:
${chunk.map((n) => `[${n.id}] (logged ${n.t}) ${n.text}`).join("\n")}`;
    try {
      const r = await callGemma(prompt, usage, `extract ${ci}`);
      // Gemma sometimes returns the list itself instead of {notes: [...]}; both are fine.
      const list = Array.isArray(r) ? r : Array.isArray(r?.notes) ? r.notes : [];
      for (const n of list) if (n?.id) out[n.id] = n;
    } catch (e) {
      for (const n of chunk) out[n.id] = { id: n.id, events: [], questions: [{ quote: n.text, ask: "The reader couldn't process this note. Please check it by hand." }], failed: true };
    }
  }));
  return out;
}

// Parent sheet in warm words. Gemma only sees the facts code already checked, and its
// text is checked again before anyone sees it (see public/lib/sheet.js).
export async function warmSheet(child: string, facts: string[], lang: string, usage: Usage): Promise<string> {
  const prompt = `Write a short, warm daily note from a home daycare provider to ${child}'s parent, in ${lang}.
Use ONLY these facts. Do not add foods, times, amounts, feelings, health details or events that are not listed. Do not soften, exaggerate or judge anything. Do not mention injuries, incidents or medicine at all (they are sent separately). Do not give advice.
Keep every time and number exactly as written. 3 to 5 sentences, plain words, no emojis, no greeting line, no sign-off.
Facts:
${facts.map((f) => `- ${f}`).join("\n")}`;
  return await callGemma(prompt, usage, `sheet ${lang}`, { json: false });
}
