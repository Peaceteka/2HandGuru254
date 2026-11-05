import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { AuthCard } from "@/components/auth-card";
import { SellerApplicationForm } from "@/components/seller-application-form";

export const metadata: Metadata = { title: "Apply to sell" };

export default async function ApplyPage() {
  const user = await requireUser("/sell/apply");
  if (user.role === "ADMIN") redirect("/admin");
  const p = user.sellerProfile;
  if (p?.status === "PENDING" || p?.status === "APPROVED") redirect("/sell/pending");
  return (
    <AuthCard
      wide
      title="Apply to become a verified seller"
      subtitle="We verify every seller's identity so buyers can trust the marketplace. Reviews usually take less than one business day."
    >
      <SellerApplicationForm
        defaults={{
          fullName: p?.fullName ?? user.name,
          phone: p?.phone ?? user.phone,
          idNumber: p?.idNumber,
          businessName: p?.businessName,
          county: p?.county ?? user.county,
          town: p?.town,
          description: p?.description,
        }}
      />
    </AuthCard>
  );
}
