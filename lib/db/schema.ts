import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  date,
  index,
  check,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    redmineId: integer("redmine_id").notNull(),
    name: text("name").notNull(),
    email: text("email"),
    role: text("role").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => ({
    redmineIdIdx: uniqueIndex("users_redmine_id_unique").on(t.redmineId),
    roleCheck: check("users_role_check", sql`${t.role} IN ('manager','member')`),
  }),
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    tracker: text("tracker").notNull(),
    subject: text("subject").notNull(),
    description: text("description"),
    priority: text("priority"),
    projectId: integer("project_id").notNull(),
    projectName: text("project_name").notNull(),
    sprintName: text("sprint_name"),
    parentTaskId: integer("parent_task_id"),
    startDate: date("start_date"),
    dueDate: date("due_date"),
    status: text("status").notNull().default("draft"),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userStatusIdx: index("tasks_user_status_idx").on(t.userId, t.status),
    statusCreatedIdx: index("tasks_status_created_idx").on(t.status, t.createdAt),
    statusCheck: check("tasks_status_check", sql`${t.status} IN ('draft','imported')`),
  }),
);

export const redmineCache = pgTable("redmine_cache", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
});
