// Optional Sentry tracing. Spans carry model names, token counts and timings,
// never note text or child names. Without SENTRY_DSN everything here is a no-op.

type Sp = { setAttribute?: (k: string, v: unknown) => void } | undefined;
let Sentry: any = null;

export async function initTracing(): Promise<boolean> {
  if (!process.env.SENTRY_DSN) return false;
  try {
    Sentry = await import("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 1.0,
      sendDefaultPii: false,
      debug: process.env.SENTRY_DEBUG === "1",
      environment: process.env.RENDER ? "production" : "local",
      beforeSendTransaction(ev: any) { delete ev.request?.data; return ev; },
    });
    return true;
  } catch { Sentry = null; return false; }
}

export async function span<T>(op: string, name: string, attrs: Record<string, string | number>, fn: (s: Sp) => Promise<T>): Promise<T> {
  if (!Sentry) return fn(undefined);
  return Sentry.startSpan({ op, name, attributes: attrs }, (s: any) => fn(s));
}

export function traceId(): string | null {
  try { const sp = Sentry?.getActiveSpan?.(); return sp ? Sentry.spanToJSON(sp).trace_id ?? null : null; } catch { return null; }
}
