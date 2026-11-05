import type { NextRequest } from "next/server";
import { handleCallback } from "@/lib/callback-guard";
import { handleB2CResult } from "@/lib/escrow";
import type { B2CResultPayload } from "@/lib/mpesa";

export async function POST(req: NextRequest) {
  return handleCallback(req, (p, ip) => handleB2CResult(p as B2CResultPayload, ip));
}
