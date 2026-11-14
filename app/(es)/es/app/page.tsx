import type { Metadata } from "next";
import { Workspace } from "@/components/app/workspace";
import { createAppMetadata } from "@/lib/i18n/app/app-metadata";

export const metadata: Metadata = createAppMetadata("es");

export default function SpanishAppPage() {
  return <Workspace locale="es" />;
}
