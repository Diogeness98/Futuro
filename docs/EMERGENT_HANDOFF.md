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
```

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

## Segurança

- Nunca inserir chaves em arquivos versionados.
- Nunca usar prefixo `NEXT_PUBLIC_` para segredos.
- Nunca imprimir chaves em logs.
- Não enviar segredos ao navegador.
- Não salvar credenciais no banco sem criptografia apropriada.

## Critérios de aceite da importação

A tarefa só é considerada concluída quando:

- cadastro funciona;
- login funciona;
- logout funciona;
- dashboard abre;
- produtos podem ser criados, editados e excluídos;
- clientes podem ser criados, editados e excluídos;
- pedidos podem ser criados, editados e excluídos;
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

- não integrar TikTok Shop;
- não refazer design;
- não trocar autenticação;
- não trocar banco;
- não trocar ORM;
- não adicionar biblioteca de UI;
- não adicionar analytics;
- não criar agentes adicionais;
- não alterar a política Jev → GPT;
- não usar Work para tarefas resolvíveis via código/API.

## Depois da importação

Somente após todos os critérios acima passarem:

1. configurar OpenAI com a chave real;
2. configurar Jev com a chave real e `JEV_MODE=live`;
3. testar o painel de decisão Jev;
4. testar roteamento Jev → GPT;
5. integrar TikTok Shop;
6. implementar automações reais;
7. testes ponta a ponta;
8. deploy de produção.

Após cada etapa bem-sucedida, parar e salvar um checkpoint no GitHub.
