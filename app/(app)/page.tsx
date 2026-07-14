import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { listTasks, listTeamMembers } from "@/actions/tasks";
import {
  getProjects,
  getTrackers,
  getPriorities,
  getParentTasks,
} from "@/actions/metadata";
import { RedmineError } from "@/lib/redmine/client";
import { clearSessionCookie } from "@/lib/auth/cookie";
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

  let bundle: [
    Awaited<ReturnType<typeof listTasks>>,
    Awaited<ReturnType<typeof getProjects>>,
    Awaited<ReturnType<typeof getTrackers>>,
    Awaited<ReturnType<typeof getPriorities>>,
    Awaited<ReturnType<typeof getParentTasks>>,
    Awaited<ReturnType<typeof listTeamMembers>>,
  ];
  try {
    bundle = await Promise.all([
      listTasks({
        status,
        sprint,
        userId: userIdFilter,
      }),
      getProjects(),
      getTrackers(),
      getPriorities(),
      getParentTasks(),
      listTeamMembers(),
    ]);
  } catch (err) {
    // A Redmine API key revoked mid-session surfaces here as a 401. Handle
    // it server-side (upstream of the error boundary) so the redirect works
    // the same in production as in dev — Next.js redacts thrown error
    // messages in prod builds, so string-matching in error.tsx doesn't work.
    if (err instanceof RedmineError && err.status === 401) {
      await clearSessionCookie();
      redirect("/login"); // throws — expected control flow, not caught here
    }
    throw err;
  }
  const [rows, projects, trackers, priorities, parents, teamMembers] = bundle;

  return (
    <WorkspaceClient
      rows={rows}
      projects={projects}
      trackers={trackers}
      priorities={priorities}
      parents={parents}
      teamMembers={teamMembers}
      currentUserId={user.db.id}
      role={user.db.role as "manager" | "member"}
    />
  );
}
