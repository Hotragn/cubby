// The one side effect: tell the Cubby server a reminder is due. The app polls for it.
export async function remind(r: { kind: string; day: string; kid: string; name: string; dueMs: number }): Promise<void> {
  const url = process.env.CUBBY_URL ?? "http://localhost:8787";
  const res = await fetch(`${url}/api/reminders/push`, { method: "POST", headers: { "content-type": "application/json", "x-cubby-worker": process.env.WORKER_SECRET ?? "local" }, body: JSON.stringify({ ...r, firedMs: Date.now() }) });
  if (!res.ok) throw new Error(`Cubby server said ${res.status}`);
}
