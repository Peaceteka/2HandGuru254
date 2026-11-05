import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function SellerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireApprovedSeller();
  const toDispatch = await db.order.count({ where: { sellerId: user.id, status: "PAID_HELD" } });
  return (
    <DashboardShell
      title="Seller dashboard"
      nav={[
        { href: "/seller", label: "Overview", exact: true },
        { href: "/seller/listings", label: "Listings" },
        { href: "/seller/orders", label: "Orders", badge: toDispatch },
        { href: "/seller/payouts", label: "Payouts" },
        { href: "/seller/settings", label: "Profile & payouts" },
        { href: "/account/orders", label: "My purchases" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
