import type { OrderEvent, OrderStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const HAPPY_PATH: OrderStatus[] = ["PENDING_PAYMENT", "PAID_HELD", "DISPATCHED", "DELIVERED_CONFIRMED", "RELEASED"];

export function OrderProgress({ status, events }: { status: OrderStatus; events: Pick<OrderEvent, "toStatus" | "createdAt">[] }) {
  const reached = new Set(events.map((e) => e.toStatus));
  const offPath = !HAPPY_PATH.includes(status);
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {HAPPY_PATH.map((s, i) => {
        const done = reached.has(s) || HAPPY_PATH.indexOf(status) > i;
        const current = s === status;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border-2 text-xs font-semibold",
                done ? "border-brand-black bg-brand-black text-white" : "border-neutral-300 bg-white text-neutral-400",
                current && !offPath && "border-brand-yellow bg-brand-yellow text-brand-black",
              )}
              aria-current={current ? "step" : undefined}
            >
              {done && !current ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn("mt-1.5 text-[11px] leading-tight sm:text-xs", done || current ? "text-neutral-900" : "text-neutral-400")}>
              {ORDER_STATUS_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTimeline({ events }: { events: (Pick<OrderEvent, "id" | "toStatus" | "note" | "createdAt"> & { actor?: { name: string } | null })[] }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand-black ring-4 ring-white" aria-hidden />
          <p className="text-sm font-medium">{ORDER_STATUS_LABELS[e.toStatus]}</p>
          {e.note && <p className="text-sm text-muted-foreground">{e.note}</p>}
          <p className="text-xs text-muted-foreground">
            {formatDate(e.createdAt, true)}
            {e.actor ? ` · ${e.actor.name}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
