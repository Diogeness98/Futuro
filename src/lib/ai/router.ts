import { evaluateOpenAiReservation, type OpenAiBudgetStatus } from "./budget";
import { aiConfig } from "./config";
import { routeTask } from "./policy";
import { decideWithJev } from "./providers/jev";
import { generateWithOpenAI, reviewDecisionWithOpenAI } from "./providers/openai";
import type { AiExecutionResult, AiTask, JevDecision, ProviderUsage } from "./types";

interface AiExecutionOptions {
  allowOpenAI?: boolean;
  budgetReason?: string;
  openAiBudget?: OpenAiBudgetStatus;
}

interface OpenAiPermit {
  allowed: boolean;
  reason: string;
  estimatedInputTokens: number;
  reservedOutputTokens: number;
}

export async function executeAiTask(task: AiTask, options: AiExecutionOptions = {}): Promise<AiExecutionResult> {
  const route = routeTask(task);

  if (route.provider === "code") {
    return { provider: "code", result: { handled: true, reason: route.reason } };
  }

  if (route.provider === "jev") {
    const taskOptions = task.options ?? ["sim", "não"];
    let decision: JevDecision;

    try {
      decision = await decideWithJev({
        state: task.input,
        options: taskOptions,
        instructions: task.decisionInstructions,
        criteria: task.criteria,
      });
    } catch (error) {
      const message = errorMessage(error);

      if (aiConfig.jev.fallbackToGptOnError) {
        const fallbackPrompt = buildDecisionFallbackPrompt(task, taskOptions, message);
        const permit = openAiPermit(
          options,
          fallbackPrompt,
          aiConfig.openai.reviewMaxOutputTokens,
        );

        if (!permit.allowed) {
          return {
            provider: "jev",
            result: {
              failed: true,
              error: message,
              budgetBlocked: true,
              fallbackSuppressed: true,
              reason: permit.reason,
            },
            manualReview: true,
          };
        }

        try {
          const fallback = await reviewDecisionWithOpenAI(
            fallbackPrompt,
            taskOptions,
            aiConfig.openai.defaultModel,
          );
          return {
            provider: "openai",
            result: {
              ...fallback.decision,
              source: "jev_error_fallback",
            },
            usage: fallback.usage,
            openAiAttempted: true,
            openAiUsage: fallback.usage ?? estimatedOpenAiUsage(permit),
            escalated: true,
            manualReview: false,
          };
        } catch (fallbackError) {
          return {
            provider: "jev",
            result: {
              failed: true,
              error: message,
              fallbackFailed: true,
              fallbackError: errorMessage(fallbackError),
            },
            openAiAttempted: true,
            openAiUsage: estimatedOpenAiUsage(permit),
            manualReview: true,
          };
        }
      }

      return {
        provider: "jev",
        result: {
          failed: true,
          error: message,
          fallbackSuppressed: true,
          reason: "Falha do Jev não chama GPT automaticamente por política de economia.",
        },
        manualReview: true,
      };
    }

    const jevUsage = usageFromJev(decision);

    if (aiConfig.jev.mode === "mock") {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        usage: jevUsage,
        manualReview: true,
      };
    }

    if (decision.confidence >= aiConfig.jev.autoExecuteThreshold) {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        usage: jevUsage,
      };
    }

    if (decision.confidence < aiConfig.jev.gptReviewThreshold) {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        usage: jevUsage,
        manualReview: true,
      };
    }

    const reviewPrompt = [
      "Você é o revisor econômico do roteador Futuro.",
      "Revise a decisão abaixo e selecione exatamente uma opção permitida.",
      `Tarefa: ${reviewContext(task.input)}`,
      task.decisionInstructions ? `Critério da decisão: ${task.decisionInstructions}` : "",
      task.criteria ? `Critérios das opções: ${JSON.stringify(task.criteria)}` : "",
      `Opções permitidas: ${taskOptions.join(", ")}`,
      `Jev escolheu: ${decision.decision} com confiança ${decision.confidence}.`,
      "Use a justificativa somente para auditoria e mantenha-a curta.",
    ].filter(Boolean).join("\n");

    const reviewPermit = openAiPermit(
      options,
      reviewPrompt,
      aiConfig.openai.reviewMaxOutputTokens,
    );

    if (!reviewPermit.allowed) {
      return {
        provider: "jev",
        result: {
          ...decision,
          budgetBlocked: true,
          reason: reviewPermit.reason,
        },
        confidence: decision.confidence,
        usage: jevUsage,
        manualReview: true,
      };
    }

    try {
      const reviewed = await reviewDecisionWithOpenAI(
        reviewPrompt,
        taskOptions,
        aiConfig.openai.defaultModel,
      );
      return {
        provider: "openai",
        result: {
          ...reviewed.decision,
          source: "jev_review",
          jevDecision: decision.decision,
          jevConfidence: decision.confidence,
        },
        usage: reviewed.usage,
        openAiAttempted: true,
        openAiUsage: reviewed.usage ?? estimatedOpenAiUsage(reviewPermit),
        escalated: true,
        confidence: decision.confidence,
      };
    } catch (error) {
      return {
        provider: "jev",
        result: {
          ...decision,
          reviewerFailed: true,
          reviewerError: errorMessage(error),
        },
        confidence: decision.confidence,
        usage: jevUsage,
        openAiAttempted: true,
        openAiUsage: estimatedOpenAiUsage(reviewPermit),
        manualReview: true,
      };
    }
  }

  const model = route.model ?? aiConfig.openai.defaultModel;
  const maxOutputTokens = model === aiConfig.openai.escalationModel
    ? aiConfig.openai.escalationMaxOutputTokens
    : aiConfig.openai.defaultMaxOutputTokens;
  const permit = openAiPermit(options, task.input, maxOutputTokens);

  if (!permit.allowed) {
    return {
      provider: "code",
      result: {
        handled: false,
        budgetBlocked: true,
        reason: permit.reason,
      },
      manualReview: true,
      workRecommended: false,
    };
  }

  try {
    const generated = await generateWithOpenAI(task.input, model);
    return {
      provider: "openai",
      result: generated.text,
      usage: generated.usage,
      openAiAttempted: true,
      openAiUsage: generated.usage ?? estimatedOpenAiUsage(permit),
      workRecommended: route.workRecommended,
    };
  } catch (error) {
    return {
      provider: "openai",
      result: {
        failed: true,
        error: errorMessage(error),
      },
      openAiAttempted: true,
      openAiUsage: estimatedOpenAiUsage(permit),
      manualReview: true,
      workRecommended: false,
    };
  }
}

