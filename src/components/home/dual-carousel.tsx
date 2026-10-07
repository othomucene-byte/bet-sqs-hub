import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import investmentImage from "@/assets/home/investments.jpg";
import bettingImage from "@/assets/home/sports.jpg";
import exchangeImage from "@/assets/home/exchange.jpg";
import gamesImage from "@/assets/home/games.jpg";
import communityImage from "@/assets/home/community.jpg";
import accountImage from "@/assets/home/account.jpg";
import promotionsImage from "@/assets/home/promotions.jpg";
import { Button } from "@/components/ui/button";

const panels = [
  { eyebrow: "SQs Investimentos", title: "INVISTA NO SEU", highlight: "FUTURO", description: "Empresas. Oportunidades. Com risco.", action: "Saber mais", href: "/investimentos", image: investmentImage, alt: "Escultura de touro em bronze e vidro verde", tone: "primary" },
  { eyebrow: "SQs Apostas", title: "APOSTAS COM MAIS", highlight: "EMOÇÃO", description: "Desportos. Viva a experiência. +18.", action: "Apostar agora", href: "/desportos", image: bettingImage, alt: "Futebolista ilustrativo num estádio", tone: "destructive" },
  { eyebrow: "SQs Exchange", title: "EXPLORE OS", highlight: "MERCADOS", description: "Empresas. Ordens. Negócios.", action: "Ver mercados", href: "/exchange", image: exchangeImage, alt: "Peças de vidro e metal interligadas", tone: "primary" },
  { eyebrow: "Jogos Betfcom", title: "ENTRE NO", highlight: "JOGO", description: "Aviator. Fish. Roda da Betfcom. +18.", action: "Ver jogos", href: "/jogos", image: gamesImage, alt: "Avião vermelho ilustrativo sobre o mar", tone: "destructive" },
  { eyebrow: "Afiliados Betfcom", title: "PARTILHE A", highlight: "BETFCOM", description: "O seu link. A sua comunidade.", action: "Ver programa", href: "/afiliados", image: communityImage, alt: "Três cadeiras verdes à volta de uma mesa", tone: "primary" },
  { eyebrow: "A sua conta", title: "FAÇA PARTE DA", highlight: "BETFCOM", description: "Conta pessoal. Identidade verificada.", action: "Criar conta", href: "/auth", image: accountImage, alt: "Cadeado metálico e chave de vidro verde", tone: "primary" },
  { eyebrow: "Promoções Betfcom", title: "BÓNUS ATÉ", highlight: "+500%", description: "Boas-vindas. Apostas grátis. Flexibilidade para apostar e investir à sua maneira. +18.", action: "Ver promoções", href: "/promocoes", image: promotionsImage, alt: "Caixa de presente azul-marinho com fichas verdes e moedas douradas", tone: "primary" },
] as const;
const pages = Array.from({ length: Math.ceil(panels.length / 2) }, (_, i) => panels.slice(i * 2, i * 2 + 2));

