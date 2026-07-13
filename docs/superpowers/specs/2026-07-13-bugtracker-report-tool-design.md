# Bugtracker Report Tool — Design Spec

**Date**: 2026-07-13
**Author**: Nguyen Nguyen (Design team manager)
**Status**: Draft — pending implementation

## 1. Mục tiêu

Xây dựng web app cho team Design log các task đã làm trong tuần. Cuối tuần, manager export CSV và import lên Redmine (`https://bugtracker.i3international.com/`). Tool giúp:

- Nhập task nhanh với dropdown dữ liệu lấy từ Redmine (tránh gõ tay sai tên project/sprint/parent).
- Tất cả member cùng dùng chung 1 web app deploy trên Vercel.
- Manager có thể xem task của toàn team; member chỉ xem của mình.
- Giữ lịch sử: task đã import vẫn còn để tra cứu.

## 2. Ngoài phạm vi (Non-goals)

- Push task trực tiếp lên Redmine qua API. Vẫn dùng CSV import thủ công.
- Dashboard/analytics.
- Notifications (Slack, email).
- Mobile-optimized UI (chỉ đảm bảo dùng được, không đầu tư).
- E2E test.

## 3. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────┐
│  Browser (Next.js UI: form + list)           │
└──────────────┬───────────────────────────────┘
               │  (server actions)
┌──────────────▼───────────────────────────────┐
│  Next.js Server (Vercel)                     │
│  ┌────────────┐        ┌──────────────────┐  │
│  │ Auth layer │◄──────►│ Redmine client   │  │
│  │ (cookie)   │        │ (fetch w/ key)   │  │
│  └─────┬──────┘        └────────┬─────────┘  │
│        │                        │            │
│        ▼                        ▼            │
│  ┌──────────────────────────────────────┐    │
│  │  Drizzle ORM                         │    │
│  └────────────────┬─────────────────────┘    │
└───────────────────┼──────────────────────────┘
                    ▼
              Neon Postgres
              (tasks, users, cache)
```

**Tech stack**:
- Next.js 15 (App Router) + TypeScript
- Neon Postgres (serverless)
- Drizzle ORM
- Tailwind CSS + shadcn/ui
- Zod (validation)
- Vitest (unit tests)
- Deploy: Vercel

## 4. Auth flow

1. User truy cập lần đầu → redirect `/login` → nhập Redmine API key cá nhân.
2. Server gọi `GET /users/current.json` với API key đó:
   - Nếu 401 → hiện lỗi "API key không hợp lệ".
   - Nếu 200 → nhận `{ id, firstname, lastname, mail }`.
3. Server gọi `GET /projects/<DESIGN_PROJECTS_ID>/memberships.json` để tra role:
   - User có role "Manager" hoặc "Developer with admin rights" trên "Design Projects" → `role = 'manager'`.
   - Trường hợp khác → `role = 'member'`.
4. Upsert record vào bảng `users` (`redmine_id`, `name`, `email`, `role`, `last_login_at`).
5. Mã hoá API key bằng AES-256-GCM với `AUTH_SECRET`, lưu trong cookie httpOnly, SameSite=Lax, secure, max-age 30 ngày.
6. Các server action sau đọc cookie, giải mã, dùng để gọi Redmine — client không nhìn thấy key.

## 5. Database schema

Postgres, 3 bảng:

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  redmine_id    INT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  email         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('manager','member')),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE tasks (
  id             SERIAL PRIMARY KEY,
  user_id        INT NOT NULL REFERENCES users(id),
  tracker        TEXT NOT NULL,
  subject        TEXT NOT NULL,
  description    TEXT,
  priority       TEXT,
  project_id     INT NOT NULL,
  project_name   TEXT NOT NULL,
  sprint_name    TEXT,
  parent_task_id INT,
  start_date     DATE,
  due_date       DATE,
  status         TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','imported')),
  imported_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX tasks_user_status_idx ON tasks (user_id, status);
CREATE INDEX tasks_status_created_idx ON tasks (status, created_at DESC);

CREATE TABLE redmine_cache (
  key         TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL
);
```

**Cache keys**:
- `projects` — sub-projects của "Design Projects".
- `trackers` — danh sách tracker types (Task_Scr, Bug, Epic, ...).
- `priorities` — danh sách priority (Low/Normal/High/Urgent).
- `versions:<projectId>` — versions (sprints) của từng project.
- `parent_tasks` — Epic + Story trong toàn bộ Design Projects tree, kể cả closed.

TTL cache: 24 giờ. Có nút "Refresh cache" trên header để ép reload.

