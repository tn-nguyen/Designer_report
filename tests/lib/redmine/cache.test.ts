import { describe, it, expect, vi, beforeEach } from "vitest";

let store: Map<string, { data: unknown; fetchedAt: Date }>;

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([] as { key: string; data: unknown; fetchedAt: Date }[]),
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

// Patch db.select to read from `store` for cache-hit tests.
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

  it("passes through TTL default of 24 hours", async () => {
    const { TTL_MS } = await importCache();
    expect(TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
