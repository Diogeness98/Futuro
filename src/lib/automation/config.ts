export type AutomationTriggerType = "order.created" | "product.low_stock" | "manual";
export type AutomationActionType = "jev.decide" | "gpt.generate" | "manual.review";

export interface AutomationTriggerConfig {
  type: AutomationTriggerType;
}

export type AutomationActionConfig =
  | {
      type: "jev.decide";
      instruction: string;
      options: string[];
      criteria: Record<string, string>;
    }
  | {
      type: "gpt.generate";
      instruction: string;
    }
  | {
      type: "manual.review";
      instruction?: string;
    };

export function buildAutomationAction(input: {
  type: AutomationActionType;
  instruction?: string;
  optionsText?: string;
  criteriaText?: string;
}): AutomationActionConfig {
  const instruction = input.instruction?.trim();

  if (input.type === "jev.decide") {
    const options = uniqueOptions(input.optionsText ?? "processar,revisar");
    if (options.length < 2) throw new Error("A automação Jev precisa de pelo menos duas opções.");

    return {
      type: "jev.decide",
      instruction: instruction || "Classifique este evento e escolha a próxima ação.",
      options,
      criteria: buildCriteria(options, input.criteriaText),
    };
  }

  if (input.type === "gpt.generate") {
    return {
      type: "gpt.generate",
      instruction: instruction || "Analise o evento e produza uma resposta operacional curta.",
    };
  }

  return {
    type: "manual.review",
    instruction: instruction || undefined,
  };
}

export function parseAutomationTrigger(value: unknown): AutomationTriggerConfig {
  const record = asRecord(value);
  const type = record.type;

  if (type !== "order.created" && type !== "product.low_stock" && type !== "manual") {
    throw new Error("Gatilho de automação inválido.");
  }

  return { type };
}

export function parseAutomationAction(value: unknown): AutomationActionConfig {
  const record = asRecord(value);
  const type = record.type;

  if (type === "jev.decide") {
    const options = Array.isArray(record.options)
      ? uniqueOptions(record.options.map(String).join(","))
      : [];

    if (options.length < 2) throw new Error("Configuração Jev sem opções suficientes.");

    return {
      type,
      instruction: typeof record.instruction === "string" && record.instruction.trim()
        ? record.instruction.trim()
        : "Classifique este evento e escolha a próxima ação.",
      options,
      criteria: normalizeStoredCriteria(options, record.criteria),
    };
  }

  if (type === "gpt.generate") {
    return {
      type,
      instruction: typeof record.instruction === "string" && record.instruction.trim()
        ? record.instruction.trim()
        : "Analise o evento e produza uma resposta operacional curta.",
    };
  }

  if (type === "manual.review") {
    return {
      type,
      instruction: typeof record.instruction === "string" && record.instruction.trim()
        ? record.instruction.trim()
        : undefined,
    };
  }

  throw new Error("Ação de automação inválida.");
}

function buildCriteria(options: string[], text?: string) {
  const supplied = new Map<string, string>();

  for (const line of (text ?? "").split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) continue;

    const option = line.slice(0, separator).trim();
    const description = line.slice(separator + 1).trim();
    if (option && description) supplied.set(option, description);
  }

  return Object.fromEntries(options.map((option) => [
    option,
    supplied.get(option) ?? option,
  ]));
}

function normalizeStoredCriteria(options: string[], value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return Object.fromEntries(options.map((option) => [option, option]));
  }

  const record = value as Record<string, unknown>;
  return Object.fromEntries(options.map((option) => [
    option,
    typeof record[option] === "string" && record[option].trim()
      ? record[option].trim()
      : option,
  ]));
}

function uniqueOptions(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 30);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Configuração de automação inválida.");
  }
  return value as Record<string, unknown>;
}
