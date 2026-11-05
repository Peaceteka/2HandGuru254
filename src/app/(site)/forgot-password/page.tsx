import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Reset your password" subtitle="Enter your email or phone and we'll send a reset link by email and SMS." footer={<Link href="/login" className="text-brand-blue hover:underline">Back to log in</Link>}>
      <ForgotPasswordForm />
    </AuthCard>
  );
}
