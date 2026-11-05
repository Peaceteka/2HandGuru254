import Link from "next/link";
import { fileUrl } from "@/lib/storage";
import { formatDate, formatKES } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { OrderStatusBadge } from "@/components/badges";
import { OrderProgress, OrderTimeline } from "@/components/order-timeline";
import type { OrderDetail } from "@/lib/order-queries";

export function OrderHeader({ order }: { order: OrderDetail }) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-neutral-100">
          {order.listing.images[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(order.listing.images[0].key)} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Order {order.code} · {formatDate(order.createdAt, true)}</p>
          <Link href={`/listings/${order.listing.id}`} className="mt-0.5 block font-semibold hover:underline">{order.listing.title}</Link>
          <p className="mt-1 text-xl font-bold">{formatKES(order.amount)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-5"><OrderProgress status={order.status} events={order.events} /></div>
    </div>
  );
}

export function DeliveryDetails({ order, showContact }: { order: OrderDetail; showContact: "buyer" | "seller" | "both" | "none" }) {
  return (
    <section className="rounded-xl border bg-white p-5" aria-labelledby="deliv-h">
      <h2 id="deliv-h" className="mb-3 font-semibold">Delivery</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Deliver to</dt><dd>{order.deliveryAddress}, {order.deliveryTown}, {order.deliveryCounty}</dd></div>
        {order.deliveryNotes && <div><dt className="text-muted-foreground">Buyer notes</dt><dd>{order.deliveryNotes}</dd></div>}
        {order.courier && <div><dt className="text-muted-foreground">Courier</dt><dd>{order.courier}</dd></div>}
        {order.trackingNote && <div><dt className="text-muted-foreground">Tracking / note</dt><dd className="whitespace-pre-line">{order.trackingNote}</dd></div>}
        {order.dispatchedAt && <div><dt className="text-muted-foreground">Dispatched</dt><dd>{formatDate(order.dispatchedAt, true)}</dd></div>}
        {(showContact === "buyer" || showContact === "both") && (
          <div><dt className="text-muted-foreground">Buyer</dt><dd>{order.buyer.name} · {displayPhone(order.buyerPhone)}</dd></div>
        )}
        {(showContact === "seller" || showContact === "both") && (
          <div><dt className="text-muted-foreground">Seller</dt><dd>{order.seller.sellerProfile?.businessName || order.seller.name} · {displayPhone(order.seller.phone)}</dd></div>
        )}
      </dl>
    </section>
  );
}

export function TimelineCard({ order }: { order: OrderDetail }) {
  return (
    <section className="rounded-xl border bg-white p-5" aria-labelledby="tl-h">
      <h2 id="tl-h" className="mb-3 font-semibold">Timeline</h2>
      <OrderTimeline events={[...order.events].reverse()} />
    </section>
  );
}
