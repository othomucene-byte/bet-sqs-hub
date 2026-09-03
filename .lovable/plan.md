# Taxa NetShop: o que está publicado e o que fazer com isso

## O que verifiquei agora no site e na documentação da NetShop

- Não existe página de preços pública (`/precos` devolve 404). A NetShop não publica tabela de comissões.
- A documentação oficial (`netshop.co.mz/docs`) só mostra a comissão dentro dos exemplos de resposta, e o valor varia:
  - cobrança de 2 500 MZN → `fees.platform: 375`, `net: 2125` (15%)
  - cobrança de 2 500 MZN (M-Pesa) → `fee: 250`, `net: 2250` (10%)
  - payout de 1 500 MZN → `fees: { our: 90, provider: 60 }`, `net: 1350` (10%)
- Limites publicados: mínimo 10 MZN em M-Pesa/mKesh/e-Mola, 50 MZN em Visa/Mastercard; payout B2C sem mínimo.
- Não há nenhum mecanismo técnico de isenção: a comissão é retida pela NetShop na liquidação, antes de o saldo ficar disponível para payout ("cobranças liquidadas menos comissões").

Conclusão honesta: **não é possível depositar sem taxa por via técnica**. A taxa é comercial. Reduzir de 10% só se consegue negociando um contrato de volume com a equipa de vendas da NetShop (`netshop.co.mz/agendar`). Não posso negociar isso por ti nem afirmar que existe isenção.

## O que proponho implementar (para deixar de trabalhar com o número "10%" assumido)

A API já devolve a comissão real por transação (`fee` / `fees.platform` / `fees.our` + `fees.provider` e `net`). Vamos passar a usar o valor real em vez do pressuposto.

1. **Ler a taxa real** — no cliente NetShop do servidor, extrair `fee`/`fees` e `net` das respostas de cobrança e payout, e também do webhook.
2. **Guardar na intenção de pagamento** — novas colunas para comissão da plataforma, comissão do provedor e valor líquido, mais o total bruto já existente.
3. **Registar no ledger como custo da plataforma** — o cliente continua a receber 100% do valor depositado (0% de taxa ao cliente, como já está definido); a comissão entra como linha de custo separada, com referência idempotente própria.
4. **Painel de administração** — bloco de reconciliação: volume bruto, comissões pagas à NetShop (por método), líquido recebido e taxa efetiva real em percentagem. Assim vês se estás a pagar 10%, 15% ou o que foi negociado.
5. **Atualizar a documentação interna** (`docs/architecture/crash-wallet.md`) para dizer que a taxa é lida da API, não fixada em 10%.

## Detalhes técnicos

- `src/lib/payments/netshop.server.ts`: `parseOperation` passa a devolver `platformFee`, `providerFee`, `netAmount`.
- Migração: colunas `platform_fee`, `provider_fee`, `net_amount` em `public.payment_intents` (nullable, sem quebrar o existente).
- `src/routes/api/public/webhooks/netshop.ts`: grava as comissões ao fechar a intenção e lança a linha de custo via `wallet_apply` com referência `netshop:<ref>:fee`.
- `src/lib/admin/admin.functions.ts` + `/admin`: agregação de comissões e taxa efetiva a partir do ledger.
- Nada muda na experiência do apostador nem nos mínimos de depósito.

## Verificação

Typecheck, log de build, e conferência de que uma cobrança de teste grava a comissão devolvida pela API (não um valor calculado).
