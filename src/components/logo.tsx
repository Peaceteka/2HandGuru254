import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", inverted = false, size = 56, showWordmark = true }: { className?: string; href?: string; inverted?: boolean; size?: number; showWordmark?: boolean }) {
  return (
    <Link href={href} className={cn("flex shrink-0 items-center gap-2.5", className)} aria-label="2ndHandGuru home">
      <Image src="/logo.webp" alt="" width={size} height={size} priority className="size-11 rounded-full shadow-sm sm:size-14" />
      {showWordmark && (
        <span className={cn("hidden text-2xl font-extrabold tracking-tight sm:inline", inverted ? "text-white" : "text-brand-black")}>
          <span className="text-brand-yellow">2nd</span>HandGuru
        </span>
      )}
    </Link>
  );
}
