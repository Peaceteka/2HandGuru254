import type { Metadata } from "next";
import Link from "next/link";
import { requireApprovedSeller } from "@/lib/session";
import { displayPhone } from "@/lib/phone";
import { PageHeader } from "@/components/dashboard-shell";
import { SellerSettingsForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/password-forms";
import { VerifiedBadge } from "@/components/badges";

export const metadata: Metadata = { title: "Profile & payouts" };

export default async function SellerSettings() {
  const user = await requireApprovedSeller();
  const p = user.sellerProfile!;
  return (
    <>
      <PageHeader title="Profile & payouts" description={<span className="inline-flex flex-wrap items-center gap-2"><VerifiedBadge /> <Link href={`/sellers/${user.id}`} className="text-brand-blue hover:underline">View public profile</Link></span>} />
      <section className="rounded-xl border bg-white p-5">
        <SellerSettingsForm
          user={{ ...user, phone: displayPhone(user.phone), mpesaPayoutPhone: displayPhone(user.mpesaPayoutPhone ?? user.phone) }}
          profile={{ businessName: p.businessName, description: p.description }}
        />
      </section>
      <section className="mt-4 rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Password</h2><ChangePasswordForm /></section>
    </>
  );
}
