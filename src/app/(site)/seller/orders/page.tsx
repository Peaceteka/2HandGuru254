import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireApprovedSeller } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";
import { OrderList } from "@/components/order-list";

export const metadata: Metadata = { title: "Orders" };

export default async function SellerOrders() {
  const user = await requireApprovedSeller();
  const orders = await db.order.findMany({
    where: { sellerId: user.id, status: { not: "PENDING_PAYMENT" } },
    orderBy: { createdAt: "desc" },
    include: { buyer: { select: { name: true } }, listing: { select: { title: true, images: { select: { key: true }, orderBy: { position: "asc" }, take: 1 } } } },
  });
  return (
    <>
      <PageHeader title="Orders" description="Orders appear here once the buyer's payment is held in escrow." />
      {orders.length ? <OrderList orders={orders.map((o) => ({ ...o, counterparty: o.buyer.name }))} hrefBase="/seller/orders" /> : <EmptyState title="No orders yet" />}
    </>
  );
}
