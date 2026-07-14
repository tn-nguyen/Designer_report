import { z } from "zod";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const taskInputSchema = z
  .object({
    tracker: z.string().min(1).max(64),
    subject: z.string().min(1).max(255),
    description: z.string().max(10000).nullish(),
    priority: z.string().max(32).nullish(),
    projectId: z.number().int().positive(),
    projectName: z.string().min(1).max(255),
    sprintName: z.string().max(255).nullish(),
    parentTaskId: z.number().int().positive().nullish(),
    startDate: z.string().regex(ISO_DATE).nullish(),
    dueDate: z.string().regex(ISO_DATE).nullish(),
  })
  .refine(
    (v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate,
    { message: "Due date phải ≥ Start date", path: ["dueDate"] },
  );

export type TaskInput = z.infer<typeof taskInputSchema>;

export type TaskActionResult = { error?: string; id?: number };
