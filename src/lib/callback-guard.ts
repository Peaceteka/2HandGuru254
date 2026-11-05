import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { config } from "./config";
import { rateLimit, RateLimitError } from "./rate-limit";

const ACK = { ResultCode: 0, ResultDesc: "Accepted" };

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Shared handling for Daraja callbacks: secret token check, rate limit, always-ack response. */
export async function handleCallback(req: NextRequest, fn: (payload: unknown, ip: string) => Promise<unknown>) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const allowlist = (process.env.MPESA_CALLBACK_IP_ALLOWLIST || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (allowlist.length && !allowlist.includes(ip)) return NextResponse.json({ ResultCode: 1, ResultDesc: "Forbidden" }, { status: 403 });
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (config.mpesa.callbackSecret && !safeEqual(token, config.mpesa.callbackSecret)) {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Unauthorized" }, { status: 401 });
  }
  try {
    await rateLimit(`cb:${ip}`, 300, 60);
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ ResultCode: 1, ResultDesc: "Too many requests" }, { status: 429 });
    throw e;
  }
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid JSON" }, { status: 400 });
  }
  try {
    await fn(payload, ip);
  } catch (err) {
    // Raw payload is already logged; ack so Daraja doesn't hammer us, and investigate from the log.
    console.error("[mpesa-callback]", err);
  }
  return NextResponse.json(ACK);
}
