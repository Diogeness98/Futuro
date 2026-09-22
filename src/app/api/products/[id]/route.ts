import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { enqueueProductLowStockEvent } from "@/lib/automation/events";
import { inventoryConfig } from "@/lib/inventory/config";

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

  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "product.updated",
    entityType: "Product",
    entityId: product.id,
    metadata: { name: product.name, stock: product.stock, priceCents: product.priceCents },
  });

  const enteredLowStock =
    product.active &&
    product.stock <= inventoryConfig.lowStockThreshold &&
    (current.stock > inventoryConfig.lowStockThreshold || !current.active);

  if (enteredLowStock) {
    try {
      await enqueueProductLowStockEvent({
        organizationId: session.organizationId,
        product,
        threshold: inventoryConfig.lowStockThreshold,
      });
    } catch (queueError) {
      console.error(
        "Produto atualizado, mas falhou ao enfileirar estoque baixo:",
        queueError instanceof Error ? queueError.message : "erro desconhecido",
      );
    }
  }

  return NextResponse.json({ product });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await context.params;
  const current = await db.product.findFirst({ where: { id, organizationId: session.organizationId } });
  if (!current) return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });

  await db.product.delete({ where: { id } });
  await recordActivity({
    organizationId: session.organizationId,
    actorId: session.userId,
    action: "product.deleted",
    entityType: "Product",
    entityId: id,
    metadata: { name: current.name },
  });

  return NextResponse.json({ ok: true });
}
