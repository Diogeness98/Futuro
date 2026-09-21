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
      return {
        provider: "jev",
        result: decision,
        confidence: decision.confidence,
      };
    }

    const reviewModel =
      aiConfig.jev.mode === "mock" || decision.confidence >= aiConfig.jev.gptReviewThreshold
        ? aiConfig.openai.defaultModel
        : aiConfig.openai.escalationModel;

    const reviewPrompt = [
      "Você é o revisor do roteador econômico do Futuro.",
      `Tarefa: ${task.input}`,
      `Opções permitidas: ${options.join(", ")}`,
      `Jev escolheu: ${decision.decision} com confiança ${decision.confidence}.`,
      "Escolha somente uma das opções permitidas e justifique em uma frase curta.",
    ].join("\n");

    const reviewed = await generateWithOpenAI(reviewPrompt, reviewModel);
    return {
      provider: "openai",
      model: reviewModel,
      result: reviewed.text,
      usage: reviewed.usage,
      escalated: true,
      confidence: decision.confidence,
      initialJevDecision: decision,
    };
  }

  const model = route.model ?? aiConfig.openai.defaultModel;
  const generated = await generateWithOpenAI(task.input, model);
  return {
    provider: "openai",
    model,
    result: generated.text,
    usage: generated.usage,
    workRecommended: route.workRecommended,
  };
}
