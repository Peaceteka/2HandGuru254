"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm, Field, NativeSelect, SubmitButton } from "@/components/forms";
import { DISPUTE_REASON_LABELS } from "@/lib/constants";
import type { ActionResult } from "@/lib/validators";
import {
  addEvidenceAction,
  cancelOrderAction,
  checkPaymentStatusAction,
  confirmReceiptAction,
  dispatchAction,
  openDisputeAction,
  retryPaymentAction,
  simulatePaymentAction,
} from "@/server/order-actions";

export function ActionButton({
  run,
  children,
  confirm,
  ...props
}: { run: () => Promise<ActionResult>; confirm?: string } & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      type="button"
      disabled={pending || props.disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const res = await run();
          if (res.error) toast.error(res.error);
          else if (res.message) toast.success(res.message);
          router.refresh();
        });
      }}
      {...props}
    >
      {children}
    </Button>
  );
}

export function PaymentPanel({ orderId, phone, mock }: { orderId: string; phone: string; mock: boolean }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        We sent an M-Pesa prompt to your phone. Enter your PIN to pay — this page updates once Safaricom confirms. If you missed it, resend below.
      </p>
      <div className="flex flex-wrap gap-2">
        <ActionButton variant="outline" run={() => checkPaymentStatusAction(orderId)}>I&apos;ve paid — check status</ActionButton>
      </div>
      <ActionForm action={retryPaymentAction.bind(null, orderId)} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field name="phone" label="M-Pesa number" className="flex-1"><Input type="tel" inputMode="tel" defaultValue={phone} /></Field>
        <SubmitButton variant="dark" pendingText="Sending…">Resend M-Pesa prompt</SubmitButton>
      </ActionForm>
      {mock && (
        <div className="rounded-lg border border-dashed border-brand-blue/50 bg-brand-blue-soft p-3">
          <p className="text-xs font-medium text-brand-blue">Development mode (MPESA_MODE=mock): simulate the Daraja callback</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton size="sm" variant="info" run={() => simulatePaymentAction(orderId, true)}>Simulate successful payment</ActionButton>
            <ActionButton size="sm" variant="outline" run={() => simulatePaymentAction(orderId, false)}>Simulate failed payment</ActionButton>
          </div>
        </div>
      )}
    </div>
  );
}

export function CancelOrderForm({ orderId, label = "Cancel order", refund }: { orderId: string; label?: string; refund?: boolean }) {
  return (
    <ActionForm action={cancelOrderAction.bind(null, orderId)} confirm={refund ? "Cancel this order and get a full refund to your M-Pesa?" : "Cancel this order?"} className="space-y-2">
      <input type="hidden" name="reason" value={refund ? "Seller did not dispatch in time" : "Cancelled by buyer before payment"} />
      <SubmitButton variant="outline" pendingText="Cancelling…">{label}</SubmitButton>
    </ActionForm>
  );
}

export function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  return (
    <ActionButton size="lg" run={() => confirmReceiptAction(orderId)} confirm="Confirm you received the item as described? This releases payment to the seller and can't be undone.">
      Confirm receipt
    </ActionButton>
  );
}

export function DisputeForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={openDisputeAction.bind(null, orderId)} className="space-y-4" confirm="Open a dispute? Funds stay frozen until our team resolves it.">
      <Field name="reason" label="What went wrong?">
        <NativeSelect defaultValue="" required>
          <option value="" disabled>Choose a reason</option>
          {Object.entries(DISPUTE_REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </Field>
      <Field name="note" label="Describe the problem" hint="At least 20 characters. Be specific — this helps us resolve it faster."><Textarea rows={4} required /></Field>
      <Field name="photos" label="Photos (optional, up to 6)"><Input type="file" multiple accept="image/jpeg,image/png,image/webp" /></Field>
      <SubmitButton variant="dark" pendingText="Submitting…">Raise dispute</SubmitButton>
    </ActionForm>
  );
}

export function EvidenceForm({ disputeId, orderId }: { disputeId: string; orderId: string }) {
  return (
    <ActionForm action={addEvidenceAction.bind(null, disputeId, orderId)} resetOnSuccess className="space-y-3">
      <Field name="note" label="Add a note or evidence"><Textarea rows={3} required /></Field>
      <Field name="photos" label="Photos (optional)"><Input type="file" multiple accept="image/jpeg,image/png,image/webp" /></Field>
      <SubmitButton variant="outline" pendingText="Uploading…">Add evidence</SubmitButton>
    </ActionForm>
  );
}

export function DispatchForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={dispatchAction.bind(null, orderId)} className="space-y-4">
      <Field name="courier" label="Courier / delivery method" hint="e.g. G4S, Fargo, Wells Fargo, matatu parcel, personal delivery"><Input required /></Field>
      <Field name="trackingNote" label="Tracking number or note (optional)"><Textarea rows={2} /></Field>
      <SubmitButton size="lg" pendingText="Saving…">Mark as dispatched</SubmitButton>
    </ActionForm>
  );
}
