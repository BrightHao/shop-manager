import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock at module scope — hoisted and recreated on vi.resetModules
const mockSignOut = vi.hoisted(() => vi.fn());

vi.mock("@cloudbase/js-sdk", () => ({
  default: {
    init: () => ({
      auth: () => ({
        signOut: mockSignOut,
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        getClaims: vi
          .fn()
          .mockResolvedValue({ data: { claims: { sub: "anon" } } }),
      }),
    }),
  },
}));

describe("cloudbase exports", () => {
  beforeEach(() => {
    vi.resetModules();
    mockSignOut.mockReset();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("exports app as initialized instance", async () => {
    const { app } = await import("./cloudbase");
    expect(app).toBeDefined();
    expect(typeof app.auth).toBe("function");
  });

  it("isValidEnvId is exported as boolean", async () => {
    const { isValidEnvId } = await import("./cloudbase");
    expect(typeof isValidEnvId).toBe("boolean");
  });

  it("checkEnvironment returns true when valid env id", async () => {
    const { checkEnvironment } = await import("./cloudbase");
    expect(checkEnvironment()).toBe(true);
  });
});
