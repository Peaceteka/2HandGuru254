import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(type === "seller" ? "/sell" : "/");
  return (
    <AuthCard title="Create your account" subtitle="Buy with escrow protection, or apply to become a verified seller." footer={<>Already have an account? <Link href="/login" className="font-medium text-brand-blue hover:underline">Log in</Link></>}>
      <RegisterForm initialType={type === "seller" ? "SELLER" : "BUYER"} />
    </AuthCard>
  );
}
