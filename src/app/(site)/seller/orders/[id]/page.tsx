import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireApprovedSeller } from "@/lib/session";
import { loadOrderDetail } from "@/lib/order-queries";
import { SellerOrderView } from "@/components/seller-order-view";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

export default async function SellerOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireApprovedSeller();
  const order = await loadOrderDetail(id);
  if (!order || order.sellerId !== user.id || order.status === "PENDING_PAYMENT") notFound();
  return <SellerOrderView order={order} />;
}
