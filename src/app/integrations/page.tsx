import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfig } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const saved = await db.integration.findMany({ where: { organizationId: session.organizationId } });
  const savedByProvider = new Map(saved.map((item) => [item.provider, item.status]));

  const integrations = [
    {
      name: "Jev",
      provider: "jev",
      purpose: "Decisão, classificação e score de baixo custo via System One.",
      configured: aiConfig.jev.mode !== "mock" && Boolean(aiConfig.jev.apiKey && aiConfig.jev.apiUrl),
      detail: aiConfig.jev.mode === "mock"
        ? `Modo mock seguro · ${aiConfig.jev.model}`
        : `System One · ${aiConfig.jev.model}`,
    },
    {
      name: "OpenAI",
      provider: "openai",
      purpose: "Geração e raciocínio quando código/Jev não bastam.",
      configured: Boolean(aiConfig.openai.apiKey),
      detail: `Modelo padrão: ${aiConfig.openai.defaultModel}`,
    },
    {
      name: "TikTok Shop",
      provider: "tiktok_shop",
      purpose: "Pedidos, catálogo e sincronização de operação.",
      configured: savedByProvider.get("tiktok_shop") === "connected",
      detail: "Integração real entra na próxima etapa.",
    },
  ];

  return (
    <AppShell active="Integrações" email={session.email}>
      <div className="eyebrow">Conectores</div>
      <h1>Integrações</h1>
      <p className="lead">Segredos são lidos somente no servidor e nunca aparecem nesta tela.</p>

      <div className="integration-grid">
        {integrations.map((item) => (
          <section className="card integration-card" key={item.provider}>
            <div className="integration-head">
              <h2>{item.name}</h2>
              <span className={item.configured ? "status ok" : "status"}>{item.configured ? "Configurado" : "Não configurado"}</span>
            </div>
            <p>{item.purpose}</p>
            <small>{item.detail}</small>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
