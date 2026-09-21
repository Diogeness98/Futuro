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
- Jev adapter isolado
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
```

### Jev

Manter inicialmente:

```env
JEV_MODE=mock
JEV_API_KEY=
JEV_API_URL=
JEV_AUTO_EXECUTE_THRESHOLD=0.92
JEV_GPT_REVIEW_THRESHOLD=0.75
```

Mudar `JEV_MODE` somente depois de confirmar o contrato real da API da conta TypeSafe.

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
- produtos podem ser criados;
- clientes podem ser criados;
- pedidos podem ser criados;
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

1. testar OpenAI com a chave real;
2. integrar Jev real;
3. testar roteamento Jev → GPT;
4. integrar TikTok Shop;
5. implementar automações reais;
6. testes ponta a ponta;
7. deploy de produção.

Após cada etapa bem-sucedida, parar e salvar um checkpoint no GitHub.
