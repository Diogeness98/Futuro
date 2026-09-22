import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { aiConfig } from "@/lib/ai/config";
import { automationRuntimeConfig } from "@/lib/automation/runtime-config";
import { inventoryConfig } from "@/lib/inventory/config";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();

  return (
    <AppShell active="Configurações" email={session.email}>
      <div className="eyebrow">Controle de custo</div>
      <h1>Configurações</h1>
      <p className="lead">Visão segura das regras do roteador. Nenhum segredo é exibido.</p>

      <div className="settings-grid">
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
            <div><dt>Revisão Jev → GPT</dt><dd>{aiConfig.openai.reviewMaxOutputTokens.toLocaleString("pt-BR")} tokens máx.</dd></div>
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
          </dl>
        </section>
      </div>
    </AppShell>
  );
}
