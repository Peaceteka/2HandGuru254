import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <AuthCard title="Choose a new password">
      {token ? <ResetPasswordForm token={token} /> : (
        <p className="text-sm text-neutral-700">This link is missing its token. <Link href="/forgot-password" className="text-brand-blue hover:underline">Request a new reset link</Link>.</p>
      )}
    </AuthCard>
  );
}
