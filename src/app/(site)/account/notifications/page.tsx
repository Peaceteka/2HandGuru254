import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { timeAgo } from "@/lib/format";
import { markNotificationsReadAction } from "@/server/auth-actions";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/account/notifications");
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = items.some((n) => !n.readAt);
  return (
    <>
      <PageHeader
        title="Notifications"
        action={unread ? <form action={markNotificationsReadAction}><Button variant="outline" size="sm" type="submit">Mark all as read</Button></form> : undefined}
      />
      {items.length ? (
        <ul className="divide-y rounded-xl border bg-white">
          {items.map((n) => {
            const body = (
              <div className="flex gap-3 p-4">
                <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand-blue"}`} />
                <div className="min-w-0">
                  <p className="font-medium">{n.title}{!n.readAt && <span className="sr-only"> (unread)</span>}</p>
                  <p className="text-sm text-neutral-600">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-neutral-50">{body}</Link> : body}</li>;
          })}
        </ul>
      ) : (
        <EmptyState title="You're all caught up" description="Updates about your orders and account will appear here." />
      )}
    </>
  );
}
