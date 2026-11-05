import { BadgeCheck, ShieldCheck } from "lucide-react";
import type { ListingStatus, OrderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { LISTING_STATUS_LABELS, ORDER_STATUS_LABELS } from "@/lib/constants";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue", className)}>
      <BadgeCheck className="size-3.5" aria-hidden /> Verified Seller
    </span>
  );
}

export function EscrowBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-brand-blue-soft px-2 py-0.5 text-xs font-medium text-brand-blue", className)}>
      <ShieldCheck className="size-3.5" aria-hidden /> Escrow protected
    </span>
  );
}

const ORDER_TONE: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-neutral-100 text-neutral-700",
  PAID_HELD: "bg-brand-blue-soft text-brand-blue",
  DISPATCHED: "bg-amber-50 text-amber-800",
  DELIVERED_CONFIRMED: "bg-emerald-50 text-emerald-800",
  RELEASED: "bg-emerald-100 text-emerald-900",
  DISPUTED: "bg-red-50 text-red-700",
  REFUNDED: "bg-purple-50 text-purple-800",
  CANCELLED: "bg-neutral-100 text-neutral-500",
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", ORDER_TONE[status], className)}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

const LISTING_TONE: Record<ListingStatus, string> = {
  DRAFT: "bg-neutral-100 text-neutral-700",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  RESERVED: "bg-brand-blue-soft text-brand-blue",
  SOLD: "bg-neutral-900 text-white",
  HIDDEN: "bg-amber-50 text-amber-800",
  REMOVED: "bg-red-50 text-red-700",
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", LISTING_TONE[status])}>
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
