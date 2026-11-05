"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ShoppingBag, Store } from "lucide-react";
import { ActionForm, Field, SubmitButton, useFieldError } from "@/components/forms";
import { Input } from "@/components/ui/input";
import { registerAction } from "@/server/auth-actions";
import { cn } from "@/lib/utils";

function TermsCheckbox() {
  const err = useFieldError("acceptTerms");
  return (
    <div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptTerms" className="mt-0.5 size-4 accent-brand-black" aria-invalid={!!err} />
        <span>I agree to the <Link href="/terms" className="text-brand-blue hover:underline" target="_blank">Terms</Link> and <Link href="/privacy" className="text-brand-blue hover:underline" target="_blank">Privacy policy</Link></span>
      </label>
      {err && <p className="mt-1 text-xs font-medium text-red-700">{err}</p>}
    </div>
  );
}

export function RegisterForm({ initialType }: { initialType: "BUYER" | "SELLER" }) {
  const [type, setType] = useState(initialType);
  const router = useRouter();

  return (
    <ActionForm
      action={registerAction}
      successToast={false}
      className="space-y-4"
      onSuccess={async (state, form) => {
        const fd = new FormData(form ?? undefined);
        await signIn("credentials", { identifier: fd.get("email"), password: fd.get("password"), redirect: false });
        router.push(state.message || "/");
        router.refresh();
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium">I want to</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["BUYER", "Buy items", ShoppingBag], ["SELLER", "Apply to sell", Store]] as const).map(([v, label, Icon]) => (
            <label key={v} className={cn("flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-blue", type === v ? "border-brand-black bg-brand-yellow/15" : "hover:border-neutral-400")}>
              <input type="radio" name="accountType" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              <Icon className="size-4" aria-hidden /> {label}
            </label>
          ))}
        </div>
        {type === "SELLER" && <p className="mt-2 text-xs text-neutral-600">Create your account first, then complete a short ID verification form.</p>}
      </fieldset>
      <Field name="name" label="Full name"><Input autoComplete="name" required /></Field>
      <Field name="email" label="Email"><Input type="email" autoComplete="email" required /></Field>
      <Field name="phone" label="Phone number (M-Pesa)" hint="Safaricom number, e.g. 0712 345 678"><Input type="tel" inputMode="tel" autoComplete="tel" required /></Field>
      <Field name="password" label="Password" hint="At least 8 characters, with a letter and a number"><Input type="password" autoComplete="new-password" required /></Field>
      <Field name="confirmPassword" label="Confirm password"><Input type="password" autoComplete="new-password" required /></Field>
      <TermsCheckbox />
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
    </ActionForm>
  );
}
