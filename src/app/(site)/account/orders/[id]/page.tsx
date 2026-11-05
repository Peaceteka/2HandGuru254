import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadOrderDetail } from "@/lib/order-queries";
import { isMockMpesa } from "@/lib/mpesa";
import { formatDate, formatKES } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { OrderHeader, DeliveryDetails, TimelineCard } from "@/components/order-summary";
import { DisputePanel } from "@/components/dispute-panel";
import { CancelOrderForm, ConfirmReceiptButton, DisputeForm, EvidenceForm, PaymentPanel } from "@/components/order-actions";

export const metadata: Metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

function Card({ title, children, tone = "default" }: { title: string; children: React.ReactNode; tone?: "default" | "info" }) {
  return (
    <section className={`rounded-xl border p-5 ${tone === "info" ? "border-brand-blue/30 bg-brand-blue-soft" : "bg-white"}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default async function BuyerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/account/orders/${id}`);
  const order = await loadOrderDetail(id);
  if (!order || order.buyerId !== user.id) notFound();
  const now = new Date();
  const dispatchOverdue = order.status === "PAID_HELD" && !!order.dispatchDeadline && order.dispatchDeadline < now;
  const refund = order.payouts.find((p) => p.type === "BUYER_REFUND");

  return (
    <div className="space-y-4">
      <OrderHeader order={order} />

      {order.status === "PENDING_PAYMENT" && (
        <Card title="Complete your M-Pesa payment">
          <PaymentPanel orderId={order.id} phone={displayPhone(order.buyerPhone)} mock={isMockMpesa()} />
          <div className="mt-4 border-t pt-4"><CancelOrderForm orderId={order.id} /></div>
        </Card>
      )}

      {order.status === "PAID_HELD" && (
        <Card title="Payment held in escrow" tone="info">
          <p className="text-sm text-neutral-700">
            {formatKES(order.amount)} is safely held. The seller has until <strong>{order.dispatchDeadline ? formatDate(order.dispatchDeadline, true) : "—"}</strong> to dispatch.
          </p>
          {dispatchOverdue && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
              <p className="mb-2 text-sm text-amber-900">The seller missed the dispatch deadline. You can cancel for a full refund.</p>
              <CancelOrderForm orderId={order.id} refund label="Cancel & refund me" />
            </div>
          )}
        </Card>
      )}

      {order.status === "DISPATCHED" && (
        <Card title="Your item is on the way">
          <p className="text-sm text-neutral-700">
            Check the item when it arrives. If you take no action, payment is released to the seller automatically on{" "}
            <strong>{order.autoReleaseAt ? formatDate(order.autoReleaseAt, true) : "—"}</strong>.
          </p>
          <div className="mt-4"><ConfirmReceiptButton orderId={order.id} /></div>
          <details className="mt-5 rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">Something wrong? Raise a dispute</summary>
            <div className="mt-4"><DisputeForm orderId={order.id} /></div>
          </details>
        </Card>
      )}

      {order.dispute && (
        <DisputePanel dispute={order.dispute} buyerId={order.buyerId}>
          <EvidenceForm disputeId={order.dispute.id} orderId={order.id} />
        </DisputePanel>
      )}

      {(order.status === "REFUNDED" || (order.status === "CANCELLED" && refund)) && refund && (
        <Card title="Refund">
          <p className="text-sm">{formatKES(refund.amount)} to {displayPhone(refund.phone)} — {refund.status === "SUCCESS" ? "sent" : refund.status === "FAILED" ? "failed (our team will retry)" : "processing"}.</p>
        </Card>
      )}

      <DeliveryDetails order={order} showContact={["PENDING_PAYMENT", "CANCELLED"].includes(order.status) ? "none" : "seller"} />
      <TimelineCard order={order} />
    </div>
  );
}
