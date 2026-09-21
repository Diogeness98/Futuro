import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest } from "@/lib/http";

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
  return NextResponse.json({ customer });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const result = await db.customer.deleteMany({ where: { id, organizationId: session.organizationId } });
  if (!result.count) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
