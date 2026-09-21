import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const raw = await bodyFromRequest(request);
  const current = await db.product.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  const product = await db.product.update({ where: { id }, data: {
    name: raw.name !== undefined ? String(raw.name).trim() : undefined,
    sku: raw.sku !== undefined ? (String(raw.sku).trim() || null) : undefined,
    stock: raw.stock !== undefined ? Math.max(0, integer(raw.stock)) : undefined,
    priceCents: raw.priceCents !== undefined ? Math.max(0, integer(raw.priceCents)) : raw.price !== undefined ? moneyToCents(raw.price) : undefined,
    active: raw.active !== undefined ? String(raw.active) === "true" : undefined,
  } });
  return NextResponse.json({ product });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const result = await db.product.deleteMany({ where: { id, organizationId: session.organizationId } });
  if (!result.count) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
