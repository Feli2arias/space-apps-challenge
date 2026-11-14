import { describe, expect, it } from "vitest";
import { clientIdFrom, createRateLimiter } from "./rate-limit";

const at = (seconds: number) => new Date(seconds * 1000);

describe("createRateLimiter", () => {
  it("allows requests up to the limit and then refuses", () => {
    const limiter = createRateLimiter(2, 60);
    expect(limiter.check("a", at(0)).allowed).toBe(true);
    expect(limiter.check("a", at(1)).allowed).toBe(true);
    const refused = limiter.check("a", at(2));
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBe(58);
  });

  it("allows again once the window has passed", () => {
    const limiter = createRateLimiter(1, 60);
    expect(limiter.check("a", at(0)).allowed).toBe(true);
    expect(limiter.check("a", at(59)).allowed).toBe(false);
    expect(limiter.check("a", at(60)).allowed).toBe(true);
  });

  it("counts each client separately", () => {
    const limiter = createRateLimiter(1, 60);
    expect(limiter.check("a", at(0)).allowed).toBe(true);
    expect(limiter.check("b", at(0)).allowed).toBe(true);
  });

  it("does not count refused requests against the client", () => {
    const limiter = createRateLimiter(1, 60);
    limiter.check("a", at(0));
    limiter.check("a", at(30));
    expect(limiter.check("a", at(60)).allowed).toBe(true);
  });
});

describe("clientIdFrom", () => {
  it("uses the first forwarded address", () => {
    expect(clientIdFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to the real-ip header and then to a fixed label", () => {
    expect(clientIdFrom(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIdFrom(new Headers())).toBe("unknown");
  });
});
