import { NextResponse, type NextRequest } from "next/server";
import { config } from "@/lib/config";
import { runEscrowJobs } from "@/lib/escrow";

export const dynamic = "force-dynamic";

/** Scheduled job endpoint: auto-release, expire unpaid orders, resend unsent payouts. */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!config.cronSecret || auth !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await runEscrowJobs();
  return NextResponse.json({ ok: true, ...summary });
}
