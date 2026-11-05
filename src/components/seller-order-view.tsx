import { formatDate, formatKES } from "@/lib/format";
import type { OrderDetail } from "@/lib/order-queries";
import { OrderHeader, DeliveryDetails, TimelineCard } from "@/components/order-summary";
import { DisputePanel } from "@/components/dispute-panel";
import { DispatchForm, EvidenceForm } from "@/components/order-actions";

export function SellerOrderView({ order }: { order: OrderDetail }) {
  const payout = order.payouts.find((p) => p.type === "SELLER_PAYOUT");
  return (
    <div className="space-y-4">
      <OrderHeader order={order} />
      <section className="rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Payment</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div><dt className="text-muted-foreground">Sale price</dt><dd>{formatKES(order.amount)}</dd></div>
          <div><dt className="text-muted-foreground">Platform fee ({order.commissionBps / 100}%)</dt><dd>−{formatKES(order.platformFee)}</dd></div>
          <div><dt className="text-muted-foreground">You receive</dt><dd className="font-semibold">{formatKES(order.sellerAmount)}</dd></div>
        </dl>
        {payout && <p className="mt-3 text-sm">Payout: {payout.status === "SUCCESS" ? `sent ${formatDate(payout.updatedAt, true)}${payout.transactionId ? ` (M-Pesa ${payout.transactionId})` : ""}` : payout.status === "FAILED" ? "failed — our team will retry" : "processing"}</p>}
      </section>
      {order.status === "PAID_HELD" && (
        <section className="rounded-xl border border-brand-yellow bg-brand-yellow/10 p-5">
          <h2 className="font-semibold">Payment held — please dispatch</h2>
          <p className="mb-4 text-sm text-neutral-700">Dispatch by <strong>{order.dispatchDeadline ? formatDate(order.dispatchDeadline, true) : "—"}</strong>. After that the buyer may cancel for a refund.</p>
          <DispatchForm orderId={order.id} />
        </section>
      )}
      {order.dispute && (
        <DisputePanel dispute={order.dispute} buyerId={order.buyerId}>
          <EvidenceForm disputeId={order.dispute.id} orderId={order.id} />
        </DisputePanel>
      )}
      <DeliveryDetails order={order} showContact="buyer" />
      <TimelineCard order={order} />
    </div>
  );
}
