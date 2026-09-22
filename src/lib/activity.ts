import { Prisma } from "../generated/prisma/client";
import { db } from "./db";

interface ActivityInput {
  organizationId: string;
  actorId?: string | null;
  actorType?: "user" | "system";
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export async function recordActivity(input: ActivityInput) {
  try {
    await db.activityLog.create({
      data: {
        organizationId: input.organizationId,
        actorType: input.actorType ?? (input.actorId ? "user" : "system"),
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    // Auditoria não deve derrubar a operação principal.
    console.error("Falha ao registrar atividade:", error instanceof Error ? error.message : "erro desconhecido");
  }
}
