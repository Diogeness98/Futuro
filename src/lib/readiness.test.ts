import { describe, expect, it } from "vitest";
import { evaluateRuntimeReadiness } from "./readiness";

function readyEnv(): Record<string, string> {
  return {
    APP_URL: "https://futuro.example.com",
    AUTH_SECRET: "a".repeat(32),
    DATABASE_URL: "postgresql://user:pass@db/futuro",
    INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    OPENAI_API_KEY: "server-openai-key",
    JEV_MODE: "live",
    JEV_API_KEY: "server-jev-key",
    JEV_API_URL: "https://api.typesafe.ai/v1/systemone",
    TIKTOK_SHOP_APP_KEY: "app-key",
    TIKTOK_SHOP_APP_SECRET: "app-secret",
    TIKTOK_SHOP_AUTH_URL: "https://example.com/seller-auth",
    AUTOMATION_CRON_SECRET: "x".repeat(32),
  };
}

describe("evaluateRuntimeReadiness", () => {
  it("fica pronto quando todas as configurações estão válidas", () => {
    const result = evaluateRuntimeReadiness(readyEnv());
    expect(result.ready).toBe(true);
    expect(result.readyCount).toBe(result.totalCount);
  });

  it("não expõe segredos nos detalhes", () => {
    const env = readyEnv();
    const result = evaluateRuntimeReadiness(env);
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(env.OPENAI_API_KEY);
    expect(serialized).not.toContain(env.JEV_API_KEY);
    expect(serialized).not.toContain(env.TIKTOK_SHOP_APP_SECRET);
  });

  it("detecta Jev ainda em mock", () => {
    const env = readyEnv();
    env.JEV_MODE = "mock";

    const result = evaluateRuntimeReadiness(env);
    expect(result.checks.find((check) => check.id === "jev")?.ready).toBe(false);
    expect(result.ready).toBe(false);
  });

  it("rejeita chave de criptografia com tamanho incorreto", () => {
    const env = readyEnv();
    env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(16, 1).toString("base64");

    const result = evaluateRuntimeReadiness(env);
    expect(result.checks.find((check) => check.id === "encryption")?.ready).toBe(false);
    expect(result.checks.find((check) => check.id === "tiktok")?.ready).toBe(false);
  });
});
