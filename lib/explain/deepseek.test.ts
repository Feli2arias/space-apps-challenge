import { describe, expect, it } from "vitest";
import { contentOfResponse } from "./deepseek";

function answer(content: string | null, finishReason = "stop"): unknown {
  return { choices: [{ message: { role: "assistant", content }, finish_reason: finishReason }] };
}

describe("contentOfResponse", () => {
  it("returns the text of the first choice", () => {
    expect(contentOfResponse(answer(' {"ok": true} '))).toBe('{"ok": true}');
  });

  it("rejects an answer cut short by the length limit", () => {
    expect(() => contentOfResponse(answer('{"ok": tr', "length"))).toThrow(/ran out of room/);
  });

  it("rejects an empty answer or another shape", () => {
    expect(() => contentOfResponse(answer(null))).toThrow(/no text/);
    expect(() => contentOfResponse({ error: { message: "Insufficient Balance" } })).toThrow(
      /unexpected format/,
    );
  });
});
