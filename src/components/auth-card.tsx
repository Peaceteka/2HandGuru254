export function AuthCard({ title, subtitle, children, footer, wide }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="container-page py-8 sm:py-14">
      <div className={`mx-auto ${wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="rounded-xl border bg-white p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-600">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-neutral-600">{footer}</div>}
      </div>
    </div>
  );
}
