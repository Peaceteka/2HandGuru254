import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account/orders");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  return (
    <DashboardShell
      title="My account"
      nav={[
        { href: "/account/orders", label: "My orders" },
        { href: "/account/saved", label: "Saved items" },
        { href: "/account/notifications", label: "Notifications", badge: unread },
        { href: "/account/settings", label: "Settings" },
      ]}
    >
      {children}
    </DashboardShell>
  );
}
