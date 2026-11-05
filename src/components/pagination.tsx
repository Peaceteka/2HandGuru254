import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Pagination({ page, totalPages, makeHref }: { page: number; totalPages: number; makeHref: (p: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-3">
      <Button variant="outline" size="sm" asChild disabled={page <= 1}>
        {page > 1 ? <Link href={makeHref(page - 1)}>Previous</Link> : <span aria-disabled>Previous</span>}
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" asChild disabled={page >= totalPages}>
        {page < totalPages ? <Link href={makeHref(page + 1)}>Next</Link> : <span aria-disabled>Next</span>}
      </Button>
    </nav>
  );
}
