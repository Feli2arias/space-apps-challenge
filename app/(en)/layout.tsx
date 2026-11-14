import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RootDocument } from "@/components/root-document";
import { en } from "@/lib/i18n/en";
import { createMetadata } from "@/lib/metadata";
import "../globals.css";

export const metadata: Metadata = createMetadata(en);

interface LayoutProps {
  readonly children: ReactNode;
}

export default function EnglishLayout({ children }: LayoutProps) {
  return <RootDocument dict={en}>{children}</RootDocument>;
}
