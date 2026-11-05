import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { PageHeader } from "@/components/dashboard-shell";
import { CategoryForm } from "@/components/admin-ui";
import { CategoryIcon } from "@/components/category-icon";

export const metadata: Metadata = { title: "Categories" };

export default async function Categories() {
  await requireAdmin();
  const cats = await db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { listings: true } } } });
  return (
    <>
      <PageHeader title="Categories" />
      <section className="mb-4 rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Add category</h2><CategoryForm /></section>
      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="rounded-xl border bg-white p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-medium"><CategoryIcon name={c.icon} className="size-4" /> {c.name} <span className="text-muted-foreground">({c._count.listings} listings)</span></p>
            <CategoryForm category={c} />
          </li>
        ))}
      </ul>
    </>
  );
}
