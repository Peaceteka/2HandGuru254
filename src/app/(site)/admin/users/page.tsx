import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { formatDate } from "@/lib/format";
import { displayPhone, normalizeKenyanPhone } from "@/lib/phone";
import { setUserStatusAction } from "@/server/admin-actions";
import { PageHeader } from "@/components/dashboard-shell";
import { ReasonForm } from "@/components/admin-ui";
import { Pagination } from "@/components/pagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Users" };
const PER = 25;

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const q = sp.q?.trim();
  const page = Math.max(1, Number(sp.page) || 1);
  const phone = q ? normalizeKenyanPhone(q) : null;
  const where: Prisma.UserWhereInput = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, ...(phone ? [{ phone }] : [])] }
    : {};
  const [total, users] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER, include: { sellerProfile: { select: { status: true } } } }),
  ]);
  return (
    <>
      <PageHeader title="Users" description={`${total} users`} />
      <form className="mb-4 flex gap-2" role="search">
        <label htmlFor="uq" className="sr-only">Search users</label>
        <Input id="uq" name="q" defaultValue={q} placeholder="Search name, email or phone" className="max-w-sm" />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      <ul className="divide-y rounded-xl border bg-white">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{u.name} <span className="ml-1 rounded bg-neutral-100 px-1.5 py-0.5 text-xs">{u.role.toLowerCase()}{u.sellerProfile && u.role !== "SELLER" ? ` · application ${u.sellerProfile.status.toLowerCase()}` : ""}</span>{u.status === "SUSPENDED" && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">suspended</span>}</p>
              <p className="text-xs text-muted-foreground">{u.email} · {displayPhone(u.phone)} · joined {formatDate(u.createdAt)}</p>
              {u.suspendedReason && <p className="text-xs text-red-700">Reason: {u.suspendedReason}</p>}
            </div>
            {u.id !== admin.id && u.role !== "ADMIN" && (
              u.status === "ACTIVE" ? (
                <details className="sm:w-72"><summary className="cursor-pointer text-sm text-red-700">Suspend…</summary><div className="mt-2"><ReasonForm action={setUserStatusAction.bind(null, u.id, "SUSPENDED")} label="Suspend user" variant="destructive" confirm="Suspend this user? Their active listings will be hidden." /></div></details>
              ) : (
                <ReasonForm action={setUserStatusAction.bind(null, u.id, "ACTIVE")} label="Reactivate" variant="outline" required={false} />
              )
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4"><Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PER))} makeHref={(p) => `/admin/users?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} /></div>
    </>
  );
}
