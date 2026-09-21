import { aiConfig } from "./config";
import { routeTask } from "./policy";
import { decideWithJev } from "./providers/jev";
import { generateWithOpenAI } from "./providers/openai";
import type { AiExecutionResult, AiTask } from "./types";

export async function executeAiTask(task: AiTask): Promise<AiExecutionResult> {
  const route = routeTask(task);

  if (route.provider === "code") {
    return { provider: "code", result: { handled: true, reason: route.reason } };
  }

  if (route.provider === "jev") {
    const options = task.options ?? ["sim", "não"];
    const decision = await decideWithJev({ state: task.input, options });

    if (decision.confidence >= aiConfig.jev.autoExecuteThreshold && aiConfig.jev.mode !== "mock") {
      return { provider: "jev", result: decision, confidence: decision.confidence };
    }

    const reviewPrompt = [
      "Você é o revisor de baixo custo do roteador Futuro.",
      `Tarefa: ${task.input}`,
      `Opções permitidas: ${options.join(", ")}`,
      `Jev escolheu: ${decision.decision} com confiança ${decision.confidence}.`,
      "Responda de forma curta indicando a opção mais adequada e uma justificativa de uma frase.",
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

  const generated = await generateWithOpenAI(task.input, route.model);
  return {
    provider: "openai",
    result: generated.text,
    usage: generated.usage,
    workRecommended: route.workRecommended,
  };
}
