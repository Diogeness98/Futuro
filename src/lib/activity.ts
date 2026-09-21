import { db } from "@/lib/db";

interface ActivityInput {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function recordActivity(input: ActivityInput) {
  try {
    await db.activityLog.create({
      data: {
        organizationId: input.organizationId,
        actorType: "user",
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
