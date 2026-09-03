# Painéis de aposta compactos, iguais à imagem de referência

O que está mal: no telemóvel os painéis empilham-se (stepper enorme, botão verde gigante em linha própria, os dois botões automáticos um por linha). A imagem de referência mostra um bloco compacto de **duas colunas**, sempre — mesmo em ecrã estreito.

## Correção (apenas layout/visual)

Cada painel passa a ter, em qualquer largura:

```text
+---------------------------+---------------------+
|  [ -   5.00   + ]         |      Aposta         |
|  [1] [2] [5] [10]         |     5.00 MZN        |
+---------------------------+---------------------+
| [ Jogo Automático ] [ Levantamento Automático ] |
+-------------------------------------------------+
```

- Grelha de 2 colunas fixa (esquerda: stepper + fichas; direita: botão verde), sem empilhar no mobile.
- Alturas reduzidas: stepper ~52px, fichas ~34px, botão verde ~92px, texto do valor menor.
- Linha dos automáticos: 2 colunas fixas, pílulas baixas (~34px) com texto pequeno; o campo de multiplicador do levantamento automático fica dentro da própria pílula quando ativo, para não estourar a largura.
- Fichas passam a 1, 2, 5, 10 como na imagem (o mínimo real de aposta continua 3 MZN, por isso 1 e 2 são elevados ao mínimo ao clicar — em alternativa mantenho 3, 5, 10, 20 se preferires).
- Cabeçalho "APOSTA 1 / APOSTA 2" com estado à direita mantém-se, mas mais fino.
- Cores mantêm-se nos tokens `--bet-*` já existentes.

## Fora de âmbito

Nada muda na animação, matemática da ronda, cash-out, RPCs, saldo ou autoridade do servidor. Só CSS/estrutura do componente.

## Ficheiros

- `src/components/games/bet-pad.tsx` — grelha 2 colunas fixa e escalas compactas.
- Ajustes menores em `src/routes/_authenticated/crash.tsx` e `fish.tsx` apenas se os painéis precisarem de largura/espaçamento diferente.

## Verificação

Screenshots via Playwright a 390px (Aviator e Fish) nos estados de aposta e voo, comparando com a imagem de referência, mais build OK.
