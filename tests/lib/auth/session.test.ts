import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

describe("session encryption", () => {
  it("round-trips a payload", async () => {
    const { encryptSession, decryptSession } = await import("@/lib/auth/session");
    const payload = {
      redmineId: 42,
      name: "Nguyen Nguyen",
      email: "nguyen@example.com",
      role: "manager" as const,
      apiKey: "abc123",
    };
    const token = encryptSession(payload);
    expect(typeof token).toBe("string");
    expect(decryptSession(token)).toEqual(payload);
  });

  it("throws on tampered token", async () => {
    const { encryptSession, decryptSession } = await import("@/lib/auth/session");
    const token = encryptSession({
      redmineId: 1,
      name: "x",
      email: null,
      role: "member",
      apiKey: "k",
    });
    const tampered = token.slice(0, -4) + "AAAA";
    expect(() => decryptSession(tampered)).toThrow();
  });

  it("throws on garbage input", async () => {
    const { decryptSession } = await import("@/lib/auth/session");
    expect(() => decryptSession("not-a-real-token")).toThrow();
  });
});
