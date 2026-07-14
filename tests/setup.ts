import { randomBytes } from "node:crypto";

process.env.AUTH_SECRET ??= randomBytes(32).toString("base64");
process.env.REDMINE_BASE_URL ??= "https://redmine.example.com";
process.env.DESIGN_PROJECTS_ID ??= "1";
