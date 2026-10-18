// Durable timers for the two things a provider can't afford to forget mid-afternoon:
// the next sleep check and a child still here at closing. Temporal keeps the timers,
// so they fire on time even if the Cubby server or the worker restarts.
import { proxyActivities, defineSignal, setHandler, condition } from "@temporalio/workflow";
import type * as acts from "./activities.ts";

const { remind } = proxyActivities<typeof acts>({ startToCloseTimeout: "30 seconds", retry: { maximumAttempts: 20 } });

export const checked = defineSignal<[number]>("checked");
export const woke = defineSignal("woke");
export const departed = defineSignal("departed");

export type NapArgs = { day: string; kid: string; name: string; startMs: number; everyMs: number };
export async function napWatch(a: NapArgs): Promise<number> {
  let last = a.startMs, awake = false, reminders = 0;
  setHandler(checked, (t: number) => { if (t > last) last = t; });
  setHandler(woke, () => { awake = true; });
  for (;;) {
    const due = last + a.everyMs;
    const seen = last;
    const moved = await condition(() => awake || last !== seen, Math.max(1, due - Date.now()));
    if (awake) return reminders;
    if (!moved) { reminders++; await remind({ kind: "sleep", day: a.day, kid: a.kid, name: a.name, dueMs: due }); last = due; }
  }
}

export type PickupArgs = { day: string; kid: string; name: string; closeMs: number };
export async function pickupWatch(a: PickupArgs): Promise<boolean> {
  let gone = false;
  setHandler(departed, () => { gone = true; });
  const left = await condition(() => gone, Math.max(1, a.closeMs - Date.now()));
  if (!left) await remind({ kind: "late", day: a.day, kid: a.kid, name: a.name, dueMs: a.closeMs });
  return left;
}
