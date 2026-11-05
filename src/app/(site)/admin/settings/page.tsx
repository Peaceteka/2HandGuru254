import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { config } from "@/lib/config";
import { PageHeader } from "@/components/dashboard-shell";
import { SettingsForm } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

export default async function Settings() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Platform settings" description="Escrow rules. Commission is locked onto each order when it's created." />
      <section className="rounded-xl border bg-white p-5"><SettingsForm values={s} /></section>
      <section className="mt-4 rounded-xl border bg-white p-5 text-sm">
        <h2 className="mb-2 font-semibold">Environment</h2>
        <p>M-Pesa mode: <code className="font-mono">{config.mpesa.mode}</code></p>
        <p>Storage driver: <code className="font-mono">{config.storage.driver}</code></p>
      </section>
    </>
  );
}
