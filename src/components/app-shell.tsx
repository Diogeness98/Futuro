import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  ["/", "Dashboard"],
  ["/orders", "Pedidos"],
  ["/products", "Produtos"],
  ["/customers", "Clientes"],
  ["/automations", "Automações"],
  ["/ai", "IA"],
  ["/integrations", "Integrações"],
  ["/logs", "Logs"],
  ["/settings", "Configurações"],
] as const;

export function AppShell({ children, active, email }: { children: ReactNode; active: string; email: string }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Futuro<span>.</span></div>
        <nav className="nav">
          {navigation.map(([href, label]) => (
            <Link className={active === label ? "active" : ""} href={href} key={label}>{label}</Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <small>{email}</small>
          <form action="/api/auth/logout" method="post"><button className="link-button" type="submit">Sair</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
