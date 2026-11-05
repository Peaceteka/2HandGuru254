import { ShieldCheck } from "lucide-react";
import Link from "next/link";

export function BuyerProtection({ autoReleaseDays, dispatchHours }: { autoReleaseDays: number; dispatchHours: number }) {
  return (
    <section aria-labelledby="bp-h" className="rounded-xl border border-brand-blue/30 bg-brand-blue-soft p-4">
      <h2 id="bp-h" className="flex items-center gap-2 font-semibold text-brand-black">
        <ShieldCheck className="size-5 text-brand-blue" aria-hidden /> Buyer protection
      </h2>
      <ol className="mt-3 space-y-2 text-sm text-neutral-700">
        <li><strong>1. Pay with M-Pesa.</strong> Your money goes to 2ndHandGuru escrow — not to the seller.</li>
        <li><strong>2. Seller dispatches</strong> within {dispatchHours} hours, or you can cancel for a full refund.</li>
        <li><strong>3. Check the item.</strong> Confirm receipt to release payment, or raise a dispute and we&apos;ll step in.</li>
      </ol>
      <p className="mt-3 text-xs text-neutral-600">
        If you don&apos;t confirm or dispute within {autoReleaseDays} days of dispatch, payment is released automatically.{" "}
        <Link href="/how-escrow-works" className="font-medium text-brand-blue hover:underline">How escrow works</Link>
      </p>
    </section>
  );
}
