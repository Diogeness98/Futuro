import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const session = await requireSession();

  const [decisions, total, jevCount, openaiCount] = await Promise.all([
    db.aiDecision.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.aiDecision.count({ where: { organizationId: session.organizationId } }),
    db.aiDecision.count({ where: { organizationId: session.organizationId, provider: "jev" } }),
    db.aiDecision.count({ where: { organizationId: session.organizationId, provider: "openai" } }),
  ]);

  return (
    <AppShell active="IA" email={session.email}>
      <div className="eyebrow">Economia de IA</div>
      <h1>Decisões de IA</h1>
      <p className="lead">Acompanhe quem executou cada tarefa. A meta é resolver o máximo com código e Jev antes de chamar GPT.</p>

      <div className="grid">
        <Metric label="Decisões registradas" value={total} />
        <Metric label="Resolvidas por Jev" value={jevCount} />
        <Metric label="Chamadas OpenAI" value={openaiCount} />
        <Metric label="Outras rotas" value={Math.max(0, total - jevCount - openaiCount)} />
      </div>

      <section className="section card table-card">
        <h2>Histórico recente</h2>
        <table>
          <thead><tr><th>Quando</th><th>Provedor</th><th>Tipo</th><th>Confiança</th><th>Entrada</th></tr></thead>
          <tbody>
            {decisions.map((decision) => (
              <tr key={decision.id}>
                <td>{formatDate(decision.createdAt)}</td>
                <td><span className="status ok">{decision.provider}</span></td>
                <td>{decision.taskType}</td>
                <td>{decision.confidence == null ? "—" : `${Math.round(decision.confidence * 100)}%`}</td>
                <td className="truncate-cell">{decision.inputSummary ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {decisions.length === 0 && <p className="empty">Nenhuma decisão executada ainda.</p>}
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="card"><small>{label}</small><div className="metric">{value}</div></div>;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}
