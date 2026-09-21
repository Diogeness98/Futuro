"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", { method: "POST", body: form });
    const data = await response.json();
    if (!response.ok) { setError(data.error ?? "Falha ao criar conta"); setLoading(false); return; }
    router.replace("/"); router.refresh();
  }

  return <main className="auth-wrap"><div className="auth-card"><div className="brand">Futuro<span>.</span></div><h1>Criar conta</h1><p className="lead">Crie sua organização e o primeiro usuário administrador.</p>
    <form className="form" onSubmit={submit}>
      <label>Nome<input name="name" required autoComplete="name" /></label>
      <label>Organização<input name="organizationName" required /></label>
      <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
      <label>Senha<input name="password" type="password" minLength={8} required autoComplete="new-password" /></label>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</button>
    </form>
    <p className="form-note">Já tem conta? <Link href="/login">Entrar</Link></p>
  </div></main>;
}
