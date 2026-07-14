"use server";

import { redirect } from "next/navigation";
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

/**
 * Used by the workspace error boundary when a Redmine 401 surfaces
 * mid-session (revoked/expired API key) — clears the now-invalid
 * session and sends the user back to the login screen.
 */
export async function clearAndRedirect(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
