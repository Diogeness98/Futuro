import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await bodyFromRequest(request));
    const email = input.email.toLowerCase();
    const user = await db.user.findUnique({ where: { email }, include: { memberships: { take: 1, orderBy: { id: "asc" } } } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
    const membership = user.memberships[0];
    if (!membership) return NextResponse.json({ error: "Usuário sem organização." }, { status: 403 });
    await setSession({ userId: user.id, organizationId: membership.organizationId, role: membership.role, email: user.email });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 401 });
  }
}
