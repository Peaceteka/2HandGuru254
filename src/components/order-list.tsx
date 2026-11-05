import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { fileUrl } from "@/lib/storage";
import { formatDate, formatKES } from "@/lib/format";
import { OrderStatusBadge } from "@/components/badges";

type Row = { id: string; code: string; amount: number; status: OrderStatus; createdAt: Date; listing: { title: string; images: { key: string }[] }; counterparty?: string };

export function OrderList({ orders, hrefBase }: { orders: Row[]; hrefBase: string }) {
  return (
    <ul className="divide-y rounded-xl border bg-white">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`${hrefBase}/${o.id}`} className="flex items-center gap-3 p-4 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-brand-blue">
            <div className="size-14 shrink-0 overflow-hidden rounded-lg border bg-neutral-100">
              {o.listing.images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(o.listing.images[0].key)} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{o.listing.title}</p>
              <p className="text-xs text-muted-foreground">{o.code} · {formatDate(o.createdAt)}{o.counterparty ? ` · ${o.counterparty}` : ""}</p>
            </div>
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="font-semibold">{formatKES(o.amount)}</span>
              <OrderStatusBadge status={o.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
