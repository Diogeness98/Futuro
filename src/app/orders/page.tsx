import { AppShell } from "@/components/app-shell";
import { OrderActions } from "@/components/crud-actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await requireSession();
  const [orders, customers] = await Promise.all([
    db.order.findMany({
      where: { organizationId: session.organizationId },
      include: {
        customer: true,
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.customer.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      take: 200,
    }),
  ]);

  return (
    <AppShell active="Pedidos" email={session.email}>
      <div className="eyebrow">Operação</div>
      <h1>Pedidos</h1>
      <div className="two-col">
        <section className="card">
          <h2>Novo pedido manual</h2>
          <form className="form" action="/api/orders" method="post">
            <label>Cliente
              <select name="customerId">
                <option value="">Sem cliente</option>
                {customers.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}
              </select>
            </label>
            <label>Total (R$)<input name="total" inputMode="decimal" placeholder="0,00" /></label>
            <label>Status
              <select name="status" defaultValue="pending">
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="shipped">Enviado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
            <button className="primary">Criar pedido</button>
          </form>
        </section>

        <section className="card table-card">
          <h2>Pedidos recentes</h2>
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Cliente / ID</th>
                <th>Status</th>
                <th>Itens</th>
                <th>Fiscal</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className={order.channel === "tiktok_shop" ? "status ok" : "status"}>{channelLabel(order.channel)}</span>
                    {order.sourceShopName && <small className="table-subline">{order.sourceShopName}</small>}
                  </td>
                  <td>{order.customer?.name ?? order.externalId ?? "—"}</td>
                  <td>{formatStatus(order.status)}</td>
                  <td>{order.channel === "tiktok_shop" && !order.detailsSyncedAt ? "…" : order._count.items || "—"}</td>
                  <td>{invoiceLabel(order.channel, order.detailsSyncedAt, order.needUploadInvoice)}</td>
                  <td>{formatMoney(order.totalCents)}</td>
                  <td>
                    <OrderActions
                      id={order.id}
                      status={order.status}
                      totalCents={order.totalCents}
                      channel={order.channel}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && <p className="empty">Nenhum pedido ainda.</p>}
        </section>
      </div>
    </AppShell>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function channelLabel(channel: string) {
  if (channel === "tiktok_shop") return "TikTok Shop";
  if (channel === "manual") return "Manual";
  return channel;
}

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function invoiceLabel(
  channel: string,
  detailsSyncedAt: Date | null,
  value: string | null,
) {
  if (channel !== "tiktok_shop") return "—";
  if (!detailsSyncedAt) return "Aguardando";
  if (value === "NEED_INVOICE") return "Nota necessária";
  if (value === "INVOICE_UPLOADED") return "Nota enviada";
  if (value === "NO_NEED") return "Não exige";
  return value ?? "—";
}
