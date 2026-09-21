"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface ProductProps {
  id: string;
  name: string;
  sku: string | null;
  priceCents: number;
  stock: number;
}

interface CustomerProps {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

interface OrderProps {
  id: string;
  status: string;
  totalCents: number;
  channel: string;
}

async function apiRequest(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Falha na operação.");
}

function useMutation() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function run(work: () => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await work();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na operação.");
    } finally {
      setPending(false);
    }
  }

  return { pending, error, run };
}

export function ProductActions({ id, name, sku, priceCents, stock }: ProductProps) {
  const mutation = useMutation();

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await mutation.run(() => apiRequest(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
  }

  async function remove() {
    if (!window.confirm(`Excluir o produto "${name}"?`)) return;
    await mutation.run(() => apiRequest(`/api/products/${id}`, { method: "DELETE" }));
  }

  return (
    <div className="row-actions">
      <details>
        <summary>Editar</summary>
        <form className="mini-form" onSubmit={update}>
          <input name="name" defaultValue={name} required aria-label="Nome" />
          <input name="sku" defaultValue={sku ?? ""} placeholder="SKU" aria-label="SKU" />
          <input name="price" defaultValue={(priceCents / 100).toFixed(2).replace(".", ",")} inputMode="decimal" aria-label="Preço" />
          <input name="stock" defaultValue={stock} type="number" min="0" aria-label="Estoque" />
          <button className="secondary" disabled={mutation.pending}>Salvar</button>
        </form>
      </details>
      <button className="danger-link" disabled={mutation.pending} onClick={remove} type="button">Excluir</button>
      {mutation.error && <span className="inline-error">{mutation.error}</span>}
    </div>
  );
}

export function CustomerActions({ id, name, email, phone }: CustomerProps) {
  const mutation = useMutation();

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await mutation.run(() => apiRequest(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
  }

  async function remove() {
    if (!window.confirm(`Excluir o cliente "${name}"?`)) return;
    await mutation.run(() => apiRequest(`/api/customers/${id}`, { method: "DELETE" }));
  }

  return (
    <div className="row-actions">
      <details>
        <summary>Editar</summary>
        <form className="mini-form" onSubmit={update}>
          <input name="name" defaultValue={name} required aria-label="Nome" />
          <input name="email" defaultValue={email ?? ""} type="email" placeholder="E-mail" aria-label="E-mail" />
          <input name="phone" defaultValue={phone ?? ""} placeholder="Telefone" aria-label="Telefone" />
          <button className="secondary" disabled={mutation.pending}>Salvar</button>
        </form>
      </details>
      <button className="danger-link" disabled={mutation.pending} onClick={remove} type="button">Excluir</button>
      {mutation.error && <span className="inline-error">{mutation.error}</span>}
    </div>
  );
}

export function OrderActions({ id, status, totalCents, channel }: OrderProps) {
  const mutation = useMutation();

  if (channel !== "manual") {
    return <span className="readonly-note">Gerenciado pela integração</span>;
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await mutation.run(() => apiRequest(`/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }));
  }

  async function remove() {
    if (!window.confirm("Excluir este pedido?")) return;
    await mutation.run(() => apiRequest(`/api/orders/${id}`, { method: "DELETE" }));
  }

  return (
    <div className="row-actions">
      <details>
        <summary>Editar</summary>
        <form className="mini-form" onSubmit={update}>
          <select name="status" defaultValue={status} aria-label="Status">
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="shipped">Enviado</option>
            <option value="cancelled">Cancelado</option>
          </select>
          <input name="total" defaultValue={(totalCents / 100).toFixed(2).replace(".", ",")} inputMode="decimal" aria-label="Total" />
          <button className="secondary" disabled={mutation.pending}>Salvar</button>
        </form>
      </details>
      <button className="danger-link" disabled={mutation.pending} onClick={remove} type="button">Excluir</button>
      {mutation.error && <span className="inline-error">{mutation.error}</span>}
    </div>
  );
}
