import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { enqueueProductLowStockEvent } from "./events";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("low-stock automation event episodes", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("deduplica retries do mesmo episódio e aceita um episódio futuro", async () => {
    const organization = await db.organization.create({
      data: { name: "Low Stock Episode Test" },
    });
    organizations.push(organization.id);

    await db.automation.create({
      data: {
        organizationId: organization.id,
        name: "Revisar estoque baixo",
        enabled: true,
        trigger: { type: "product.low_stock" },
        action: {
          type: "manual.review",
          instruction: "Revisar produto com estoque baixo.",
        },
      },
    });

    const product = await db.product.create({
      data: {
        organizationId: organization.id,
        name: "Produto teste",
        sku: "LOW-1",
        stock: 2,
        active: true,
      },
    });

    const first = await enqueueProductLowStockEvent({
      organizationId: organization.id,
      product,
      threshold: 5,
      episodeId: "episode-1",
    });

    const retry = await enqueueProductLowStockEvent({
      organizationId: organization.id,
      product,
      threshold: 5,
      episodeId: "episode-1",
    });

    const futureEpisode = await enqueueProductLowStockEvent({
      organizationId: organization.id,
      product,
      threshold: 5,
      episodeId: "episode-2",
    });

    expect(first.events).toBe(1);
    expect(first.executions).toBe(1);
    expect(retry.events).toBe(0);
    expect(retry.executions).toBe(0);
    expect(futureEpisode.events).toBe(1);
    expect(futureEpisode.executions).toBe(1);

    expect(await db.automationEvent.count({
      where: {
        organizationId: organization.id,
        triggerType: "product.low_stock",
      },
    })).toBe(2);
  });
});
