import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requireSession();
  const logs = await db.activityLog.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <AppShell active="Logs" email={session.email}>
      <div className="eyebrow">Auditoria</div>
      <h1>Logs</h1>
      <p className="lead">Eventos operacionais por organização, sem armazenar chaves de API.</p>
      <section className="card table-card">
        <table>
          <thead><tr><th>Data</th><th>Ação</th><th>Ator</th><th>Entidade</th></tr></thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.id}>
                <td>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(item.createdAt)}</td>
                <td>{item.action}</td>
                <td>{item.actorType}</td>
                <td>{item.entityType ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="empty">Nenhum evento registrado ainda.</p>}
      </section>
    </AppShell>
  );
}
