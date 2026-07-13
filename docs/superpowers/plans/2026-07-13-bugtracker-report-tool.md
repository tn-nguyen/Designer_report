# Bugtracker Report Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js + Neon Postgres web app deployed on Vercel that lets the Design team log tasks throughout the week and export them as a Redmine-compatible CSV for weekly import into `bugtracker.i3international.com`.

**Architecture:** Next.js 15 App Router with server actions as the only client → server surface. Per-user Redmine API key stored encrypted in an httpOnly cookie; server uses it to call Redmine. Metadata (projects, versions, parent Epic/Story issues) cached 24h in a JSONB column of Neon Postgres. Draft tasks live in Postgres and get exported to a Redmine CSV; imported rows remain for history.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Neon Postgres (serverless HTTP driver) · Drizzle ORM · Tailwind CSS · shadcn/ui · Zod · Vitest · pnpm

## Global Constraints

- Node runtime for server actions (not Edge) — needed by `node:crypto`.
- API key encryption: AES-256-GCM, key from `AUTH_SECRET` (32 bytes base64).
- Cookie: name `br_session`, httpOnly, `SameSite=Lax`, `Secure` in prod, max-age 30 days.
- All Redmine API calls go through `lib/redmine/client.ts` — no direct `fetch` elsewhere.
- All DB access goes through `lib/db/client.ts` — no ad-hoc Neon connections.
- CSV columns, in this exact order: `Tracker,Subject,Assignee,Due date,Sprint,Parent task,Start date,Description,Priority`.
- CSV date format: `MM/DD/YYYY`.
- Cache TTL: 24 hours (`24 * 60 * 60 * 1000` ms).
- Cache keys used: `projects`, `trackers`, `priorities`, `versions:<projectId>`, `parent_tasks`.
- Task status enum: `'draft'` (default) or `'imported'`. Set `imported_at` at time of export.
- Role enum: `'manager'` or `'member'`.
- Env vars required: `DATABASE_URL`, `AUTH_SECRET`, `REDMINE_BASE_URL`, `DESIGN_PROJECTS_ID`.
- Never commit `.env*` (already in .gitignore).
- File paths in this plan are relative to `/Volumes/Data/Claude space/Bugtracker-report/`.

---

## Task 1: Project scaffold + Vitest smoke test

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `.eslintrc.json`, `.prettierrc`, `vitest.config.ts`, `.env.example`
- Create: `app/layout.tsx`, `app/page.tsx`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: a working Next.js + Vitest scaffold that later tasks build on.

- [ ] **Step 1: Init package.json with exact dependencies**

Run in `/Volumes/Data/Claude space/Bugtracker-report/`:

```bash
pnpm init
```

Then overwrite `package.json` with:

```json
{
  "name": "bugtracker-report-tool",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.5",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.33.0",
    "lucide-react": "^0.446.0",
    "next": "15.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.5.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.16.10",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "drizzle-kit": "^0.24.2",
    "eslint": "^8.57.1",
    "eslint-config-next": "15.0.3",
    "postcss": "^8.4.47",
    "prettier": "^3.3.3",
    "tailwindcss": "^3.4.13",
    "typescript": "^5.6.3",
    "vitest": "^2.1.2"
  }
}
```

Install:

```bash
pnpm install
```

- [ ] **Step 2: Add TypeScript config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Add Next.js, Tailwind, ESLint, Prettier config**

Create `next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
```

Create `postcss.config.mjs`:

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

Create `app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Create `.eslintrc.json`:

```json
{ "extends": "next/core-web-vitals" }
```

Create `.prettierrc`:

```json
{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100 }
```

- [ ] **Step 4: Add minimal app scaffold**

Create `app/layout.tsx`:

```tsx
import "./globals.css";

export const metadata = { title: "Bugtracker Report Tool" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `app/page.tsx`:

```tsx
export default function Home() {
  return <main className="p-8">Bugtracker Report Tool — placeholder</main>;
}
```

- [ ] **Step 5: Add Vitest config and smoke test**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `tests/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Add .env.example**

Create `.env.example`:

```
# Neon Postgres pooled connection string
DATABASE_URL=

# 32-byte random base64, generate with: openssl rand -base64 32
AUTH_SECRET=

# Bugtracker (Redmine) base URL — no trailing slash
REDMINE_BASE_URL=https://bugtracker.i3international.com

# Numeric id of the parent "Design Projects" project on Redmine
DESIGN_PROJECTS_ID=
```

- [ ] **Step 7: Run tests and build to verify**

Run: `pnpm test`
Expected: `1 passed`

Run: `pnpm build`
Expected: build completes without error (a warning about missing env is OK).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.mjs postcss.config.mjs tailwind.config.ts .eslintrc.json .prettierrc vitest.config.ts .env.example app tests
git commit -m "chore: scaffold Next.js 15 + Tailwind + Vitest"
```

---

## Task 2: Drizzle schema & first migration

**Files:**
- Create: `drizzle.config.ts`
- Create: `lib/db/schema.ts`
- Create: `lib/db/client.ts`
- Create: `lib/db/migrations/0000_initial.sql` (generated)

**Interfaces:**
- Consumes: `DATABASE_URL` env.
- Produces:
  - `db` (Drizzle Neon HTTP client) exported from `@/lib/db/client`.
  - Tables: `users`, `tasks`, `redmineCache` exported from `@/lib/db/schema`.
  - Column names on `tasks` (camelCase in TS, snake_case in SQL):
    `id, userId, tracker, subject, description, priority, projectId, projectName, sprintName, parentTaskId, startDate, dueDate, status, importedAt, createdAt, updatedAt`.
  - Column names on `users`: `id, redmineId, name, email, role, lastLoginAt`.
  - Column names on `redmineCache`: `key, data, fetchedAt`.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/db/schema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/db/schema.test.ts`
Expected: FAIL — cannot resolve `@/lib/db/schema`.

- [ ] **Step 3: Implement schema**

Create `lib/db/schema.ts`:

```ts
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
```

- [ ] **Step 4: Implement DB client**

Create `lib/db/client.ts`:

```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set");
}

