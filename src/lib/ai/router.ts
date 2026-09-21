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

    // Jev mock nunca pode disparar automação real.
    if (aiConfig.jev.mode === "mock") {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        manualReview: true,
      };
    }

    // Faixa 1: confiança alta. Jev resolve sozinho e economiza GPT.
    if (decision.confidence >= aiConfig.jev.autoExecuteThreshold) {
      return { provider: "jev", result: decision, confidence: decision.confidence };
    }

    // Faixa 3: confiança baixa. Não gastamos GPT automaticamente:
    // enviamos para revisão humana/filas futuras.
    if (decision.confidence < aiConfig.jev.gptReviewThreshold) {
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
        manualReview: true,
      };
    }

    // Faixa 2: somente a zona cinzenta usa o GPT econômico como revisor.
    const reviewPrompt = [
      "Você é o revisor econômico do roteador Futuro.",
      "Escolha estritamente uma das opções permitidas.",
      `Tarefa: ${task.input}`,
      `Opções permitidas: ${options.join(", ")}`,
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

  const generated = await generateWithOpenAI(task.input, route.model);
  return {
    provider: "openai",
    result: generated.text,
    usage: generated.usage,
    workRecommended: route.workRecommended,
  };
}
