import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { listTasks } from "@/actions/tasks";
import {
  getProjects,
  getTrackers,
  getPriorities,
  getParentTasks,
} from "@/actions/metadata";
import { WorkspaceClient } from "./workspace-client";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const status = (sp.status as "draft" | "imported" | "all" | undefined) ?? "draft";
  const sprint = sp.sprint ?? null;

  // Manager default = All team; explicit numeric user_id overrides.
  const userIdFilter: number | "all" | undefined =
    user.db.role === "manager"
      ? sp.user && sp.user !== "all"
        ? Number(sp.user)
        : "all"
      : user.db.id;

  const [rows, projects, trackers, priorities, parents] = await Promise.all([
    listTasks({
      status,
      sprint,
      userId: userIdFilter,
    }),
    getProjects(),
    getTrackers(),
    getPriorities(),
    getParentTasks(),
  ]);

  return (
    <WorkspaceClient
      rows={rows as any}
      projects={projects}
      trackers={trackers}
      priorities={priorities}
      parents={parents}
      currentUserId={user.db.id}
      role={user.db.role as "manager" | "member"}
    />
  );
}
