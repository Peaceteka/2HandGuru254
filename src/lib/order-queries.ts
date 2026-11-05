import "server-only";
import { db } from "./db";

export function loadOrderDetail(id: string) {
  return db.order.findUnique({
    where: { id },
    include: {
      listing: { select: { id: true, title: true, images: { select: { key: true }, orderBy: { position: "asc" }, take: 1 } } },
      buyer: { select: { id: true, name: true, phone: true, email: true } },
      seller: { select: { id: true, name: true, phone: true, email: true, mpesaPayoutPhone: true, sellerProfile: { select: { businessName: true, isPlatform: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
      payouts: { orderBy: { createdAt: "desc" } },
      dispute: { include: { evidence: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } } } },
      ledgerTxns: { orderBy: { createdAt: "asc" }, include: { entries: true } },
    },
  });
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof loadOrderDetail>>>;
