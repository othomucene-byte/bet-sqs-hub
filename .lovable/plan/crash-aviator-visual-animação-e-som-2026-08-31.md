# Crash/Aviator — visual, animação e som

Objetivo: transformar o ecrã de Crash atual num jogo estilo Aviator, bonito e fluido, mantendo o servidor como única autoridade sobre ronda, aposta, cash-out e saldo. Nenhuma alteração à base de dados nem à lógica financeira.

## O que muda

**1. Palco do voo (novo componente de canvas)**
- Curva de voo com gradiente esmeralda/vermelho, grelha em movimento e traço luminoso, redesenhada a 60fps com `requestAnimationFrame`.
- Avião desenhado em vetor com nariz inclinado, ligeira oscilação vertical, hélice a girar e rasto de partículas.
- Fundo com estrelas/nuvens em parallax que aceleram com o multiplicador.
- Estado de crash: avião foge do ecrã, flash vermelho, curva congelada e "Voou!" com o multiplicador final.
- Contagem decrescente clara na fase de apostas, com barra de progresso circular.

**2. Multiplicador e HUD**
- Multiplicador grande, com escala/pulsação suave e mudança de cor por patamar (1x-2x, 2x-5x, 5x+).
- Barra de histórico horizontal com pills coloridas (vermelho/amarelo/verde) e clique para verificar a ronda (reutiliza o cartão Provably Fair já existente).
- Cabeçalho com saldo real da carteira de apostas vindo do servidor.

**3. Painel de aposta (1 aposta por ronda, como hoje)**
- Stepper -/+ com fichas rápidas (10, 25, 50, 100 MZN).
- Botão de ação único que reflete o estado do servidor: Apostar (verde) → Cash-out com valor a subir em tempo real (laranja) → Levantado/Perdida (desativado).
- Cash-out automático com switch e valor alvo; continua a ser executado pelo servidor.
- Mínimos/máximos e mensagens de erro vindos do servidor, sem validação inventada no cliente.

**4. Som sintetizado (Web Audio, sem ficheiros)**
- Motor a subir de tom durante o voo, ding no cash-out, explosão no crash, tick na contagem decrescente.
- Botão de silenciar no cabeçalho, com preferência guardada localmente; áudio só arranca após a primeira interação do utilizador (regra dos browsers).

**5. Estatísticas
- Separadores "Todas as apostas / As minhas apostas / Maiores ganhos" alimentados por dados reais do servidor; quando não houver dados, mostram estado vazio honesto em vez de números falsos.

## Regras mantidas

- O cliente só interpola a animação entre respostas do servidor; o valor pago é sempre o do servidor.
- Nenhum saldo, odd, ronda ou ganho simulado. Sem números de exemplo como se fossem reais.
- Cores e tipografia vêm dos tokens do design system (sem cores fixas nos componentes).

## Detalhes técnicos

- Novos componentes: `src/components/crash/flight-canvas.tsx` (canvas + avião, cliente), `src/components/crash/bet-panel.tsx`, `src/components/crash/history-bar.tsx`, `src/components/crash/round-stats.tsx`, e `src/lib/crash/sound.ts` (Web Audio, inicializado só no browser).
- `src/routes/_authenticated/crash.tsx` passa a compor estes componentes; o polling de `getCurrentRound` (1s) e o alinhamento de relógio via `serverNow` mantêm-se.
- Canvas e áudio são estritamente cliente: instanciados em `useEffect`, sem acesso a `window` em módulo ou render.
- Uma nova função de servidor de leitura para as estatísticas por ronda (apostas da ronda e maiores ganhos), sem escrita e sem alterações de esquema.
- Tokens adicionais em `src/styles.css` se necessário para os gradientes do palco.
