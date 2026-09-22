import { AppShell } from "@/components/app-shell";
import { requireSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { aiConfig } from "@/lib/ai/config";
import { tikTokShopConfig } from "@/lib/integrations/tiktok/config";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const session = await requireSession();
  const saved = await db.integration.findMany({ where: { organizationId: session.organizationId } });
  const tiktok = saved.find((item) => item.provider === "tiktok_shop");
  const tiktokConfig = parseTikTokConfig(tiktok?.config);
  const tiktokConnected = tiktok?.status === "connected";
  const tiktokAppReady = Boolean(
    tikTokShopConfig.appKey &&
    tikTokShopConfig.appSecret &&
    tikTokShopConfig.authorizationUrl &&
    process.env.INTEGRATION_ENCRYPTION_KEY,
  );

  const aiIntegrations = [
    {
      name: "Jev",
      provider: "jev",
      purpose: "Decisão, classificação e score de baixo custo via System One.",
      configured: aiConfig.jev.mode !== "mock" && Boolean(aiConfig.jev.apiKey && aiConfig.jev.apiUrl),
      detail: aiConfig.jev.mode === "mock"
        ? `Modo mock seguro · ${aiConfig.jev.model}`
        : `System One · ${aiConfig.jev.model}`,
    },
    {
      name: "OpenAI",
      provider: "openai",
      purpose: "Geração e raciocínio quando código/Jev não bastam.",
      configured: Boolean(aiConfig.openai.apiKey),
      detail: `Modelo padrão: ${aiConfig.openai.defaultModel}`,
    },
  ];

  return (
    <AppShell active="Integrações" email={session.email}>
      <div className="eyebrow">Conectores</div>
      <h1>Integrações</h1>
      <p className="lead">Segredos são lidos somente no servidor. Tokens do TikTok Shop são armazenados criptografados.</p>

      <div className="integration-grid">
        {aiIntegrations.map((item) => (
          <section className="card integration-card" key={item.provider}>
            <div className="integration-head">
              <h2>{item.name}</h2>
              <span className={item.configured ? "status ok" : "status"}>{item.configured ? "Configurado" : "Não configurado"}</span>
            </div>
            <p>{item.purpose}</p>
            <small>{item.detail}</small>
          </section>
        ))}

        <section className="card integration-card">
          <div className="integration-head">
            <h2>TikTok Shop</h2>
            <span className={tiktokConnected ? "status ok" : "status"}>
              {tiktokConnected ? "Conectado" : tiktokAppReady ? "Pronto para conectar" : "Configuração pendente"}
            </span>
          </div>

          <p>Pedidos, catálogo, lojas e sincronização operacional usando a Open API oficial.</p>

          {tiktokConnected ? (
            <>
              <div className="integration-meta">
                <small>Lojas autorizadas: {tiktokConfig.shops.length}</small>
                {tiktokConfig.shops.slice(0, 3).map((shop) => (
                  <div className="shop-line" key={shop.cipher}>
                    <strong>{shop.name ?? "TikTok Shop"}</strong>
                    <span>{[shop.region, shop.seller_type].filter(Boolean).join(" · ") || "Loja autorizada"}</span>
                  </div>
                ))}
              </div>

              <div className="integration-actions">
                <form action="/api/integrations/tiktok/sync-orders" method="post">
                  <button className="primary" type="submit">Sincronizar pedidos</button>
                </form>
                <form action="/api/integrations/tiktok/sync-products" method="post">
                  <button className="secondary" type="submit">Sincronizar catálogo</button>
                </form>
                <form action="/api/integrations/tiktok/refresh" method="post">
                  <button className="secondary" type="submit">Renovar token</button>
                </form>
                <form action="/api/integrations/tiktok/disconnect" method="post">
                  <button className="danger-button" type="submit">Desconectar localmente</button>
                </form>
              </div>
            </>
          ) : tiktokAppReady ? (
            <a className="primary action-link" href="/api/integrations/tiktok/connect">Conectar TikTok Shop</a>
          ) : (
            <small>Configure App Key, App Secret, Seller Authorization Link e a chave de criptografia no ambiente do servidor.</small>
          )}
        </section>
      </div>
    </AppShell>
  );
}

interface ShopSummary {
  cipher: string;
  name?: string;
  region?: string;
  seller_type?: string;
}

function parseTikTokConfig(value: unknown): { shops: ShopSummary[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { shops: [] };
  const shops = (value as Record<string, unknown>).shops;
  if (!Array.isArray(shops)) return { shops: [] };

  return {
    shops: shops.flatMap((shop) => {
      if (!shop || typeof shop !== "object" || Array.isArray(shop)) return [];
      const item = shop as Record<string, unknown>;
      if (typeof item.cipher !== "string") return [];
      return [{
        cipher: item.cipher,
        name: typeof item.name === "string" ? item.name : undefined,
        region: typeof item.region === "string" ? item.region : undefined,
        seller_type: typeof item.seller_type === "string" ? item.seller_type : undefined,
      }];
    }),
  };
}
