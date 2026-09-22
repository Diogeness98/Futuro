import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "./db";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];
const users: string[] = [];

describeDb("database schema integration", () => {
  afterEach(async () => {
    if (organizations.length > 0) {
      await db.organization.deleteMany({
        where: { id: { in: organizations.splice(0) } },
      });
    }
    if (users.length > 0) {
      await db.user.deleteMany({
        where: { id: { in: users.splice(0) } },
      });
    }
  });

  it("persiste os modelos principais e suas relações", async () => {
    const suffix = randomUUID();

    const organization = await db.organization.create({
      data: { name: "Schema Smoke Test" },
    });
    organizations.push(organization.id);

    const user = await db.user.create({
      data: {
        email: `schema-${suffix}@example.test`,
        name: "Schema User",
        passwordHash: "not-a-real-password-hash",
      },
    });
    users.push(user.id);

    await db.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: "owner",
      },
    });

    const product = await db.product.create({
      data: {
        organizationId: organization.id,
        sku: `SKU-${suffix}`,
        name: "Produto teste",
        description: "Validação da migração",
        priceCents: 2590,
        stock: 8,
        active: true,
      },
    });

    const customer = await db.customer.create({
      data: {
        organizationId: organization.id,
        name: "Cliente teste",
        email: `customer-${suffix}@example.test`,
        phone: "+5500000000000",
      },
    });

    const order = await db.order.create({
      data: {
        organizationId: organization.id,
        customerId: customer.id,
        externalId: `external-${suffix}`,
        channel: "manual",
        status: "pending",
        totalCents: 5180,
        items: {
          create: [{
            productId: product.id,
            name: product.name,
            quantity: 2,
            unitCents: 2590,
          }],
        },
      },
      include: { items: true },
    });

    await db.integration.create({
      data: {
        organizationId: organization.id,
        provider: `test-${suffix}`,
        status: "connected",
        config: { smoke: true },
      },
    });

    const automation = await db.automation.create({
      data: {
        organizationId: organization.id,
        name: "Automação teste",
        enabled: true,
        trigger: { type: "manual" },
        conditions: [{ path: "order.status", operator: "eq", value: "pending" }],
        action: { type: "manual.review", instruction: "Revisar" },
      },
    });

    await db.aiDecision.create({
      data: {
        organizationId: organization.id,
        provider: "code",
        taskType: "smoke",
        inputSummary: "schema smoke test",
        decision: { ok: true },
        confidence: 1,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: "0",
      },
    });

    await db.activityLog.create({
      data: {
        organizationId: organization.id,
        actorType: "system",
        actorId: user.id,
        action: "schema.smoke",
        entityType: "Order",
        entityId: order.id,
        metadata: { automationId: automation.id },
      },
    });

    const loaded = await db.organization.findUniqueOrThrow({
      where: { id: organization.id },
      include: {
        memberships: true,
        products: true,
        customers: true,
        orders: { include: { items: true } },
        integrations: true,
        automations: true,
        aiDecisions: true,
        activityLogs: true,
      },
    });

    expect(loaded.memberships).toHaveLength(1);
    expect(loaded.products).toHaveLength(1);
    expect(loaded.customers).toHaveLength(1);
    expect(loaded.orders).toHaveLength(1);
    expect(loaded.orders[0]?.items).toHaveLength(1);
    expect(loaded.integrations).toHaveLength(1);
    expect(loaded.automations).toHaveLength(1);
    expect(loaded.aiDecisions).toHaveLength(1);
    expect(loaded.activityLogs).toHaveLength(1);
  });
});
