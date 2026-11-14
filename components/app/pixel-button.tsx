// Contract: PixelButton
// Props: children (ReactNode, required) — the label
//        variant ("accent" | "outline" | "ink", optional, default "outline")
//        size ("md" | "sm", optional, default "md")
//        withArrow (boolean, optional, default false) — pixel arrow after the label
//        busy (boolean, optional, default false) — the action is running; presses are ignored
//        unavailable (boolean, optional, default false) — the action cannot be used right now
//        type, onClick, className and any other <button> attribute
// Variants: same three looks as PixelLink (accent = cinnabar with hard ink shadow,
//           outline = white with ink border, ink = ink fill), so links and buttons match
// States: default | hover (lifts 2px up-left in two steps) | focus-visible (2px outline)
//         | active (presses 2px down-right) | busy and unavailable (muted, no lift, presses
//         ignored). There is no error or empty state: the caller shows those next to it.
// Accessibility: a real <button>. Busy and unavailable use aria-disabled instead of the
//                disabled attribute, so the button keeps keyboard focus and screen readers
//                can still find it; busy also sets aria-busy. 44px minimum height.
// Responsive: intrinsic width unless the caller passes a width class; the label never wraps

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from "react";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { cn } from "@/lib/cn";

type PixelButtonVariant = "accent" | "outline" | "ink";
type PixelButtonSize = "md" | "sm";

interface PixelButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  readonly children: ReactNode;
  readonly variant?: PixelButtonVariant;
  readonly size?: PixelButtonSize;
  readonly withArrow?: boolean;
  readonly busy?: boolean;
  readonly unavailable?: boolean;
}

const VARIANT_CLASSES: Readonly<Record<PixelButtonVariant, string>> = {
  accent: "border-cinnabar bg-cinnabar text-ink shadow-pixel-sm",
  outline: "border-ink bg-white text-ink",
  ink: "border-ink bg-ink text-white",
};

const HOVER_CLASSES: Readonly<Record<PixelButtonVariant, string>> = {
  accent: "active:shadow-none",
  outline: "hover:bg-ink hover:text-white",
  ink: "hover:bg-white hover:text-ink",
};

const SIZE_CLASSES: Readonly<Record<PixelButtonSize, string>> = {
  md: "px-5",
  sm: "px-3.5",
};

const LIFT_CLASSES =
  "cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5";

export function PixelButton({
  children,
  variant = "outline",
  size = "md",
  withArrow = false,
  busy = false,
  unavailable = false,
  type = "button",
  onClick,
  className,
  ...rest
}: PixelButtonProps) {
  const inactive = busy || unavailable;

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (inactive) {
      // Also stops a submit button from sending its form.
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      {...rest}
      type={type}
      aria-disabled={inactive || undefined}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2.5 border font-mono text-small font-semibold tracking-label whitespace-nowrap uppercase",
        "transition-[translate,background-color,color,box-shadow] motion-reduce:transition-none",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        inactive ? "cursor-not-allowed opacity-60" : cn(LIFT_CLASSES, HOVER_CLASSES[variant]),
        className,
      )}
    >
      {children}
      {withArrow ? <PixelIcon name="arrow" className="h-2.5 w-3" /> : null}
    </button>
  );
}
