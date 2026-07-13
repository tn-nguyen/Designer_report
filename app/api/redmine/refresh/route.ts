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
