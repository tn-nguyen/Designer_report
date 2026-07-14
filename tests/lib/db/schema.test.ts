import { describe, it, expect } from "vitest";
import { users, tasks, redmineCache } from "@/lib/db/schema";

describe("db schema", () => {
  it("declares users table with required columns", () => {
    const cols = Object.keys(users);
    expect(cols).toEqual(
      expect.arrayContaining(["id", "redmineId", "name", "email", "role", "lastLoginAt"]),
    );
  });

  it("declares tasks table with required columns", () => {
    const cols = Object.keys(tasks);
    expect(cols).toEqual(
      expect.arrayContaining([
        "id",
        "userId",
        "tracker",
        "subject",
        "description",
        "priority",
        "projectId",
        "projectName",
        "sprintName",
        "parentTaskId",
        "startDate",
        "dueDate",
        "status",
        "importedAt",
        "createdAt",
        "updatedAt",
      ]),
    );
  });

  it("declares redmineCache table with required columns", () => {
    const cols = Object.keys(redmineCache);
    expect(cols).toEqual(expect.arrayContaining(["key", "data", "fetchedAt"]));
  });
});
