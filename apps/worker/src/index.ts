import "dotenv/config";
import { closeDb } from "@market-radar-pl/db";
import { registerAdapter } from "./adapters/base.js";
import { olxAdapter }     from "./adapters/olx.js";
import { manualAdapter }  from "./adapters/manual.js";
import { runOnce }        from "./scheduler.js";

registerAdapter(olxAdapter);
registerAdapter(manualAdapter);

const INTERVAL_MS = parseInt(process.env["WORKER_INTERVAL_MS"] ?? "900000", 10);

async function main(): Promise<void> {
  console.log(`[worker] Starting market-radar-pl worker (interval: ${INTERVAL_MS}ms)`);

  // Run immediately on startup, then on interval
  await runOnce();

  const timer = setInterval(async () => {
    try {
      await runOnce();
    } catch (err) {
      console.error("[worker] Unhandled error in runOnce:", err);
    }
  }, INTERVAL_MS);

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[worker] Received ${signal}, shutting down...`);
    clearInterval(timer);
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT",  () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
