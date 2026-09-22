import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";

const schema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
});

const INVALID_LOGIN = { error: "E-mail ou senha inválidos." };
const DUMMY_PASSWORD_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function POST(request: Request) {
  try {
    const input = schema.parse(await bodyFromRequest(request));
    const email = input.email.toLowerCase();
    const user = await db.user.findUnique({
      where: { email },
      include: {
        memberships: {
          take: 1,
          orderBy: { id: "asc" },
        },
      },
    });

    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordValid = await bcrypt.compare(input.password, passwordHash);
    const membership = user?.memberships[0];

    if (!user || !passwordValid || !membership) {
      return NextResponse.json(INVALID_LOGIN, { status: 401 });
    }

    await setSession({
      userId: user.id,
      organizationId: membership.organizationId,
      role: membership.role,
      email: user.email,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(INVALID_LOGIN, { status: 401 });
  }
}
