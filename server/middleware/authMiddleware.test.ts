import { describe, expect, it } from "vitest";
import { invalidateAuthCache } from "./authMiddleware";

describe("authMiddleware TTL cache", () => {
  it("exports invalidateAuthCache function that executes without error", () => {
    expect(() => invalidateAuthCache("test-user-id")).not.toThrow();
    expect(() => invalidateAuthCache()).not.toThrow();
  });
});
