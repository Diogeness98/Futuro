import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db";
import { getOpenAiBudgetStatus } from "./budget";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("OpenAI budget persistence integration", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("conta tentativa GPT mesmo quando o provedor final é Jev", async () => {
    const organization = await db.organization.create({
      data: { name: "Budget Integration Test" },
    });
    organizations.push(organization.id);

    await db.aiDecision.createMany({
      data: [
        {
          organizationId: organization.id,
          provider: "jev",
          taskType: "decision",
          inputSummary: "Jev com revisão GPT que falhou",
          inputTokens: 25,
          outputTokens: 5,
          openAiAttempted: true,
          openAiInputTokens: 120,
          openAiOutputTokens: 0,
          decision: { reviewerFailed: true },
        },
        {
          organizationId: organization.id,
          provider: "openai",
          taskType: "generation",
          inputSummary: "Geração GPT",
          inputTokens: 50,
          outputTokens: 20,
          openAiAttempted: true,
          openAiInputTokens: 50,
          openAiOutputTokens: 20,
          decision: { ok: true },
        },
        {
          organizationId: organization.id,
          provider: "jev",
          taskType: "decision",
          inputSummary: "Jev sem GPT",
          inputTokens: 999,
          outputTokens: 999,
          openAiAttempted: false,
          decision: { ok: true },
        },
      ],
    });

    const budget = await getOpenAiBudgetStatus(organization.id);

    expect(budget.calls).toBe(2);
    expect(budget.inputTokens).toBe(170);
    expect(budget.outputTokens).toBe(20);
  });
});
