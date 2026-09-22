import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bodyFromRequest, integer, moneyToCents } from "@/lib/http";
import { recordActivity } from "@/lib/activity";
import { enqueueAutomationEvent } from "@/lib/automation/queue";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const orders = await db.order.findMany({
    where: { organizationId: session.organizationId },
    include: { customer: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const raw = await bodyFromRequest(request);
    const input = z.object({
      customerId: z.string().optional(),
      status: z.string().trim().max(40).optional(),
      total: z.any().optional(),
      totalCents: z.any().optional(),
    }).parse(raw);

    if (input.customerId) {
      const customer = await db.customer.findFirst({
        where: {
          id: input.customerId,
          organizationId: session.organizationId,
        },
      });
      if (!customer) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    }

    const totalCents = input.totalCents !== undefined
      ? Math.max(0, integer(input.totalCents))
      : moneyToCents(input.total);

    const order = await db.order.create({
      data: {
        organizationId: session.organizationId,
        customerId: input.customerId || null,
        status: input.status || "pending",
        channel: "manual",
        totalCents,
      },
    });

    await recordActivity({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "order.created",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        status: order.status,
        channel: order.channel,
        totalCents: order.totalCents,
      },
    });

    try {
      await enqueueAutomationEvent({
        organizationId: session.organizationId,
        triggerType: "order.created",
        entityType: "Order",
        entityId: order.id,
        payload: {
          event: "order.created",
          order: {
            id: order.id,
            externalId: order.externalId,
            customerId: order.customerId,
            channel: order.channel,
            status: order.status,
            totalCents: order.totalCents,
            createdAt: order.createdAt.toISOString(),
          },
        },
      });

      await db.order.update({
        where: { id: order.id },
        data: { orderCreatedEventAt: new Date() },
      });
    } catch (queueError) {
      console.error(
        "Pedido criado, mas falhou ao enfileirar automações:",
        queueError instanceof Error ? queueError.message : "erro desconhecido",
      );
    }

    if ((request.headers.get("content-type") ?? "").includes("application/json")) {
      return NextResponse.json({ order }, { status: 201 });
    }
    return NextResponse.redirect(new URL("/orders", request.url), 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar pedido.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
