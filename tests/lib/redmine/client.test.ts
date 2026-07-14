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

  it("retries on 5xx and succeeds once the server recovers", async () => {
    vi.useFakeTimers();
    const { RedmineClient } = await importClient();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 502 }))
      .mockResolvedValueOnce(
        jsonResponse({ user: { id: 1, firstname: "N", lastname: "N", mail: "x" } }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const c = new RedmineClient("k");
    const promise = c.getCurrentUser();
    await vi.runAllTimersAsync();
    const user = await promise;
    expect(user.id).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry on 4xx and throws RedmineError immediately", async () => {
    const { RedmineClient, RedmineError } = await importClient();
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new RedmineClient("k");
    await expect(c.getCurrentUser()).rejects.toBeInstanceOf(RedmineError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after exhausting retries on repeated 5xx", async () => {
    vi.useFakeTimers();
    const { RedmineClient, RedmineError } = await importClient();
    const fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = new RedmineClient("k");
    const promise = c.getCurrentUser();
    const assertion = expect(promise).rejects.toBeInstanceOf(RedmineError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + 2 retries
    vi.useRealTimers();
  });
});
