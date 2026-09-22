import { Prisma } from "../../generated/prisma/client";
import { recordActivity } from "../activity";
import { db } from "../db";
import type { AutomationTriggerType } from "./config";
import { parseAutomationTrigger } from "./config";
import { runAutomation } from "./runner";

const MAX_ATTEMPTS = 3;
const DEFAULT_BATCH_SIZE = 5;

interface QueueEventInput {
  entityType: string;
  entityId: string;
  payload: unknown;
}

export interface QueueEnqueueSummary {
  events: number;
  executions: number;
  automations: number;
}

export interface QueueProcessSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export async function enqueueAutomationEvent(input: {
  organizationId: string;
  triggerType: AutomationTriggerType;
  entityType: string;
  entityId: string;
  payload: unknown;
}): Promise<QueueEnqueueSummary> {
  return enqueueAutomationEvents({
    organizationId: input.organizationId,
    triggerType: input.triggerType,
    events: [{
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
    }],
  });
}

export async function enqueueAutomationEvents(input: {
  organizationId: string;
  triggerType: AutomationTriggerType;
  events: QueueEventInput[];
}): Promise<QueueEnqueueSummary> {
  const uniqueEvents = deduplicateEvents(input.events);
  if (uniqueEvents.length === 0) {
    return { events: 0, executions: 0, automations: 0 };
  }

  const enabled = await db.automation.findMany({
    where: {
      organizationId: input.organizationId,
      enabled: true,
    },
    select: {
      id: true,
      trigger: true,
    },
  });

  const matchingAutomationIds = enabled.flatMap((automation) => {
    try {
      return parseAutomationTrigger(automation.trigger).type === input.triggerType
        ? [automation.id]
        : [];
    } catch {
      return [];
    }
  });

  if (matchingAutomationIds.length === 0) {
    return { events: 0, executions: 0, automations: 0 };
  }

  const createdEvents = await db.$transaction(async (tx) => {
    await tx.automationEvent.createMany({
      data: uniqueEvents.map((event) => ({
        organizationId: input.organizationId,
        triggerType: input.triggerType,
        entityType: event.entityType,
        entityId: event.entityId,
        payload: toJson(event.payload),
        status: "pending",
      })),
      skipDuplicates: true,
    });

    const events = await tx.automationEvent.findMany({
      where: {
        organizationId: input.organizationId,
        triggerType: input.triggerType,
        OR: uniqueEvents.map((event) => ({
          entityType: event.entityType,
          entityId: event.entityId,
        })),
      },
      select: { id: true },
    });

    if (events.length > 0) {
      await tx.automationEventExecution.createMany({
        data: events.flatMap((event) => matchingAutomationIds.map((automationId) => ({
          eventId: event.id,
          automationId,
          status: "pending",
        }))),
        skipDuplicates: true,
      });
    }

    return events;
  });

  return {
    events: createdEvents.length,
    executions: createdEvents.length * matchingAutomationIds.length,
    automations: matchingAutomationIds.length,
  };
}

