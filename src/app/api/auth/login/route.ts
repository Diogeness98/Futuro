import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import {
  clearLoginThrottle,
  loginThrottleBlocked,
  loginThrottleKey,
  recordLoginFailure,
} from "@/lib/auth/login-throttle";
import { bodyFromRequest } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

const dummyPasswordHash = bcrypt.hash("futuro-invalid-login-sentinel", 12);

export async function POST(request: Request) {
  try {
    const input = schema.parse(await bodyFromRequest(request));
    const email = input.email.toLowerCase();
    const throttleKey = loginThrottleKey(email, request);

    if (await loginThrottleBlocked(throttleKey)) {
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          take: 1,
          orderBy: { id: "asc" },
        },
      },
    });

    const passwordHash = user?.passwordHash ?? await dummyPasswordHash;
    const passwordValid = await bcrypt.compare(input.password, passwordHash);
    const membership = user?.memberships[0];

    if (!user || !passwordValid || !membership) {
      await recordLoginFailure(throttleKey);
      return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    }

    await clearLoginThrottle(throttleKey);

    await setSession({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
      email: user.email,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
}
