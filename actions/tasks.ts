"use server";

import { z } from "zod";
import { and, eq, inArray, desc, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toRedmineCsv, type CsvTaskRow } from "@/lib/csv";
import { taskInputSchema, type TaskInput } from "@/lib/validation/task";

export type { TaskInput };

export type TaskActionResult = { error?: string; id?: number };

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  return u;
}

/** Turns an unexpected throw into a returnable error message. */
function toActionError(err: unknown): TaskActionResult {
  if (err instanceof z.ZodError) {
    return { error: err.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }
  if (err instanceof Error) return { error: err.message };
  return { error: "Đã xảy ra lỗi." };
}

export async function createTask(input: TaskInput): Promise<TaskActionResult> {
  const u = await requireUser();
  try {
    const data = taskInputSchema.parse(input);
    const [row] = await db
      .insert(tasks)
      .values({ ...data, userId: u.db.id })
      .returning({ id: tasks.id });
    return { id: row.id };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateTask(id: number, input: TaskInput): Promise<TaskActionResult> {
  const u = await requireUser();
  try {
    const data = taskInputSchema.parse(input);
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) return { error: "Not found" };
    if (existing.userId !== u.db.id) return { error: "Forbidden" };
    await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id));
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteTask(id: number): Promise<TaskActionResult> {
  const u = await requireUser();
  try {
    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) return {};
    if (existing.userId !== u.db.id) return { error: "Forbidden" };
    await db.delete(tasks).where(eq(tasks.id, id));
    return {};
  } catch (err) {
    return toActionError(err);
  }
}

export type TaskListFilters = {
  status?: "draft" | "imported" | "all";
  sprint?: string | null;
  userId?: number | "all";
};

export async function listTasks(filters: TaskListFilters = {}) {
  const u = await requireUser();
  const where: SQL[] = [];

  if (u.db.role === "member" || filters.userId === undefined) {
    where.push(eq(tasks.userId, u.db.id));
  } else if (typeof filters.userId === "number") {
    where.push(eq(tasks.userId, filters.userId));
  } // else: manager + userId === 'all' → no user filter

  const status = filters.status ?? "draft";
  if (status !== "all") where.push(eq(tasks.status, status));
  if (filters.sprint) where.push(eq(tasks.sprintName, filters.sprint));

  return await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      userName: users.name,
      tracker: tasks.tracker,
      subject: tasks.subject,
      description: tasks.description,
      priority: tasks.priority,
      projectId: tasks.projectId,
      projectName: tasks.projectName,
      sprintName: tasks.sprintName,
      parentTaskId: tasks.parentTaskId,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      status: tasks.status,
      importedAt: tasks.importedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.userId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(tasks.createdAt));
}

export async function listTeamMembers(): Promise<{ id: number; name: string }[]> {
  await requireUser();
  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .orderBy(users.name);
  return rows;
}

export async function markImported(ids: number[]): Promise<void> {
  const u = await requireUser();
  if (ids.length === 0) return;
  await db
    .update(tasks)
    .set({ status: "imported", importedAt: new Date() })
    .where(and(eq(tasks.userId, u.db.id), inArray(tasks.id, ids)));
}

export async function exportSelected(ids: number[]): Promise<{ csv: string }> {
  const u = await requireUser();
  if (ids.length === 0) return { csv: toRedmineCsv([]) };
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, u.db.id), inArray(tasks.id, ids)));
  const csvRows: CsvTaskRow[] = rows.map((r) => ({
    tracker: r.tracker,
    subject: r.subject,
    assignee: u.db.name,
    dueDate: r.dueDate,
    sprint: r.sprintName,
    parentTaskId: r.parentTaskId,
    startDate: r.startDate,
    description: r.description,
    priority: r.priority,
  }));
  await markImported(rows.map((r) => r.id));
  return { csv: toRedmineCsv(csvRows) };
}