**Snapshot**: `project_name` và `sprint_name` lưu tại thời điểm nhập, không phải reference — tránh Redmine đổi tên làm CSV export sai.

## 6. UI

### Route

- `/login` — form nhập API key.
- `/` — workspace (form + list). Có auth guard, redirect `/login` nếu không có cookie hợp lệ.

### Workspace layout

```
┌────────────────────────────────────────────────────────────┐
│  Header:  Bugtracker Report Tool    [Refresh cache] [User▼]│
├──────────────────┬─────────────────────────────────────────┤
│                  │   Filter bar:                           │
│   New task form  │   Status: [Draft ▼] Sprint:[..]         │
│   ─────────────  │   [Manager only] User: [All ▼]          │
│   Tracker  [▼]   │                                         │
│   Project  [▼]   │   ┌───────────────────────────────────┐ │
│   Subject  [__]  │   │ Task list (table)                 │ │
│   Desc     [__]  │   │ ☐ Subject      Tracker  Sprint    │ │
│   Priority [▼]   │   │ ☐ ...          ...      ...       │ │
│   Sprint   [▼]   │   └───────────────────────────────────┘ │
│   Parent   [▼🔍] │                                         │
│   Start    [📅]  │   [Export CSV & Mark Imported] (bulk)   │
│   Due      [📅]  │                                         │
│                  │                                         │
│   [Add task]     │                                         │
└──────────────────┴─────────────────────────────────────────┘
```

### Behaviors

- **Add**: Fill form → "Add task" → row mới trong list. Form giữ lại giá trị Project + Sprint để nhập nhanh nhiều task cùng loại. Các field khác reset.
- **Edit**: Click row → form load. Nút chuyển thành "Save changes". Nút "Cancel" để bỏ.
- **Delete**: Icon 🗑 khi hover row → confirm dialog.
- **Filter**:
  - Status: `Draft` (mặc định) / `Imported` / `All`.
  - Sprint: dropdown.
  - User: chỉ manager thấy dropdown này. Mặc định "All team".
- **Permissions**:
  - Member: xem/edit/delete/export task của chính mình. Không thấy user filter.
  - Manager: xem task của toàn team qua filter user. Edit/delete/export **chỉ** task của chính mình. Task của member khác chỉ xem, không sửa. (Nếu sau này cần cho manager sửa task member, mở thêm switch riêng.)
- **Bulk export**: Checkbox từng row (hoặc header select-all) → nút "Export CSV & Mark Imported":
  1. Server sinh CSV → trả file download.
  2. Update `status='imported'`, `imported_at=NOW()` cho các row được chọn.
  3. Manager chỉ bulk-export task của chính mình. Task của member khác không có checkbox chọn.
- **Refresh cache**: nút trên header. Bất kỳ user nào cũng bấm được (chỉ ép refetch data metadata, không hại).
- **Responsive**: Desktop-first. Mobile chỉ đảm bảo dùng được, không đầu tư.

### CSV format (Redmine-compatible)

Cột: `Tracker, Subject, Assignee, Due date, Sprint, Parent task, Start date, Description, Priority`

- Bỏ cột `#` (Redmine tự sinh).
- Bỏ cột `Status` (Redmine mặc định "New" khi import).
- `Assignee` = tên user (từ `users.name`).
- `Parent task` = ID Redmine (số nguyên).
- `Start date` / `Due date` format `MM/DD/YYYY` (khớp Redmine mặc định).
- Escape đúng chuẩn RFC 4180: quote field có dấu phẩy / newline / dấu nháy kép; nháy kép trong nội dung → double.

## 7. Cấu trúc code

```
app/
├── (auth)/login/page.tsx
├── (app)/
│   ├── layout.tsx                  # auth guard + header
│   └── page.tsx                    # workspace
├── api/redmine/refresh/route.ts    # POST refresh cache
└── layout.tsx
actions/
├── auth.ts                         # login/logout server actions
├── tasks.ts                        # CRUD + export CSV
└── cache.ts                        # refresh cache
lib/
├── db/
│   ├── schema.ts                   # Drizzle schema
│   ├── client.ts                   # neon-http + drizzle
│   └── migrations/
├── redmine/
│   ├── client.ts                   # fetch wrapper (pagination, errors)
│   ├── types.ts                    # Project, Version, Issue, User
│   └── cache.ts                    # get-or-fetch cached metadata
├── auth/
│   ├── session.ts                  # AES-256-GCM encrypt/decrypt
│   └── current-user.ts             # đọc user từ cookie
└── csv.ts                          # generate Redmine CSV
components/
├── task-form.tsx
├── task-list.tsx
├── project-picker.tsx
├── parent-task-picker.tsx          # searchable combobox
└── ui/                             # shadcn/ui
tests/
├── lib/csv.test.ts
├── lib/auth/session.test.ts
├── lib/redmine/cache.test.ts
└── actions/tasks.test.ts
```

