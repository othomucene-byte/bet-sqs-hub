# Painéis de aposta como na imagem (Aviator + Fish) e mínimo de 3 MZN

Alterar apenas a zona inferior dos dois jogos (painéis de aposta, separadores e totais) e baixar a aposta mínima para 3 MZN. Nada muda na animação, na matemática da ronda, no cash-out nem na autoridade do servidor.

## Aposta mínima 3 MZN

- `minBet` passa de 10 para 3 MZN (máximo mantém-se 25 000 MZN).
- Validação atualizada no servidor (validador da aposta) e a RPC de aposta confirmada/atualizada para aceitar 3 como mínimo — sem isto o botão falharia com erro do servidor.
- O texto informativo passa a dizer "Aposta mínima 3,00 MZN".
- Fichas rápidas passam a 3, 5, 10, 20 (a primeira igual ao mínimo real).

## Painéis como na imagem

Dois cartões iguais, empilhados no telemóvel (lado a lado em ecrã largo), com cores fortes e planas como na referência:

- Cartão cinzento-escuro neutro, cantos bem arredondados, sem brilho azul.
- Stepper em pílula escura: `−  5.00  +` com valor grande e centrado.
- Linha de 4 fichas em pílulas escuras.
- Botão verde grande à direita, altura total do bloco do stepper + fichas: "Aposta" em cima e "5.00 MZN" em baixo, a negrito. Em jogo muda para "Levantar" com o valor a subir (âmbar).
- Nova linha inferior com dois botões cinzentos: "Jogo Automático" (com ícone) e "Levantamento Automático".
  - "Levantamento Automático" abre o campo de multiplicador alvo já suportado pelo servidor (cash-out automático executado no servidor).
  - "Jogo Automático" repete a aposta do mesmo valor na ronda seguinte, do lado do cliente apenas enquanto a página estiver aberta; cada aposta continua a ser criada pelo servidor. Estado visível de ligado/desligado.

## Abaixo dos painéis

- Separadores em pílula: "Todas as apostas" (ativo), "As minhas apostas", "Principais Ganhos" — ligados às estatísticas reais da ronda que já existem; estado vazio honesto quando não há dados.
- Faixa de totais: "Total de apostas 0/0" à esquerda e "Ganho total MZN 0" à direita, mais o botão "Ronda anterior" com ícone, tal como na imagem.

## Cores

Nova paleta neutra de casino em tokens no `src/styles.css` (superfície do painel, pílula, chip, verde de aposta, âmbar de levantar), usada pelos dois jogos. Sem cores fixas nos componentes.

## Ficheiros

- `src/components/games/bet-pad.tsx` — reescrito (visual + linha de automáticos).
- `src/components/games/game-chrome.tsx` — separadores e faixa de totais com "Ronda anterior".
- `src/routes/_authenticated/crash.tsx` e `fish.tsx` — composição, fichas e ligação dos separadores.
- `src/lib/crash/fair.ts` — `minBet: 3`.
- Uma migração pequena, só se a RPC de aposta tiver o mínimo 10 gravado.
- `src/styles.css` — tokens de cor do painel.

## Verificação

Screenshots via Playwright em viewport de telemóvel (390px) nos estados apostas/voo, mais typecheck e log de build.
