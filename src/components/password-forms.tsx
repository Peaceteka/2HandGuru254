"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { changePasswordAction, forgotPasswordAction, resetPasswordAction } from "@/server/auth-actions";

export function ForgotPasswordForm() {
  return (
    <ActionForm action={forgotPasswordAction} successToast={false} className="space-y-4">
      <Field name="identifier" label="Email or phone number"><Input autoComplete="username" required /></Field>
      <SubmitButton className="w-full" pendingText="Sending…">Send reset link</SubmitButton>
    </ActionForm>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  return (
    <ActionForm action={resetPasswordAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field name="password" label="New password" hint="At least 8 characters, with a letter and a number"><Input type="password" autoComplete="new-password" required /></Field>
      <Field name="confirmPassword" label="Confirm new password"><Input type="password" autoComplete="new-password" required /></Field>
      <SubmitButton className="w-full" pendingText="Saving…">Set new password</SubmitButton>
    </ActionForm>
  );
}

export function ChangePasswordForm() {
  return (
    <ActionForm action={changePasswordAction} resetOnSuccess className="space-y-4">
      <Field name="currentPassword" label="Current password"><Input type="password" autoComplete="current-password" required /></Field>
      <Field name="password" label="New password"><Input type="password" autoComplete="new-password" required /></Field>
      <Field name="confirmPassword" label="Confirm new password"><Input type="password" autoComplete="new-password" required /></Field>
      <SubmitButton pendingText="Saving…">Change password</SubmitButton>
    </ActionForm>
  );
}
