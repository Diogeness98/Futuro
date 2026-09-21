# Arquitetura do Futuro

## Objetivo

Minimizar custo operacional e preservar recursos caros sem sacrificar confiabilidade.

## Ordem de execução

1. **Código determinístico** — validação, cálculos, regras explícitas.
2. **Jev** — classificação, Choice, Score, roteamento e decisões probabilísticas.
3. **OpenAI** — geração, interpretação e raciocínio mais complexo.
4. **Work** — somente quando houver interação externa longa/imprevisível que APIs normais não resolvam.

## Thresholds iniciais

- Jev `>= 0.92`: execução automática, desde que não seja modo mock e a ação esteja autorizada.
- Abaixo de `0.92`: revisão por GPT econômico antes de ação.
- Work não é chamado automaticamente na Fase 0; o roteador apenas sinaliza quando pode ser necessário.

## Regra de segurança

Nenhuma credencial deve usar prefixo `NEXT_PUBLIC_`. Todas as chaves ficam somente no ambiente do servidor.

## Jev

Jev está em early access. O adapter de transporte está isolado em `src/lib/ai/providers/jev.ts`. A integração real só deve ser ativada após confirmar na conta TypeSafe o endpoint e o contrato exatos.
