import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const session = await requireSession();
  const products = await db.product.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AppShell active="Produtos" email={session.email}><div className="page-head"><div><div className="eyebrow">Catálogo</div><h1>Produtos</h1></div></div>
    <div className="two-col"><section className="card"><h2>Novo produto</h2><form className="form" action="/api/products" method="post"><label>Nome<input name="name" required /></label><label>SKU<input name="sku" /></label><label>Preço (R$)<input name="price" inputMode="decimal" placeholder="0,00" /></label><label>Estoque<input name="stock" type="number" min="0" defaultValue="0" /></label><button className="primary">Adicionar</button></form></section>
    <section className="card table-card"><h2>Produtos cadastrados</h2><table><thead><tr><th>Produto</th><th>SKU</th><th>Preço</th><th>Estoque</th></tr></thead><tbody>{products.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.sku ?? "—"}</td><td>{formatMoney(p.priceCents)}</td><td>{p.stock}</td></tr>)}</tbody></table>{products.length === 0 && <p className="empty">Nenhum produto ainda.</p>}</section></div>
  </AppShell>;
}
function formatMoney(cents: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100); }