### Ranh giới module

| Module | Nhiệm vụ | Phụ thuộc |
|---|---|---|
| `lib/redmine/client.ts` | HTTP tới Redmine + pagination + error mapping | fetch |
| `lib/redmine/cache.ts` | Read-through cache: DB → fallback API | redmine/client, db |
| `lib/auth/session.ts` | AES-GCM encrypt/decrypt cookie | node:crypto |
| `lib/csv.ts` | Pure function: `Task[] → string` | (pure) |
| `actions/tasks.ts` | Zod validate + ownership check + CRUD | db, csv, current-user |
| `components/*` | UI only, gọi server action | actions/* |

**Nguyên tắc**:
- Server actions là cửa duy nhất client dùng để thao tác DB/Redmine. Không expose REST API public.
- `lib/csv.ts` pure → test dễ.
- Không có logic Redmine trong React component.

## 8. Env vars

```
DATABASE_URL              # Neon connection string (pooled)
AUTH_SECRET               # 32-byte random base64 (cookie encryption)
REDMINE_BASE_URL          # https://bugtracker.i3international.com
DESIGN_PROJECTS_ID        # numeric id hoặc slug của parent project "Design Projects"
```

Cả `AUTH_SECRET` và Redmine API key (per-user, trong cookie) đều **không** commit lên git. `.env.local` gitignored. Trên Vercel setup qua Environment Variables UI.

## 9. Error handling

| Lớp | Loại lỗi | Xử lý |
|---|---|---|
| Redmine API | 401 (key sai/hết hạn) | Xoá cookie, redirect `/login`, msg "API key không hợp lệ" |
| | 403 (không quyền project) | Toast "Bạn không có quyền Design Projects" |
| | Timeout / 5xx | Retry 2 lần exponential backoff; fail → toast |
| | Rate limit | Serve cache cũ nếu có, warn "Đang dùng data cache" |
| DB | Unique violation (redmine_id) | Update thay insert |
| | Connection fail | Toast "Không kết nối được DB" |
| Input | Required field | Highlight đỏ + msg dưới field |
| | Due < Start | Msg "Due date phải ≥ Start date" |
| | Parent không thuộc project | Warning nhưng vẫn cho save |

Validation ở server action bằng Zod.

## 10. Testing

Chỉ test unit có logic:

| Test | Nội dung |
|---|---|
| `lib/csv.test.ts` | Escape dấu phẩy / nháy / newline; ký tự Vietnamese; null values; date format `MM/DD/YYYY` |
| `lib/auth/session.test.ts` | Encrypt→decrypt round-trip; tamper token throw |
| `lib/redmine/cache.test.ts` | Cache hit từ DB; cache miss/expired → fetch → lưu DB |
| `actions/tasks.test.ts` | Zod reject input xấu; ownership check (member không sửa task người khác); status transition Draft→Imported |

Không test: Redmine client HTTP (test bằng tay khi dev), React components, E2E.

Runtime: `pnpm test` với Vitest. CI Vercel chạy trước deploy.

## 11. Logging

`console.log` với prefix `[bugtracker-tool]`. Xem qua Vercel logs. Không dùng log service riêng.

## 12. Deployment

1. Setup Neon Postgres → lấy `DATABASE_URL`.
2. Sinh `AUTH_SECRET`: `openssl rand -base64 32`.
3. Tạo Vercel project, link repo, set env vars.
4. Run migration lần đầu từ local với env `DATABASE_URL` trỏ production: `pnpm drizzle-kit push`.
5. Deploy.

## 13. Rủi ro & giả định

- **Giả định**: "Design Projects" là parent project và có ít hơn ~200 sub-projects → dropdown flat OK.
- **Giả định**: Số Epic + Story trong Design Projects tree < ~500 → cache `parent_tasks` khả thi.
- **Rủi ro**: Redmine version có thể có custom field mà tool không handle → chỉ support core fields; custom field bỏ qua trong export.
- **Rủi ro**: Nếu Redmine API rate-limit strict → cần điều chỉnh TTL cache lên.
- **Rủi ro**: Nếu team mở rộng > 20 người, Neon free tier có thể chật → nâng plan.
