import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader, EmptyState } from "@/components/dashboard-shell";
import { OrderList } from "@/components/order-list";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "My orders" };

export default async function MyOrders() {
  const user = await requireUser("/account/orders");
  const orders = await db.order.findMany({
    where: { buyerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { listing: { select: { title: true, images: { select: { key: true }, orderBy: { position: "asc" }, take: 1 } } } },
  });
  return (
    <>
      <PageHeader title="My orders" description="Track payments held in escrow, dispatch and delivery." />
      {orders.length ? <OrderList orders={orders} hrefBase="/account/orders" /> : (
        <EmptyState title="No orders yet" description="When you buy with escrow, your orders appear here." action={<Button asChild><Link href="/listings">Browse listings</Link></Button>} />
      )}
    </>
  );
}