export const db = drizzle(neon(url), { schema });
export type Db = typeof db;
```

Note: this file throws at import if `DATABASE_URL` is missing. Tests that import `db` need env set — see Task 5 setup file.

- [ ] **Step 5: Add drizzle-kit config and generate migration**

Create `drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

Generate migration:

```bash
pnpm db:generate
```

Expected: a `lib/db/migrations/0000_*.sql` file appears containing the three `CREATE TABLE` statements plus indexes.

- [ ] **Step 6: Run schema test**

Run: `pnpm test tests/lib/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add drizzle.config.ts lib/db tests/lib/db
git commit -m "feat(db): drizzle schema for users, tasks, redmine_cache"
```

---

## Task 3: Session encryption (AES-256-GCM)

**Files:**
- Create: `lib/auth/session.ts`
- Create: `tests/lib/auth/session.test.ts`

**Interfaces:**
- Consumes: `AUTH_SECRET` env.
- Produces:
  - `encryptSession(payload: SessionPayload): string` — returns base64url ciphertext.
  - `decryptSession(token: string): SessionPayload` — throws on tamper/bad key.
  - `type SessionPayload = { redmineId: number; name: string; email: string | null; role: "manager" | "member"; apiKey: string }`.

- [ ] **Step 1: Write failing tests**

Create `tests/lib/auth/session.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomBytes } from "node:crypto";

beforeAll(() => {
  process.env.AUTH_SECRET = randomBytes(32).toString("base64");
});

describe("session encryption", () => {
  it("round-trips a payload", async () => {
    const { encryptSession, decryptSession } = await import("@/lib/auth/session");
    const payload = {
      redmineId: 42,
      name: "Nguyen Nguyen",
      email: "nguyen@example.com",
      role: "manager" as const,
      apiKey: "abc123",
    };
    const token = encryptSession(payload);
    expect(typeof token).toBe("string");
    expect(decryptSession(token)).toEqual(payload);
  });

  it("throws on tampered token", async () => {
    const { encryptSession, decryptSession } = await import("@/lib/auth/session");
    const token = encryptSession({
      redmineId: 1,
      name: "x",
      email: null,
      role: "member",
      apiKey: "k",
    });
    const tampered = token.slice(0, -4) + "AAAA";
    expect(() => decryptSession(tampered)).toThrow();
  });

  it("throws on garbage input", async () => {
    const { decryptSession } = await import("@/lib/auth/session");
    expect(() => decryptSession("not-a-real-token")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/auth/session.test.ts`
Expected: FAIL — cannot resolve `@/lib/auth/session`.

- [ ] **Step 3: Implement session encryption**

Create `lib/auth/session.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type SessionPayload = {
  redmineId: number;
  name: string;
  email: string | null;
  role: "manager" | "member";
  apiKey: string;
};

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const key = Buffer.from(secret, "base64");
  if (key.length !== 32) throw new Error("AUTH_SECRET must decode to 32 bytes");
  return key;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encryptSession(payload: SessionPayload): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([iv, tag, ciphertext]));
}

export function decryptSession(token: string): SessionPayload {
  const buf = fromB64url(token);
  if (buf.length < IV_LEN + TAG_LEN + 1) throw new Error("invalid token");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as SessionPayload;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/lib/auth/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/auth/session.ts tests/lib/auth/session.test.ts
git commit -m "feat(auth): AES-256-GCM session encryption"
```

---

## Task 4: Redmine API client

**Files:**
- Create: `lib/redmine/types.ts`
- Create: `lib/redmine/client.ts`
- Create: `tests/lib/redmine/client.test.ts`

**Interfaces:**
- Consumes: `REDMINE_BASE_URL` env, `apiKey` from session, `DESIGN_PROJECTS_ID` env.
- Produces:
  - `class RedmineClient { constructor(apiKey: string) }`
  - `getCurrentUser(): Promise<{ id: number; firstname: string; lastname: string; mail: string | null }>`
  - `getProjectMemberships(projectId: number | string): Promise<Array<{ user: { id: number; name: string }; roles: Array<{ id: number; name: string }> }>>`
  - `getSubProjects(parentId: number | string): Promise<Array<Project>>`
  - `getTrackers(): Promise<Array<{ id: number; name: string }>>`
  - `getPriorities(): Promise<Array<{ id: number; name: string }>>`
  - `getProjectVersions(projectId: number): Promise<Array<{ id: number; name: string }>>`
  - `getEpicAndStoryIssues(rootProjectId: number | string, trackerIds: number[]): Promise<Array<Issue>>`
  - `type Project = { id: number; name: string; identifier: string; parent?: { id: number } }`
  - `type Issue = { id: number; subject: string; project: { id: number; name: string }; tracker: { id: number; name: string }; status: { id: number; name: string } }`
  - `class RedmineError extends Error { readonly status: number }`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/redmine/client.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/redmine/client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types**

Create `lib/redmine/types.ts`:

```ts
export type Project = {
  id: number;
  name: string;
  identifier: string;
  parent?: { id: number };
};

export type Version = { id: number; name: string; status?: string };

export type Issue = {
  id: number;
  subject: string;
  project: { id: number; name: string };
  tracker: { id: number; name: string };
  status: { id: number; name: string };
};

export type Membership = {
  user?: { id: number; name: string };
  group?: { id: number; name: string };
  roles: Array<{ id: number; name: string }>;
};

export type CurrentUser = {
  id: number;
  firstname: string;
  lastname: string;
  mail: string | null;
};

export type Tracker = { id: number; name: string };
export type Priority = { id: number; name: string };
```

- [ ] **Step 4: Implement client**

Create `lib/redmine/client.ts`:

```ts
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
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/lib/redmine/client.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/redmine tests/lib/redmine
git commit -m "feat(redmine): API client with pagination and error mapping"
```

---

## Task 5: Redmine metadata cache

**Files:**
- Create: `lib/redmine/cache.ts`
- Create: `tests/lib/redmine/cache.test.ts`
- Create: `tests/setup.ts`
- Modify: `vitest.config.ts` (add setupFiles)

