import type { NextRequest } from "next/server";
import { handleCallback } from "@/lib/callback-guard";
import { handleB2CTimeout } from "@/lib/escrow";

export async function POST(req: NextRequest) {
  return handleCallback(req, (p, ip) => handleB2CTimeout(p, ip));
}
