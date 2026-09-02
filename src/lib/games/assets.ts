/**
 * Registo central dos assets visuais dos jogos.
 *
 * Todos os elementos gráficos principais (personagem e cenário) vivem aqui, o
 * que permite substituir a arte por modelos/ilustrações profissionais mais
 * tarde sem tocar na lógica do jogo nem nos componentes de render.
 */
import fishBody from "@/assets/games/fish-body.png.asset.json";
import planeBody from "@/assets/games/plane-body.png.asset.json";
import skyBg from "@/assets/games/sky-bg.jpg.asset.json";
import waterBg from "@/assets/games/water-bg.jpg.asset.json";

export const gameAssets = {
  aviator: {
    character: planeBody.url,
    background: skyBg.url,
  },
  fish: {
    character: fishBody.url,
    background: waterBg.url,
  },
} as const;
