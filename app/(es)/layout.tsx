import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/root-document";
import { es } from "@/lib/i18n/es";
import { createMetadata } from "@/lib/metadata";
import "../globals.css";

export const metadata: Metadata = createMetadata(es);

interface LayoutProps {
  readonly children: ReactNode;
}

export default function SpanishLayout({ children }: LayoutProps) {
  return <RootDocument dict={es}>{children}</RootDocument>;
}
