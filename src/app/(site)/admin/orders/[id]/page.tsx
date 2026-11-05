import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { loadOrderDetail } from "@/lib/order-queries";
import { formatKES } from "@/lib/format";
import { adminRefundAction, adminReleaseAction } from "@/server/admin-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { OrderHeader, DeliveryDetails, TimelineCard } from "@/components/order-summary";
import { DisputePanel } from "@/components/dispute-panel";
import { PaymentsAndLedger } from "@/components/admin-order-panels";
import { ReasonForm } from "@/components/admin-ui";
import { DispatchForm } from "@/components/order-actions";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await loadOrderDetail(id);
  if (!order) notFound();
  const canIntervene = ["PAID_HELD", "DISPATCHED", "DELIVERED_CONFIRMED"].includes(order.status);
  return (
    <div className="space-y-4">
      <PageHeader title={`Order ${order.code}`} description={<>Fee {formatKES(order.platformFee)} ({order.commissionBps / 100}%) · seller receives {formatKES(order.sellerAmount)}</>} />
      <OrderHeader order={order} />
      {order.status === "DISPUTED" && order.dispute && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">This order is disputed. <Link href={`/admin/disputes/${order.dispute.id}`} className="font-medium text-brand-blue hover:underline">Resolve the dispute</Link> to release or refund.</p>
      )}
      {canIntervene && (
        <section className="grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
          <div><h2 className="mb-2 font-semibold">Manual release</h2><ReasonForm action={adminReleaseAction.bind(null, order.id)} label="Release to seller" confirm="Release escrow funds to the seller now?" /></div>
          {order.status !== "DELIVERED_CONFIRMED" && <div><h2 className="mb-2 font-semibold">Manual refund</h2><ReasonForm action={adminRefundAction.bind(null, order.id)} label="Refund buyer" variant="destructive" confirm="Refund the buyer in full?" /></div>}
        </section>
      )}
      {order.status === "PAID_HELD" && order.seller.sellerProfile?.isPlatform && (
        <section className="rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Dispatch (platform listing)</h2><DispatchForm orderId={order.id} /></section>
      )}
      {order.dispute && <DisputePanel dispute={order.dispute} buyerId={order.buyerId} />}
      <PaymentsAndLedger order={order} />
      <DeliveryDetails order={order} showContact="both" />
      <TimelineCard order={order} />
    </div>
  );
}