function openAiPermit(
  options: AiExecutionOptions,
  input: string,
  maxOutputTokens: number,
): OpenAiPermit {
  const estimatedInputTokens = Math.max(1, Math.ceil(Math.max(0, input.length) / 3));
  const reservedOutputTokens = Math.max(0, Math.floor(maxOutputTokens));

  if (options.allowOpenAI === false) {
    return {
      allowed: false,
      reason: options.budgetReason || "Orçamento OpenAI indisponível.",
      estimatedInputTokens,
      reservedOutputTokens,
    };
  }

  if (options.openAiBudget) {
    const reservation = evaluateOpenAiReservation(
      options.openAiBudget,
      input.length,
      maxOutputTokens,
    );

    return {
      allowed: reservation.allowed,
      reason: reservation.reasons.join(" ") || "Orçamento OpenAI disponível.",
      estimatedInputTokens: reservation.estimatedInputTokens,
      reservedOutputTokens: reservation.reservedOutputTokens,
    };
  }

  return {
    allowed: true,
    reason: "Orçamento OpenAI não informado.",
    estimatedInputTokens,
    reservedOutputTokens,
  };
}

function estimatedOpenAiUsage(permit: OpenAiPermit): ProviderUsage {
  return {
    inputTokens: permit.estimatedInputTokens,
    outputTokens: 0,
    totalTokens: permit.estimatedInputTokens,
  };
}

function usageFromJev(decision: JevDecision): ProviderUsage | undefined {
  const inputTokens = decision.usage?.inputTokens;
  const outputTokens = decision.usage?.outputTokens;
  if (inputTokens === undefined && outputTokens === undefined) return undefined;

  return {
    inputTokens,
    outputTokens,
    totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
  };
}

function buildDecisionFallbackPrompt(task: AiTask, options: string[], jevError: string) {
  return [
    "Jev está indisponível. Faça somente a decisão estruturada necessária.",
    `Estado: ${reviewContext(task.input)}`,
    task.decisionInstructions ? `Pergunta: ${task.decisionInstructions}` : "",
    task.criteria ? `Critérios: ${JSON.stringify(task.criteria)}` : "",
    `Opções permitidas: ${options.join(", ")}`,
    `Falha do Jev: ${jevError}`,
  ].filter(Boolean).join("\n");
}

function reviewContext(input: string) {
  if (input.length <= aiConfig.openai.reviewMaxInputChars) return input;
  return input.slice(0, aiConfig.openai.reviewMaxInputChars) + "\n[contexto truncado para economia]";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido do provedor.";
}
