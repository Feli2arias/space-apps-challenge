// Contract: MonthGridEditor
// Props: months (readonly CoverLevel[], required) — 12 declared levels, January first
//        onChange ((monthIndex: number, level: CoverLevel) => void, required)
//        label (string, required) — accessible name of the group, includes the rotation name
//        dict (RotationsDictionary, required)
// Variants: none
// States: one cell per month showing bare | low | medium | high; focus-visible outline on the
//         focused cell; hover darkens the border
// Accessibility: a labelled group of 12 real buttons with a roving tab stop (one Tab stop for
//                the whole grid). Enter/Space or a tap cycles the level; ArrowLeft/Right move
//                between months (Home/End jump to the ends); ArrowUp/Down raise or lower the
//                level. Each button's name is "month: level" in words. Levels are told apart
//                by a letter AND by the height of the filled block, never by colour alone.
// Responsive: 6 columns × 2 rows at every width; each cell is at least 44 × 56 px

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { monthName } from "@/lib/analysis/format";
import { fill } from "@/lib/i18n/app/results";
import type { RotationsDictionary } from "@/lib/i18n/app/rotations";
import { COVER_LEVELS, COVER_PERCENT, type CoverLevel } from "@/lib/rotation/exposure";
import { cn } from "@/lib/cn";
import { cycleLevel, stepLevel } from "./plans";

interface MonthGridEditorProps {
  readonly months: readonly CoverLevel[];
  readonly onChange: (monthIndex: number, level: CoverLevel) => void;
  readonly label: string;
  readonly dict: RotationsDictionary;
}

const LAST_MONTH_INDEX = 11;

export function LevelSwatch({ level, dict }: { readonly level: CoverLevel; readonly dict: RotationsDictionary }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-6 shrink-0 items-start justify-center overflow-hidden border border-ink bg-white",
        level === "bare" && "border-dashed",
      )}
    >
      <span className="absolute inset-x-0 bottom-0 block bg-stone" style={{ height: `${COVER_PERCENT[level]}%` }} />
      <span className="relative font-mono text-label leading-none font-semibold">{dict.levels[level].letter}</span>
    </span>
  );
}

export function MonthGridEditor({ months, onChange, label, dict }: MonthGridEditorProps) {
  const helpId = useId();
  const [active, setActive] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  const focusMonth = (index: number) => {
    const next = Math.min(Math.max(index, 0), LAST_MONTH_INDEX);
    setActive(next);
    buttons.current[next]?.focus();
  };

  const handleKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const level = months[index];
    const actions: Readonly<Record<string, () => void>> = {
      ArrowRight: () => focusMonth(index + 1),
      ArrowLeft: () => focusMonth(index - 1),
      Home: () => focusMonth(0),
      End: () => focusMonth(LAST_MONTH_INDEX),
      ArrowUp: () => onChange(index, stepLevel(level, 1)),
      ArrowDown: () => onChange(index, stepLevel(level, -1)),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div>
      <div role="group" aria-label={label} aria-describedby={helpId} className="grid grid-cols-6 gap-1">
        {months.map((level, index) => {
          const month = monthName(index + 1, dict.locale, "long") ?? String(index + 1);
          return (
            <button
              key={month}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              type="button"
              tabIndex={index === active ? 0 : -1}
              aria-label={fill(dict.editor.cellLabel, { month, level: dict.levels[level].name })}
              onClick={() => {
                setActive(index);
                onChange(index, cycleLevel(level));
              }}
              onKeyDown={(event) => handleKey(event, index)}
              data-level={level}
              className={cn(
                "relative flex min-h-14 min-w-11 cursor-pointer flex-col items-center justify-between overflow-hidden border border-ink bg-white pt-1 pb-0.5 hover:border-cinnabar-deep",
                level === "bare" && "border-dashed",
              )}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 block bg-stone"
                style={{ height: `${COVER_PERCENT[level]}%` }}
              />
              <span aria-hidden="true" className="relative font-mono text-label text-muted uppercase">
                {monthName(index + 1, dict.locale, "short")}
              </span>
              <span aria-hidden="true" className="relative bg-white px-1 font-display text-h3 leading-none">
                {dict.levels[level].letter}
              </span>
            </button>
          );
        })}
      </div>
      <p id={helpId} className="mt-2 text-small text-muted">
        {dict.editor.help}
      </p>
      <ul aria-label={dict.editor.legend} className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-small">
        {COVER_LEVELS.map((level) => (
          <li key={level} className="flex items-center gap-1.5">
            <LevelSwatch level={level} dict={dict} />
            {dict.levels[level].name} ({COVER_PERCENT[level]} %)
          </li>
        ))}
      </ul>
    </div>
  );
}
