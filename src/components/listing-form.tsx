"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ActionForm, Field, NativeSelect, SubmitButton, useFieldError } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CONDITION_LABELS, KENYAN_COUNTIES, MAX_LISTING_IMAGES } from "@/lib/constants";
import type { ActionResult } from "@/lib/validators";

type Existing = {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  condition: string;
  price: number;
  county: string;
  town: string | null;
  status: string;
  featured: boolean;
  images: { id: string; url: string }[];
};

function ImagesField({ existing }: { existing: { id: string; url: string }[] }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const err = useFieldError("images");
  const remaining = MAX_LISTING_IMAGES - (existing.length - removed.length);
  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-sm font-medium">Photos <span className="font-normal text-muted-foreground">(up to {MAX_LISTING_IMAGES}, first photo is the cover)</span></p>
      <div className="flex flex-wrap gap-2">
        {existing.filter((i) => !removed.includes(i.id)).map((img) => (
          <div key={img.id} className="relative size-24 overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className="size-full object-cover" />
            <button type="button" onClick={() => setRemoved((r) => [...r, img.id])} aria-label="Remove photo" className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-black/70 text-white">
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
        {previews.map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" className="size-24 rounded-lg border border-dashed object-cover" />
        ))}
      </div>
      {removed.map((id) => <input key={id} type="hidden" name="removeImage" value={id} />)}
      <Input
        id="f-images"
        type="file"
        name="images"
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-invalid={!!err}
        disabled={remaining <= 0}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          previews.forEach(URL.revokeObjectURL);
          setPreviews(files.slice(0, remaining).map((f) => URL.createObjectURL(f)));
        }}
      />
      <p className="text-xs text-muted-foreground">{remaining > 0 ? `You can add ${remaining} more. JPG, PNG or WebP, max 5 MB each.` : "Maximum photos reached — remove one to add another."}</p>
      {err && <p className="text-xs font-medium text-red-700">{err}</p>}
    </div>
  );
}

export function ListingForm({
  action,
  categories,
  listing,
  isAdmin,
}: {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  categories: { id: string; name: string }[];
  listing?: Existing;
  isAdmin?: boolean;
}) {
  return (
    <ActionForm action={action} className="grid gap-4 sm:grid-cols-2">
      <Field name="title" label="Title" className="sm:col-span-2"><Input defaultValue={listing?.title} maxLength={100} required placeholder="e.g. Samsung Galaxy S21, 128GB, black" /></Field>
      <Field name="categoryId" label="Category">
        <NativeSelect defaultValue={listing?.categoryId ?? ""} required>
          <option value="" disabled>Choose category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </Field>
      <Field name="condition" label="Condition">
        <NativeSelect defaultValue={listing?.condition ?? "GOOD"}>
          {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </Field>
      <Field name="price" label="Price (KES)"><Input type="number" inputMode="numeric" min={50} step={1} defaultValue={listing?.price} required /></Field>
      <Field name="status" label="Status" hint="Drafts and hidden listings aren't visible to buyers">
        <NativeSelect defaultValue={listing && ["DRAFT", "ACTIVE", "HIDDEN", "SOLD"].includes(listing.status) ? listing.status : "ACTIVE"}>
          <option value="ACTIVE">Active (published)</option>
          <option value="DRAFT">Draft</option>
          <option value="HIDDEN">Hidden</option>
          <option value="SOLD">Sold (elsewhere)</option>
        </NativeSelect>
      </Field>
      <Field name="county" label="County">
        <NativeSelect defaultValue={listing?.county ?? ""} required>
          <option value="" disabled>Choose county</option>
          {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </Field>
      <Field name="town" label="Town / area (optional)"><Input defaultValue={listing?.town ?? ""} /></Field>
      <Field name="description" label="Description" hint="Include age, defects, what's in the box, reason for selling" className="sm:col-span-2">
        <Textarea rows={6} defaultValue={listing?.description} required />
      </Field>
      <ImagesField existing={listing?.images ?? []} />
      {isAdmin && (
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="featured" defaultChecked={listing?.featured} className="size-4 accent-brand-black" /> Feature on home page
        </label>
      )}
      <div className="flex gap-2 sm:col-span-2">
        <SubmitButton size="lg" pendingText="Saving…">{listing ? "Save changes" : "Publish listing"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