**Interfaces:**
- Consumes: `RedmineClient` from Task 4, `db` and `redmineCache` from Task 2.
- Produces:
  - `type CacheKey = 'projects' | 'trackers' | 'priorities' | 'parent_tasks' | \`versions:${number}\``
  - `getCached<T>(key: CacheKey, fetcher: () => Promise<T>, options?: { force?: boolean; ttlMs?: number }): Promise<T>`
  - `invalidateAll(): Promise<void>` — deletes all rows in `redmine_cache`.
  - `TTL_MS` constant = `24 * 60 * 60 * 1000`.

- [ ] **Step 1: Update vitest config for test setup + module isolation**

Modify `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Create `tests/setup.ts`:

```ts
import { randomBytes } from "node:crypto";

process.env.AUTH_SECRET ??= randomBytes(32).toString("base64");
process.env.REDMINE_BASE_URL ??= "https://redmine.example.com";
process.env.DESIGN_PROJECTS_ID ??= "1";
// Tests that touch DB set this themselves.
```

- [ ] **Step 2: Write failing test**

Create `tests/lib/redmine/cache.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

let store: Map<string, { data: unknown; fetchedAt: Date }>;

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([] as { key: string; data: unknown; fetchedAt: Date }[]),
      }),
    }),
    insert: () => ({
      values: (v: { key: string; data: unknown; fetchedAt: Date }) => ({
        onConflictDoUpdate: () => {
          store.set(v.key, { data: v.data, fetchedAt: v.fetchedAt });
          return Promise.resolve();
        },
      }),
    }),
    delete: () => ({
      where: () => Promise.resolve(),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  redmineCache: { key: "key", data: "data", fetchedAt: "fetchedAt" },
}));

// Patch db.select to read from `store` for cache-hit tests.
async function importCache() {
  return await import("@/lib/redmine/cache");
}

beforeEach(() => {
  store = new Map();
});

