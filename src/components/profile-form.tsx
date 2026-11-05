"use client";

import { ActionForm, Field, NativeSelect, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KENYAN_COUNTIES } from "@/lib/constants";
import { sellerSettingsAction, updateProfileAction } from "@/server/auth-actions";

type P = { name: string; phone: string; county: string | null; email: string };

function CountySelect({ value }: { value: string | null }) {
  return (
    <NativeSelect defaultValue={value ?? ""}>
      <option value="">Not set</option>
      {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
    </NativeSelect>
  );
}

export function ProfileForm({ user }: { user: P }) {
  return (
    <ActionForm action={updateProfileAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Full name"><Input defaultValue={user.name} autoComplete="name" /></Field>
      <Field name="email" label="Email" hint="Contact support to change your email"><Input defaultValue={user.email} disabled /></Field>
      <Field name="phone" label="Phone"><Input type="tel" defaultValue={user.phone} /></Field>
      <Field name="county" label="County"><CountySelect value={user.county} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingText="Saving…">Save profile</SubmitButton></div>
    </ActionForm>
  );
}

export function SellerSettingsForm({ user, profile }: { user: P & { mpesaPayoutPhone: string }; profile: { businessName: string | null; description: string } }) {
  return (
    <ActionForm action={sellerSettingsAction} className="grid gap-4 sm:grid-cols-2">
      <Field name="name" label="Your name"><Input defaultValue={user.name} /></Field>
      <Field name="businessName" label="Business / shop name (optional)"><Input defaultValue={profile.businessName ?? ""} /></Field>
      <Field name="phone" label="Contact phone"><Input type="tel" defaultValue={user.phone} /></Field>
      <Field name="mpesaPayoutPhone" label="M-Pesa payout number" hint="Escrow releases are sent here via M-Pesa B2C"><Input type="tel" defaultValue={user.mpesaPayoutPhone} /></Field>
      <Field name="county" label="County"><CountySelect value={user.county} /></Field>
      <Field name="description" label="Profile description" className="sm:col-span-2"><Textarea rows={4} defaultValue={profile.description} /></Field>
      <div className="sm:col-span-2"><SubmitButton pendingText="Saving…">Save settings</SubmitButton></div>
    </ActionForm>
  );
}
