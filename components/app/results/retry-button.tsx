// Contract: RetryButton
// Props: sourceTitle (string, required) — name of the source, for the accessible label
//        busy (boolean, required) — true while the source is being queried again
//        onRetry (() => void, required) — asks the backend to query the source again
//        dict (ResultsDictionary, required)
// Variants: none (cinnabar fill with a hard ink shadow, like the site's primary action)
// States: default | hover (lifts 2px up-left) | focus-visible (2px outline) | active (presses
//         2px down-right) | busy (ignores presses, mist fill, blinking seed, "Consultando de
//         nuevo…")
// Accessibility: a real button, 44px tall; its accessible name includes the source ("Retry
//                Rain"); while busy it keeps focus, is marked aria-disabled and aria-busy,
//                and the new state is announced through a polite status region; ink on
//                cinnabar is 6.3:1
// Responsive: intrinsic width; the label never wraps
"use client";

import { PixelIcon } from "@/components/ui/pixel-icon";
import { fill, type ResultsDictionary } from "@/lib/i18n/app/results";
import { cn } from "@/lib/cn";
import "../busy.css";

interface RetryButtonProps {
  readonly sourceTitle: string;
  readonly busy: boolean;
  readonly onRetry: () => void;
  readonly dict: ResultsDictionary;
}

export function RetryButton({ sourceTitle, busy, onRetry, dict }: RetryButtonProps) {
  const { error } = dict;

  return (
    <>
      <button
        type="button"
        // Not `disabled`: a disabled button drops keyboard focus, and the person who
        // pressed Retry would lose their place. It stays focusable and ignores presses.
        onClick={busy ? undefined : onRetry}
        aria-disabled={busy}
        aria-busy={busy}
        aria-label={busy ? undefined : fill(error.retryLabel, { source: sourceTitle })}
        className={cn(
          "inline-flex min-h-11 items-center gap-2.5 self-start border px-5 font-mono text-small font-semibold tracking-label whitespace-nowrap uppercase",
          "transition-[translate] motion-reduce:transition-none",
          busy
            ? "cursor-progress border-ink bg-mist text-ink"
            : "border-cinnabar bg-cinnabar text-ink shadow-pixel-sm hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        )}
      >
        {busy ? <PixelIcon name="seed" className="size-3 app-busy-blink" /> : null}
        {busy ? error.retrying : error.retry}
      </button>
      <span role="status" className="sr-only">
        {busy ? `${sourceTitle}: ${error.retrying}` : ""}
      </span>
    </>
  );
}
