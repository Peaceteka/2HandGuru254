"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-neutral-600">Please try again. If the problem continues, contact support.</p>
      <Button className="mt-6" onClick={reset}>Try again</Button>
    </div>
  );
}
