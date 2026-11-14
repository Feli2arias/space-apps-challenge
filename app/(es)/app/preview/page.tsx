import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PreviewGallery } from "@/components/app/results/preview-gallery";

/**
 * Development-only page for checking the seed loader and the results panel
 * without a backend. It renders invented sample data and says so in a banner.
 * In production it does not exist: the route answers 404.
 */
export const metadata: Metadata = {
  title: "Layout preview (invented sample data) | Before the Seed",
  robots: { index: false, follow: false },
};

export default function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    // The gallery reads its starting state from the address, which is only known
    // per request: the boundary lets the rest of the page be prerendered.
    <Suspense fallback={null}>
      <PreviewGallery />
    </Suspense>
  );
}
