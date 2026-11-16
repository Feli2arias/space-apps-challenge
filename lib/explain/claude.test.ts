import { describe, expect, it } from "vitest";
import { contentOfResponse, jsonTextOf } from "./claude";

function answer(text: string, stopReason = "end_turn"): unknown {
  return { content: [{ type: "text", text }], stop_reason: stopReason };
}

describe("jsonTextOf", () => {
  it("leaves a bare object as it is", () => {
    expect(jsonTextOf('{"ok": true}')).toBe('{"ok": true}');
  });

  it("takes the object out of a code fence or a sentence", () => {
    expect(jsonTextOf('```json\n{"ok": true}\n```')).toBe('{"ok": true}');
    expect(jsonTextOf('Here it is: {"a": {"b": 1}} Done.')).toBe('{"a": {"b": 1}}');
  });

  it("gives back text without an object unchanged, so the caller rejects it", () => {
    expect(jsonTextOf(" no object here ")).toBe("no object here");
  });
});

describe("contentOfResponse", () => {
  it("joins the text blocks and ignores the rest", () => {
    const raw = {
      content: [{ type: "thinking" }, { type: "text", text: '{"ok":' }, { type: "text", text: " true}" }],
      stop_reason: "end_turn",
    };
    expect(contentOfResponse(raw)).toBe('{"ok": true}');
  });

  it("rejects an answer cut short by the length limit", () => {
    expect(() => contentOfResponse(answer('{"ok": tr', "max_tokens"))).toThrow(/ran out of room/);
  });

  it("rejects an empty answer or another shape", () => {
    expect(() => contentOfResponse({ content: [] })).toThrow(/no text/);
    expect(() => contentOfResponse({ type: "error", error: { type: "overloaded_error" } })).toThrow(
      /unexpected format/,
    );
  });
});
