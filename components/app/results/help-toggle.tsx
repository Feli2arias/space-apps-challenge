"use client";

// Contract: HelpToggle
// Props: label (string, required) — accessible name, e.g. "Qué significa: Lluvia anual"
//        text (string, required) — the one-sentence explanation shown on demand
//        className (string, optional) — extra classes (cn does not merge conflicting ones)
// Variants: none
// States: closed (default: only a small "?" square) | open (square filled, sentence shown)
// Accessibility: a button with aria-expanded and aria-controls; the hit area is 44px even
//                though the square is 20px; visible focus from the global :focus-visible;
//                works with Enter, Space and touch
// Responsive: the sentence spans the full width of whatever holds the toggle
// Use `useHelpToggle` when the button and the sentence sit in different places.

import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export interface HelpState {
  readonly open: boolean;
  readonly id: string;
  readonly toggle: () => void;
}

export function useHelpToggle(): HelpState {
  const [open, setOpen] = useState(false);
  const id = useId();
  return { open, id, toggle: () => setOpen((value) => !value) };
}

interface HelpButtonProps {
  readonly label: string;
  readonly state: HelpState;
  readonly className?: string;
}

export function HelpButton({ label, state, className }: HelpButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={state.open}
      aria-controls={state.id}
      onClick={state.toggle}
      className={cn("-m-3 grid size-11 shrink-0 cursor-pointer place-items-center", className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-5 place-items-center border font-mono text-label leading-none font-semibold",
          state.open ? "border-ink bg-ink text-white" : "border-line text-muted",
        )}
      >
        ?
      </span>
    </button>
  );
}

interface HelpTextProps {
  readonly state: HelpState;
  readonly text: string;
  readonly className?: string;
}

export function HelpText({ state, text, className }: HelpTextProps) {
  return (
    <p id={state.id} hidden={!state.open} className={cn("text-small text-muted", className)}>
      {text}
    </p>
  );
}
