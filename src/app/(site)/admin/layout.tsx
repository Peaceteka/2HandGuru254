import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [apps, disputes] = await Promise.all([db.sellerProfile.count({ where: { status: "PENDING" } }), db.dispute.count({ where: { status: "OPEN" } })]);
  return (
    <DashboardShell
      title="Admin"
      nav={[
        { href: "/admin", label: "Dashboard", exact: true },
        { href: "/admin/applications", label: "Seller applications", badge: apps },
        { href: "/admin/users", label: "Users" },
        { href: "/admin/listings", label: "Listings" },
        { href: "/admin/categories", label: "Categories" },
        { href: "/admin/orders", label: "Orders & escrow" },
        { href: "/admin/disputes", label: "Disputes", badge: disputes },
        { href: "/admin/audit", label: "Audit log" },
        { href: "/admin/settings", label: "Settings" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
