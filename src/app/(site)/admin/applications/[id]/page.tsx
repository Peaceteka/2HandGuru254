import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { fileUrl } from "@/lib/storage";
import { formatDate } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { rejectApplicationAction } from "@/server/admin-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ApproveButton, ReasonForm } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Review application" };

export default async function ApplicationDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const a = await db.sellerProfile.findUnique({ where: { id }, include: { user: { select: { email: true, phone: true, createdAt: true } }, reviewedBy: { select: { name: true } } } });
  if (!a) notFound();
  const rows: [string, React.ReactNode][] = [
    ["Full name", a.fullName], ["ID number", a.idNumber], ["Phone", displayPhone(a.phone)], ["Account phone", displayPhone(a.user.phone)],
    ["Email", a.user.email], ["Business name", a.businessName || "—"], ["Location", `${a.town ? `${a.town}, ` : ""}${a.county}`],
    ["Applied", formatDate(a.createdAt, true)], ["Account created", formatDate(a.user.createdAt)],
  ];
  return (
    <>
      <PageHeader title={a.fullName} description={`Status: ${a.status.toLowerCase()}${a.reviewedBy ? ` by ${a.reviewedBy.name} on ${formatDate(a.reviewedAt)}` : ""}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-5">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">{rows.map(([k, v]) => <div key={k}><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>
          <h2 className="mt-5 text-sm text-muted-foreground">Description</h2>
          <p className="whitespace-pre-line text-sm">{a.description}</p>
          {a.rejectionReason && <p className="mt-4 rounded bg-red-50 p-2 text-sm text-red-800">Rejection reason: {a.rejectionReason}</p>}
        </section>
        <section className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">ID photo</h2>
          <a href={fileUrl(a.idPhotoKey)} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(a.idPhotoKey)} alt={`ID document for ${a.fullName}`} className="max-h-80 w-full rounded-lg border object-contain" />
          </a>
        </section>
      </div>
      {a.status === "PENDING" && (
        <section className="mt-4 grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2">
          <div><h2 className="mb-2 font-semibold">Approve</h2><p className="mb-3 text-sm text-neutral-600">The applicant becomes a verified seller and is notified by email, SMS and in-app.</p><ApproveButton profileId={a.id} /></div>
          <div><h2 className="mb-2 font-semibold">Reject</h2><ReasonForm action={rejectApplicationAction.bind(null, a.id)} label="Reject application" variant="destructive" placeholder="e.g. ID photo is blurry — please upload a clearer image" /></div>
        </section>
      )}
    </>
  );
}
