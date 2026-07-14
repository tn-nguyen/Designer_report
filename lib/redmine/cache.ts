import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { redmineCache } from "@/lib/db/schema";

export type CacheKey =
  | "projects"
  | "trackers"
  | "priorities"
  | "parent_tasks"
  | `versions:${number}`;

export const TTL_MS = 24 * 60 * 60 * 1000;

export async function getCached<T>(
  key: CacheKey,
  fetcher: () => Promise<T>,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const ttl = options.ttlMs ?? TTL_MS;

  const rows = await db.select().from(redmineCache).where(eq(redmineCache.key, key));
  const hit = rows[0];

  if (!options.force && hit && Date.now() - hit.fetchedAt.getTime() < ttl) {
    return hit.data as T;
  }

  let fresh: T;
  try {
    fresh = await fetcher();
  } catch (err) {
    if (hit) {
      console.warn("[bugtracker-tool] Redmine fetch failed, serving stale cache for", key);
      return hit.data as T;
    }
    throw err;
  }

  await db
    .insert(redmineCache)
    .values({ key, data: fresh as unknown, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: redmineCache.key,
      set: { data: fresh as unknown, fetchedAt: new Date() },
    });
  return fresh;
}

export async function invalidateAll(): Promise<void> {
  await db.delete(redmineCache);
}
