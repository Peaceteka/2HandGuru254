import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { loadOrderDetail } from "@/lib/order-queries";
import { formatKES } from "@/lib/format";
import { resolveDisputeAction } from "@/server/admin-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { OrderHeader, DeliveryDetails, TimelineCard } from "@/components/order-summary";
import { DisputePanel } from "@/components/dispute-panel";
import { EvidenceForm } from "@/components/order-actions";
import { ReasonForm } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Resolve dispute" };
export const dynamic = "force-dynamic";

export default async function DisputeDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const d = await db.dispute.findUnique({ where: { id }, select: { orderId: true } });
  if (!d) notFound();
  const order = await loadOrderDetail(d.orderId);
  if (!order?.dispute) notFound();
  const open = order.dispute.status === "OPEN";
  return (
    <div className="space-y-4">
      <PageHeader title="Dispute" description={<Link href={`/admin/orders/${order.id}`} className="text-brand-blue hover:underline">Order {order.code}</Link>} />
      <OrderHeader order={order} />
      <DisputePanel dispute={order.dispute} buyerId={order.buyerId}>
        <EvidenceForm disputeId={order.dispute.id} orderId={order.id} />
      </DisputePanel>
      {open && (
        <section className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
          <div>
            <h2 className="mb-1 font-semibold">Release to seller</h2>
            <p className="mb-2 text-sm text-neutral-600">{formatKES(order.sellerAmount)} to seller after {formatKES(order.platformFee)} fee.</p>
            <ReasonForm action={resolveDisputeAction.bind(null, order.dispute.id, "RELEASE")} label="Release to seller" confirm="Resolve in the seller's favour and release funds?" />
          </div>
          <div>
            <h2 className="mb-1 font-semibold">Refund buyer</h2>
            <p className="mb-2 text-sm text-neutral-600">{formatKES(order.amount)} back to the buyer&apos;s M-Pesa.</p>
            <ReasonForm action={resolveDisputeAction.bind(null, order.dispute.id, "REFUND")} label="Refund buyer" variant="destructive" confirm="Resolve in the buyer's favour and refund in full?" />
          </div>
        </section>
      )}
      <DeliveryDetails order={order} showContact="both" />
      <TimelineCard order={order} />
    </div>
  );
}
