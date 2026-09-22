import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { enqueueProductLowStockEvent } from "@/lib/automation/events";
import { inventoryConfig, shouldEmitLowStockEvent } from "@/lib/inventory/config";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const products = await db.product.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const raw = await bodyFromRequest(request);
    const input = z.object({ name: z.string().trim().min(1).max(160), sku: z.string().trim().max(80).optional().or(z.literal("")), price: z.any().optional(), priceCents: z.any().optional(), stock: z.any().optional() }).parse(raw);
    const priceCents = input.priceCents !== undefined ? Math.max(0, integer(input.priceCents)) : moneyToCents(input.price);
    const product = await db.product.create({ data: { organizationId: session.organizationId, name: input.name, sku: input.sku || null, priceCents, stock: Math.max(0, integer(input.stock)) } });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "product.created",
      entityType: "Product",
      entityId: product.id,
      metadata: { name: product.name, stock: product.stock, priceCents: product.priceCents },
    });

    if (shouldEmitLowStockEvent({
      stock: product.stock,
      active: product.active,
      threshold: inventoryConfig.lowStockThreshold,
    })) {
      try {
        await enqueueProductLowStockEvent({
          organizationId: session.organizationId,
          product,
          threshold: inventoryConfig.lowStockThreshold,
        });
      } catch (queueError) {
        console.error(
          "Produto criado, mas falhou ao enfileirar estoque baixo:",
          queueError instanceof Error ? queueError.message : "erro desconhecido",
        );
      }
    }

    if ((request.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ product }, { status: 201 });
    return NextResponse.redirect(new URL("/products", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar produto.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
