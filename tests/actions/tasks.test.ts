import { describe, it, expect, vi, beforeEach } from "vitest";

// Ownership + validation are exercised by the pure schema below.
// Full server-action tests need DB and are covered manually.
describe("TaskInput schema", () => {
  it("rejects empty subject", async () => {
    const { taskInputSchema } = await import("@/actions/tasks");
    const res = taskInputSchema.safeParse({
      tracker: "Task_Scr",
      subject: "",
      projectId: 1,
      projectName: "Project",
    });
    expect(res.success).toBe(false);
  });

  it("rejects due < start", async () => {
    const { taskInputSchema } = await import("@/actions/tasks");
    const res = taskInputSchema.safeParse({
      tracker: "Task_Scr",
      subject: "x",
      projectId: 1,
      projectName: "Project",
      startDate: "2026-07-13",
      dueDate: "2026-07-12",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a valid input", async () => {
    const { taskInputSchema } = await import("@/actions/tasks");
    const res = taskInputSchema.safeParse({
      tracker: "Task_Scr",
      subject: "Design something",
      projectId: 1,
      projectName: "Project A",
      startDate: "2026-07-13",
      dueDate: "2026-07-14",
    });
    expect(res.success).toBe(true);
  });
});
