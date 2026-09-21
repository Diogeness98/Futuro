import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await requireSession();
  const [orders, customers] = await Promise.all([
    db.order.findMany({ where: { organizationId: session.organizationId }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.customer.findMany({ where: { organizationId: session.organizationId }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  return <AppShell active="Pedidos" email={session.email}><div className="eyebrow">Operação</div><h1>Pedidos</h1><div className="two-col">
    <section className="card"><h2>Novo pedido manual</h2><form className="form" action="/api/orders" method="post"><label>Cliente<select name="customerId"><option value="">Sem cliente</option>{customers.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label><label>Total (R$)<input name="total" inputMode="decimal" placeholder="0,00" /></label><label>Status<select name="status" defaultValue="pending"><option value="pending">Pendente</option><option value="paid">Pago</option><option value="shipped">Enviado</option><option value="cancelled">Cancelado</option></select></label><button className="primary">Criar pedido</button></form></section>
    <section className="card table-card"><h2>Pedidos recentes</h2><table><thead><tr><th>Cliente</th><th>Status</th><th>Total</th></tr></thead><tbody>{orders.map((o) => <tr key={o.id}><td>{o.customer?.name ?? "—"}</td><td>{o.status}</td><td>{formatMoney(o.totalCents)}</td></tr>)}</tbody></table>{orders.length === 0 && <p className="empty">Nenhum pedido ainda.</p>}</section>
  </div></AppShell>;
}
function formatMoney(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
