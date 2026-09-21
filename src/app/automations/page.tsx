import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AutomationsPage() {
  const session = await requireSession();
  const automations = await db.automation.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell active="Automações" email={session.email}>
      <div className="eyebrow">Orquestração</div>
      <h1>Automações</h1>
      <p className="lead">Configure regras pequenas e teste cada uma manualmente antes de ligar eventos automáticos. Decisões usam Jev primeiro e respeitam o orçamento do GPT.</p>

      <div className="two-col">
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
            <label className="check-row"><input name="enabled" type="checkbox" /> Ativar para testes</label>
            <button className="primary">Criar automação</button>
          </form>
        </section>

        <section className="card table-card">
          <h2>Fluxos cadastrados</h2>
          <table>
            <thead><tr><th>Nome</th><th>Gatilho</th><th>Ação</th><th>Status</th><th>Teste</th></tr></thead>
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
                        <form className="mini-form" action={`/api/automations/${automation.id}/run`} method="post">
                          <textarea
                            name="context"
                            rows={4}
                            required
                            placeholder='{"pedido":{"status":"pending","total":120}}'
                          />
                          <button className="secondary" type="submit">Rodar teste</button>
                        </form>
                      </details>
                    ) : (
                      <span className="readonly-note">Ative ao criar para testar</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {automations.length === 0 && <p className="empty">Nenhuma automação ainda.</p>}
        </section>
      </div>
    </AppShell>
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
