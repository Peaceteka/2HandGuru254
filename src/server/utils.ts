import "server-only";
import { unstable_rethrow } from "next/navigation";
import { EscrowError } from "@/lib/escrow";
import { RateLimitError } from "@/lib/rate-limit";
import { UploadError } from "@/lib/storage";
import type { ActionResult } from "@/lib/validators";

/** Converts known domain errors into form-friendly results; lets redirects/notFound propagate. */
export async function safeAction(fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof EscrowError || err instanceof RateLimitError || err instanceof UploadError) return { error: err.message };
    console.error("[action]", err);
    return { error: "Something went wrong. Please try again." };
  }
}
