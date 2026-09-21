import { aiConfig } from "./config";
import { routeTask } from "./policy";
import { decideWithJev } from "./providers/jev";
import { generateWithOpenAI } from "./providers/openai";
import type { AiExecutionResult, AiTask, JevDecision, ProviderUsage } from "./types";

interface AiExecutionOptions {
  allowOpenAI?: boolean;
  budgetReason?: string;
}

export async function executeAiTask(task: AiTask, options: AiExecutionOptions = {}): Promise<AiExecutionResult> {
  const route = routeTask(task);
  const allowOpenAI = options.allowOpenAI ?? true;

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

      if (aiConfig.jev.fallbackToGptOnError && allowOpenAI) {
        try {
          const fallback = await generateWithOpenAI(buildDecisionFallbackPrompt(task, taskOptions, message), aiConfig.openai.defaultModel);
          return {
            provider: "openai",
            result: fallback.text,
            usage: fallback.usage,
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

    if (!allowOpenAI) {
      return {
        provider: "jev",
        result: {
          ...decision,
          budgetBlocked: true,
          reason: options.budgetReason ?? "Orçamento OpenAI indisponível.",
        },
        confidence: decision.confidence,
        usage: jevUsage,
        manualReview: true,
      };
    }

    const reviewPrompt = [
      "Você é o revisor econômico do roteador Futuro.",
      "Escolha estritamente uma das opções permitidas.",
      `Tarefa: ${task.input}`,
      task.decisionInstructions ? `Critério da decisão: ${task.decisionInstructions}` : "",
      `Opções permitidas: ${taskOptions.join(", ")}`,
      `Jev escolheu: ${decision.decision} com confiança ${decision.confidence}.`,
      "Responda com a opção escolhida e uma justificativa de uma frase.",
    ].filter(Boolean).join("\n");

    try {
      const reviewed = await generateWithOpenAI(reviewPrompt, aiConfig.openai.defaultModel);
      return {
        provider: "openai",
        result: reviewed.text,
        usage: reviewed.usage,
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
        manualReview: true,
      };
    }
  }

  if (!allowOpenAI) {
    return {
      provider: "code",
      result: {
        handled: false,
        budgetBlocked: true,
        reason: options.budgetReason ?? "Orçamento OpenAI indisponível.",
      },
      manualReview: true,
      workRecommended: false,
    };
  }

  try {
    const generated = await generateWithOpenAI(task.input, route.model);
    return {
      provider: "openai",
      result: generated.text,
      usage: generated.usage,
      workRecommended: route.workRecommended,
    };
  } catch (error) {
    return {
      provider: "openai",
      result: {
        failed: true,
        error: errorMessage(error),
      },
      manualReview: true,
      workRecommended: false,
    };
  }
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
    `Estado: ${task.input}`,
    task.decisionInstructions ? `Pergunta: ${task.decisionInstructions}` : "",
    `Opções permitidas: ${options.join(", ")}`,
    `Falha do Jev: ${jevError}`,
    "Responda de forma curta com uma opção permitida e uma justificativa de uma frase.",
  ].filter(Boolean).join("\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro desconhecido do provedor.";
}
