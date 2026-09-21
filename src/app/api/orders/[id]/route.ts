import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const raw = await bodyFromRequest(request);
  const current = await db.order.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  const order = await db.order.update({ where: { id }, data: {
    status: raw.status !== undefined ? String(raw.status) : undefined,
    totalCents: raw.totalCents !== undefined ? Math.max(0, integer(raw.totalCents)) : raw.total !== undefined ? moneyToCents(raw.total) : undefined,
  } });
  return NextResponse.json({ order });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const result = await db.order.deleteMany({ where: { id, organizationId: session.organizationId } });
  if (!result.count) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
