// Contract: AiThinking
// Props: label (string, required) — what the language model is doing right now
//        className (string, optional)
// Variants: none
// States: one — shown for as long as the request is running. There is no progress figure:
//         the wait has no measurable steps, so none is pretended.
// Accessibility: role="status" so the label is announced once; the drawing is decorative
// Responsive: drawing and text side by side at every width

import { cn } from "@/lib/cn";
import { MiniSprout } from "../loader/mini-sprout";
import "./ai-thinking.css";

interface AiThinkingProps {
  readonly label: string;
  readonly className?: string;
}

export function AiThinking({ label, className }: AiThinkingProps) {
  return (
    <div role="status" className={cn("flex items-center gap-4", className)}>
      <MiniSprout className="size-10 shrink-0" />
      <p className="text-body text-muted">
        {label}
        <span aria-hidden="true" className="ai-thinking__cursor ml-1 inline-block h-3.5 w-2 translate-y-0.5 bg-cinnabar" />
      </p>
    </div>
  );
}
