"use server";

import { RedmineClient } from "@/lib/redmine/client";
import { getCached } from "@/lib/redmine/cache";
import { getCurrentUser } from "@/lib/auth/current-user";

const EPIC_STORY_NAME_RE = /epic|story/i;

async function clientFromSession(): Promise<RedmineClient> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  return new RedmineClient(u.session.apiKey);
}

export async function getProjects() {
  const parentId = process.env.DESIGN_PROJECTS_ID!;
  const c = await clientFromSession();
  const projects = await getCached("projects", () => c.getSubProjects(parentId));
  return projects.map((p) => ({ id: p.id, name: p.name }));
}

export async function getTrackers() {
  const c = await clientFromSession();
  return await getCached("trackers", async () => (await c.getTrackers()).map((t) => ({ id: t.id, name: t.name })));
}

export async function getPriorities() {
  const c = await clientFromSession();
  return await getCached("priorities", async () => (await c.getPriorities()).map((p) => ({ id: p.id, name: p.name })));
}

export async function getVersions(projectId: number) {
  const c = await clientFromSession();
  return await getCached(`versions:${projectId}`, async () =>
    (await c.getProjectVersions(projectId)).map((v) => ({ id: v.id, name: v.name })),
  );
}

export async function getParentTasks() {
  const parentId = process.env.DESIGN_PROJECTS_ID!;
  const c = await clientFromSession();
  return await getCached("parent_tasks", async () => {
    const trackers = await c.getTrackers();
    const ids = trackers.filter((t) => EPIC_STORY_NAME_RE.test(t.name)).map((t) => t.id);
    if (ids.length === 0) return [];
    const issues = await c.getEpicAndStoryIssues(parentId, ids);
    return issues.map((i) => ({
      id: i.id,
      subject: i.subject,
      projectName: i.project.name,
      tracker: i.tracker.name,
    }));
  });
}
