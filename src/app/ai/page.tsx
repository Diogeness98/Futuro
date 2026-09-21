import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const session = await requireSession();
  const decisions = await db.aiDecision.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const jevOnly = decisions.filter((item) => item.provider === "jev").length;
  const openai = decisions.filter((item) => item.provider === "openai").length;
  const escalated = decisions.filter((item) => item.escalated).length;
  const workSignals = decisions.filter((item) => item.workRecommended).length;
  const estimatedCost = decisions.reduce((sum, item) => sum + Number(item.costUsd ?? 0), 0);

  return (
    <AppShell active="IA" email={session.email}>
      <div className="eyebrow">Controle de custo</div>
      <h1>IA e decisões</h1>
      <p className="lead">Acompanhe qual camada resolveu cada tarefa. Work nunca é chamado automaticamente por este roteador.</p>

      <div className="grid">
        <Metric label="Jev resolveu sozinho" value={String(jevOnly)} />
        <Metric label="Chamadas GPT" value={String(openai)} />
        <Metric label="Escaladas após Jev" value={String(escalated)} />
        <Metric label="Custo GPT estimado*" value={formatUsd(estimatedCost)} />
      </div>

      <section className="section card table-card">
        <div className="section-title-row">
          <h2>Decisões recentes</h2>
          <span className="badge">{workSignals} sinal(is) para Work</span>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Provedor final</th><th>Modelo</th><th>Confiança Jev</th><th>Custo est.</th></tr></thead>
          <tbody>
            {decisions.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.createdAt)}</td>
                <td>{item.taskType}</td>
                <td><span className="provider">{item.provider}</span>{item.escalated ? " ↗" : ""}</td>
                <td>{item.model ?? "—"}</td>
                <td>{item.confidence == null ? "—" : `${(item.confidence * 100).toFixed(1)}%`}</td>
                <td>{item.costUsd == null ? "—" : formatUsd(Number(item.costUsd))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {decisions.length === 0 && <p className="empty">Nenhuma decisão registrada ainda. Use /api/ai/route depois de configurar as APIs.</p>}
      </section>

      <p className="fine-print">*Estimativa local com tabela de referência; a cobrança real é a exibida pela OpenAI.</p>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><small>{label}</small><div className="metric">{value}</div></div>;
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4 }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}
