import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "./db";
import { can, type Module } from "./permissions";

const COOKIE = "session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET ausente ou curto (mín. 32 chars) [NECESSÁRIO CONFIGURAR]");
  return new TextEncoder().encode(s);
};

export type Session = { userId: string; companyId: string; name: string; role: Role };

export async function createSession(s: Session) {
  const token = await new SignJWT({ ...s }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(key());
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 7 });
}
export async function destroySession() { (await cookies()).delete(COOKIE); }

export async function getSession(): Promise<Session | null> {
  const t = (await cookies()).get(COOKIE)?.value;
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, key()); return payload as unknown as Session; } catch { return null; }
}

/** Use no topo de toda página/ação protegida. */
export async function requireSession(module?: Module): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (module && !can(s.role, module)) redirect("/?negado=1");
  return s;
}
