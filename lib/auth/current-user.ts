import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { readSession } from "./cookie";
import type { SessionPayload } from "./session";

export type CurrentUser = {
  db: typeof users.$inferSelect;
  session: SessionPayload;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const rows = await db.select().from(users).where(eq(users.redmineId, session.redmineId));
  const row = rows[0];
  if (!row) return null;
  return { db: row, session };
}
