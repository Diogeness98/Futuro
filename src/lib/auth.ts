import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "futuro_session";
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export interface SessionPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET precisa ter pelo menos 32 caracteres.");
  return new TextEncoder().encode(value);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secret());
}

export async function setSession(payload: SessionPayload) {
  const token = await createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.userId || !payload.organizationId || !payload.email) return null;
    return {
      userId: String(payload.userId),
      organizationId: String(payload.organizationId),
      role: String(payload.role ?? "member"),
      email: String(payload.email),
    };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
