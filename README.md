# Futuro

SaaS de operações, e-commerce e automação construído para usar IA de forma econômica por padrão.

## Estratégia central

**Código → Jev → GPT → Work**

- Código determinístico resolve regras previsíveis sem IA.
- Jev recebe decisões estruturadas, classificação e score.
- GPT entra em geração/raciocínio e na zona cinzenta do Jev.
- Work fica reservado para fluxos externos longos ou imprevisíveis.

O roteador usa, por padrão:

- Jev >= 92% de confiança: resolve sem GPT.
- Jev entre 75% e 91,9%: GPT econômico revisa usando Structured Outputs.
- Jev abaixo de 75%: revisão manual.
- Falha do Jev: revisão manual por padrão; não dispara GPT automaticamente.
- GPT possui disjuntor de orçamento móvel de 24 horas.

## Estado atual

O repositório já contém:

- Next.js + TypeScript + PostgreSQL + Prisma;
- cadastro, login, logout e organizações;
- dashboard;
- CRUD de produtos, clientes e pedidos;
- logs/auditoria;
- Jev System One real, com modo mock seguro;
- OpenAI Responses API;
- orçamento e timeouts por provedor;
- histórico de decisões e consumo de tokens;
- automações configuráveis, testáveis e auditadas;
- TikTok Shop OAuth;
- assinatura HMAC-SHA256 das chamadas TikTok;
- tokens TikTok criptografados com AES-256-GCM;
- Get Authorized Shops;
- refresh token;
- sincronização incremental de pedidos TikTok;
- proteção contra edição manual de pedidos sincronizados;
- testes unitários e CI com typecheck, testes e build.

## Desenvolvimento local

Requisitos:

- Node.js 22+
- PostgreSQL

Instalação:

```bash
cp .env.example .env.local
npm install
npm run db:deploy
npm run dev
```

Abra:

```text
http://localhost:3000
```

## Validação antes de deploy

```bash
npm run db:status
npm run typecheck
npm test
npm run build
```

Os três comandos devem passar antes de um deploy.

## Variáveis de ambiente

Use `.env.example` como referência.

As variáveis mais importantes são:

```env
AUTH_SECRET=
DATABASE_URL=
INTEGRATION_ENCRYPTION_KEY=
AUTOMATION_CRON_SECRET=
LOW_STOCK_THRESHOLD=5

OPENAI_API_KEY=

JEV_MODE=mock
JEV_API_KEY=
JEV_API_URL=https://api.typesafe.ai/v1/systemone
JEV_MODEL=jev-latest

TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
TIKTOK_SHOP_AUTH_URL=
```

### Secrets

Nunca faça commit de:

- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `JEV_API_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- access tokens / refresh tokens

Todos devem existir apenas no ambiente do servidor/deploy.

`INTEGRATION_ENCRYPTION_KEY` deve ser uma chave aleatória de 32 bytes codificada em Base64.

## Ativando Jev real

Depois de inserir a chave como secret:

```env
JEV_MODE=live
```

O painel **IA** possui uma ferramenta de teste que não expõe a chave ao navegador.

## TikTok Shop

Depois de configurar App Key, App Secret, Seller Authorization Link e a chave de criptografia, configure o callback no Partner Center como `<APP_URL>/api/integrations/tiktok/callback`.

Então:

1. entre em **Integrações**;
2. clique em **Conectar TikTok Shop**;
3. conclua a autorização de seller;
4. confirme as lojas autorizadas;
5. use **Sincronizar pedidos**.

Pedidos importados usam o canal `tiktok_shop` e são somente leitura no Futuro; atualizações devem vir da integração.

Para desenvolvimento, valide primeiro com uma Development/Test Shop.

## Automações

A página **Automações** permite:

- escolher gatilho;
- selecionar Jev, GPT ou revisão humana;
- definir instrução;
- definir opções permitidas para Jev;
- ativar/desativar;
- executar um teste manual;
- visualizar o resultado do provedor na própria tela;
- excluir regras.

Os testes manuais já usam o mesmo roteador, orçamento e auditoria que serão usados pelos eventos automáticos.

### Fila e worker

Eventos automáticos não chamam IA dentro do CRUD. Eles entram em uma fila PostgreSQL idempotente.

Gatilhos conectados:
- `order.created` para pedidos manuais e novos pedidos TikTok;
- `product.low_stock` quando o estoque cruza o limiar configurado.

Os schedulers internos são:

```text
GET/POST /api/internal/automation-worker
Authorization: Bearer <AUTOMATION_CRON_SECRET>

GET/POST /api/internal/tiktok-sync
Authorization: Bearer <AUTOMATION_CRON_SECRET>
```

Cadência inicial recomendada: automações a cada 1 minuto e TikTok Shop a cada 5 minutos.

O processamento tem lotes pequenos, máximo de 3 tentativas, recuperação de claims travados, revisão humana explícita e dead-letter com retry manual pelo painel.

## Emergent

O Emergent não deve reconstruir este projeto.

Leia primeiro:

```text
docs/EMERGENT_HANDOFF.md
```

O objetivo do Emergent é importar, configurar infraestrutura/secrets, validar fluxos e fazer deploy com o menor consumo de créditos possível.

## Segurança operacional

- nenhum secret deve usar prefixo `NEXT_PUBLIC_`;
- tokens TikTok são criptografados antes de ir ao banco;
- decisões mock nunca executam automaticamente;
- GPT é bloqueado ao atingir o orçamento configurado;
- pedidos sincronizados não podem ser editados/excluídos manualmente;
- chamadas externas possuem timeout;
- falhas de provedor são enviadas para revisão segura.

## Próximo marco

Validar com credenciais reais em ambiente de teste:

1. PostgreSQL;
2. Jev;
3. OpenAI;
4. TikTok Shop Development/Test Shop;
5. automações manuais;
6. sincronização de pedidos;
7. deploy de produção.


## Migrações do banco

Produção usa migrações Prisma versionadas:

```bash
npm run db:deploy
npm run db:status
```

`npm run db:push` fica restrito a prototipação local descartável. Para um deploy novo, prefira PostgreSQL limpo + `db:deploy`.
