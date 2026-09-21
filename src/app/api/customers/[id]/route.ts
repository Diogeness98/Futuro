import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const raw = await bodyFromRequest(request);
  const current = await db.customer.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  const customer = await db.customer.update({ where: { id }, data: {
    name: raw.name !== undefined ? String(raw.name).trim() : undefined,
    email: raw.email !== undefined ? (String(raw.email).trim() || null) : undefined,
    phone: raw.phone !== undefined ? (String(raw.phone).trim() || null) : undefined,
  } });

  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "customer.updated",
    entityType: "Customer",
    entityId: customer.id,
    metadata: { name: customer.name },
  });

  return NextResponse.json({ customer });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const current = await db.customer.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });

  await db.customer.delete({ where: { id } });
  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "customer.deleted",
    entityType: "Customer",
    entityId: id,
    metadata: { name: current.name },
  });

  return NextResponse.json({ ok: true });
}
