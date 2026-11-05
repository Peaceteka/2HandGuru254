import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; reset?: string; error?: string }> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/");
  return (
    <AuthCard title="Welcome back" subtitle="Log in with your email or M-Pesa phone number." footer={<>New to 2ndHandGuru? <Link href="/register" className="font-medium text-brand-blue hover:underline">Create an account</Link></>}>
      <LoginForm callbackUrl={sp.callbackUrl ?? null} notice={sp.reset ? "Password updated. Log in with your new password." : undefined} />
    </AuthCard>
  );
}
