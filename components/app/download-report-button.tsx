"use client";

// Contract: DownloadReportButton
// Props: request (AnalysisRequest, required) — the analysis whose results are on screen
//        locale (Locale, required) — language of the file
// Variants: none (a small outline button, sized like the other actions of the plot box)
// States: idle | working (busy while the server writes the file) | failed (a plain message
//         under the button; pressing again retries)
// Accessibility: a real button with aria-busy; the outcome is announced through a polite
//                live region; the download starts by itself, with a readable file name
// Responsive: keeps its 44 px height; the message wraps under it

import { useEffect, useRef, useState } from "react";
import type { AnalysisRequest } from "@/lib/analysis/types";
import { REPORT_WORDS } from "@/lib/report/words";
import type { Locale } from "@/lib/site";
import { PixelButton } from "./pixel-button";

interface DownloadReportButtonProps {
  readonly request: AnalysisRequest;
  readonly locale: Locale;
}

type Phase = "idle" | "working" | "failed";

const ENDPOINT = "/api/report";

/** The file name the server proposes, or a plain one when it gives none. */
function fileNameFrom(response: Response, fallback: string): string {
  const header = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(header);
  return match ? match[1] : `${fallback}.pdf`;
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DownloadReportButton({ request, locale }: DownloadReportButtonProps) {
  const words = REPORT_WORDS[locale];
  const [phase, setPhase] = useState<Phase>("idle");
  const pending = useRef<AbortController | null>(null);

  // Leaving the screen cancels a file that is still being written.
  useEffect(() => () => pending.current?.abort(), []);

  const download = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setPhase("working");
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request, locale }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`The report answered with status ${response.status}.`);
      save(await response.blob(), fileNameFrom(response, words.fileName));
      setPhase("idle");
    } catch {
      if (controller.signal.aborted) return;
      setPhase("failed");
    }
  };

  return (
    <span className="inline-flex flex-col gap-1.5">
      <PixelButton size="sm" busy={phase === "working"} onClick={() => void download()}>
        {phase === "working" ? words.button.working : words.button.download}
      </PixelButton>
      <span aria-live="polite" className="text-small text-cinnabar-deep empty:hidden">
        {phase === "failed" ? words.button.failed : null}
      </span>
    </span>
  );
}
