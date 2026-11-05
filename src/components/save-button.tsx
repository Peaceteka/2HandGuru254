"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleSavedAction } from "@/server/listing-actions";
import { cn } from "@/lib/utils";

export function SaveButton({ listingId, initialSaved }: { listingId: string; initialSaved: boolean }) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-pressed={saved}
      onClick={() =>
        start(async () => {
          const res = await toggleSavedAction(listingId);
          if ("error" in res) {
            if (res.error === "login") router.push(`/login?callbackUrl=/listings/${listingId}`);
            else toast.error(res.error);
            return;
          }
          setSaved(res.saved);
          toast.success(res.saved ? "Saved to your wishlist" : "Removed from saved items");
        })
      }
    >
      <Heart className={cn("size-4", saved && "fill-red-500 text-red-500")} aria-hidden />
      {saved ? "Saved" : "Save"}
    </Button>
  );
}
