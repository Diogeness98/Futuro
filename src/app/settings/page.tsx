import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { aiConfig } from "@/lib/ai/config";
import { automationRuntimeConfig } from "@/lib/automation/runtime-config";
import { inventoryConfig } from "@/lib/inventory/config";
import { tikTokShopConfig } from "@/lib/integrations/tiktok/config";
import { evaluateRuntimeReadiness } from "@/lib/readiness";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const readiness = evaluateRuntimeReadiness();

  return (
    <AppShell active="Configurações" email={session.email}>
      <div className="eyebrow">Controle de custo</div>
      <h1>Configurações</h1>
      <p className="lead">Visão segura das regras do roteador e do preflight de produção. Nenhum segredo é exibido.</p>

      <section className="card readiness-card">
        <div className="integration-head">
          <div>
            <h2>Preflight de produção</h2>
            <p className="muted-copy">Verifica somente se a configuração necessária existe e tem formato válido. Conectividade real do banco é testada em /api/health.</p>
          </div>
          <span className={readiness.ready ? "status ok" : "status"}>
            {readiness.ready ? "Pronto" : `${readiness.readyCount}/${readiness.totalCount} configurados`}
          </span>
        </div>

        <div className="readiness-grid">
          {readiness.checks.map((check) => (
            <div className="readiness-item" key={check.id}>
              <div className="integration-head">
                <strong>{check.label}</strong>
                <span className={check.ready ? "status ok" : "status"}>
                  {check.ready ? "OK" : "Pendente"}
                </span>
              </div>
              <small>{check.detail}</small>
            </div>
          ))}
        </div>
      </section>

      <div className="settings-grid section">
        <section className="card">
          <h2>Prioridade de execução</h2>
          <ol className="policy-list">
            <li>Código determinístico</li>
            <li>Jev para decisão/classificação</li>
            <li>GPT econômico</li>
            <li>GPT de escalonamento</li>
            <li>Work somente quando necessário</li>
          </ol>
        </section>
        <section className="card">
          <h2>Limites atuais</h2>
          <dl className="settings-list">
            <div><dt>Jev automático</dt><dd>{Math.round(aiConfig.jev.autoExecuteThreshold * 100)}%+</dd></div>
            <div><dt>Zona GPT</dt><dd>{Math.round(aiConfig.jev.gptReviewThreshold * 100)}%–{Math.round(aiConfig.jev.autoExecuteThreshold * 100) - 1}%</dd></div>
            <div><dt>Timeout Jev</dt><dd>{Math.round(aiConfig.jev.timeoutMs / 1000)}s</dd></div>
            <div><dt>Fallback Jev → GPT em erro</dt><dd>{aiConfig.jev.fallbackToGptOnError ? "Ativo" : "Bloqueado"}</dd></div>
            <div><dt>Modelo econômico</dt><dd>{aiConfig.openai.defaultModel}</dd></div>
            <div><dt>Raciocínio econômico</dt><dd>{aiConfig.openai.defaultReasoningEffort}</dd></div>
            <div><dt>Saída econômica</dt><dd>{aiConfig.openai.defaultMaxOutputTokens.toLocaleString("pt-BR")} tokens</dd></div>
            <div><dt>Contexto revisão GPT</dt><dd>{aiConfig.openai.reviewMaxInputChars.toLocaleString("pt-BR")} caracteres máx.</dd></div>
            <div><dt>Saída revisão GPT</dt><dd>{aiConfig.openai.reviewMaxOutputTokens.toLocaleString("pt-BR")} tokens máx.</dd></div>
            <div><dt>Modelo forte</dt><dd>{aiConfig.openai.escalationModel}</dd></div>
            <div><dt>Raciocínio forte</dt><dd>{aiConfig.openai.escalationReasoningEffort}</dd></div>
            <div><dt>Saída forte</dt><dd>{aiConfig.openai.escalationMaxOutputTokens.toLocaleString("pt-BR")} tokens</dd></div>
            <div><dt>Timeout OpenAI</dt><dd>{Math.round(aiConfig.openai.timeoutMs / 1000)}s</dd></div>
            <div><dt>Entrada máxima por tarefa</dt><dd>{aiConfig.openai.maxInputChars.toLocaleString("pt-BR")} caracteres</dd></div>
            <div><dt>Chamadas / 24h</dt><dd>{aiConfig.openai.maxCallsPer24h.toLocaleString("pt-BR")}</dd></div>
            <div><dt>Entrada / 24h</dt><dd>{aiConfig.openai.maxInputTokensPer24h.toLocaleString("pt-BR")} tokens</dd></div>
            <div><dt>Saída / 24h</dt><dd>{aiConfig.openai.maxOutputTokensPer24h.toLocaleString("pt-BR")} tokens</dd></div>
            <div><dt>Worker automático</dt><dd>{automationRuntimeConfig.cronConfigured ? "Configurado" : "Manual"}</dd></div>
            <div><dt>Organizações por ciclo</dt><dd>{automationRuntimeConfig.organizationLimit}</dd></div>
            <div><dt>Eventos por organização</dt><dd>{automationRuntimeConfig.batchSize}</dd></div>
            <div><dt>Estoque baixo</dt><dd>≤ {inventoryConfig.lowStockThreshold} unidades</dd></div>
            <div><dt>TikTok orgs / sync</dt><dd>{tikTokShopConfig.syncOrganizationLimit}</dd></div>
            <div><dt>TikTok páginas / loja</dt><dd>{tikTokShopConfig.syncMaxPagesPerShop}</dd></div>
            <div><dt>Detalhes TikTok / ciclo</dt><dd>até {tikTokShopConfig.orderDetailMaxBatchesPerSync * 50} pedidos</dd></div>
            <div><dt>Catálogo TikTok</dt><dd>a cada {tikTokShopConfig.productSyncIntervalMinutes} min</dd></div>
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
