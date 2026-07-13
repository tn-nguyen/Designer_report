import { describe, it, expect, beforeEach, vi } from "vitest";

const BASE = "https://redmine.example.com";
process.env.REDMINE_BASE_URL = BASE;

async function importClient() {
  return await import("@/lib/redmine/client");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("RedmineClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("adds X-Redmine-API-Key header", async () => {
    const { RedmineClient } = await importClient();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ user: { id: 1, firstname: "N", lastname: "N", mail: "x" } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = new RedmineClient("my-key");
    await c.getCurrentUser();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/users/current.json`);
    expect((init as RequestInit).headers).toMatchObject({ "X-Redmine-API-Key": "my-key" });
  });

  it("throws RedmineError on 401", async () => {
    const { RedmineClient, RedmineError } = await importClient();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 401 })));
    const c = new RedmineClient("bad");
    await expect(c.getCurrentUser()).rejects.toBeInstanceOf(RedmineError);
  });

  it("paginates until offset+limit >= total_count", async () => {
    const { RedmineClient } = await importClient();
    const page1 = { issues: [{ id: 1 }, { id: 2 }], total_count: 3, offset: 0, limit: 2 };
    const page2 = { issues: [{ id: 3 }], total_count: 3, offset: 2, limit: 2 };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page1))
      .mockResolvedValueOnce(jsonResponse(page2));
    vi.stubGlobal("fetch", fetchMock);
    const c = new RedmineClient("k");
    const issues = await c.getEpicAndStoryIssues(1, [7, 8]);
    expect(issues).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