export async function processAutomationQueue(input: {
  organizationId: string;
  actorId?: string;
  limit?: number;
}): Promise<QueueProcessSummary> {
  const limit = Math.min(20, Math.max(1, input.limit ?? DEFAULT_BATCH_SIZE));
  await recoverStaleClaims(input.organizationId);

  const candidates = await db.automationEventExecution.findMany({
    where: {
      event: { organizationId: input.organizationId },
      attempts: { lt: MAX_ATTEMPTS },
      status: { in: ["pending", "failed"] },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      event: true,
      automation: true,
    },
  });

  const summary: QueueProcessSummary = {
    claimed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const candidate of candidates) {
    const claimed = await db.automationEventExecution.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
        attempts: candidate.attempts,
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        startedAt: new Date(),
        lastError: null,
      },
    });

    if (claimed.count !== 1) continue;
    summary.claimed += 1;

    if (!candidate.automation.enabled) {
      await db.automationEventExecution.update({
        where: { id: candidate.id },
        data: {
          status: "skipped",
          processedAt: new Date(),
          lastError: "Automação foi desativada antes do processamento.",
        },
      });
      summary.skipped += 1;
      await finalizeEvent(candidate.eventId);
      continue;
    }

    try {
      await runAutomation({
        automationId: candidate.automationId,
        organizationId: input.organizationId,
        actorId: input.actorId,
        context: candidate.event.payload,
      });

      await db.automationEventExecution.update({
        where: { id: candidate.id },
        data: {
          status: "succeeded",
          processedAt: new Date(),
          lastError: null,
        },
      });
      summary.succeeded += 1;
    } catch (error) {
      const message = errorMessage(error);
      await db.automationEventExecution.update({
        where: { id: candidate.id },
        data: {
          status: "failed",
          lastError: message.slice(0, 1000),
        },
      });
      summary.failed += 1;

      await recordActivity({
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: input.actorId ? "user" : "system",
        action: "automation.queue_execution_failed",
        entityType: "AutomationEventExecution",
        entityId: candidate.id,
        metadata: toJson({
          automationId: candidate.automationId,
          eventId: candidate.eventId,
          attempt: candidate.attempts + 1,
          error: message.slice(0, 300),
        }),
      });
    }

    await finalizeEvent(candidate.eventId);
  }

  return summary;
}

export async function getAutomationQueueStatus(organizationId: string) {
  const [pending, processing, failed, succeeded] = await Promise.all([
    db.automationEventExecution.count({
      where: {
        event: { organizationId },
        status: "pending",
      },
    }),
    db.automationEventExecution.count({
      where: {
        event: { organizationId },
        status: "processing",
      },
    }),
    db.automationEventExecution.count({
      where: {
        event: { organizationId },
        status: "failed",
        attempts: { lt: MAX_ATTEMPTS },
      },
    }),
    db.automationEventExecution.count({
      where: {
        event: { organizationId },
        status: "succeeded",
      },
    }),
  ]);

  const deadLetter = await db.automationEventExecution.count({
    where: {
      event: { organizationId },
      status: "failed",
      attempts: { gte: MAX_ATTEMPTS },
    },
  });

  return {
    pending,
    processing,
    retryableFailed: failed,
    succeeded,
    deadLetter,
    batchSize: DEFAULT_BATCH_SIZE,
    maxAttempts: MAX_ATTEMPTS,
  };
}

async function finalizeEvent(eventId: string) {
  const executions = await db.automationEventExecution.findMany({
    where: { eventId },
    select: {
      status: true,
      attempts: true,
    },
  });

  if (executions.length === 0) return;

  const hasActive = executions.some((execution) =>
    execution.status === "pending" ||
    execution.status === "processing" ||
    (execution.status === "failed" && execution.attempts < MAX_ATTEMPTS),
  );

  if (hasActive) {
    await db.automationEvent.update({
      where: { id: eventId },
      data: {
        status: "pending",
        processedAt: null,
      },
    });
    return;
  }

  const hasDeadLetter = executions.some((execution) =>
    execution.status === "failed" && execution.attempts >= MAX_ATTEMPTS,
  );

  await db.automationEvent.update({
    where: { id: eventId },
    data: {
      status: hasDeadLetter ? "failed" : "processed",
      processedAt: new Date(),
    },
  });
}

async function recoverStaleClaims(organizationId: string) {
  const staleBefore = new Date(Date.now() - 10 * 60 * 1000);

  await db.automationEventExecution.updateMany({
    where: {
      event: { organizationId },
      status: "processing",
      startedAt: { lt: staleBefore },
      attempts: { lt: MAX_ATTEMPTS },
    },
    data: {
      status: "failed",
      lastError: "Execução recuperada após claim expirado.",
    },
  });
}

function deduplicateEvents(events: QueueEventInput[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!event.entityType.trim() || !event.entityId.trim()) return false;
    const key = `${event.entityType.trim()}:${event.entityId.trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido ao processar automação.";
}
