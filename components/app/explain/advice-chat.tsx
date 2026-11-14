"use client";

// Contract: AdviceChat
// Props: request (AnalysisRequest, required) — the analysis the questions are about
//        locale (Locale, required)
//        sourceNames (Record<SourceId, string>, required)
// Variants: none
// States: empty (a note on what it can answer and example questions) | waiting (the question
//         is shown, a small animation and a status line; the form is busy) | answered (each
//         turn: the question, then the answer with the sources it rests on, or a tag saying the
//         analysis does not hold that information) | discarded (the answer did not pass the
//         checks: said plainly) | error (plain message by cause; the question can be sent again)
// Accessibility: an h3; the conversation is a polite live log; a labelled text field with a
//                visible character count; Enter sends; example questions are real buttons
// Responsive: a single column; the field and its button stack under 480 px of container width

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { AnalysisRequest, SourceId } from "@/lib/analysis/types";
import { MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH, type ChatAnswer } from "@/lib/explain/chat";
import { AI_DICTIONARY } from "@/lib/i18n/app/ai";
import type { Locale } from "@/lib/site";
import { PixelButton } from "../pixel-button";
import { postAi, type AiErrorKind } from "./ai-request";
import { AiThinking } from "./ai-thinking";

interface AdviceChatProps {
  readonly request: AnalysisRequest;
  readonly locale: Locale;
  readonly sourceNames: Readonly<Record<SourceId, string>>;
}

/** What came back for a question; `answer` is null when the text was discarded by the checks. */
type AskData = Omit<ChatAnswer, "answer"> & { readonly answer: string | null };

type Outcome =
  | { readonly kind: "waiting" }
  | { readonly kind: "answered"; readonly data: AskData }
  | { readonly kind: "error"; readonly error: AiErrorKind };

interface Turn {
  readonly id: number;
  readonly question: string;
  readonly outcome: Outcome;
}

const ENDPOINT = "/api/ask";

/** Earlier turns sent as context: only those that got a real answer. */
function historyOf(turns: readonly Turn[]): { question: string; answer: string }[] {
  return turns
    .flatMap((turn) =>
      turn.outcome.kind === "answered" && turn.outcome.data.answer !== null
        ? [{ question: turn.question, answer: turn.outcome.data.answer }]
        : [],
    )
    .slice(-MAX_HISTORY_TURNS);
}

export function AdviceChat({ request, locale, sourceNames }: AdviceChatProps) {
  const dict = AI_DICTIONARY[locale];
  const fieldId = useId();
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const [draft, setDraft] = useState("");
  const pending = useRef<AbortController | null>(null);
  const nextId = useRef(1);

  // Leaving the screen cancels a question that is still being answered.
  useEffect(() => () => pending.current?.abort(), []);

  const waiting = turns.some((turn) => turn.outcome.kind === "waiting");

  const ask = async (text: string) => {
    const question = text.trim().slice(0, MAX_QUESTION_LENGTH);
    if (question === "" || waiting) return;

    const id = nextId.current;
    nextId.current += 1;
    const history = historyOf(turns);
    const controller = new AbortController();
    pending.current = controller;
    setDraft("");
    setTurns((current) => [...current, { id, question, outcome: { kind: "waiting" } }]);

    const settle = (outcome: Outcome) =>
      setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, outcome } : turn)));

    try {
      const result = await postAi<AskData>(ENDPOINT, { request, locale, question, history }, controller.signal);
      if (controller.signal.aborted) return;
      settle(result.ok ? { kind: "answered", data: result.data } : { kind: "error", error: result.error });
    } catch {
      // Cancelled because the screen was left: nothing to show.
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(draft);
  };

  return (
    <div className="@container flex flex-col gap-4 border-t border-ink pt-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-mono text-small font-semibold tracking-brand uppercase">{dict.chat.title}</h3>
        <p className="max-w-prose text-small text-muted">{dict.chat.intro}</p>
      </div>

      <div role="log" aria-live="polite" className="flex flex-col gap-4">
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-2">
            <p className="max-w-prose self-end bg-ink px-3.5 py-2 text-body text-white">
              <span className="sr-only">{dict.chat.you}: </span>
              {turn.question}
            </p>
            {turn.outcome.kind === "waiting" ? <AiThinking label={dict.chat.working} /> : null}
            {turn.outcome.kind === "error" ? (
              <p className="max-w-prose border-l-2 border-cinnabar pl-4 text-body">
                {dict.errors[turn.outcome.error]}
              </p>
            ) : null}
            {turn.outcome.kind === "answered" ? (
              <div className="flex max-w-prose flex-col gap-1.5 border-l-2 border-ink pl-4">
                <p className="text-body">
                  <span className="sr-only">{dict.chat.assistant}: </span>
                  {turn.outcome.data.answer ?? dict.chat.discarded}
                </p>
                {turn.outcome.data.answer !== null ? (
                  <p className="font-mono text-label tracking-label text-muted uppercase">
                    {turn.outcome.data.answerable && turn.outcome.data.basedOn.length > 0
                      ? `${dict.basedOn}: ${turn.outcome.data.basedOn.map((source) => sourceNames[source]).join(" · ")}`
                      : turn.outcome.data.answerable
                        ? dict.origin
                        : dict.chat.noData}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {turns.length === 0 ? (
        <ul aria-label={dict.chat.suggestionsLabel} className="flex flex-wrap gap-2">
          {dict.chat.suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => void ask(suggestion)}
                className="min-h-11 cursor-pointer border border-line bg-paper px-3.5 text-left text-small hover:border-ink"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={fieldId} className="font-mono text-label tracking-label text-muted uppercase">
          {dict.chat.inputLabel}
        </label>
        <div className="flex flex-col gap-2 @md:flex-row">
          <input
            id={fieldId}
            type="text"
            value={draft}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder={dict.chat.placeholder}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-11 min-w-0 flex-1 border border-ink bg-white px-3.5 text-body placeholder:text-muted"
          />
          <PixelButton type="submit" variant="ink" busy={waiting} unavailable={draft.trim() === ""}>
            {dict.chat.send}
          </PixelButton>
        </div>
        <p className="text-small text-muted">
          {dict.chat.remaining.replace("{left}", String(MAX_QUESTION_LENGTH - draft.length))}
        </p>
      </form>
    </div>
  );
}
