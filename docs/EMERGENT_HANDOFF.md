# Futuro — Handoff para Emergent

## Objetivo

Usar o Emergent como integrador, validador e finalizador do projeto existente — não como construtor do zero.

O orçamento total disponível é limitado. Portanto, nenhuma alteração fora deste checklist deve ser feita sem necessidade técnica.

## Regra principal

**Não reescrever a arquitetura. Não trocar stack. Não recriar telas que já existem.**

O repositório `Diogeness98/Futuro` é a fonte de verdade.

## Stack existente

- Next.js
- TypeScript
- PostgreSQL
- Prisma
- autenticação própria com cookie HTTP-only/JWT
- Jev System One adapter
- OpenAI Responses API
- TikTok Shop OAuth + assinatura + sincronização inicial de pedidos
- GitHub Actions para typecheck, testes e build

## Ordem econômica de IA

1. Código determinístico
2. Jev
3. GPT econômico
4. GPT forte
5. Work apenas quando realmente necessário

## Primeira tarefa no Emergent

1. Importar o repositório existente.
2. Instalar dependências.
3. Configurar PostgreSQL.
4. Configurar variáveis de ambiente.
5. Gerar Prisma Client.
6. Aplicar schema ao banco.
7. Executar typecheck.
8. Executar testes.
9. Executar build.
10. Iniciar aplicação.

Não adicionar funcionalidades durante esta tarefa.

## Variáveis obrigatórias

### Aplicação

```env
AUTH_SECRET=
APP_URL=
DATABASE_URL=
INTEGRATION_ENCRYPTION_KEY=
AUTOMATION_CRON_SECRET=
AUTOMATION_WORKER_ORG_LIMIT=5
AUTOMATION_WORKER_BATCH_SIZE=3
LOW_STOCK_THRESHOLD=5
```

`INTEGRATION_ENCRYPTION_KEY` deve ser uma chave aleatória de 32 bytes em Base64 e deve existir apenas no ambiente do servidor.

### OpenAI

```env
OPENAI_API_KEY=
OPENAI_DEFAULT_MODEL=gpt-5.6-luna
OPENAI_ESCALATION_MODEL=gpt-5.6-sol
OPENAI_MAX_INPUT_CHARS=12000
OPENAI_DEFAULT_REASONING_EFFORT=low
OPENAI_ESCALATION_REASONING_EFFORT=medium
OPENAI_DEFAULT_MAX_OUTPUT_TOKENS=1600
OPENAI_ESCALATION_MAX_OUTPUT_TOKENS=6000
OPENAI_TIMEOUT_MS=30000
OPENAI_MAX_CALLS_PER_24H=100
OPENAI_MAX_INPUT_TOKENS_PER_24H=200000
OPENAI_MAX_OUTPUT_TOKENS_PER_24H=40000
```

Esses limites funcionam como disjuntor de orçamento. Ao atingir qualquer teto, novas chamadas ao GPT são bloqueadas e o fluxo segue para revisão manual.

### Jev / TypeSafe AI

Contrato verificado:

```text
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <server-side-key>
Content-Type: application/json
```

Configuração:

```env
JEV_MODE=mock
JEV_API_KEY=
JEV_API_URL=https://api.typesafe.ai/v1/systemone
JEV_MODEL=jev-latest
JEV_AUTO_EXECUTE_THRESHOLD=0.92
JEV_GPT_REVIEW_THRESHOLD=0.75
JEV_TIMEOUT_MS=12000
JEV_FALLBACK_TO_GPT_ON_ERROR=false
```

Após inserir a chave como secret no ambiente, alterar:

```env
JEV_MODE=live
```

Nunca versionar a chave.

O adapter do projeto usa Choice com:
- `state`
- `questions.decision.type=choice`
- `instructions`
- `criteria`

A resposta esperada é lida de `answers.decision`, incluindo `choice`, `probabilities` e `confidence`.

### TikTok Shop

A integração já existe no código. Não recriar.

