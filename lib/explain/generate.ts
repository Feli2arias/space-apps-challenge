import { askModel, type ChatMessage } from "./claude";
import { correctionMessage } from "./prompts";
import type { Checked } from "./grounded";

/** One correction is allowed when the first answer does not pass the checks. */
const MAX_ATTEMPTS = 2;

/**
 * Asks the model and keeps its answer only if it passes `check`. A failed
 * answer is sent back once with what was wrong. Returns `null` when no attempt
 * passed: the caller then tells the reader the text was discarded.
 */
export async function generateChecked<T>(
  label: string,
  conversation: readonly ChatMessage[],
  check: (raw: string) => Checked<T>,
  signal?: AbortSignal,
): Promise<T | null> {
  let messages = conversation;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const answer = await askModel(messages, signal);
    const result = check(answer);
    if (result.ok) return result.value;
    console.error(`[${label}] attempt ${attempt} discarded: ${result.problem}`);
    messages = [
      ...messages,
      { role: "assistant", content: answer },
      { role: "user", content: correctionMessage(result.problem) },
    ];
  }
  return null;
}
