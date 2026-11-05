import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { sellerStats } from "@/lib/seller-stats";
import { formatDate, formatKES } from "@/lib/format";
import { PageHeader, StatCard, EmptyState } from "@/components/dashboard-shell";
import { OrderList } from "@/components/order-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Seller dashboard" };

export default async function SellerOverview() {
  const user = await requireApprovedSeller();
  const [stats, toDispatch, recent] = await Promise.all([
    sellerStats(user.id),
    db.order.findMany({ where: { sellerId: user.id, status: "PAID_HELD" }, orderBy: { dispatchDeadline: "asc" }, include: { listing: { select: { title: true } } } }),
    db.order.findMany({
      where: { sellerId: user.id, status: { not: "PENDING_PAYMENT" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { listing: { select: { title: true, images: { select: { key: true }, orderBy: { position: "asc" }, take: 1 } } } },
    }),
  ]);
  return (
    <>
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description="Here's how your shop is doing." action={<Button asChild><Link href="/seller/listings/new">New listing</Link></Button>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active listings" value={stats.active} href="/seller/listings" />
        <StatCard label="Pending orders" value={stats.pending} hint="Paid or in transit" href="/seller/orders" />
        <StatCard label="Held in escrow" value={formatKES(stats.held)} hint="After platform fee" />
        <StatCard label="Released to you" value={formatKES(stats.released)} href="/seller/payouts" />
      </div>
      {toDispatch.length > 0 && (
        <section className="mt-6 rounded-xl border border-brand-yellow bg-brand-yellow/10 p-5" aria-labelledby="dispatch-h">
          <h2 id="dispatch-h" className="font-semibold">Ready to dispatch ({toDispatch.length})</h2>
          <p className="text-sm text-neutral-700">Payment is held. Dispatch before the deadline or the buyer can cancel and be refunded.</p>
          <ul className="mt-3 space-y-2">
            {toDispatch.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
                <span className="min-w-0"><span className="font-medium">{o.listing.title}</span> <span className="text-xs text-muted-foreground">· due {o.dispatchDeadline ? formatDate(o.dispatchDeadline, true) : "—"}</span></span>
                <Button asChild size="sm"><Link href={`/seller/orders/${o.id}`}>Dispatch</Link></Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 className="mt-8 mb-3 font-semibold">Recent orders</h2>
      {recent.length ? <OrderList orders={recent} hrefBase="/seller/orders" /> : <EmptyState title="No orders yet" description="Orders on your listings will show up here." />}
    </>
  );
}
