# Designer Report

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
