import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";
import { recordActivity } from "@/lib/activity";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const raw = await bodyFromRequest(request);
  const current = await db.order.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (current.channel !== "manual") {
    return NextResponse.json({ error: "Pedidos sincronizados devem ser atualizados pela integração de origem." }, { status: 409 });
  }

  const order = await db.order.update({ where: { id }, data: {
    status: raw.status !== undefined ? String(raw.status) : undefined,
    totalCents: raw.totalCents !== undefined ? Math.max(0, integer(raw.totalCents)) : raw.total !== undefined ? moneyToCents(raw.total) : undefined,
  } });

  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "order.updated",
    entityType: "Order",
    entityId: order.id,
    metadata: { status: order.status, totalCents: order.totalCents },
  });

  return NextResponse.json({ order });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const current = await db.order.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  if (current.channel !== "manual") {
    return NextResponse.json({ error: "Pedidos sincronizados não podem ser excluídos manualmente." }, { status: 409 });
  }

  await db.order.delete({ where: { id } });
  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "order.deleted",
    entityType: "Order",
    entityId: id,
    metadata: { status: current.status, totalCents: current.totalCents },
  });

  return NextResponse.json({ ok: true });
}
