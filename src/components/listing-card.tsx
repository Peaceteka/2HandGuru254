import Link from "next/link";
import { MapPin } from "lucide-react";
import type { ListingCondition } from "@prisma/client";
import { CONDITION_LABELS } from "@/lib/constants";
import { formatKES } from "@/lib/format";
import { fileUrl } from "@/lib/storage";
import { VerifiedBadge } from "./badges";

export type ListingCardData = {
  id: string;
  title: string;
  price: number;
  condition: ListingCondition;
  county: string;
  town: string | null;
  images: { key: string }[];
  seller?: { sellerProfile: { status: string } | null } | null;
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const img = listing.images[0];
  const verified = listing.seller?.sellerProfile?.status === "APPROVED";
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white transition hover:border-neutral-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-brand-blue"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(img.key)} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">No photo</div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="text-base font-bold text-brand-black">{formatKES(listing.price)}</p>
        <h3 className="line-clamp-2 text-sm leading-snug text-neutral-800">{listing.title}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="size-3" aria-hidden /> {listing.town ? `${listing.town}, ` : ""}
            {listing.county}
          </span>
          <span aria-hidden>·</span>
          <span>{CONDITION_LABELS[listing.condition]}</span>
        </div>
        {verified && <VerifiedBadge className="mt-1 self-start" />}
      </div>
    </Link>
  );
}

export const listingCardSelect = {
  id: true,
  title: true,
  price: true,
  condition: true,
  county: true,
  town: true,
  images: { select: { key: true }, orderBy: { position: "asc" as const }, take: 1 },
  seller: { select: { sellerProfile: { select: { status: true } } } },
};
