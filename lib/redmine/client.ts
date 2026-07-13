import type {
  Project,
  Version,
  Issue,
  Membership,
  CurrentUser,
  Tracker,
  Priority,
} from "./types";

export class RedmineError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RedmineError";
  }
}

function baseUrl(): string {
  const u = process.env.REDMINE_BASE_URL;
  if (!u) throw new Error("REDMINE_BASE_URL is not set");
  return u.replace(/\/+$/, "");
}

export class RedmineClient {
  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = new URL(baseUrl() + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString(), {
      headers: {
        "X-Redmine-API-Key": this.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new RedmineError(`Redmine ${res.status} for ${url.pathname}`, res.status);
    }
    return (await res.json()) as T;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const data = await this.request<{ user: CurrentUser }>("/users/current.json");
    return data.user;
  }

  async getProjectMemberships(
    projectId: number | string,
  ): Promise<Membership[]> {
    const data = await this.paginate<Membership>(`/projects/${projectId}/memberships.json`, "memberships");
    return data;
  }

  async getSubProjects(parentId: number | string): Promise<Project[]> {
    const all = await this.paginate<Project>("/projects.json", "projects", { include: "" });
    const parentNum = typeof parentId === "number" ? parentId : Number(parentId);
    return all.filter((p) => p.parent?.id === parentNum);
  }

  async getTrackers(): Promise<Tracker[]> {
    const data = await this.request<{ trackers: Tracker[] }>("/trackers.json");
    return data.trackers;
  }

  async getPriorities(): Promise<Priority[]> {
    const data = await this.request<{ issue_priorities: Priority[] }>(
      "/enumerations/issue_priorities.json",
    );
    return data.issue_priorities;
  }

  async getProjectVersions(projectId: number): Promise<Version[]> {
    const data = await this.request<{ versions: Version[] }>(
      `/projects/${projectId}/versions.json`,
    );
    return data.versions;
  }

  async getEpicAndStoryIssues(
    rootProjectId: number | string,
    trackerIds: number[],
  ): Promise<Issue[]> {
    return await this.paginate<Issue>("/issues.json", "issues", {
      project_id: String(rootProjectId),
      subproject_id: "*",
      tracker_id: trackerIds.join(","),
      status_id: "*",
    });
  }

  private async paginate<T>(
    path: string,
    listKey: string,
    extra: Record<string, string> = {},
  ): Promise<T[]> {
    const out: T[] = [];
    const limit = 100;
    let offset = 0;
    // Safety cap: max 50 pages = 5000 items.
    for (let i = 0; i < 50; i++) {
      const data = await this.request<Record<string, unknown> & { total_count: number }>(
        path,
        { ...extra, limit, offset },
      );
      const chunk = data[listKey] as T[] | undefined;
      if (!chunk || chunk.length === 0) break;
      out.push(...chunk);
      offset += chunk.length;
      if (typeof data.total_count === "number" && offset >= data.total_count) break;
    }
    return out;
  }
}