describe("getCached", () => {
  it("calls fetcher on cache miss and stores result", async () => {
    const { getCached } = await importCache();
    const fetcher = vi.fn().mockResolvedValue([{ id: 1 }]);
    const result = await getCached("projects", fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual([{ id: 1 }]);
  });

  it("passes through TTL default of 24 hours", async () => {
    const { TTL_MS } = await importCache();
    expect(TTL_MS).toBe(24 * 60 * 60 * 1000);
  });
});
```

Note: full DB round-trip is exercised in integration by running the app locally; unit-mock scope is limited to fetcher invocation.

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/lib/redmine/cache.test.ts`
Expected: FAIL — cannot resolve `@/lib/redmine/cache`.

- [ ] **Step 4: Implement cache**

Create `lib/redmine/cache.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { redmineCache } from "@/lib/db/schema";

export type CacheKey =
  | "projects"
  | "trackers"
  | "priorities"
  | "parent_tasks"
  | `versions:${number}`;

export const TTL_MS = 24 * 60 * 60 * 1000;

export async function getCached<T>(
  key: CacheKey,
  fetcher: () => Promise<T>,
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<T> {
  const ttl = options.ttlMs ?? TTL_MS;

  if (!options.force) {
    const rows = await db.select().from(redmineCache).where(eq(redmineCache.key, key));
    const hit = rows[0];
    if (hit && Date.now() - hit.fetchedAt.getTime() < ttl) {
      return hit.data as T;
    }
  }

  const fresh = await fetcher();
  await db
    .insert(redmineCache)
    .values({ key, data: fresh as unknown, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: redmineCache.key,
      set: { data: fresh as unknown, fetchedAt: new Date() },
    });
  return fresh;
}

export async function invalidateAll(): Promise<void> {
  await db.delete(redmineCache);
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test tests/lib/redmine/cache.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/redmine/cache.ts tests/lib/redmine/cache.test.ts tests/setup.ts vitest.config.ts
git commit -m "feat(redmine): 24h read-through cache in postgres"
```

---

## Task 6: CSV export (pure)

**Files:**
- Create: `lib/csv.ts`
- Create: `tests/lib/csv.test.ts`

**Interfaces:**
- Consumes: `Task` row shape from Drizzle inference.
- Produces:
  - `type CsvTaskRow = { tracker: string; subject: string; assignee: string; dueDate: string | null; sprint: string | null; parentTaskId: number | null; startDate: string | null; description: string | null; priority: string | null }`
  - `function toRedmineCsv(rows: CsvTaskRow[]): string` — full CSV string with header, CRLF line endings, RFC 4180 escaping.
  - `function formatDate(iso: string | null): string` — `"2026-07-13"` → `"07/13/2026"`, `null` → `""`.

- [ ] **Step 1: Write failing tests**

Create `tests/lib/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toRedmineCsv, formatDate } from "@/lib/csv";

describe("formatDate", () => {
  it("converts ISO to MM/DD/YYYY", () => {
    expect(formatDate("2026-07-13")).toBe("07/13/2026");
  });
  it("returns empty string for null", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("toRedmineCsv", () => {
  it("writes header in the exact column order", () => {
    const csv = toRedmineCsv([]);
    expect(csv).toBe(
      "Tracker,Subject,Assignee,Due date,Sprint,Parent task,Start date,Description,Priority\r\n",
    );
  });

  it("writes a simple row", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Task_Scr",
        subject: "Hello",
        assignee: "Nguyen Nguyen",
        dueDate: "2026-07-13",
        sprint: "Q3-2026 (Jul 01 - Sep 30)",
        parentTaskId: 114330,
        startDate: "2026-07-13",
        description: null,
        priority: "Normal",
      },
    ]);
    expect(csv).toContain(
      "Task_Scr,Hello,Nguyen Nguyen,07/13/2026,Q3-2026 (Jul 01 - Sep 30),114330,07/13/2026,,Normal\r\n",
    );
  });

  it("quotes fields with commas and doubles quotes inside", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Bug",
        subject: 'Something, with "quotes"',
        assignee: "A",
        dueDate: null,
        sprint: null,
        parentTaskId: null,
        startDate: null,
        description: "Line 1\nLine 2",
        priority: null,
      },
    ]);
    expect(csv).toContain('"Something, with ""quotes""",A,,,,');
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  it("handles Vietnamese characters", () => {
    const csv = toRedmineCsv([
      {
        tracker: "Task_Scr",
        subject: "Thiết kế bảng điều khiển",
        assignee: "Nguyễn",
        dueDate: null,
        sprint: null,
        parentTaskId: null,
        startDate: null,
        description: null,
        priority: null,
      },
    ]);
    expect(csv).toContain("Thiết kế bảng điều khiển");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/lib/csv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement CSV**

Create `lib/csv.ts`:

```ts
export type CsvTaskRow = {
  tracker: string;
  subject: string;
  assignee: string;
  dueDate: string | null;
  sprint: string | null;
  parentTaskId: number | null;
  startDate: string | null;
  description: string | null;
  priority: string | null;
};

const HEADER = [
  "Tracker",
  "Subject",
  "Assignee",
  "Due date",
  "Sprint",
  "Parent task",
  "Start date",
  "Description",
  "Priority",
];

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  // Expect "YYYY-MM-DD"
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${m}/${d}/${y}`;
}

function escape(value: string): string {
  if (value === "") return "";
  const needsQuote = /[",\r\n]/.test(value);
  if (!needsQuote) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

function rowToLine(r: CsvTaskRow): string {
  return [
    escape(r.tracker),
    escape(r.subject),
    escape(r.assignee),
    escape(formatDate(r.dueDate)),
    escape(r.sprint ?? ""),
    escape(r.parentTaskId != null ? String(r.parentTaskId) : ""),
    escape(formatDate(r.startDate)),
    escape(r.description ?? ""),
    escape(r.priority ?? ""),
  ].join(",");
}

export function toRedmineCsv(rows: CsvTaskRow[]): string {
  const lines = [HEADER.join(","), ...rows.map(rowToLine)];
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/lib/csv.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts tests/lib/csv.test.ts
git commit -m "feat(csv): Redmine-compatible CSV serializer"
```

---

## Task 7: Auth cookie helpers & current-user reader

**Files:**
- Create: `lib/auth/cookie.ts`
- Create: `lib/auth/current-user.ts`

**Interfaces:**
- Consumes: `encryptSession`/`decryptSession` from Task 3, `db` + `users` from Task 2.
- Produces:
  - `const COOKIE_NAME = "br_session"`
  - `function setSessionCookie(payload: SessionPayload): void` (calls `cookies().set(...)`)
  - `function clearSessionCookie(): void`
  - `function readSession(): SessionPayload | null`
  - `async function getCurrentUser(): Promise<{ db: typeof users.$inferSelect; session: SessionPayload } | null>` — reads cookie, looks up DB row.

- [ ] **Step 1: Implement cookie helpers**

Create `lib/auth/cookie.ts`:

```ts
import { cookies } from "next/headers";
import { encryptSession, decryptSession, type SessionPayload } from "./session";

export const COOKIE_NAME = "br_session";
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: encryptSession(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const c = store.get(COOKIE_NAME);
  if (!c) return null;
  try {
    return decryptSession(c.value);
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Implement current-user helper**

Create `lib/auth/current-user.ts`:

```ts
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { readSession } from "./cookie";
import type { SessionPayload } from "./session";

export type CurrentUser = {
  db: typeof users.$inferSelect;
  session: SessionPayload;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await readSession();
  if (!session) return null;
  const rows = await db.select().from(users).where(eq(users.redmineId, session.redmineId));
  const row = rows[0];
  if (!row) return null;
  return { db: row, session };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/cookie.ts lib/auth/current-user.ts
git commit -m "feat(auth): cookie set/read/clear + current-user helper"
```

---

## Task 8: Login flow (server action + page)

**Files:**
- Create: `actions/auth.ts`
- Create: `app/(auth)/login/page.tsx`
- Create: `components/login-form.tsx`

**Interfaces:**
- Consumes: `RedmineClient`, `setSessionCookie`, `clearSessionCookie`, `db.users`.
- Produces:
  - Server action `login(formData: FormData): Promise<{ error?: string }>`
  - Server action `logout(): Promise<void>`
  - Route `/login`.
  - Role rule: user is `manager` if any membership role name matches `/manager/i` or `/admin/i` on `DESIGN_PROJECTS_ID`; else `member`.

- [ ] **Step 1: Implement server actions**

Create `actions/auth.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { RedmineClient, RedmineError } from "@/lib/redmine/client";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/cookie";

const MANAGER_ROLE_RE = /manager|admin/i;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export async function login(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) return { error: "API key không được để trống." };

  const designProjectsId = requireEnv("DESIGN_PROJECTS_ID");
  const client = new RedmineClient(apiKey);

  let current;
  try {
    current = await client.getCurrentUser();
  } catch (err) {
    if (err instanceof RedmineError && err.status === 401) {
      return { error: "API key không hợp lệ." };
    }
    return { error: "Không kết nối được Redmine, thử lại." };
  }

  let role: "manager" | "member" = "member";
  try {
    const memberships = await client.getProjectMemberships(designProjectsId);
    const mine = memberships.find((m) => m.user?.id === current.id);
    if (mine?.roles.some((r) => MANAGER_ROLE_RE.test(r.name))) role = "manager";
  } catch (err) {
    if (err instanceof RedmineError && err.status === 403) {
      return { error: "Bạn không có quyền truy cập project Design Projects." };
    }
    // Non-fatal — default to member.
  }

  const name = `${current.firstname} ${current.lastname}`.trim();
  await db
    .insert(users)
    .values({
      redmineId: current.id,
      name,
      email: current.mail,
      role,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.redmineId,
      set: { name, email: current.mail, role, lastLoginAt: new Date() },
    });

  await setSessionCookie({
    redmineId: current.id,
    name,
    email: current.mail,
    role,
    apiKey,
  });

  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
```

- [ ] **Step 2: Implement login form component (client)**

Create `components/login-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { login } from "@/actions/auth";

const initialState: { error?: string } = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);
  return (
    <form action={formAction} className="mx-auto mt-24 max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Đăng nhập</h1>
      <p className="text-sm text-gray-600">
        Nhập Redmine API key cá nhân (lấy từ trang My account trên bugtracker).
      </p>
      <label className="block">
        <span className="text-sm">API key</span>
        <input
          type="password"
          name="apiKey"
          required
          className="mt-1 block w-full rounded border px-3 py-2 font-mono text-sm"
          placeholder="xxxxxxxx…"
        />
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Đang xác thực…" : "Đăng nhập"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Create login page**

Create `app/(auth)/login/page.tsx`:

```tsx
import { LoginForm } from "@/components/login-form";
import { readSession } from "@/lib/auth/cookie";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect("/");
  return <LoginForm />;
}
```

- [ ] **Step 4: Verify build compiles**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add actions/auth.ts components/login-form.tsx app/\(auth\)/login/page.tsx
git commit -m "feat(auth): login page and server action"
```

---

## Task 9: Auth guard & workspace shell

**Files:**
- Delete: `app/page.tsx` (from Task 1, replaced by group route)
- Create: `app/(app)/layout.tsx`
- Create: `app/(app)/page.tsx`
- Create: `components/header.tsx`

**Interfaces:**
- Consumes: `getCurrentUser`, `logout` action.
- Produces:
  - `/` renders workspace shell (header + placeholder body). Redirects to `/login` if no session.

- [ ] **Step 1: Remove Task-1 placeholder**

Run: `rm app/page.tsx`

- [ ] **Step 2: Create header component**

Create `components/header.tsx`:

```tsx
import { logout } from "@/actions/auth";

export function Header({ name, role }: { name: string; role: "manager" | "member" }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-semibold">Bugtracker Report Tool</h1>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {name} <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{role}</span>
        </span>
        <form action={logout}>
          <button type="submit" className="rounded border px-3 py-1">
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create app layout with guard**

Create `app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Header } from "@/components/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen">
      <Header name={user.db.name} role={user.db.role as "manager" | "member"} />
      <main className="p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Create workspace placeholder**

Create `app/(app)/page.tsx`:

```tsx
export default function WorkspacePage() {
  return <p>Workspace — coming next task.</p>;
}
```

- [ ] **Step 5: Verify build**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app components/header.tsx
git rm app/page.tsx 2>/dev/null || true
git commit -m "feat(app): auth guard and workspace shell"
```

---

## Task 10: Metadata fetch server actions + refresh button

**Files:**
- Create: `actions/metadata.ts`
- Create: `app/api/redmine/refresh/route.ts`
- Create: `components/refresh-button.tsx`
- Modify: `components/header.tsx` (mount the button)

**Interfaces:**
- Consumes: `RedmineClient`, `getCached`, `invalidateAll`, `DESIGN_PROJECTS_ID` env.
- Produces:
  - `async function getProjects(): Promise<Array<{ id: number; name: string }>>`
  - `async function getTrackers(): Promise<Array<{ id: number; name: string }>>`
  - `async function getPriorities(): Promise<Array<{ id: number; name: string }>>`
  - `async function getVersions(projectId: number): Promise<Array<{ id: number; name: string }>>`
  - `async function getParentTasks(): Promise<Array<{ id: number; subject: string; projectName: string; tracker: string }>>`
  - `POST /api/redmine/refresh` — clears cache, returns `{ ok: true }`.

- [ ] **Step 1: Implement metadata actions**

Create `actions/metadata.ts`:

```ts
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
```

- [ ] **Step 2: Implement refresh API route**

Create `app/api/redmine/refresh/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { invalidateAll } from "@/lib/redmine/cache";

export const runtime = "nodejs";

export async function POST() {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await invalidateAll();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Refresh button component**

Create `components/refresh-button.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";

export function RefreshButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <button
      type="button"
      className="rounded border px-3 py-1 text-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await fetch("/api/redmine/refresh", { method: "POST" });
          const data = await res.json();
          setMsg(data.ok ? "Đã refresh" : "Lỗi refresh");
          setTimeout(() => setMsg(null), 2000);
          location.reload();
        })
      }
    >
      {pending ? "Đang refresh…" : msg ?? "Refresh cache"}
    </button>
  );
}
```

- [ ] **Step 4: Mount refresh button in header**

Replace `components/header.tsx`:

```tsx
import { logout } from "@/actions/auth";
import { RefreshButton } from "./refresh-button";

