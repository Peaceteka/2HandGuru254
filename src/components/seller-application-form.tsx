"use client";

import { ActionForm, Field, NativeSelect, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KENYAN_COUNTIES } from "@/lib/constants";
import { applySellerAction } from "@/server/auth-actions";

type Defaults = { fullName?: string; phone?: string; idNumber?: string; businessName?: string | null; county?: string | null; town?: string | null; description?: string };

export function SellerApplicationForm({ defaults }: { defaults: Defaults }) {
  return (
    <ActionForm action={applySellerAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="fullName" label="Full name (as on ID)"><Input defaultValue={defaults.fullName} autoComplete="name" required /></Field>
      <Field name="phone" label="Phone number"><Input type="tel" inputMode="tel" defaultValue={defaults.phone} required /></Field>
      <Field name="idNumber" label="National ID / passport number"><Input defaultValue={defaults.idNumber} inputMode="numeric" required /></Field>
      <Field name="businessName" label="Business name (optional)"><Input defaultValue={defaults.businessName ?? ""} /></Field>
      <Field name="county" label="County">
        <NativeSelect defaultValue={defaults.county ?? ""} required>
          <option value="" disabled>Choose county</option>
          {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
      </Field>
      <Field name="town" label="Town / area"><Input defaultValue={defaults.town ?? ""} placeholder="e.g. Westlands" /></Field>
      <Field name="description" label="What do you sell?" hint="A short description buyers will see on your profile (20–600 characters)" className="sm:col-span-2">
        <Textarea rows={4} defaultValue={defaults.description} required />
      </Field>
      <Field name="idPhoto" label="Photo of your ID (front)" hint="JPG, PNG or WebP up to 5 MB. Only our verification team can see it." className="sm:col-span-2">
        <Input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton size="lg" className="w-full sm:w-auto" pendingText="Submitting…">Submit application</SubmitButton>
      </div>
    </ActionForm>
  );
}
