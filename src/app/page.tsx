const navigation = ["Dashboard", "Pedidos", "Produtos", "Clientes", "Automações", "IA", "Integrações", "Logs", "Configurações"];

export default function HomePage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Futuro<span>.</span></div>
        <nav className="nav">
          {navigation.map((item) => <a href="#" key={item}>{item}</a>)}
        </nav>
      </aside>

      <main className="main">
        <div className="eyebrow">Fase 0 · Fundação</div>
        <h1>Operação com IA econômica por padrão</h1>
        <p className="lead">
          O Futuro prioriza código determinístico, usa Jev para decisões estruturadas e aciona GPT somente quando geração ou raciocínio são realmente necessários.
        </p>

        <div className="grid">
          <Metric label="Pedidos" value="—" />
          <Metric label="Produtos" value="—" />
          <Metric label="Clientes" value="—" />
          <Metric label="Automações ativas" value="—" />
        </div>

        <section className="section">
          <h2>Política de roteamento</h2>
          <div className="flow">
            <Step title="1. Código" text="Regras determinísticas e validações sem custo de IA." />
            <Step title="2. Jev" text="Choice, score, classificação e decisões com confiança." />
            <Step title="3. GPT" text="Geração, interpretação e raciocínio quando Jev não basta." />
            <Step title="4. Work" text="Último recurso para ações externas longas ou imprevisíveis." />
          </div>
        </section>

        <section className="section">
          <span className="badge"><span className="dot" /> base pronta para OpenAI, Jev, banco e automações</span>
        </section>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card"><small>{label}</small><div className="metric">{value}</div></div>;
}

function Step({ title, text }: { title: string; text: string }) {
  return <div className="step"><strong>{title}</strong><p>{text}</p></div>;
}
