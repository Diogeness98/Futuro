import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { bodyFromRequest } from "@/lib/http";

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  organizationName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(12, "A senha precisa ter pelo menos 12 caracteres.").max(128),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await bodyFromRequest(request));
    const email = input.email.toLowerCase();
    if (await db.user.findUnique({ where: { email } })) return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const created = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: input.organizationName } });
      const user = await tx.user.create({ data: { name: input.name, email, passwordHash } });
      await tx.membership.create({ data: { userId: user.id, organizationId: organization.id, role: "owner" } });
      return { user, organization };
    });

    await setSession({ userId: created.user.id, organizationId: created.organization.id, role: "owner", email });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível criar a conta.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
