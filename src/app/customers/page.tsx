import { AppShell } from "@/components/app-shell";
import { CustomerActions } from "@/components/crud-actions";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await requireSession();
  const customers = await db.customer.findMany({ where: { organizationId: session.organizationId }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <AppShell active="Clientes" email={session.email}>
      <div className="eyebrow">Relacionamento</div>
      <h1>Clientes</h1>
      <div className="two-col">
        <section className="card">
          <h2>Novo cliente</h2>
          <form className="form" action="/api/customers" method="post">
            <label>Nome<input name="name" required /></label>
            <label>E-mail<input name="email" type="email" /></label>
            <label>Telefone<input name="phone" /></label>
            <button className="primary">Adicionar</button>
          </form>
        </section>

        <section className="card table-card">
          <h2>Clientes cadastrados</h2>
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Ações</th></tr></thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>{customer.name}</td>
                  <td>{customer.email ?? "—"}</td>
                  <td>{customer.phone ?? "—"}</td>
                  <td>
                    <CustomerActions
                      id={customer.id}
                      name={customer.name}
                      email={customer.email}
                      phone={customer.phone}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {customers.length === 0 && <p className="empty">Nenhum cliente ainda.</p>}
        </section>
      </div>
    </AppShell>
  );
}
