"use client";

import { ActionForm, Field, NativeSelect, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KENYAN_COUNTIES } from "@/lib/constants";
import { checkoutAction } from "@/server/order-actions";

export function CheckoutForm({ listingId, phone, county, amountLabel }: { listingId: string; phone: string; county?: string | null; amountLabel: string }) {
  return (
    <ActionForm action={checkoutAction} className="space-y-4">
      <input type="hidden" name="listingId" value={listingId} />
      <Field name="buyerPhone" label="M-Pesa number to pay from" hint="You'll get an STK prompt on this phone"><Input type="tel" inputMode="tel" defaultValue={phone} required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="deliveryCounty" label="Delivery county">
          <NativeSelect defaultValue={county ?? ""} required>
            <option value="" disabled>Choose county</option>
            {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </Field>
        <Field name="deliveryTown" label="Town / area"><Input required placeholder="e.g. Kilimani" /></Field>
      </div>
      <Field name="deliveryAddress" label="Delivery address or pickup point" hint="Building, street, or courier office (e.g. G4S Kenyatta Ave)"><Input required /></Field>
      <Field name="deliveryNotes" label="Notes for the seller (optional)"><Textarea rows={2} /></Field>
      <SubmitButton size="lg" className="w-full" pendingText="Sending M-Pesa prompt…">Pay {amountLabel} with M-Pesa</SubmitButton>
      <p className="text-center text-xs text-neutral-600">Your payment is held in escrow and only released to the seller after you confirm receipt.</p>
    </ActionForm>
  );
}
