import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { displayPhone } from "@/lib/phone";
import { PageHeader } from "@/components/dashboard-shell";
import { ProfileForm } from "@/components/profile-form";
import { ChangePasswordForm } from "@/components/password-forms";

export const metadata: Metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser("/account/settings");
  return (
    <>
      <PageHeader title="Settings" />
      <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Profile</h2><ProfileForm user={{ ...user, phone: displayPhone(user.phone) }} /></section>
      <section className="mt-4 rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Password</h2><ChangePasswordForm /></section>
    </>
  );
}
