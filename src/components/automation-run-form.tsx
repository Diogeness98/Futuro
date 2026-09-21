"use client";

import { FormEvent, useState } from "react";

interface AutomationRunFormProps {
  automationId: string;
}

interface RunResponse {
  ok?: boolean;
  error?: string;
  result?: {
    automationName?: string;
    actionType?: string;
    result?: {
      provider?: string;
      confidence?: number;
      manualReview?: boolean;
      escalated?: boolean;
      result?: unknown;
    };
  };
}

export function AutomationRunForm({ automationId }: AutomationRunFormProps) {
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<RunResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResponse(null);

    const form = new FormData(event.currentTarget);
    const context = String(form.get("context") ?? "").trim();

    try {
      const request = await fetch(`/api/automations/${automationId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context }),
      });

      const data = await request.json() as RunResponse;
      setResponse(data);
    } catch (error) {
      setResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao executar automação.",
      });
    } finally {
      setPending(false);
    }
  }

  const execution = response?.result?.result;

  return (
    <form className="mini-form automation-run-form" onSubmit={submit}>
      <textarea
        name="context"
        rows={4}
        required
        placeholder='{"pedido":{"status":"pending","total":120}}'
      />
      <button className="secondary" disabled={pending} type="submit">
        {pending ? "Executando..." : "Rodar teste"}
      </button>

      {response?.error && <span className="inline-error">{response.error}</span>}

      {response?.ok && execution && (
        <div className="automation-result">
          <div className="automation-result-meta">
            <span className="status ok">{execution.provider ?? "resultado"}</span>
            {typeof execution.confidence === "number" && (
              <span>{Math.round(execution.confidence * 100)}% confiança</span>
            )}
            {execution.manualReview && <span>Revisão manual</span>}
            {execution.escalated && <span>Escalado</span>}
          </div>
          <pre>{JSON.stringify(execution.result, null, 2)}</pre>
        </div>
      )}
    </form>
  );
}
