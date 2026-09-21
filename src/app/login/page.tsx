"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Falha ao entrar"); setLoading(false); return; }
    router.replace("/"); router.refresh();
  }

  return <AuthCard title="Entrar" subtitle="Acesse o Futuro.">
    <form className="form" onSubmit={submit}>
      <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
      <label>Senha<input name="password" type="password" required autoComplete="current-password" /></label>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</button>
    </form>
    <p className="form-note">Ainda não tem conta? <Link href="/register">Criar conta</Link></p>
  </AuthCard>;
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <main className="auth-wrap"><div className="auth-card"><div className="brand">Futuro<span>.</span></div><h1>{title}</h1><p className="lead">{subtitle}</p>{children}</div></main>;
}
