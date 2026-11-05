"use client";

import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { contactAction } from "@/server/auth-actions";

export function ContactForm() {
  return (
    <ActionForm action={contactAction} resetOnSuccess successToast={false} className="space-y-4">
      <Field name="name" label="Your name"><Input autoComplete="name" required /></Field>
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <Field name="message" label="How can we help?"><Textarea rows={5} required /></Field>
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </ActionForm>
  );
}
