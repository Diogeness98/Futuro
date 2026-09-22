import { AppShell } from "@/components/app-shell";
import { ProductActions } from "@/components/crud-actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await requireSession();
  const products = await db.product.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { variants: true } },
    },
  });

  return (
    <AppShell active="Produtos" email={session.email}>
      <div className="page-head"><div><div className="eyebrow">Catálogo</div><h1>Produtos</h1></div></div>
      <div className="two-col">
        <section className="card">
          <h2>Novo produto manual</h2>
          <form className="form" action="/api/products" method="post">
            <label>Nome<input name="name" required /></label>
            <label>SKU<input name="sku" /></label>
            <label>Preço (R$)<input name="price" inputMode="decimal" placeholder="0,00" /></label>
            <label>Estoque<input name="stock" type="number" min="0" defaultValue="0" /></label>
            <button className="primary">Adicionar</button>
          </form>
          <p className="muted-copy">Produtos do TikTok Shop entram pela sincronização e ficam somente leitura neste painel.</p>
        </section>

        <section className="card table-card">
          <h2>Produtos cadastrados</h2>
          <table>
            <thead>
              <tr>
                <th>Canal</th>
                <th>Produto</th>
                <th>SKU</th>
                <th>Preço</th>
                <th>Estoque</th>
                <th>Variantes</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td><span className={product.channel === "tiktok_shop" ? "status ok" : "status"}>{channelLabel(product.channel)}</span></td>
                  <td>
                    <strong>{product.name}</strong>
                    {product.externalId && <small className="table-subline">ID {product.externalId}</small>}
                  </td>
                  <td>{product.sku ?? (product._count.variants > 1 ? "Múltiplos SKUs" : "—")}</td>
                  <td>{formatMoney(product.priceCents, product.currency ?? "BRL")}</td>
                  <td>{product.stock}</td>
                  <td>{product._count.variants || "—"}</td>
                  <td>{product.externalStatus ?? (product.active ? "ativo" : "inativo")}</td>
                  <td>
                    <ProductActions
                      id={product.id}
                      name={product.name}
                      sku={product.sku}
                      priceCents={product.priceCents}
                      stock={product.stock}
                      channel={product.channel}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {products.length === 0 && <p className="empty">Nenhum produto ainda.</p>}
        </section>
      </div>
    </AppShell>
  );
}

function formatMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

function channelLabel(channel: string) {
  if (channel === "tiktok_shop") return "TikTok Shop";
  if (channel === "manual") return "Manual";
  return channel;
}
