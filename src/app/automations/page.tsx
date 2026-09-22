import { AppShell } from "@/components/app-shell";
import { AutomationRunForm } from "@/components/automation-run-form";
import { requireSession } from "@/lib/auth";
import { getAutomationQueueStatus } from "@/lib/automation/queue";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const session = await requireSession();
  const [automations, queue, recentExecutions] = await Promise.all([
    db.automation.findMany({
      where: { organizationId: session.organizationId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getAutomationQueueStatus(session.organizationId),
    db.automationEventExecution.findMany({
      where: { event: { organizationId: session.organizationId } },
      include: {
        automation: { select: { name: true, deletedAt: true } },
        event: { select: { triggerType: true, entityType: true, entityId: true, createdAt: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const backlog = queue.pending + queue.retryableFailed;

  return (
    <AppShell active="Automações" email={session.email}>
      <div className="eyebrow">Orquestração</div>
      <h1>Automações</h1>
      <p className="lead">Eventos reais entram em uma fila persistente. O processamento é limitado em pequenos lotes para evitar rajadas de chamadas ao Jev/GPT.</p>

      <section className="card queue-card">
        <div className="integration-head">
          <div>
            <h2>Fila de automações</h2>
            <p className="muted-copy">Pedidos são salvos primeiro. IA roda depois e nunca bloqueia a operação principal.</p>
          </div>
          <span className={queue.deadLetter > 0 ? "status" : "status ok"}>
            {queue.deadLetter > 0 ? "Requer atenção" : "Saudável"}
          </span>
        </div>

        <div className="grid compact-grid">
          <QueueMetric label="Pendentes" value={queue.pending} />
          <QueueMetric label="Retry" value={queue.retryableFailed} />
          <QueueMetric label="Processando" value={queue.processing} />
          <QueueMetric label="Concluídas" value={queue.succeeded} />
          <QueueMetric label="Falha definitiva" value={queue.deadLetter} />
        </div>

        <div className="queue-actions">
          <form action="/api/automations/process" method="post">
            <input type="hidden" name="limit" value={queue.batchSize} />
            <button className="primary" type="submit" disabled={backlog === 0}>
              Processar até {queue.batchSize}
            </button>
          </form>
          {queue.deadLetter > 0 && (
            <form action="/api/automations/retry-dead-letter" method="post">
              <button className="secondary" type="submit">Reenfileirar até 20 falhas</button>
            </form>
          )}
          <small>
            Máximo de {queue.maxAttempts} tentativas por execução. Falhas definitivas ficam visíveis e não são repetidas silenciosamente.
          </small>
        </div>
      </section>

      <div className="two-col section">
        <section className="card">
          <h2>Nova automação</h2>
          <form className="form" action="/api/automations" method="post">
            <label>Nome<input name="name" required placeholder="Ex.: Revisar novo pedido" /></label>
            <label>Gatilho
              <select name="triggerType" defaultValue="order.created">
                <option value="order.created">Pedido criado</option>
                <option value="product.low_stock">Estoque baixo</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label>Ação
              <select name="actionType" defaultValue="jev.decide">
                <option value="jev.decide">Jev — decidir/classificar</option>
                <option value="gpt.generate">GPT — gerar/analisar</option>
                <option value="manual.review">Revisão humana</option>
              </select>
            </label>
            <label>Instrução
              <textarea
                name="actionInstruction"
                rows={3}
                placeholder="Ex.: Este pedido pode seguir automaticamente ou precisa de revisão?"
              />
            </label>
            <label>Opções do Jev
              <input name="jevOptions" defaultValue="processar,revisar" placeholder="processar,revisar" />
              <small>Separadas por vírgula. Usadas somente quando a ação é Jev.</small>
            </label>
            <label className="check-row"><input name="enabled" type="checkbox" /> Ativar para testes e eventos novos</label>
            <button className="primary">Criar automação</button>
          </form>
        </section>

        <section className="card table-card">
          <h2>Fluxos cadastrados</h2>
          <table>
            <thead><tr><th>Nome</th><th>Gatilho</th><th>Ação</th><th>Status</th><th>Teste</th><th>Gestão</th></tr></thead>
            <tbody>
              {automations.map((automation) => (
                <tr key={automation.id}>
                  <td>{automation.name}</td>
                  <td>{jsonType(automation.trigger)}</td>
                  <td>{actionSummary(automation.action)}</td>
                  <td><span className={automation.enabled ? "status ok" : "status"}>{automation.enabled ? "Ativa" : "Inativa"}</span></td>
                  <td>
                    {automation.enabled ? (
                      <details className="automation-test">
                        <summary>Executar</summary>
                        <AutomationRunForm automationId={automation.id} />
                      </details>
                    ) : (
                      <span className="readonly-note">Ative para testar</span>
                    )}
                  </td>
                  <td>
                    <div className="automation-manage">
                      <form action={`/api/automations/${automation.id}`} method="post">
                        <input type="hidden" name="intent" value="toggle" />
                        <button className="secondary" type="submit">{automation.enabled ? "Desativar" : "Ativar"}</button>
                      </form>
                      <form action={`/api/automations/${automation.id}`} method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <button className="danger-button" type="submit">Excluir</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {automations.length === 0 && <p className="empty">Nenhuma automação ainda.</p>}
        </section>
      </div>

      <section className="section card table-card">
        <h2>Execuções recentes da fila</h2>
        <table>
          <thead>
            <tr><th>Quando</th><th>Automação</th><th>Gatilho</th><th>Status</th><th>Tentativas</th><th>Resultado</th><th>Erro</th></tr>
          </thead>
          <tbody>
            {recentExecutions.map((execution) => (
              <tr key={execution.id}>
                <td>{formatDate(execution.createdAt)}</td>
                <td>
                  {execution.automation.name}
                  {execution.automation.deletedAt ? " (excluída)" : ""}
                </td>
                <td>{execution.event.triggerType}</td>
                <td><span className={executionStatusClass(execution.status)}>{execution.status}</span></td>
                <td>{execution.attempts}</td>
                <td>
                  {execution.result ? (
                    <details className="queue-result">
                      <summary>Ver</summary>
                      <pre>{JSON.stringify(execution.result, null, 2)}</pre>
                    </details>
                  ) : "—"}
                </td>
                <td className="truncate-cell">{execution.lastError ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recentExecutions.length === 0 && <p className="empty">Nenhuma execução automática ainda.</p>}
      </section>
    </AppShell>
  );
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="queue-metric">
      <small>{label}</small>
      <strong>{value.toLocaleString("pt-BR")}</strong>
    </div>
  );
}

function jsonType(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const type = (value as Record<string, unknown>).type;
  return typeof type === "string" ? type : "—";
}

function actionSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "—";
  const action = value as Record<string, unknown>;
  const type = typeof action.type === "string" ? action.type : "—";

  if (type === "jev.decide" && Array.isArray(action.options)) {
    return `${type} · ${action.options.map(String).join(" / ")}`;
  }

  return type;
}


function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function executionStatusClass(status: string) {
  if (status === "succeeded" || status === "skipped") return "status ok";
  return "status";
}
