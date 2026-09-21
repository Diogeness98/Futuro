import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await requireSession();
  const organizationId = session.organizationId;

  const [orders, products, customers, automations] = await Promise.all([
    db.order.count({ where: { organizationId } }),
    db.product.count({ where: { organizationId } }),
    db.customer.count({ where: { organizationId } }),
    db.automation.count({ where: { organizationId, enabled: true } }),
  ]);

  return (
    <AppShell active="Dashboard" email={session.email}>
      <div className="eyebrow">Operação</div>
      <h1>Dashboard</h1>
      <p className="lead">Núcleo operacional com isolamento por organização e roteamento econômico de IA.</p>
      <div className="grid">
        <Metric label="Pedidos" value={String(orders)} />
        <Metric label="Produtos" value={String(products)} />
        <Metric label="Clientes" value={String(customers)} />
        <Metric label="Automações ativas" value={String(automations)} />
      </div>
      <section className="section" id="ai">
        <h2>Política de IA</h2>
        <div className="flow">
          <Step title="1. Código" text="Regras e cálculos determinísticos." />
          <Step title="2. Jev" text="Classificação, score e decisões estruturadas." />
          <Step title="3. GPT" text="Geração e raciocínio quando necessário." />
          <Step title="4. Work" text="Último recurso para execução externa complexa." />
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><small>{label}</small><div className="metric">{value}</div></div>;
}
function Step({ title, text }: { title: string; text: string }) {
  return <div className="step"><strong>{title}</strong><p>{text}</p></div>;
}
