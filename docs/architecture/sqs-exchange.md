# SQs Exchange — arquitetura, PAPER e LIVE

Módulo de mercado de investimentos moçambicano dentro da Betfcom SQs. Entrou **ao lado**
do que já existia (apostas, investimentos, wallet, KYC, pagamentos, admin) — nada foi
removido ou substituído.

## Ambiente

Por omissão o módulo corre em **PAPER (simulação)**: dinheiro fictício, instrumentos
marcados como demo, preços derivados **apenas** de negócios executados entre
participantes da simulação. Nenhum preço é inventado — sem negócios, a interface mostra
“Dados não disponíveis”. Não há qualquer ligação à BVM.

## Base de dados (migração aplicada)

Tabelas: `exchange_markets`, `market_sessions`, `exchange_assets`, `market_data`,
`investment_accounts`, `ledger_accounts`, `ledger_transactions`, `ledger_entries`,
`exchange_orders`, `order_events`, `trades`, `positions`, `exchange_transfers`,
`fee_configs`, `risk_limits`, `risk_alerts`, `watchlists`, `audit_logs`.

Garantias: RLS por dono em todas as tabelas de utilizador, GRANTs explícitos, ledger de
dupla entrada append-only (ledger, eventos de ordem e auditoria são imutáveis por
trigger), idempotência por `idempotency_key`/`reference`, catálogo PAPER semeado com
instrumentos demo moçambicanos e taxa de negociação de 0,25%.

Funções PostgreSQL (SECURITY DEFINER, sem execução para `anon`/`authenticated`, exceto
`exchange_order_book`): garantia de contas, lançamentos no ledger, saldo derivado,
crédito de simulação, transferência de carteira, criação/cancelamento de ordens,
execução de negócios, motor de cruzamento, livro agregado e mudança de estado do mercado.

## Servidor (TanStack Start)

- `src/lib/exchange/adapters.server.ts` — `PaperTradingAdapter` (motor no PostgreSQL) e
  `BvmExchangeAdapter` (falha explicitamente enquanto não houver operador autorizado).
- `src/lib/exchange/market-data.server.ts` — provider da plataforma e provider BVM
  (pendente). Nunca inventa cotações.
- `src/lib/exchange/market.functions.ts` — catálogo e detalhe públicos.
- `src/lib/exchange/trading.functions.ts` — conta, ordens, negócios, favoritos,
  histórico, crédito de simulação e transferências reais.
- `src/lib/exchange/admin.functions.ts` — supervisão, estado do mercado, instrumentos,
  taxas, limites de risco e cancelamento administrativo (todas verificam `has_role`).
- `src/lib/exchange/format.ts` — helpers puros, cobertos por testes em
  `src/lib/exchange/__tests__/format.test.ts` (5 testes, a passar).

## Ecrãs

Público: `/exchange` (mercado, pesquisa, filtros), `/exchange/asset/:symbol` (resumo,
gráfico, livro, negócios, informação, painel de negociação).
Autenticado: `/exchange/portfolio`, `/exchange/orders`, `/exchange/trades`,
`/exchange/wallet`, `/exchange/watchlist`, `/exchange/history`.
Administração: `/admin/exchange`.

Mobile-first, tema escuro, navegação inferior no telefone. O frontend nunca decide
saldo, execução, liquidação ou preço.

## Ativar PAPER

1. O mercado `SQSX-PAPER` já existe e está aberto; ajuste o estado em `/admin/exchange`.
2. Cada utilizador credita saldo de simulação em `/exchange/wallet`.
3. As ordens passam a cruzar entre participantes; os preços aparecem à medida que
   existirem negócios.

## Ativar LIVE (depende de terceiros)

Falta, e não pode ser suprido aqui: contrato com operador de bolsa/corretora autorizada,
credenciais e API oficial, feed de cotações licenciado e autorização regulatória. Depois
disso: implementar `BvmExchangeAdapter` e `BvmMarketDataProvider` contra a API real,
criar o mercado com `environment = LIVE`, exigir KYC aprovado e ligar as transferências
reais entre a carteira de investimentos e a conta de mercado. Até lá, a negociação LIVE
permanece indisponível por decisão explícita do código.

## Aviso obrigatório

Investir envolve risco de perda de capital. A plataforma não promete nem garante
retornos. Os dados do ambiente de simulação não são cotações oficiais.
