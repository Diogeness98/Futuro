# Futuro

SaaS de operações e automação construído para usar IA de forma econômica por padrão.

## Estratégia de IA

**Código → Jev → GPT → Work**

- Código determinístico resolve regras previsíveis sem custo de IA.
- Jev recebe decisões estruturadas, classificação e score.
- OpenAI entra em geração, interpretação e raciocínio.
- Work é último recurso para fluxos externos longos ou imprevisíveis.

## Fase atual

**Fase 0 — fundação.** Já inclui:

- Next.js + TypeScript;
- dashboard inicial responsivo;
- endpoint `/api/health`;
- roteador econômico em `/api/ai/route`;
- adapter OpenAI via Responses API;
- adapter Jev isolado com modo mock seguro;
- schema PostgreSQL/Prisma para organizações, produtos, clientes, pedidos, integrações, automações, decisões de IA e logs;
- testes unitários da política de roteamento;
- CI básico.

## Começar

```bash
cp .env.example .env.local
npm install
npm run dev
```

Teste o planejamento sem gastar API:

```bash
curl -X POST http://localhost:3000/api/ai/route \
  -H 'content-type: application/json' \
  -d '{"input":"classifique este pedido","options":["normal","revisar"],"dryRun":true}'
```

## Segredos

Nunca faça commit de `OPENAI_API_KEY` ou `JEV_API_KEY`. Configure as chaves somente nas variáveis de ambiente do servidor/deploy.

## Próximas fases

1. autenticação e persistência real;
2. CRUD de produtos/clientes/pedidos;
3. Jev real após confirmar endpoint da conta;
4. OpenAI real com chave existente;
5. TikTok Shop e automações;
6. testes end-to-end e deploy.