```env
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
TIKTOK_SHOP_AUTH_URL=
TIKTOK_SHOP_AUTH_BASE_URL=https://auth.tiktok-shops.com
TIKTOK_SHOP_API_BASE_URL=https://open-api.tiktokglobalshop.com
TIKTOK_SHOP_TIMEOUT_MS=20000
```

`TIKTOK_SHOP_AUTH_URL` deve receber o Seller Authorization Link fornecido pelo Partner Center.

O código já implementa:

- estado OAuth em cookie HTTP-only para proteção de callback;
- troca de authorization code por access/refresh token;
- refresh token;
- assinatura HMAC-SHA256 das chamadas Open API;
- Get Authorized Shops;
- armazenamento dos tokens com AES-256-GCM;
- conexão, refresh e desconexão local;
- sincronização incremental de pedidos;
- proteção contra edição manual de pedidos sincronizados.

Na primeira configuração real do TikTok, apenas inserir secrets e validar o fluxo. Não reescrever o adapter.

### Worker de automações

A fila persistente e o worker já existem no código. Não reconstruir.

Endpoint interno:

```text
GET ou POST /api/internal/automation-worker
Authorization: Bearer <AUTOMATION_CRON_SECRET>
```

Configurar o scheduler do host para chamar esse endpoint periodicamente. O worker processa poucos itens por organização e respeita os mesmos limites Jev/GPT do restante do sistema.

Recomendação inicial de produção: executar a cada minuto com `AUTOMATION_WORKER_ORG_LIMIT=5` e `AUTOMATION_WORKER_BATCH_SIZE=3`. Não aumentar esses valores durante a primeira validação real.

A fila possui:
- `order.created` já conectado para pedidos manuais e novos pedidos TikTok;
- `product.low_stock` já conectado ao cruzar o limiar configurado;
- `LOW_STOCK_THRESHOLD` com padrão 5;
- execução idempotente por evento × automação;
- máximo de 3 tentativas;
- recuperação de claims travados;
- dead-letter após falha definitiva;
- soft-delete de automações para preservar auditoria;
- processamento manual pelo painel como fallback.

## Segurança

- Nunca inserir chaves em arquivos versionados.
- Nunca usar prefixo `NEXT_PUBLIC_` para segredos.
- Nunca imprimir chaves em logs.
- Não enviar segredos ao navegador.
- Tokens TikTok ficam criptografados antes de serem gravados no banco.
- Não substituir `INTEGRATION_ENCRYPTION_KEY` depois que credenciais já tiverem sido gravadas sem fazer uma migração controlada.

## Critérios de aceite da importação

A tarefa só é considerada concluída quando:

- cadastro funciona;
- login funciona;
- logout funciona;
- dashboard abre;
- produtos podem ser criados, editados e excluídos;
- clientes podem ser criados, editados e excluídos;
- pedidos manuais podem ser criados, editados e excluídos;
- pedidos sincronizados aparecem como gerenciados pela integração;
- página de Automações abre;
- página de IA abre;
- página de Integrações abre;
- página de Logs abre;
- página de Configurações abre;
- `/api/health` responde;
- `npm run typecheck` passa;
- `npm test` passa;
- `npm run build` passa.

## O que NÃO fazer na primeira passagem

- não reconstruir TikTok Shop;
- não refazer design;
- não trocar autenticação;
- não trocar banco;
- não trocar ORM;
- não adicionar biblioteca de UI;
- não adicionar analytics;
- não criar agentes adicionais;
- não alterar a política Jev → GPT;
- não usar Work para tarefas resolvíveis via código/API.

## Validação depois da importação

Somente após todos os critérios básicos passarem:

1. configurar OpenAI com a chave real;
2. configurar Jev com a chave real e `JEV_MODE=live`;
3. testar o painel de decisão Jev;
4. testar roteamento Jev → GPT;
5. configurar os secrets do TikTok Shop;
6. conectar uma Development/Test Shop;
7. confirmar lojas autorizadas;
8. executar a sincronização de pedidos;
9. validar que pedidos TikTok não podem ser alterados manualmente;
10. testes ponta a ponta;
11. deploy de produção.

Após cada etapa bem-sucedida, parar e salvar um checkpoint no GitHub.
