export type AutomationTriggerType = "order.created" | "product.low_stock" | "manual";
export type AutomationActionType = "jev.decide" | "gpt.generate" | "manual.review";
export type AutomationConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

export interface AutomationTriggerConfig {
  type: AutomationTriggerType;
}

export interface AutomationConditionConfig {
  path: string;
  operator: AutomationConditionOperator;
  value: string | number | boolean;
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

export function buildAutomationConditions(input: {
  path?: string;
  operator?: AutomationConditionOperator | "";
  value?: string;
}): AutomationConditionConfig[] | undefined {
  const path = input.path?.trim() ?? "";
  const operator = input.operator ?? "";
  const rawValue = input.value?.trim() ?? "";

  if (!path && !operator && !rawValue) return undefined;
  if (!path || !operator || !rawValue) {
    throw new Error("Condição determinística incompleta: informe campo, operador e valor.");
  }
  if (!safePath(path)) throw new Error("Campo de condição inválido.");

  return [{
    path,
    operator,
    value: parseConditionValue(rawValue),
  }];
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

export function parseAutomationConditions(value: unknown): AutomationConditionConfig[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Condições de automação inválidas.");

  return value.map((item) => {
    const record = asRecord(item);
    const path = typeof record.path === "string" ? record.path.trim() : "";
    const operator = record.operator;

    if (!safePath(path) || !isConditionOperator(operator)) {
      throw new Error("Condição de automação inválida.");
    }

    const conditionValue = record.value;
    if (
      typeof conditionValue !== "string" &&
      typeof conditionValue !== "number" &&
      typeof conditionValue !== "boolean"
    ) {
      throw new Error("Valor de condição inválido.");
    }

    return {
      path,
      operator,
      value: conditionValue,
    };
  });
}

export function evaluateAutomationConditions(
  context: unknown,
  conditions: AutomationConditionConfig[],
) {
  if (conditions.length === 0) return { matched: true, reason: "Sem condição determinística." };

  const source = normalizeConditionContext(context);

  for (const condition of conditions) {
    const actual = readPath(source, condition.path);
    if (!compareCondition(actual, condition.operator, condition.value)) {
      return {
        matched: false,
        reason: `Condição não atendida: ${condition.path} ${condition.operator} ${String(condition.value)}.`,
      };
    }
  }

  return { matched: true, reason: "Todas as condições determinísticas foram atendidas." };
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

function normalizeConditionContext(context: unknown): unknown {
  if (typeof context !== "string") return context;

  try {
    return JSON.parse(context);
  } catch {
    return context;
  }
}

function readPath(source: unknown, path: string): unknown {
  let current = source;

  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function compareCondition(
  actual: unknown,
  operator: AutomationConditionOperator,
  expected: string | number | boolean,
) {
  if (operator === "contains") {
    if (typeof actual === "string") return actual.includes(String(expected));
    if (Array.isArray(actual)) return actual.some((item) => primitiveEquals(item, expected));
    return false;
  }

  if (operator === "eq") return primitiveEquals(actual, expected);
  if (operator === "neq") return !primitiveEquals(actual, expected);

  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (!Number.isFinite(actualNumber) || !Number.isFinite(expectedNumber)) return false;

  if (operator === "gt") return actualNumber > expectedNumber;
  if (operator === "gte") return actualNumber >= expectedNumber;
  if (operator === "lt") return actualNumber < expectedNumber;
  return actualNumber <= expectedNumber;
}

function primitiveEquals(actual: unknown, expected: string | number | boolean) {
  if (typeof expected === "number") return Number(actual) === expected;
  if (typeof expected === "boolean") {
    if (typeof actual === "boolean") return actual === expected;
    return String(actual).toLowerCase() === String(expected);
  }
  return String(actual ?? "") === expected;
}

function parseConditionValue(value: string): string | number | boolean {
  if (value.toLowerCase() === "true") return true;
  if (value.toLowerCase() === "false") return false;

  const number = Number(value.replace(",", "."));
  if (value.trim() !== "" && Number.isFinite(number)) return number;

  return value;
}

function safePath(path: string) {
  if (!/^[A-Za-z0-9_.]+$/.test(path)) return false;
  const blocked = new Set(["__proto__", "prototype", "constructor"]);
  return path.split(".").every((part) => part && !blocked.has(part));
}

function isConditionOperator(value: unknown): value is AutomationConditionOperator {
  return value === "eq" ||
    value === "neq" ||
    value === "gt" ||
    value === "gte" ||
    value === "lt" ||
    value === "lte" ||
    value === "contains";
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
