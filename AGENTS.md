<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Regras de arquitetura

- Comissões de afiliados são geradas por triggers (`affiliate_on_wager`) nas tabelas de apostas/investimentos (`game_bets`, `bet_slips`, `instant_rounds`, `investments`) via `affiliate_commission_for`, deduplicadas por `(source_kind, source_id)` e estornadas quando o evento de origem é anulado. A disponibilidade deriva do prazo (`available_at`) em `affiliate_available`; **não usar pg_cron nem aprovação manual em massa** para validar comissões.
- O carrossel editorial da página inicial vive isolado em `components/home`, para não misturar temporizadores e interação com os dados financeiros da página.
