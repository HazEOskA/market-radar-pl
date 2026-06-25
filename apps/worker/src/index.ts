import "dotenv/config";
import { closeDb } from "@market-radar-pl/db";
import { registerAdapter } from "./adapters/base.js";
import { olxAdapter }     from "./adapters/olx.js";
import { manualAdapter }  from "./adapters/manual.js";
import { runOnce }        from "./scheduler.js";

// The manual adapter is always registered (used as the generic fallback).
registerAdapter(manualAdapter);

// Source-specific adapters are opt-in via env flags.
// Set OLX_ENABLED=true to activate the OLX adapter.
if (process.env["OLX_ENABLED"] === "true") {
  registerAdapter(olxAdapter);
  console.log("[worker] OLX adapter enabled");
}
// ALLEGRO_ENABLED placeholder — adapter not yet implemented.
if (process.env["ALLEGRO_ENABLED"] === "true") {
  console.warn("[worker] ALLEGRO_ENABLED=true but no Allegro adapter is registered yet");
}

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
