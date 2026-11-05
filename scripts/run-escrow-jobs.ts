/**
 * Runs the escrow scheduler once (auto-release, unpaid-order expiry, payout resend).
 * Usage: npm run escrow:run   — schedule every 5 minutes via cron, or call POST /api/cron/escrow.
 */
import { runEscrowJobs } from "@/lib/escrow";
import { db } from "@/lib/db";

runEscrowJobs()
  .then((s) => console.log(JSON.stringify({ ok: true, ...s })))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
