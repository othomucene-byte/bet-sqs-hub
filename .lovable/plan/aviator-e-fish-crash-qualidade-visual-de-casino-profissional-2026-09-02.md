# Aviator e Fish Crash — qualidade visual de casino profissional

Objetivo: elevar os dois jogos ao nível de produto comercial (gráficos realistas, iluminação, partículas, animação interpolada, mobile-first), sem tocar na lógica de rondas, aposta, cash-out, saldo, histórico ou liquidação — o servidor continua a ser a única autoridade.

## Assets realistas (substituíveis)

Gerar assets de alta qualidade em PNG transparente / JPG e publicá-los no CDN de assets, num único registo central (`src/lib/games/assets.ts`) para que possam ser trocados depois por arte profissional sem mexer no código do jogo:

- Aviator: aeronave vermelha BETFCOM em vista 3/4 (render fotorrealista, metal com reflexos), disco de hélice em movimento (camada separada), camadas de nuvens em 3 planos para parallax, e textura de fumo/rasto.
- Fish Crash: peixe realista 3D (dorso azul, ventre laranja — fiel à referência enviada), com camada de cauda separada para ondulação natural, fundo submarino profundo com raios de luz, e camada de algas/silhuetas para parallax.
- A referência do avião e do peixe enviadas servem de direção visual; nada de emojis, formas geométricas ou desenhos infantis.

## Motor de render (canvas 2D em camadas)

Um núcleo comum novo (`src/lib/games/stage.ts`) partilhado pelos dois jogos:

- Loop com delta-time e amortecimento exponencial (`v *= Math.exp(-k*dt)`) — nada de passos fixos que parecem robóticos.
- Interpolação suave do multiplicador entre respostas do servidor (o valor pago continua a ser o do servidor).
- Camadas: fundo → parallax médio → curva do multiplicador → personagem (sprite) → partículas/glow → vinheta e grão de luz.
- Curva do multiplicador redesenhada: traço com gradiente, glow duplo, área preenchida com degradê suave, ponto luminoso pulsante na ponta e ligeiro rasto de motion blur.
- Partículas: fumo/turbulência no Aviator; bolhas com profundidade, caustics de água e poeira em suspensão no Fish Crash.
- Cap de DPR e contagem de partículas por largura de ecrã, para manter 60fps em telemóvel.
- Crash: câmara com pequeno shake, flash, personagem a fugir com escala/desfoque e congelamento elegante da curva.

## Interface (mobile-first, marca intacta)

- Palco com altura por `dvh`, HUD sobreposto (multiplicador grande com contorno neon, estado da ronda, contagem decrescente circular).
- Painel de aposta fixo em baixo no telemóvel (safe-area do iPhone), fichas rápidas, botão único Apostar → Levantar com valor a subir.
- Histórico em pills roláveis; estatísticas com estado vazio honesto.
- Cores e tipografia só a partir dos tokens existentes (`--fish-*`, tokens da marca) — sem cores fixas novas nos componentes.

## Ficheiros

- Novos: `src/lib/games/assets.ts`, `src/lib/games/stage.ts`, `src/components/games/game-stage.tsx`, `src/components/games/hud.tsx`.
- Reescritos (só visual): `src/components/crash/flight-canvas.tsx`, `src/components/fish/fish-canvas.tsx`.
- Ajustados: `src/routes/_authenticated/crash.tsx`, `src/routes/_authenticated/fish.tsx` (composição e layout apenas).
- Inalterados: `src/lib/crash/crash.functions.ts`, `engine.server.ts`, `fair.ts`, wallet, migrações.

## Verificação

Screenshots via Playwright em viewport iPhone e desktop, nos estados apostas/voo/crash, mais typecheck e verificação do log de build.
