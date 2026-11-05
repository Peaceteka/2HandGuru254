export function StaticPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className="container-page py-8 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-xl border bg-white p-6 sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {intro && <p className="mt-3 text-lg text-neutral-600">{intro}</p>}
        <div className="prose-guru mt-8">{children}</div>
      </article>
    </div>
  );
}
