import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  enqueueAutomationEvent,
  processAutomationQueue,
  resolveAutomationReview,
} from "./queue";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("automation queue integration", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("deduplica evento, processa uma vez e conclui revisão humana", async () => {
    const organization = await db.organization.create({
      data: { name: "Queue Integration Test" },
    });
    organizations.push(organization.id);

    const automation = await db.automation.create({
      data: {
        organizationId: organization.id,
        name: "Revisar pedido",
        enabled: true,
        trigger: { type: "order.created" },
        action: {
          type: "manual.review",
          instruction: "Revisar o pedido antes de continuar.",
        },
      },
    });

    const event = {
      organizationId: organization.id,
      triggerType: "order.created" as const,
      entityType: "Order",
      entityId: "order-test-1",
      payload: {
        event: "order.created",
        order: {
          id: "order-test-1",
          channel: "manual",
          status: "pending",
          totalCents: 10000,
        },
      },
    };

    const first = await enqueueAutomationEvent(event);
    const duplicate = await enqueueAutomationEvent(event);

    expect(first.events).toBe(1);
    expect(first.executions).toBe(1);
    expect(duplicate.events).toBe(0);
    expect(duplicate.executions).toBe(0);

    const processed = await processAutomationQueue({
      organizationId: organization.id,
      limit: 5,
    });

    expect(processed.claimed).toBe(1);
    expect(processed.review).toBe(1);
    expect(processed.failed).toBe(0);

    const execution = await db.automationEventExecution.findFirstOrThrow({
      where: { automationId: automation.id },
      include: { event: true },
    });

    expect(execution.status).toBe("review");
    expect(execution.attempts).toBe(1);
    expect(execution.event.status).toBe("review");

    const resolved = await resolveAutomationReview({
      organizationId: organization.id,
      executionId: execution.id,
      actorId: "integration-test",
      note: "Aprovado no teste.",
    });

    expect(resolved.status).toBe("reviewed");

    const [finalExecution, finalEvent] = await Promise.all([
      db.automationEventExecution.findUniqueOrThrow({
        where: { id: execution.id },
      }),
      db.automationEvent.findUniqueOrThrow({
        where: { id: execution.eventId },
      }),
    ]);

    expect(finalExecution.status).toBe("reviewed");
    expect(finalExecution.processedAt).not.toBeNull();
    expect(finalEvent.status).toBe("processed");
    expect(finalEvent.processedAt).not.toBeNull();

    const replay = await processAutomationQueue({
      organizationId: organization.id,
      limit: 5,
    });

    expect(replay.claimed).toBe(0);
  });
});
