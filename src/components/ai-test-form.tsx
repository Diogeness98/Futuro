"use client";

import { FormEvent, useState } from "react";

interface TestResponse {
  ok?: boolean;
  error?: string;
  plan?: unknown;
  budget?: unknown;
  result?: unknown;
}

export function AiTestForm() {
  const [pending, setPending] = useState(false);
  const [response, setResponse] = useState<TestResponse | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setResponse(null);

    const form = new FormData(event.currentTarget);
    const options = String(form.get("options") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const criteria = Object.fromEntries(options.map((option) => [option, option]));

    try {
      const request = await fetch("/api/ai/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: String(form.get("input") ?? ""),
          taskType: "decision",
          options,
          decisionInstructions: String(form.get("instructions") ?? ""),
          criteria,
        }),
      });

      const data = await request.json() as TestResponse;
      setResponse(data);
    } catch (error) {
      setResponse({ ok: false, error: error instanceof Error ? error.message : "Falha no teste." });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2>Testar roteamento Jev</h2>
      <p className="muted-copy">A chave permanece no servidor. Este formulário envia apenas estado, instruções e opções.</p>
      <form className="form" onSubmit={submit}>
        <label>Estado
          <textarea name="input" required rows={4} defaultValue="O cliente não consegue conectar a conta Stripe no painel e relata estar perdendo vendas." />
        </label>
        <label>Instrução
          <input name="instructions" required defaultValue="Qual departamento deve tratar este caso?" />
        </label>
        <label>Opções, separadas por vírgula
          <input name="options" required defaultValue="technical_support, billing" />
        </label>
        <button className="primary" disabled={pending}>{pending ? "Testando..." : "Executar decisão"}</button>
      </form>

      {response && (
        <div className="test-result">
          <strong>{response.ok ? "Resposta recebida" : "Falha"}</strong>
          <pre>{JSON.stringify(response, null, 2)}</pre>
        </div>
      )}
    </section>
  );
}
