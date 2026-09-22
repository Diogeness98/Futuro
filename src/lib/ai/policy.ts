import { aiConfig } from "./config";
import type { AiTask, RoutingDecision } from "./types";

const decisionHints = ["classifique", "classificar", "escolha", "escolher", "priorize", "priorizar", "score", "probabilidade", "sim ou não", "decida"];
const externalHints = ["entre no site", "navegue", "portal externo", "faça login", "baixe o arquivo", "clique", "browser", "navegador"];

export function routeTask(task: AiTask): RoutingDecision {
  const input = task.input.trim().toLowerCase();

  if (task.taskType === "deterministic") {
    return { provider: "code", reason: "Tarefa explicitamente determinística." };
  }

  if (task.requiresExternalInteraction || externalHints.some((hint) => input.includes(hint))) {
    return {
      provider: "openai",
      model: aiConfig.openai.defaultModel,
      reason: "GPT econômico faz a triagem; Work só é recomendado se a ação externa realmente for necessária.",
      workRecommended: true,
    };
  }

  if (task.taskType === "decision" || (task.options?.length ?? 0) >= 2 || decisionHints.some((hint) => input.includes(hint))) {
    return { provider: "jev", reason: "Decisão estruturada deve usar Jev antes de GPT." };
  }

  if (task.taskType === "complex") {
    return { provider: "openai", model: aiConfig.openai.escalationModel, reason: "Tarefa complexa exige modelo de escalonamento." };
  }

  return { provider: "openai", model: aiConfig.openai.defaultModel, reason: "Tarefa de geração/interpretação; usar modelo econômico padrão." };
}
