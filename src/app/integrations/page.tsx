import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const saved = await db.integration.findMany({ where: { organizationId: session.organizationId } });
  const statusByProvider = new Map(saved.map((item) => [item.provider, item.status]));

  const openaiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const jevConfigured = process.env.JEV_MODE !== "mock" && Boolean(process.env.JEV_API_KEY && process.env.JEV_API_URL);
  const tiktokStatus = statusByProvider.get("tiktok_shop") ?? "not_configured";

  return (
    <AppShell active="Integrações" email={session.email}>
      <div className="eyebrow">Conexões</div>
      <h1>Integrações</h1>
      <p className="lead">Credenciais ficam somente no servidor. Esta tela mostra estado, nunca as chaves.</p>
      <div className="integration-grid">
        <IntegrationCard name="OpenAI" status={openaiConfigured ? "configured" : "not_configured"} detail="GPT para geração, interpretação e revisão." />
        <IntegrationCard name="Jev" status={jevConfigured ? "configured" : "mock"} detail="Decisões estruturadas; permanece seguro em mock até configurar endpoint e chave." />
        <IntegrationCard name="TikTok Shop" status={tiktokStatus} detail="Será conectado na fase de canais e pedidos." />
      </div>
    </AppShell>
  );
}

function IntegrationCard({ name, status, detail }: { name: string; status: string; detail: string }) {
  const ok = status === "configured" || status === "connected";
  const label = ok ? "Configurado" : status === "mock" ? "Modo mock" : status === "error" ? "Erro" : "Não configurado";
  return (
    <section className="card integration-card">
      <div className="section-title-row"><h2>{name}</h2><span className={`status ${ok ? "ok" : ""}`}>{label}</span></div>
      <p>{detail}</p>
    </section>
  );
}
