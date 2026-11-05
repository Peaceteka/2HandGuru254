"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionButton } from "@/components/order-actions";
import { CATEGORY_ICON_NAMES } from "@/components/category-icon";
import type { ActionResult } from "@/lib/validators";
import type { Button } from "@/components/ui/button";
import {
  approveApplicationAction,
  deleteCategoryAction,
  saveCategoryAction,
  saveSettingsAction,
  toggleFeaturedAction,
  retryPayoutAction,
} from "@/server/admin-actions";

type Act = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

/** A small "reason + submit" form used for reject/suspend/release/refund/resolve. */
export function ReasonForm({
  action, label, confirm, placeholder, variant = "default", required = true,
}: { action: Act; label: string; confirm?: string; placeholder?: string; variant?: React.ComponentProps<typeof Button>["variant"]; required?: boolean }) {
  return (
    <ActionForm action={action} confirm={confirm} className="space-y-2" resetOnSuccess>
      <Field name="reason" label={required ? "Reason" : "Note (optional)"}><Textarea rows={2} placeholder={placeholder} /></Field>
      <SubmitButton variant={variant} pendingText="Working…">{label}</SubmitButton>
    </ActionForm>
  );
}

export function ApproveButton({ profileId }: { profileId: string }) {
  return <ActionButton run={() => approveApplicationAction(profileId)} confirm="Approve this seller? They'll be able to list items immediately.">Approve seller</ActionButton>;
}

export function FeatureToggle({ id, featured }: { id: string; featured: boolean }) {
  return <ActionButton size="sm" variant="outline" run={() => toggleFeaturedAction(id)}>{featured ? "Unfeature" : "Feature"}</ActionButton>;
}

export function RetryPayoutButton({ payoutId, orderId }: { payoutId: string; orderId: string }) {
  return <ActionButton size="sm" variant="outline" run={() => retryPayoutAction(payoutId, orderId)} confirm="Re-send this M-Pesa B2C payment?">Retry</ActionButton>;
}

type Cat = { id: string; name: string; slug: string; icon: string; description: string | null; sortOrder: number };

export function CategoryForm({ category }: { category?: Cat }) {
  return (
    <ActionForm action={saveCategoryAction.bind(null, category?.id ?? null)} resetOnSuccess={!category} className="grid gap-3 sm:grid-cols-5 sm:items-end">
      <Field name="name" label="Name"><Input defaultValue={category?.name} required /></Field>
      <Field name="slug" label="Slug"><Input defaultValue={category?.slug} required pattern="[a-z0-9-]+" /></Field>
      <Field name="icon" label="Icon" hint={category ? undefined : CATEGORY_ICON_NAMES.join(", ")}><Input defaultValue={category?.icon ?? "package"} list="icon-names" /></Field>
      <Field name="sortOrder" label="Order"><Input type="number" defaultValue={category?.sortOrder ?? 0} /></Field>
      <div className="flex gap-2">
        <SubmitButton size="sm" pendingText="Saving…">{category ? "Save" : "Add category"}</SubmitButton>
        {category && <ActionButton size="sm" variant="ghost" className="text-red-700" run={() => deleteCategoryAction(category.id)} confirm={`Delete ${category.name}?`}>Delete</ActionButton>}
      </div>
      <datalist id="icon-names">{CATEGORY_ICON_NAMES.map((n) => <option key={n} value={n} />)}</datalist>
    </ActionForm>
  );
}

export function SettingsForm({ values }: { values: { commissionPercent: number; dispatchWindowHours: number; autoReleaseDays: number } }) {
  return (
    <ActionForm action={saveSettingsAction} className="grid max-w-xl gap-4">
      <Field name="commissionPercent" label="Platform commission (%)" hint="Deducted from the seller's payout on release"><Input type="number" step="0.1" min={0} max={30} defaultValue={values.commissionPercent} /></Field>
      <Field name="dispatchWindowHours" label="Dispatch window (hours)" hint="After this the buyer may cancel a paid order for a refund"><Input type="number" min={12} max={240} defaultValue={values.dispatchWindowHours} /></Field>
      <Field name="autoReleaseDays" label="Auto-release after dispatch (days)"><Input type="number" min={1} max={30} defaultValue={values.autoReleaseDays} /></Field>
      <div><SubmitButton pendingText="Saving…">Save settings</SubmitButton></div>
    </ActionForm>
  );
}
