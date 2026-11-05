import type { Dispute, DisputeEvidence } from "@prisma/client";
import { DISPUTE_REASON_LABELS } from "@/lib/constants";
import { fileUrl } from "@/lib/storage";
import { formatDate } from "@/lib/format";

type D = Dispute & { evidence: (DisputeEvidence & { user: { id: string; name: string } })[] };

export function DisputePanel({ dispute, buyerId, children }: { dispute: D; buyerId: string; children?: React.ReactNode }) {
  const open = dispute.status === "OPEN";
  return (
    <section className="rounded-xl border border-amber-300 bg-amber-50/60 p-5" aria-labelledby="dispute-h">
      <h2 id="dispute-h" className="font-semibold">
        Dispute: {DISPUTE_REASON_LABELS[dispute.reason]} {open ? <span className="text-sm font-normal text-amber-800">— funds frozen pending review</span> : null}
      </h2>
      {!open && (
        <p className="mt-2 text-sm">
          <strong>{dispute.status === "RESOLVED_RELEASED" ? "Resolved: released to seller." : "Resolved: refunded to buyer."}</strong> {dispute.resolutionNote}
        </p>
      )}
      <ol className="mt-4 space-y-3">
        {dispute.evidence.map((e) => (
          <li key={e.id} className="rounded-lg border bg-white p-3">
            <p className="text-xs text-muted-foreground">
              <strong className="text-neutral-800">{e.user.name}</strong> ({e.user.id === buyerId ? "buyer" : "seller/admin"}) · {formatDate(e.createdAt, true)}
            </p>
            <p className="mt-1 text-sm whitespace-pre-line">{e.note}</p>
            {e.imageKeys.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {e.imageKeys.map((k) => (
                  <a key={k} href={fileUrl(k)} target="_blank" rel="noreferrer" className="block size-20 overflow-hidden rounded border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={fileUrl(k)} alt="Dispute evidence" className="size-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {open && children && <div className="mt-4">{children}</div>}
    </section>
  );
}
