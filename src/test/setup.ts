import { vi } from "vitest";

// Mock import.meta.env for Vite environment variables
vi.stubGlobal("import", vi.fn());

// Mock @cloudbase/js-sdk globally
const mockSignOut = vi.fn();
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

// Export mockSignOut for use in tests
vi.stubGlobal("__mockSignOut", mockSignOut);

// Suppress console output during tests unless specifically testing it
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "log").mockImplementation(() => {});
