import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock, XCircle, CheckCircle2 } from "lucide-react";
import { requireUser, isApprovedSeller } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seller application status" };

export default async function PendingPage() {
  const user = await requireUser("/sell/pending");
  const p = user.sellerProfile;
  if (!p) redirect("/sell/apply");
  const approved = isApprovedSeller(user);

  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto max-w-lg rounded-xl border bg-white p-6 text-center sm:p-10">
        {approved ? (
          <>
            <CheckCircle2 className="mx-auto size-12 text-emerald-600" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">You&apos;re a verified seller</h1>
            <p className="mt-2 text-neutral-600">Your application was approved. Start listing items now.</p>
            <Button asChild className="mt-6"><Link href="/seller">Go to seller dashboard</Link></Button>
          </>
        ) : p.status === "REJECTED" ? (
          <>
            <XCircle className="mx-auto size-12 text-red-600" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">Application not approved</h1>
            {p.rejectionReason && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Reason: {p.rejectionReason}</p>}
            <p className="mt-3 text-neutral-600">You can correct your details and apply again.</p>
            <Button asChild className="mt-6"><Link href="/sell/apply">Update and re-apply</Link></Button>
          </>
        ) : (
          <>
            <Clock className="mx-auto size-12 text-brand-blue" aria-hidden />
            <h1 className="mt-4 text-2xl font-semibold">Pending approval</h1>
            <p className="mt-2 text-neutral-600">
              Thanks, {p.fullName.split(" ")[0]}. We received your application on {formatDate(p.createdAt)} and are verifying your ID.
              You&apos;ll get an email, SMS and in-app notification once it&apos;s reviewed.
            </p>
            <p className="mt-4 text-sm text-neutral-600">You can&apos;t post listings until you&apos;re approved — but you can still shop safely in the meantime.</p>
            <Button asChild variant="outline" className="mt-6"><Link href="/listings">Browse listings</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
