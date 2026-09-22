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

const REGISTRATION_CONFLICT = {
  error: "Não foi possível criar a conta com esses dados.",
};

export async function POST(request: Request) {
  try {
    const input = schema.parse(await bodyFromRequest(request));
    const email = input.email.toLowerCase();

    // Executa o mesmo trabalho caro antes da checagem de existência para
    // reduzir diferença de tempo entre e-mail novo e e-mail já cadastrado.
    const passwordHash = await bcrypt.hash(input.password, 12);

    if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json(REGISTRATION_CONFLICT, { status: 409 });
    }

    const created = await db.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: input.organizationName },
      });
      const user = await tx.user.create({
        data: { name: input.name, email, passwordHash },
      });
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "owner",
        },
      });
      return { user, organization };
    });

    await setSession({
      userId: created.user.id,
      organizationId: created.organization.id,
      role: "owner",
      email,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(REGISTRATION_CONFLICT, { status: 409 });
    }

    const message = error instanceof Error
      ? error.message
      : "Não foi possível criar a conta.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function isUniqueViolation(error: unknown) {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002",
  );
}
