import type { NextRequest } from "next/server";
import { handleCallback } from "@/lib/callback-guard";
import { handleStkCallback } from "@/lib/escrow";
import type { StkCallbackPayload } from "@/lib/mpesa";

export async function POST(req: NextRequest) {
  return handleCallback(req, (p, ip) => handleStkCallback(p as StkCallbackPayload, ip));
}
