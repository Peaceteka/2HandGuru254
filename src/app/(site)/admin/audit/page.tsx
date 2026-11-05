import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/dashboard-shell";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Audit log" };
const PER = 50;

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [total, logs] = await Promise.all([
    db.auditLog.count(),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { actor: { select: { name: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, newest first. Entries are append-only." />
      <div className="overflow-x-auto rounded-xl border bg-white">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Admin</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{formatDate(l.createdAt, true)}</TableCell>
                <TableCell>{l.actor.name}</TableCell>
                <TableCell className="font-mono text-xs">{l.action}</TableCell>
                <TableCell className="font-mono text-xs">{l.entityType}:{l.entityId.slice(-8)}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={l.details ? JSON.stringify(l.details) : ""}>{l.details ? JSON.stringify(l.details) : ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4"><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER))} makeHref={(p) => `/admin/audit?page=${p}`} /></div>
    </>
  );
}