export function Header({ name, role }: { name: string; role: "manager" | "member" }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-semibold">Bugtracker Report Tool</h1>
      <div className="flex items-center gap-4 text-sm">
        <RefreshButton />
        <span>
          {name} <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">{role}</span>
        </span>
        <form action={logout}>
          <button type="submit" className="rounded border px-3 py-1">
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: Verify TS**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add actions/metadata.ts app/api components/refresh-button.tsx components/header.tsx
git commit -m "feat(app): metadata server actions and cache refresh"
```

---

## Task 11: Task CRUD server actions

**Files:**
- Create: `actions/tasks.ts`
- Create: `tests/actions/tasks.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `db`, `tasks` schema.
- Produces:
  - `type TaskInput = { tracker: string; subject: string; description?: string | null; priority?: string | null; projectId: number; projectName: string; sprintName?: string | null; parentTaskId?: number | null; startDate?: string | null; dueDate?: string | null }`
  - `async function createTask(input: TaskInput): Promise<{ id: number }>`
  - `async function updateTask(id: number, input: TaskInput): Promise<void>` — 403 if not owner.
  - `async function deleteTask(id: number): Promise<void>` — 403 if not owner.
  - `async function listTasks(filters: { status?: 'draft' | 'imported' | 'all'; sprint?: string | null; userId?: number | 'all' }): Promise<Array<TaskRow & { userName: string }>>` — non-managers get their own tasks regardless of `userId`.
  - `async function markImported(ids: number[]): Promise<void>` — filters to caller's own rows.
  - `async function exportSelected(ids: number[]): Promise<{ csv: string }>` — returns CSV of caller's rows only, then marks them imported.

- [ ] **Step 1: Write failing tests for zod & ownership**

Create `tests/actions/tasks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/actions/tasks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tasks action file**

Create `actions/tasks.ts`:

```ts
"use server";

import { z } from "zod";
import { and, eq, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tasks, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toRedmineCsv, type CsvTaskRow } from "@/lib/csv";

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
    { message: "dueDate must be >= startDate", path: ["dueDate"] },
  );

