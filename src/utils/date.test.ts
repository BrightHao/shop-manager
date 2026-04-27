import { describe, it, expect } from "vitest";
import { formatDateTime, formatDate } from "./date";

describe("formatDateTime", () => {
  it('returns "-" for empty string', () => {
    expect(formatDateTime("")).toBe("-");
  });

  it("returns input for whitespace-only string", () => {
    // formatDateTime returns the original string for non-date-like input
    expect(formatDateTime("   ")).toBe("   ");
  });

  it("passes through non-date strings unchanged", () => {
    expect(formatDateTime("hello")).toBe("hello");
  });

  it('formats MySQL timestamp "2026-04-24 15:01:21"', () => {
    expect(formatDateTime("2026-04-24 15:01:21")).toBe("2026-04-24 15:01:21");
  });

  it('formats ISO timestamp "2026-04-24T15:01:21.000Z" (strips timezone info)', () => {
    expect(formatDateTime("2026-04-24T15:01:21.000Z")).toBe(
      "2026-04-24 15:01:21",
    );
  });

  it("handles single-digit time components", () => {
    expect(formatDateTime("2026-04-24 09:01:05")).toBe("2026-04-24 09:01:05");
  });

  it("handles millisecond ISO timestamps", () => {
    expect(formatDateTime("2026-01-01T00:00:00.123Z")).toBe(
      "2026-01-01 00:00:00",
    );
  });
});

describe("formatDate", () => {
  it('returns "-" for empty string', () => {
    expect(formatDate("")).toBe("-");
  });

  it("returns input for whitespace-only string", () => {
    expect(formatDate("   ")).toBe("   ");
  });

  it("passes through non-date strings unchanged", () => {
    expect(formatDate("hello")).toBe("hello");
  });

  it('extracts date from "2026-04-24 15:01:21"', () => {
    expect(formatDate("2026-04-24 15:01:21")).toBe("2026-04-24");
  });

  it("extracts date from ISO timestamp", () => {
    expect(formatDate("2026-04-24T15:01:21.000Z")).toBe("2026-04-24");
  });

  it("handles single-digit months and days", () => {
    expect(formatDate("2026-01-05 09:00:00")).toBe("2026-01-05");
  });
});
