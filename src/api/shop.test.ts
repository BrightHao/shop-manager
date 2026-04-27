import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the app module before importing
const mockCallFunction = vi.fn();

vi.mock("../utils/cloudbase", () => ({
  app: {
    callFunction: (...args: unknown[]) => mockCallFunction(...args),
  },
}));

vi.mock("import.meta", () => ({
  env: {
    VITE_ENV_ID: "test-env-id",
  },
}));

describe("callShopApi", () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it("calls the cloud function with correct action and data", async () => {
    mockCallFunction.mockResolvedValue({
      result: { code: 0, message: "success", data: { items: [1, 2, 3] } },
    });

    const { callShopApi } = await import("./shop");
    const result = await callShopApi("products.list", { page: 1 });

    expect(mockCallFunction).toHaveBeenCalledWith({
      name: "shop-api",
      data: { action: "products.list", data: { page: 1 } },
    });
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("unwraps cloud function result correctly", async () => {
    mockCallFunction.mockResolvedValue({
      result: { code: 0, data: "direct" },
    });

    const { callShopApi } = await import("./shop");
    const result = await callShopApi("dashboard");

    expect(result).toBe("direct");
  });

  it("returns raw result when no inner data exists", async () => {
    mockCallFunction.mockResolvedValue({
      result: { code: 0, data: null },
    });

    const { callShopApi } = await import("./shop");
    const result = await callShopApi("products.get", { id: 1 });

    expect(result).toEqual({ code: 0, data: null });
  });
});

describe("callShopApiRaw", () => {
  beforeEach(() => {
    mockCallFunction.mockReset();
  });

  it("calls cloud function with arbitrary name and data", async () => {
    mockCallFunction.mockResolvedValue({
      result: { Response: { RequestId: "abc" } },
    });

    const { callShopApiRaw } = await import("./shop");
    const result = await callShopApiRaw("other-fn", { key: "value" });

    expect(mockCallFunction).toHaveBeenCalledWith({
      name: "other-fn",
      data: { key: "value" },
    });
    expect(result).toEqual({ Response: { RequestId: "abc" } });
  });
});