export type TaskInput = z.infer<typeof taskInputSchema>;

async function requireUser() {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not authenticated");
  return u;
}

export async function createTask(input: TaskInput): Promise<{ id: number }> {
  const u = await requireUser();
  const data = taskInputSchema.parse(input);
  const [row] = await db
    .insert(tasks)
    .values({ ...data, userId: u.db.id })
    .returning({ id: tasks.id });
  return row;
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  const u = await requireUser();
  const data = taskInputSchema.parse(input);
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) throw new Error("Not found");
  if (existing.userId !== u.db.id) throw new Error("Forbidden");
  await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function deleteTask(id: number): Promise<void> {
  const u = await requireUser();
  const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
  if (!existing) return;
  if (existing.userId !== u.db.id) throw new Error("Forbidden");
  await db.delete(tasks).where(eq(tasks.id, id));
}

export type TaskListFilters = {
  status?: "draft" | "imported" | "all";
  sprint?: string | null;
  userId?: number | "all";
};

export async function listTasks(filters: TaskListFilters = {}) {
  const u = await requireUser();
  const where = [] as any[];

  if (u.db.role === "member" || filters.userId === undefined) {
    where.push(eq(tasks.userId, u.db.id));
  } else if (typeof filters.userId === "number") {
    where.push(eq(tasks.userId, filters.userId));
  } // else: manager + userId === 'all' → no user filter

  const status = filters.status ?? "draft";
  if (status !== "all") where.push(eq(tasks.status, status));
  if (filters.sprint) where.push(eq(tasks.sprintName, filters.sprint));

  return await db
    .select({
      id: tasks.id,
      userId: tasks.userId,
      userName: users.name,
      tracker: tasks.tracker,
      subject: tasks.subject,
      description: tasks.description,
      priority: tasks.priority,
      projectId: tasks.projectId,
      projectName: tasks.projectName,
      sprintName: tasks.sprintName,
      parentTaskId: tasks.parentTaskId,
      startDate: tasks.startDate,
      dueDate: tasks.dueDate,
      status: tasks.status,
      importedAt: tasks.importedAt,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .innerJoin(users, eq(users.id, tasks.userId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(tasks.createdAt));
}

export async function markImported(ids: number[]): Promise<void> {
  const u = await requireUser();
  if (ids.length === 0) return;
  await db
    .update(tasks)
    .set({ status: "imported", importedAt: new Date() })
    .where(and(eq(tasks.userId, u.db.id), inArray(tasks.id, ids)));
}

export async function exportSelected(ids: number[]): Promise<{ csv: string }> {
  const u = await requireUser();
  if (ids.length === 0) return { csv: toRedmineCsv([]) };
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, u.db.id), inArray(tasks.id, ids)));
  const csvRows: CsvTaskRow[] = rows.map((r) => ({
    tracker: r.tracker,
    subject: r.subject,
    assignee: u.db.name,
    dueDate: r.dueDate,
    sprint: r.sprintName,
    parentTaskId: r.parentTaskId,
    startDate: r.startDate,
    description: r.description,
    priority: r.priority,
  }));
  await markImported(rows.map((r) => r.id));
  return { csv: toRedmineCsv(csvRows) };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test tests/actions/tasks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add actions/tasks.ts tests/actions/tasks.test.ts
git commit -m "feat(tasks): CRUD server actions with zod validation and ownership check"
```

---

## Task 12: Task form component

**Files:**
- Create: `components/task-form.tsx`

**Interfaces:**
- Consumes: `createTask`, `updateTask`, `getProjects`, `getTrackers`, `getPriorities`, `getVersions`, `getParentTasks`.
- Produces:
  - `<TaskForm />` component — receives initial metadata (projects, trackers, priorities, parents) as props. Loads versions per selected project client-side via server action. `editingId` prop switches to update mode.

- [ ] **Step 1: Implement task form**

Create `components/task-form.tsx`:

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { createTask, updateTask, type TaskInput } from "@/actions/tasks";
import { getVersions } from "@/actions/metadata";

export type Option = { id: number; name: string };
export type ParentOption = { id: number; subject: string; projectName: string; tracker: string };

export function TaskForm({
  projects,
  trackers,
  priorities,
  parents,
  initial,
  editingId,
  onDone,
}: {
  projects: Option[];
  trackers: Option[];
  priorities: Option[];
  parents: ParentOption[];
  initial?: Partial<TaskInput>;
  editingId?: number;
  onDone?: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tracker, setTracker] = useState(initial?.tracker ?? trackers[0]?.name ?? "");
  const [projectId, setProjectId] = useState<number | null>(initial?.projectId ?? projects[0]?.id ?? null);
  const [projectName, setProjectName] = useState(initial?.projectName ?? projects[0]?.name ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "");
  const [sprintName, setSprintName] = useState(initial?.sprintName ?? "");
  const [parentTaskId, setParentTaskId] = useState<number | "">(initial?.parentTaskId ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [versions, setVersions] = useState<Option[]>([]);
  const [parentQuery, setParentQuery] = useState("");

  useEffect(() => {
    if (!projectId) return setVersions([]);
    getVersions(projectId).then(setVersions).catch(() => setVersions([]));
  }, [projectId]);

  function reset() {
    setSubject("");
    setDescription("");
    setPriority("");
    setParentTaskId("");
    setStartDate("");
    setDueDate("");
    // Keep projectId + sprint for fast batch entry.
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!projectId) return setError("Chọn project.");
    const input: TaskInput = {
      tracker,
      subject,
      description: description || null,
      priority: priority || null,
      projectId,
      projectName,
      sprintName: sprintName || null,
      parentTaskId: parentTaskId === "" ? null : Number(parentTaskId),
      startDate: startDate || null,
      dueDate: dueDate || null,
    };
    start(async () => {
      try {
        if (editingId) {
          await updateTask(editingId, input);
        } else {
          await createTask(input);
        }
        reset();
        onDone?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lỗi.");
      }
    });
  }

  const filteredParents = parents
    .filter((p) => (parentQuery ? p.subject.toLowerCase().includes(parentQuery.toLowerCase()) || String(p.id).includes(parentQuery) : true))
    .slice(0, 20);

  return (
    <form onSubmit={onSubmit} className="w-80 shrink-0 space-y-3 border-r p-4 text-sm">
      <h2 className="text-base font-semibold">
        {editingId ? "Sửa task" : "New task"}
      </h2>

      <label className="block">
        <span className="text-xs text-gray-600">Tracker</span>
        <select value={tracker} onChange={(e) => setTracker(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          {trackers.map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Project *</span>
        <select
          value={projectId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            const p = projects.find((x) => x.id === id);
            setProjectId(id);
            setProjectName(p?.name ?? "");
            setSprintName("");
          }}
          className="mt-1 block w-full rounded border px-2 py-1"
          required
        >
          <option value="">— Chọn —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Subject *</span>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={255} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Description</span>
        <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 block w-full rounded border px-2 py-1" />
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Priority</span>
        <select value={priority ?? ""} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          <option value="">—</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Sprint</span>
        <select value={sprintName ?? ""} onChange={(e) => setSprintName(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1">
          <option value="">—</option>
          {versions.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-600">Parent task</span>
        <input value={parentQuery} onChange={(e) => setParentQuery(e.target.value)} placeholder="Tìm subject hoặc id…" className="mt-1 block w-full rounded border px-2 py-1" />
        <select
          value={parentTaskId === "" ? "" : String(parentTaskId)}
          onChange={(e) => setParentTaskId(e.target.value === "" ? "" : Number(e.target.value))}
          size={4}
          className="mt-1 block w-full rounded border px-2 py-1"
        >
          <option value="">—</option>
          {filteredParents.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} — [{p.tracker}] {p.subject} ({p.projectName})
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-gray-600">Start</span>
          <input type="date" value={startDate ?? ""} onChange={(e) => setStartDate(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
        <label className="block">
          <span className="text-xs text-gray-600">Due</span>
          <input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} className="mt-1 block w-full rounded border px-2 py-1" />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button type="submit" disabled={pending} className="w-full rounded bg-blue-600 py-2 text-white disabled:opacity-50">
        {pending ? "Đang lưu…" : editingId ? "Save changes" : "Add task"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify TS**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/task-form.tsx
git commit -m "feat(ui): task form component"
```

---

## Task 13: Task list, filters, bulk export

**Files:**
- Create: `components/task-list.tsx`
- Modify: `app/(app)/page.tsx`

**Interfaces:**
- Consumes: `listTasks`, `deleteTask`, `exportSelected`, `TaskForm`, metadata actions.
- Produces:
  - `<TaskList />` — shows tasks, checkboxes for own rows (managers still edit only own).
  - Bulk "Export CSV & Mark Imported" button downloads CSV via a hidden anchor + `URL.createObjectURL`.

- [ ] **Step 1: Implement task list**

Create `components/task-list.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { deleteTask, exportSelected } from "@/actions/tasks";

export type TaskRow = {
  id: number;
  userId: number;
  userName: string;
  tracker: string;
  subject: string;
  sprintName: string | null;
  projectName: string;
  status: string;
  createdAt: Date | string;
};

export function TaskList({
  rows,
  currentUserId,
  role,
  onEdit,
}: {
  rows: TaskRow[];
  currentUserId: number;
  role: "manager" | "member";
  onEdit: (id: number) => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const ownRows = rows.filter((r) => r.userId === currentUserId);

  function toggle(id: number) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  function selectAllOwnDraft() {
    setSelected(new Set(ownRows.filter((r) => r.status === "draft").map((r) => r.id)));
  }

  function downloadCsv(csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bugtracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex-1 space-y-3">
      <div className="flex items-center gap-2">
        <button type="button" className="rounded border px-2 py-1 text-xs" onClick={selectAllOwnDraft}>
          Chọn tất cả draft của tôi
        </button>
        <button
          type="button"
          disabled={selected.size === 0 || pending}
          className="rounded bg-green-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          onClick={() =>
            start(async () => {
              const { csv } = await exportSelected(Array.from(selected));
              downloadCsv(csv);
              setSelected(new Set());
              location.reload();
            })
          }
        >
          {pending ? "Exporting…" : `Export CSV & Mark Imported (${selected.size})`}
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="p-2 w-8"></th>
            <th className="p-2">Subject</th>
            <th className="p-2">Tracker</th>
            <th className="p-2">Project</th>
            <th className="p-2">Sprint</th>
            <th className="p-2">Status</th>
            {role === "manager" && <th className="p-2">User</th>}
            <th className="p-2 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOwn = r.userId === currentUserId;
            return (
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-2">
                  {isOwn && r.status === "draft" && (
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                </td>
                <td className="p-2">{r.subject}</td>
                <td className="p-2">{r.tracker}</td>
                <td className="p-2">{r.projectName}</td>
                <td className="p-2">{r.sprintName ?? "—"}</td>
                <td className="p-2">
                  <span
                    className={
                      r.status === "imported"
                        ? "rounded bg-gray-200 px-2 py-0.5 text-xs"
                        : "rounded bg-yellow-200 px-2 py-0.5 text-xs"
                    }
                  >
                    {r.status}
                  </span>
                </td>
                {role === "manager" && <td className="p-2">{r.userName}</td>}
                <td className="p-2">
                  {isOwn && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={() => onEdit(r.id)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 underline"
                        onClick={() =>
                          confirm("Xoá task này?") &&
                          start(async () => {
                            await deleteTask(r.id);
                            location.reload();
                          })
                        }
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={role === "manager" ? 8 : 7} className="p-4 text-center text-gray-500">
                Chưa có task nào.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Compose workspace page**

Replace `app/(app)/page.tsx`:

```tsx
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
```

Create `app/(app)/workspace-client.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskForm } from "@/components/task-form";
import { TaskList, type TaskRow } from "@/components/task-list";

