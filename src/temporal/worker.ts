// Run next to a local Temporal dev server:  temporal server start-dev  then  node src/temporal/worker.ts
import { Worker, NativeConnection } from "@temporalio/worker";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
if (existsSync(".env")) process.loadEnvFile(".env");
const activities = await import("./activities.ts");
const connection = await NativeConnection.connect({ address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233" });
const worker = await Worker.create({ connection, namespace: "default", taskQueue: "cubby-timers", workflowsPath: fileURLToPath(new URL("./workflows.ts", import.meta.url)), activities });
console.log("Cubby timer worker on task queue cubby-timers");
await worker.run();
