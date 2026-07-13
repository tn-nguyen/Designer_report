import { randomBytes } from "node:crypto";

process.env.AUTH_SECRET ??= randomBytes(32).toString("base64");
process.env.REDMINE_BASE_URL ??= "https://redmine.example.com";
process.env.DESIGN_PROJECTS_ID ??= "1";
// Placeholder so modules that construct a lazy neon-http client at import
// time (e.g. lib/db/client.ts) don't throw during collection. No test
// exercises a real connection with this value — DB-touching tests mock
// "@/lib/db/client" instead.
process.env.DATABASE_URL ??= "postgres://user:pass@localhost:5432/placeholder";
