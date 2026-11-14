// Contract: form controls of the analysis screen (FieldError, CoordinateField, ChoiceRow)
// Props: see each component below; all text arrives translated
// Variants: none. ChoiceRow is one compact row: a short label on the left (with an optional
//           "?" help toggle and a small note under it) and the options side by side
// States: CoordinateField: default | focus-visible (outline) | invalid (cinnabar-deep
//         border and a message under the field). ChoiceRow: unselected | selected (ink
//         fill) | focus-visible (outline on the option) | help open (sentence under the
//         row). No loading or empty state.
// Accessibility: real <input> elements with visible labels; placeholders only add an
//                example, they never replace the label. Hints and errors are linked with
//                aria-describedby and errors set aria-invalid. Choices are native radio
//                buttons inside a <fieldset> with a <legend>, so arrow keys move between
//                options. Every control is at least 44px tall. Errors are text with an
//                icon, never colour alone.
// Responsive: controls fill the width they are given; options share it equally

import type { ClipboardEvent, FocusEvent, ReactNode, Ref } from "react";
import { HelpButton, HelpText, useHelpToggle } from "@/components/app/results/help-toggle";
import { PixelIcon } from "@/components/ui/pixel-icon";
import { cn } from "@/lib/cn";

export const SUB_LEGEND_CLASSES = "font-mono text-label tracking-label uppercase";
export const HINT_CLASSES = "text-small text-muted";

interface FieldErrorProps {
  readonly id?: string;
  readonly children: ReactNode;
  /** Announce it as soon as it appears. Used where no field can take the focus. */
  readonly announce?: boolean;
  readonly className?: string;
}

export function FieldError({ id, children, announce = false, className }: FieldErrorProps) {
  return (
    <p
      id={id}
      role={announce ? "alert" : undefined}
      className={cn("flex items-start gap-2 text-small font-medium text-cinnabar-deep", className)}
    >
      <PixelIcon name="cross" className="mt-1 size-2.5" />
      <span>{children}</span>
    </p>
  );
}

interface CoordinateFieldProps {
  readonly id: string;
  readonly label: string;
  /** Muted example inside the empty field, e.g. the accepted range. */
  readonly placeholder: string;
  /** Id of a hint shared by both coordinate fields. */
  readonly describedBy?: string;
  readonly value: string;
  /** Sentence explaining what is wrong, when something is. */
  readonly error: string | null;
  readonly inputRef?: Ref<HTMLInputElement>;
  readonly onChange: (text: string) => void;
  readonly onBlur: (event: FocusEvent<HTMLInputElement>) => void;
  readonly onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

export function CoordinateField({
  id,
  label,
  placeholder,
  describedBy,
  value,
  error,
  inputRef,
  onChange,
  onBlur,
  onPaste,
}: CoordinateFieldProps) {
  const errorId = `${id}-error`;
  const described = [describedBy, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={cn("block text-muted", SUB_LEGEND_CLASSES)}>
        {label}
      </label>
      {/*
        A plain text keyboard on purpose: the numeric keypads of some phones have
        no minus sign, and every longitude in the Americas needs one.
      */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        onPaste={onPaste}
        aria-invalid={error ? true : undefined}
        aria-describedby={described || undefined}
        className={cn(
          "mt-1 h-11 w-full border bg-white px-3 font-mono text-body placeholder:text-muted",
          error ? "border-2 border-cinnabar-deep" : "border-ink",
        )}
      />
      {error ? (
        <FieldError id={errorId} className="mt-1">
          {error}
        </FieldError>
      ) : null}
    </div>
  );
}

export interface ChoiceOption<T extends string | number> {
  readonly value: T;
  readonly label: string;
}

export interface ChoiceHelp {
  /** Accessible name of the "?" button. */
  readonly label: string;
  /** Sentence shown under the row when the "?" is pressed. */
  readonly text: string;
}

interface ChoiceRowProps<T extends string | number> {
  /** Shared by the radio buttons of the group; must be unique on the page. */
  readonly name: string;
  /** Short visible label, also the group's legend. */
  readonly legend: string;
  /** Small text under the label, e.g. "4 ha". Read out with the legend. */
  readonly note?: string;
  readonly help?: ChoiceHelp;
  readonly options: readonly ChoiceOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** Extra content inside the group, after the row. */
  readonly children?: ReactNode;
  readonly className?: string;
}

const OPTION_CLASSES =
  "flex min-h-11 cursor-pointer items-center justify-center border border-ink bg-white px-2 py-2 text-center " +
  "transition-colors hover:bg-mist peer-checked:bg-ink peer-checked:text-white " +
  "peer-focus-visible:relative peer-focus-visible:z-10 peer-focus-visible:outline-2 " +
  "peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cinnabar-deep";

export function ChoiceRow<T extends string | number>({
  name,
  legend,
  note,
  help,
  options,
  value,
  onChange,
  children,
  className,
}: ChoiceRowProps<T>) {
  const helpState = useHelpToggle();

  return (
    <fieldset className={cn("min-w-0", className)}>
      {/* The legend is read out; the visible label below is the same words laid out in the row. */}
      <legend className="sr-only">
        {legend}
        {note ? `, ${note}` : null}
      </legend>
      <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-2">
        <div className="flex min-w-0 flex-col justify-center">
          <span className="flex items-center gap-1.5">
            <span aria-hidden="true" className={SUB_LEGEND_CLASSES}>
              {legend}
            </span>
            {help ? <HelpButton label={help.label} state={helpState} /> : null}
          </span>
          {note ? (
            <span aria-hidden="true" className="font-mono text-label text-muted">
              {note}
            </span>
          ) : null}
        </div>
        <div className="flex">
          {options.map((option, index) => (
            // Neighbours overlap by one pixel so the shared border is not doubled.
            <label key={option.value} className={cn("relative block flex-1", index > 0 && "-ml-px")}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={option.value === value}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className={OPTION_CLASSES}>
                <span className="font-mono text-small font-semibold whitespace-nowrap uppercase">
                  {option.label}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {help ? <HelpText state={helpState} text={help.text} className="mt-1.5" /> : null}
      {children}
    </fieldset>
  );
}
