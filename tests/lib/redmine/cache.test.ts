import { describe, it, expect, vi, beforeEach } from "vitest";

let store: Map<string, { data: unknown; fetchedAt: Date }>;

// Real `eq()` so the where() mock below can read back which key was queried.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (_col: unknown, val: string) => ({ __eqVal: val }),
  };
});

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (cond: { __eqVal: string }) => {
          const hit = store.get(cond.__eqVal);
          return Promise.resolve(
            hit ? [{ key: cond.__eqVal, data: hit.data, fetchedAt: hit.fetchedAt }] : [],
          );
        },
      }),
    }),
    insert: () => ({
      values: (v: { key: string; data: unknown; fetchedAt: Date }) => ({
        onConflictDoUpdate: () => {
          store.set(v.key, { data: v.data, fetchedAt: v.fetchedAt });
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  redmineCache: { key: "key", data: "data", fetchedAt: "fetchedAt" },
}));

async function importCache() {
  return await import("@/lib/redmine/cache");
}

beforeEach(() => {
  store = new Map();
});

describe("getCached", () => {
  it("calls fetcher on cache miss and stores result", async () => {
    const { getCached } = await importCache();
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
    const result = await getCached("projects", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual([{ id: 1 }]);
  });

  it("returns cached data without calling fetcher when within TTL", async () => {
    const { getCached } = await importCache();
    store.set("projects", { data: [{ id: 7 }], fetchedAt: new Date() });
    const fetcher = vi.fn().mockResolvedValue([{ id: 99 }]);
    const result = await getCached("projects", fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual([{ id: 7 }]);
  });

  it("passes through TTL default of 24 hours", async () => {
    const { TTL_MS } = await importCache();
    expect(TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("falls back to stale cache when the fetcher fails and a stale row exists", async () => {
    const { getCached } = await importCache();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const staleFetchedAt = new Date(Date.now() - 999 * 24 * 60 * 60 * 1000);
    store.set("projects", { data: [{ id: 42 }], fetchedAt: staleFetchedAt });
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    const result = await getCached("projects", fetcher);
    expect(result).toEqual([{ id: 42 }]);
    expect(warnSpy).toHaveBeenCalledWith(
      "[bugtracker-tool] Redmine fetch failed, serving stale cache for",
      "projects",
    );
    warnSpy.mockRestore();
  });

  it("rethrows when the fetcher fails and there is no cache row at all", async () => {
    const { getCached } = await importCache();
    const fetcher = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(getCached("projects", fetcher)).rejects.toThrow("network down");
  });
});