export function DualCarousel() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const hovering = React.useRef(false);
  const focused = React.useRef(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const goTo = React.useCallback((index: number) => setActive((index + pages.length) % pages.length), []);
  const keepPaused = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
  };
  const pauseTemporarily = () => {
    keepPaused();
    resumeTimer.current = setTimeout(() => {
      if (!hovering.current && !focused.current) setPaused(false);
    }, 6_000);
  };
  const navigate = (index: number) => { goTo(index); pauseTemporarily(); };
  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  React.useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => goTo(active + 1), 4_000);
    return () => window.clearTimeout(timer);
  }, [active, goTo, paused, reducedMotion]);
  React.useEffect(() => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); }, []);

  return (
    <section className="border-b border-border/60 bg-background" aria-label="Destaques Betfcom SQs">
      <div className="mx-auto w-full max-w-6xl px-3 pb-2 pt-3 sm:px-4 sm:pt-4">
        <div className="relative h-[12.25rem] overflow-hidden rounded-lg border border-border bg-bet-surface sm:h-[16.25rem]" aria-roledescription="carrossel"
          onMouseEnter={() => { hovering.current = true; keepPaused(); }}
          onMouseLeave={() => { hovering.current = false; if (!focused.current) setPaused(false); }}
          onPointerDown={keepPaused} onPointerUp={pauseTemporarily} onPointerCancel={pauseTemporarily}
          onFocusCapture={() => { focused.current = true; keepPaused(); }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              focused.current = false;
              if (!hovering.current) setPaused(false);
            }
          }}>
          <div className="flex h-full transition-transform duration-700 ease-in-out motion-reduce:transition-none" style={{ transform: `translateX(-${active * (100 / pages.length)}%)`, width: `${pages.length * 100}%` }}>
            {pages.map((page, pageIndex) => (
              <div key={pageIndex} className="grid h-full shrink-0 grid-cols-2 divide-x divide-border/60" style={{ width: `${100 / pages.length}%` }} aria-hidden={pageIndex !== active} inert={pageIndex !== active}>
                {page.map((panel) => (
                  <article key={panel.href} className={`relative h-full min-w-0 overflow-hidden ${page.length === 1 ? "col-span-2" : ""}`}>
                    <img src={panel.image} alt={panel.alt} width={1024} height={768} loading={pageIndex === 0 ? "eager" : "lazy"} className="absolute inset-0 size-full object-cover object-right" />
                    <div className="absolute inset-0 bg-gradient-to-r from-bet-surface/90 via-bet-surface/55 to-bet-surface/5" />
                    <div className="relative z-10 flex h-full flex-col justify-center px-5 py-4 sm:px-10 sm:py-6">
                      <p className={`text-[10px] font-bold sm:text-xs ${panel.tone === "destructive" ? "text-destructive" : "text-primary"}`}>{panel.eyebrow}</p>
                      <h2 className="mt-2 max-w-[15rem] font-display text-base font-extrabold leading-[1.15] text-bet-foreground sm:text-3xl">{panel.title} <span className={panel.tone === "destructive" ? "text-destructive" : "text-primary"}>{panel.highlight}</span></h2>
                      <p className="mt-2 max-w-[15rem] text-[10px] font-medium leading-snug text-bet-foreground/85 sm:text-xs">{panel.description}</p>
                      <div className="mt-3">
                        <Button variant="outline" className={`h-7 max-w-full gap-1 rounded-full bg-bet-surface/35 px-2 text-[10px] font-bold backdrop-blur-sm sm:h-9 sm:gap-2 sm:px-4 sm:text-xs ${panel.tone === "destructive" ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`} asChild>
                          <a href={panel.href}>{panel.action}<ArrowRight className="size-3 shrink-0 sm:size-4" /></a>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
          <Button type="button" variant="secondary" size="icon" className="absolute left-0 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground hover:bg-bet-surface sm:left-1 sm:size-7" aria-label="Destaque anterior" onClick={() => navigate(active - 1)}><ChevronLeft aria-hidden="true" /></Button>
          <Button type="button" variant="secondary" size="icon" className="absolute right-0 top-1/2 z-20 size-5 -translate-y-1/2 rounded-full border border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground hover:bg-bet-surface sm:right-1 sm:size-7" aria-label="Destaque seguinte" onClick={() => navigate(active + 1)}><ChevronRight aria-hidden="true" /></Button>
        </div>
        <div className="flex h-6 items-center justify-center gap-1" aria-label="Escolher destaque">
          {pages.map((page, index) => (
            <Button key={index} type="button" variant="ghost" className="size-6 min-h-0 bg-transparent p-0 hover:bg-transparent" aria-label={`Mostrar ${page.map((panel) => panel.eyebrow).join(" e ")}`} aria-current={index === active ? "true" : undefined} onClick={() => navigate(index)}>
              <span className={`h-1.5 rounded-full transition-[width] ${index === active ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/50"}`} />
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
