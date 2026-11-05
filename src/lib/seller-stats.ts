import "server-only";
import { db } from "./db";

export const HELD_STATUSES = ["PAID_HELD", "DISPATCHED", "DELIVERED_CONFIRMED", "DISPUTED"] as const;

export async function sellerStats(sellerId: string) {
  const [active, pending, held, released] = await Promise.all([
    db.listing.count({ where: { sellerId, status: "ACTIVE" } }),
    db.order.count({ where: { sellerId, status: { in: ["PAID_HELD", "DISPATCHED"] } } }),
    db.order.aggregate({ where: { sellerId, status: { in: [...HELD_STATUSES] } }, _sum: { sellerAmount: true } }),
    db.order.aggregate({ where: { sellerId, status: "RELEASED" }, _sum: { sellerAmount: true } }),
  ]);
  return { active, pending, held: held._sum.sellerAmount ?? 0, released: released._sum.sellerAmount ?? 0 };
}
