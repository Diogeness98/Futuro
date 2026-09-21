import { aiConfig } from "./config";
import { routeTask } from "./policy";
import { decideWithJev } from "./providers/jev";
import { generateWithOpenAI } from "./providers/openai";
import type { AiExecutionResult, AiTask } from "./types";

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
    const decision = await decideWithJev({ state: task.input, options: taskOptions });

    if (aiConfig.jev.mode === "mock") {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        manualReview: true,
      };
    }

    if (decision.confidence >= aiConfig.jev.autoExecuteThreshold) {
      return { provider: "jev", result: decision, confidence: decision.confidence };
    }

    if (decision.confidence < aiConfig.jev.gptReviewThreshold) {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
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
        manualReview: true,
      };
    }

    const reviewPrompt = [
      "Você é o revisor econômico do roteador Futuro.",
      "Escolha estritamente uma das opções permitidas.",
      `Tarefa: ${task.input}`,
      `Opções permitidas: ${taskOptions.join(", ")}`,
      `Jev escolheu: ${decision.decision} com confiança ${decision.confidence}.`,
      "Responda com a opção escolhida e uma justificativa de uma frase.",
    ].join("\n");

    const reviewed = await generateWithOpenAI(reviewPrompt, aiConfig.openai.defaultModel);
    return {
      provider: "openai",
      result: reviewed.text,
      usage: reviewed.usage,
      escalated: true,
      confidence: decision.confidence,
    };
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

  const generated = await generateWithOpenAI(task.input, route.model);
  return {
    provider: "openai",
    result: generated.text,
    usage: generated.usage,
    workRecommended: route.workRecommended,
  };
}
