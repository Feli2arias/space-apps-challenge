import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotationsPreviewLoader } from "@/components/app/rotations/preview-loader";

/**
 * Development-only page for checking the rotation explorer with a real
 * analysis of the test area (fetched from POST /api/analysis, usually cached).
 * In production it does not exist: the route answers 404.
 * Add `?lang=en` to see the English words.
 */
export const metadata: Metadata = {
  title: "Rotations preview (test area) | Before the Seed",
  robots: { index: false, follow: false },
};

export default function RotationsPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RotationsPreviewLoader />;
}
