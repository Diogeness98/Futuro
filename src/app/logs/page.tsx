import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const session = await requireSession();
  const logs = await db.activityLog.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell active="Logs" email={session.email}>
      <div className="eyebrow">Auditoria</div>
      <h1>Logs</h1>
      <p className="lead">Registro operacional da organização. Chaves de API e segredos nunca devem ser gravados aqui.</p>

      <section className="card table-card">
        <table>
          <thead><tr><th>Quando</th><th>Ação</th><th>Entidade</th><th>ID</th></tr></thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{formatDate(log.createdAt)}</td>
                <td>{log.action}</td>
                <td>{log.entityType ?? "—"}</td>
                <td className="mono">{log.entityId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <p className="empty">Nenhuma atividade registrada ainda.</p>}
      </section>
    </AppShell>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}
