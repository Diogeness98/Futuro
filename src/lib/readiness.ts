export interface ReadinessCheck {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
}

export interface RuntimeReadiness {
  ready: boolean;
  readyCount: number;
  totalCount: number;
  checks: ReadinessCheck[];
}

export function evaluateRuntimeReadiness(
  env: Record<string, string | undefined> = process.env,
): RuntimeReadiness {
  const encryptionReady = validBase64Key(env.INTEGRATION_ENCRYPTION_KEY, 32);

  const checks: ReadinessCheck[] = [
    {
      id: "app_url",
      label: "URL pública da aplicação",
      ready: validHttpUrl(env.APP_URL),
      detail: "APP_URL deve apontar para a URL HTTPS do Futuro em produção.",
    },
    {
      id: "auth",
      label: "Segredo de autenticação",
      ready: (env.AUTH_SECRET?.length ?? 0) >= 32,
      detail: "AUTH_SECRET precisa ter pelo menos 32 caracteres.",
    },
    {
      id: "database",
      label: "PostgreSQL",
      ready: Boolean(env.DATABASE_URL?.trim()),
      detail: "DATABASE_URL precisa estar configurada. A conectividade é testada em /api/health.",
    },
    {
      id: "encryption",
      label: "Criptografia de integrações",
      ready: encryptionReady,
      detail: "INTEGRATION_ENCRYPTION_KEY deve ser Base64 de exatamente 32 bytes.",
    },
    {
      id: "openai",
      label: "OpenAI",
      ready: Boolean(env.OPENAI_API_KEY?.trim()),
      detail: "OPENAI_API_KEY deve existir somente no servidor.",
    },
    {
      id: "jev",
      label: "Jev / TypeSafe",
      ready:
        env.JEV_MODE === "live" &&
        Boolean((env.JEV_API_KEY ?? env.TYPESAFE_API_KEY)?.trim()) &&
        Boolean(env.JEV_API_URL?.trim() || "https://api.typesafe.ai/v1/systemone"),
      detail: "Configure a chave e use JEV_MODE=live após validar a integração.",
    },
    {
      id: "tiktok",
      label: "TikTok Shop",
      ready:
        Boolean(env.TIKTOK_SHOP_APP_KEY?.trim()) &&
        Boolean(env.TIKTOK_SHOP_APP_SECRET?.trim()) &&
        Boolean(env.TIKTOK_SHOP_AUTH_URL?.trim()) &&
        encryptionReady,
      detail: "App Key, App Secret, Seller Authorization Link e criptografia são obrigatórios.",
    },
    {
      id: "worker",
      label: "Worker de automações",
      ready: (env.AUTOMATION_CRON_SECRET?.length ?? 0) >= 24,
      detail: "AUTOMATION_CRON_SECRET deve proteger o endpoint interno do scheduler.",
    },
  ];

  const readyCount = checks.filter((check) => check.ready).length;
  return {
    ready: readyCount === checks.length,
    readyCount,
    totalCount: checks.length,
    checks,
  };
}

function validHttpUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validBase64Key(value: string | undefined, bytes: number) {
  if (!value) return false;
  try {
    const decoded = Buffer.from(value, "base64");
    if (decoded.length !== bytes) return false;
    return decoded.toString("base64").replace(/=+$/u, "") === value.trim().replace(/=+$/u, "");
  } catch {
    return false;
  }
}