export function WorkspaceClient(props: {
  rows: TaskRow[];
  projects: { id: number; name: string }[];
  trackers: { id: number; name: string }[];
  priorities: { id: number; name: string }[];
  parents: { id: number; subject: string; projectName: string; tracker: string }[];
  currentUserId: number;
  role: "manager" | "member";
}) {
  const [editingId, setEditingId] = useState<number | undefined>();
  const router = useRouter();
  const sp = useSearchParams();

  const editing = editingId ? props.rows.find((r) => r.id === editingId) : undefined;

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null || value === "") params.delete(key);
    else params.set(key, value);
    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="flex gap-4">
      <TaskForm
        projects={props.projects}
        trackers={props.trackers}
        priorities={props.priorities}
        parents={props.parents}
        initial={editing as any}
        editingId={editingId}
        onDone={() => {
          setEditingId(undefined);
          router.refresh();
        }}
      />
      <div className="flex-1 space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label>
            Status:&nbsp;
            <select
              value={sp.get("status") ?? "draft"}
              onChange={(e) => setParam("status", e.target.value)}
              className="rounded border px-2 py-1"
            >
              <option value="draft">Draft</option>
              <option value="imported">Imported</option>
              <option value="all">All</option>
            </select>
          </label>
          {props.role === "manager" && (
            <label>
              User:&nbsp;
              <select
                value={sp.get("user") ?? "all"}
                onChange={(e) => setParam("user", e.target.value)}
                className="rounded border px-2 py-1"
              >
                <option value="all">All team</option>
                {Array.from(new Map(props.rows.map((r) => [r.userId, r.userName])).entries()).map(
                  ([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            </label>
          )}
        </div>
        <TaskList
          rows={props.rows}
          currentUserId={props.currentUserId}
          role={props.role}
          onEdit={setEditingId}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TS**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/task-list.tsx app/\(app\)/page.tsx app/\(app\)/workspace-client.tsx
git commit -m "feat(app): task list, filters, and bulk CSV export"
```

---

## Task 14: End-to-end manual verification & deployment prep

**Files:**
- Create: `README.md`
- Modify: `.env.example` (only if new vars discovered during E2E)

**Interfaces:**
- Consumes: everything from prior tasks.
- Produces: verified app + docs to onboard other users.

- [ ] **Step 1: Set up local env**

Copy `.env.example` → `.env.local`, fill in:
- `DATABASE_URL` from a Neon test project.
- `AUTH_SECRET` from `openssl rand -base64 32`.
- `REDMINE_BASE_URL=https://bugtracker.i3international.com`.
- `DESIGN_PROJECTS_ID` — find via Redmine UI at `/projects/design-projects` (identifier or numeric id in URL).

Run: `pnpm db:push`
Expected: 3 tables created on Neon.

- [ ] **Step 2: Run dev server and log in**

Run: `pnpm dev`

Navigate to `http://localhost:3000`.

Expected: redirect to `/login`. Enter your real Redmine API key. On success, redirect to `/` with header showing your name and role.

- [ ] **Step 3: Verify metadata loads**

On `/`, verify the Project dropdown lists sub-projects of Design Projects, Tracker/Priority dropdowns are populated, Parent task list contains real Epic/Story rows.

If empty: check Vercel logs / dev console for `[bugtracker-tool]` errors; verify `DESIGN_PROJECTS_ID` is correct.

- [ ] **Step 4: Verify CRUD**

- Add a task → row appears in list.
- Edit the task → subject changes.
- Delete → row removed.
- Add 3 tasks → tick 2 → click Export CSV. Verify CSV downloads with the two rows, header matches Redmine columns, and both rows now show status "Imported".

- [ ] **Step 5: Verify permissions with a second user**

Log out; log in with a different team member's API key. Confirm:
- Member only sees own tasks; no User filter dropdown.
- Cannot edit/delete tasks belonging to the first user (buttons hidden).

Manager account (yours): confirm User filter appears and can select each teammate.

- [ ] **Step 6: Write README**

Create `README.md`:

```markdown
# Bugtracker Report Tool

Team-Design task-logging web app that exports a Redmine-compatible CSV
for weekly import into https://bugtracker.i3international.com/.

## Local development

1. Create a Neon Postgres project → copy `DATABASE_URL` (pooled).
2. Generate `AUTH_SECRET`: `openssl rand -base64 32`.
3. Find `DESIGN_PROJECTS_ID` in Redmine (Projects → Design Projects → URL contains id).
4. Copy `.env.example` → `.env.local`, fill in.
5. Install and initialize DB:
   ```
   pnpm install
   pnpm db:push
   ```
6. Run:
   ```
   pnpm dev
   ```
7. Open http://localhost:3000, log in with your personal Redmine API key
   (My account → API access key).

## Deploy to Vercel

1. Push this repo to GitHub.
2. `vercel` (or import in Vercel dashboard). Set all env vars from
   `.env.example` under Project Settings → Environment Variables.
3. First deploy: run `pnpm db:push` locally against the production
   `DATABASE_URL` to apply migrations.

## Tests

```
pnpm test
```

## Weekly workflow

- Team members log their tasks throughout the week from the form.
- On Friday, each member selects their draft rows and clicks
  "Export CSV & Mark Imported" — CSV downloads and the rows move
  to "Imported" status (still visible under Status: Imported / All).
- Import the CSV into Redmine via **Administration → Import** (or the
  per-project Import UI, depending on your Redmine version).
```

- [ ] **Step 7: Final build + test check**

Run: `pnpm test && pnpm build`
Expected: all tests pass, build succeeds.

- [ ] **Step 8: Commit and tag**

```bash
git add README.md .env.example
git commit -m "docs: README with setup and deploy instructions"
git tag v0.1.0
```

- [ ] **Step 9: Push and deploy**

```bash
# Set up GitHub remote (once):
# gh repo create bugtracker-report-tool --private --source=. --remote=origin
git push -u origin main --tags
```

Then in Vercel: import the repo, set env vars, deploy. Share the URL with the team; each member logs in with their own Redmine API key.
