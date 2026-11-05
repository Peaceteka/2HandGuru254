import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-neutral-50 p-6 text-center">
      <div>
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-neutral-600">The page or listing you&apos;re looking for doesn&apos;t exist or is no longer available.</p>
        <Link href="/" className="mt-6 inline-block rounded-lg bg-brand-yellow px-4 py-2 font-medium text-brand-black">Back to home</Link>
      </div>
    </main>
  );
}
