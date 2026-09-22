# Arquitetura do Futuro

## Objetivo

Minimizar custo operacional e preservar recursos caros sem sacrificar confiabilidade, auditabilidade e segurança.

## Ordem econômica de execução

1. **Código determinístico** — validação, filtros, cálculos e regras explícitas.
2. **Jev** — classificação, Choice, Score, roteamento e decisões probabilísticas.
3. **GPT econômico** — geração comum e revisão da zona cinzenta do Jev.
4. **GPT forte** — somente para tarefas explicitamente complexas.
5. **Work** — somente para interação externa longa ou imprevisível que APIs normais não resolvam.

## Roteador de IA

O roteador vive em `src/lib/ai/router.ts`.

### Decisões

- Jev `>= 0.92`: resolve sem GPT.
- Jev `>= 0.75` e `< 0.92`: GPT econômico revisa usando JSON Schema.
- Jev `< 0.75`: revisão manual.
- Em modo mock, nenhuma decisão Jev é executada automaticamente.
- Falha do Jev não dispara GPT por padrão.

Os thresholds são configuráveis por ambiente.

### OpenAI

OpenAI usa a Responses API.

Proteções existentes:

- modelo econômico por padrão;
- modelo forte somente em `complex`;
- revisão Jev → GPT com saída estruturada;
- teto próprio de 300 tokens para revisão estruturada;
- limite de entrada por tarefa;
- timeout;
- orçamento móvel de 24 horas;
- reserva conservadora do orçamento **antes** de cada chamada;
- `store: false`.

A reserva pré-chamada estima tokens de entrada por caracteres e reserva o teto de saída. Se a próxima chamada puder ultrapassar o orçamento, ela não é iniciada.

## Jev / TypeSafe System One

O adapter real está em:

```text
src/lib/ai/providers/jev.ts
```

Contrato usado:

```text
POST https://api.typesafe.ai/v1/systemone
Authorization: Bearer <server secret>
Content-Type: application/json
```

O projeto envia Choice com:

- `state`;
- `instructions`;
- `criteria`;
- opções permitidas.

O retorno é normalizado a partir de:

- `answers.decision.choice`;
- `answers.decision.confidence`;
- `answers.decision.probabilities`;
- uso de tokens.

Critérios Jev podem ser configurados por automação para aumentar a qualidade da decisão e reduzir escaladas ao GPT.

## Automações

### Princípio

Eventos de negócio **não chamam IA no caminho crítico**.

Fluxo:

```text
evento de negócio
  ↓
grava operação principal
  ↓
AutomationEvent
  ↓
AutomationEventExecution
  ↓
worker em lote pequeno
  ↓
condição determinística
  ↓
Jev / GPT / revisão humana
  ↓
resultado auditado
```

### Filtros determinísticos

Uma automação pode ter condição simples antes de qualquer IA:

- `eq`
- `neq`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`

Exemplos:

```text
order.totalCents gte 50000
order.channel eq tiktok_shop
product.stock lte 2
```

Se a condição não for atendida, a execução recebe status `skipped` e não consome Jev nem GPT.

### Fila

A fila PostgreSQL possui:

- deduplicação de eventos;
- idempotência por evento × automação;
- claim atômico;
- lotes pequenos;
- até 3 tentativas;
- recuperação de claims travados;
- dead-letter;
- retry manual de dead-letter;
- soft-delete de automações;
- resultado persistido por execução;
- histórico no painel.

### Worker

Endpoint interno:

```text
GET ou POST /api/internal/automation-worker
Authorization: Bearer <AUTOMATION_CRON_SECRET>
```

O host deve agendar esse endpoint. O worker possui limite de organizações por ciclo e limite de execuções por organização.

## Gatilhos conectados

### `order.created`

Enfileirado para:

- pedidos manuais;
- novos pedidos importados do TikTok Shop.

### `product.low_stock`

Enfileirado somente quando:

- produto novo já nasce abaixo do limiar;
- estoque cruza de acima para abaixo/igual ao limiar;
- produto baixo é reativado.

Não repete evento enquanto o estoque continua baixo.

## TikTok Shop

Camadas:

```text
config.ts      → configuração server-side
tokens.ts      → exchange/refresh OAuth
signing.ts     → HMAC-SHA256
client.ts      → cliente Open API
storage.ts     → tokens criptografados
order-sync.ts  → sincronização incremental
```

### Segurança

- OAuth state em cookie HTTP-only;
- App Secret somente no servidor;
- tokens OAuth criptografados com AES-256-GCM;
- chave de criptografia separada do banco;
- pedidos externos não podem ser editados/excluídos manualmente no Futuro;
- timeout de chamadas externas.

### Rollout inicial

TikTok Shop permanece em **leitura/sincronização**.

O Futuro ainda não executa fulfillment automático. Antes disso, o fluxo brasileiro de nota fiscal/invoice precisa ser implementado e validado.

## Dados e auditoria

Entidades principais:

- `Organization`
- `User` / `Membership`
- `Product`
- `Customer`
- `Order` / `OrderItem`
- `Integration`
- `Automation`
- `AutomationEvent`
- `AutomationEventExecution`
- `AiDecision`
- `ActivityLog`

`AiDecision` registra provedor, confiança e tokens.

`AutomationEventExecution` registra status, tentativas, erro e resultado da execução.

`ActivityLog` registra ações de usuário e sistema.

## Health e deploy

`/api/health` testa também a conexão com PostgreSQL e retorna HTTP 503 quando o banco não está pronto.

Antes de deploy:

```bash
npm run typecheck
npm test
npm run build
```

Todos devem passar.

## Regra de segurança de secrets

Nunca versionar ou expor com `NEXT_PUBLIC_`:

- `AUTH_SECRET`
- `OPENAI_API_KEY`
- `JEV_API_KEY`
- `TIKTOK_SHOP_APP_SECRET`
- `INTEGRATION_ENCRYPTION_KEY`
- `AUTOMATION_CRON_SECRET`
- access tokens / refresh tokens

## Papel do Emergent

O Emergent deve:

- importar o repositório;
- fornecer PostgreSQL;
- configurar environment secrets;
- aplicar schema;
- validar flows;
- configurar scheduler;
- fazer ajustes finais de infraestrutura/UI;
- publicar.

O Emergent **não deve reconstruir** Jev, OpenAI, TikTok Shop, autenticação ou o motor de automações.
