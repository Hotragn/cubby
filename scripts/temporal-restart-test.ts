// Measures that Cubby's sleep-check timer survives a worker crash.
// Needs: temporal server start-dev (localhost:7233). Starts its own reminder receiver and worker.
// A nap timer is set to 20 s; the worker is killed at 5 s and restarted at 12 s.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { Client, Connection } from "@temporalio/client";

const PORT = 8799, got: any[] = [];
const srv = createServer((req, res) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => { got.push({ ...JSON.parse(b || "{}"), atMs: Date.now() }); res.end("{}"); }); }).listen(PORT);
const startWorker = () => spawn(process.execPath, ["src/temporal/worker.ts"], { env: { ...process.env, CUBBY_URL: `http://localhost:${PORT}` }, stdio: "ignore" });
let w = startWorker();
await new Promise((r) => setTimeout(r, 4000)); // worker boot (bundles the workflow)
const c = new Client({ connection: await Connection.connect({ address: "localhost:7233" }) });
const t0 = Date.now(), every = 20_000;
await c.workflow.start("napWatch", { taskQueue: "cubby-timers", workflowId: `restart-test-${t0}`, args: [{ day: "test", kid: "test", name: "Test child", startMs: t0, everyMs: every }] });
await new Promise((r) => setTimeout(r, 5000)); w.kill("SIGKILL"); const killedAt = Date.now() - t0;
await new Promise((r) => setTimeout(r, 7000)); w = startWorker(); const restartedAt = Date.now() - t0;
for (let i = 0; i < 40 && !got.length; i++) await new Promise((r) => setTimeout(r, 500));
const firstAt = got.length ? got[0].atMs - t0 : null;
await c.workflow.getHandle(`restart-test-${t0}`).signal("woke");
const result = { timerMs: every, workerKilledAtMs: killedAt, workerRestartedAtMs: restartedAt, reminderAtMs: firstAt, lateByMs: firstAt == null ? null : firstAt - every };
console.log(JSON.stringify(result));
w.kill(); srv.close(); process.exit(0);
