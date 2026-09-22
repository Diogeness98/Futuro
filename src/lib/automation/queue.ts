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
  dedupeKey?: string;
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
      deletedAt: null,
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

  const queued = await db.$transaction(async (tx) => {
    const eventInsert = await tx.automationEvent.createMany({
      data: uniqueEvents.map((event) => ({
        organizationId: input.organizationId,
        triggerType: input.triggerType,
        entityType: event.entityType,
        entityId: event.entityId,
        dedupeKey: event.dedupeKey ?? `${event.entityType}:${event.entityId}`,
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
          dedupeKey: event.dedupeKey ?? `${event.entityType}:${event.entityId}`,
        })),
      },
      select: { id: true },
    });

    let executionCount = 0;
    if (events.length > 0) {
      const executionInsert = await tx.automationEventExecution.createMany({
        data: events.flatMap((event) => matchingAutomationIds.map((automationId) => ({
          eventId: event.id,
          automationId,
          status: "pending",
        }))),
        skipDuplicates: true,
      });
      executionCount = executionInsert.count;
    }

    return {
      eventCount: eventInsert.count,
      executionCount,
    };
  });

  return {
    events: queued.eventCount,
    executions: queued.executionCount,
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

    if (!candidate.automation.enabled || candidate.automation.deletedAt) {
      await db.automationEventExecution.update({
        where: { id: candidate.id },
        data: {
          status: "skipped",
          processedAt: new Date(),
          lastError: candidate.automation.deletedAt
            ? "Automação foi excluída antes do processamento."
            : "Automação foi desativada antes do processamento.",
        },
      });
      summary.skipped += 1;
      await finalizeEvent(candidate.eventId);
      continue;
    }

    try {
      const runResult = await runAutomation({
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
          result: toJson({
            provider: runResult.result.provider,
            result: runResult.result.result,
            confidence: "confidence" in runResult.result ? runResult.result.confidence ?? null : null,
            manualReview: runResult.result.manualReview ?? false,
            escalated: "escalated" in runResult.result ? runResult.result.escalated ?? false : false,
          }),
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

export async function processAllAutomationQueues(input: {
  organizationLimit?: number;
  perOrganizationLimit?: number;
} = {}) {
  const organizationLimit = Math.min(20, Math.max(1, input.organizationLimit ?? 5));
  const perOrganizationLimit = Math.min(10, Math.max(1, input.perOrganizationLimit ?? 3));

  const organizations = await db.automationEvent.findMany({
    where: {
      executions: {
        some: {
          attempts: { lt: MAX_ATTEMPTS },
          status: { in: ["pending", "failed"] },
        },
      },
    },
    select: { organizationId: true },
    distinct: ["organizationId"],
    take: organizationLimit,
  });

  const summary = {
    organizations: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };

  for (const item of organizations) {
    const result = await processAutomationQueue({
      organizationId: item.organizationId,
      limit: perOrganizationLimit,
    });

    summary.organizations += 1;
    summary.claimed += result.claimed;
    summary.succeeded += result.succeeded;
    summary.failed += result.failed;
    summary.skipped += result.skipped;
  }

  return summary;
}

export async function retryDeadLetterExecutions(input: {
  organizationId: string;
  limit?: number;
}) {
  const limit = Math.min(100, Math.max(1, input.limit ?? 20));

  const executions = await db.automationEventExecution.findMany({
    where: {
      event: { organizationId: input.organizationId },
      status: "failed",
      attempts: { gte: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      eventId: true,
    },
  });

  if (executions.length === 0) {
    return { reset: 0, events: 0 };
  }

  const eventIds = [...new Set(executions.map((execution) => execution.eventId))];

  await db.$transaction([
    db.automationEventExecution.updateMany({
      where: { id: { in: executions.map((execution) => execution.id) } },
      data: {
        status: "pending",
        attempts: 0,
        lastError: null,
        startedAt: null,
        processedAt: null,
        result: Prisma.JsonNull,
      },
    }),
    db.automationEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        status: "pending",
        processedAt: null,
      },
    }),
  ]);

  return {
    reset: executions.length,
    events: eventIds.length,
  };
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

  const stale = await db.automationEventExecution.findMany({
    where: {
      event: { organizationId },
      status: "processing",
      startedAt: { lt: staleBefore },
    },
    select: {
      id: true,
      eventId: true,
    },
  });

  if (stale.length === 0) return;

  await db.automationEventExecution.updateMany({
    where: {
      id: { in: stale.map((execution) => execution.id) },
      status: "processing",
    },
    data: {
      status: "failed",
      lastError: "Execução recuperada após claim expirado.",
    },
  });

  for (const eventId of [...new Set(stale.map((execution) => execution.eventId))]) {
    await finalizeEvent(eventId);
  }
}

function deduplicateEvents(events: QueueEventInput[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (!event.entityType.trim() || !event.entityId.trim()) return false;
    const key = event.dedupeKey?.trim() || `${event.entityType.trim()}:${event.entityId.trim()}`;
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
