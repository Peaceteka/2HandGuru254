import Link from "next/link";
import { CONDITION_LABELS, KENYAN_COUNTIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/forms";

export type BrowseParams = { q?: string; category?: string; min?: string; max?: string; condition?: string; county?: string; sort?: string };

export function SearchFilters({ params, categories }: { params: BrowseParams; categories: { slug: string; name: string }[] }) {
  return (
    <form action="/listings" className="space-y-4" aria-label="Filter listings">
      {params.q && <input type="hidden" name="q" value={params.q} />}
      <div className="space-y-1.5">
        <Label htmlFor="flt-category">Category</Label>
        <NativeSelect id="flt-category" name="category" defaultValue={params.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </NativeSelect>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Price (KES)</legend>
        <div className="flex items-center gap-2">
          <Input name="min" type="number" inputMode="numeric" min={0} placeholder="Min" defaultValue={params.min} aria-label="Minimum price" />
          <span className="text-muted-foreground">–</span>
          <Input name="max" type="number" inputMode="numeric" min={0} placeholder="Max" defaultValue={params.max} aria-label="Maximum price" />
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="flt-condition">Condition</Label>
        <NativeSelect id="flt-condition" name="condition" defaultValue={params.condition ?? ""}>
          <option value="">Any condition</option>
          {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="flt-county">County</Label>
        <NativeSelect id="flt-county" name="county" defaultValue={params.county ?? ""}>
          <option value="">All of Kenya</option>
          {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="flt-sort">Sort by</Label>
        <NativeSelect id="flt-sort" name="sort" defaultValue={params.sort ?? "newest"}>
          <option value="newest">Newest first</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </NativeSelect>
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">Apply filters</Button>
        <Button type="button" variant="outline" asChild><Link href="/listings">Reset</Link></Button>
      </div>
    </form>
  );
}
