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
