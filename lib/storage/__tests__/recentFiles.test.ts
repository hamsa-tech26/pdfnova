import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addRecentFile, clearRecentFiles, getRecentFiles, subscribeRecentFiles,
} from "../recentFiles";

const key = "kukureku-recent-files";
let values: Map<string, string>;
let localStorage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn>; removeItem: ReturnType<typeof vi.fn> };

beforeEach(() => {
  values = new Map();
  localStorage = {
    getItem: vi.fn((name: string) => values.get(name) ?? null),
    setItem: vi.fn((name: string, value: string) => { values.set(name, value); }),
    removeItem: vi.fn((name: string) => { values.delete(name); }),
  };
  const target = new EventTarget();
  vi.stubGlobal("window", Object.assign(target, { localStorage }));
  getRecentFiles();
});

afterEach(() => vi.unstubAllGlobals());

describe("optional recent task history", () => {
  it("does not fail a completed tool when reading or writing storage is blocked", () => {
    localStorage.getItem.mockImplementation(() => { throw new Error("SecurityError"); });
    localStorage.setItem.mockImplementation(() => { throw new Error("QuotaExceededError"); });
    expect(getRecentFiles()).toEqual([]);
    expect(() => addRecentFile({ fileName: "output.pdf", toolName: "Merge PDF" })).not.toThrow();
  });

  it("tolerates blocked history clearing", () => {
    localStorage.removeItem.mockImplementation(() => { throw new Error("SecurityError"); });
    expect(() => clearRecentFiles()).not.toThrow();
  });

  it("discards malformed entries and caps valid history at eight tasks", () => {
    values.set(key, JSON.stringify([null, {}, { id: 1 }, ...Array.from({ length: 10 }, (_, id) => ({
      id: String(id), fileName: "output.pdf", toolName: "Merge PDF", createdAt: "2026-10-02",
    }))]));
    expect(getRecentFiles()).toHaveLength(8);
    values.set(key, "broken json");
    expect(getRecentFiles()).toEqual([]);
  });

  it("keeps snapshots stable and notifies subscribers on add and clear", () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeRecentFiles(onChange);
    addRecentFile({ fileName: "output.pdf", toolName: "Merge PDF" });
    const snapshot = getRecentFiles();
    expect(getRecentFiles()).toBe(snapshot);
    expect(snapshot[0].fileName).toBe("output.pdf");
    clearRecentFiles();
    expect(getRecentFiles()).toEqual([]);
    expect(onChange).toHaveBeenCalledTimes(2);
    unsubscribe();
    addRecentFile({ fileName: "next.pdf", toolName: "Merge PDF" });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
