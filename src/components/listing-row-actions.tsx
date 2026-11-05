"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/order-actions";
import { deleteListingAction } from "@/server/listing-actions";

export function ListingRowActions({ id, canEdit }: { id: string; canEdit: boolean }) {
  return (
    <div className="flex gap-2">
      {canEdit && <Button asChild size="sm" variant="outline"><Link href={`/seller/listings/${id}/edit`}>Edit</Link></Button>}
      {canEdit && (
        <ActionButton size="sm" variant="ghost" className="text-red-700" run={() => deleteListingAction(id)} confirm="Delete this listing? This can't be undone.">
          Delete
        </ActionButton>
      )}
    </div>
  );
}
