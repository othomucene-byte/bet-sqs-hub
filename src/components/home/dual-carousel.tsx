import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";

import investmentImage from "@/assets/hero.jpg";
import bettingImage from "@/assets/games/track-bg.jpg";
import { Button } from "@/components/ui/button";

const panels = [
  {
    eyebrow: "SQs Investimentos",
    title: (
      <>
        INVISTA NO SEU <span className="text-primary">FUTURO</span>
      </>
    ),
    description: "Empresas. Oportunidades. Rendimentos.",
    action: "Saber mais",
    href: "/investimentos",
    image: investmentImage,
    alt: "Mercado financeiro com gráfico verde em crescimento",
    tone: "primary",
  },
  {
    eyebrow: "SQs Apostas",
    title: (
      <>
        APOSTAS COM MAIS <span className="text-destructive">EMOÇÃO</span>
      </>
    ),
    description: "Desportos. Odds reais. Viva a experiência.",
    action: "Apostar agora",
    href: "/desportos",
    image: bettingImage,
    alt: "Ambiente desportivo iluminado e cheio de energia",
    tone: "destructive",
  },
] as const;

export function DualCarousel() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = React.useCallback((index: number) => {
    setActive((index + panels.length) % panels.length);
  }, []);

  const pauseTemporarily = React.useCallback(() => {
    setPaused(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), 6_000);
  }, []);

  const navigate = React.useCallback(
    (index: number) => {
      goTo(index);
      pauseTemporarily();
    },
    [goTo, pauseTemporarily],
  );

  React.useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => goTo(active + 1), 4_000);
    return () => window.clearTimeout(timer);
  }, [active, goTo, paused]);

  React.useEffect(
    () => () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    },
    [],
  );

  const keepPaused = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    setPaused(true);
  };

  return (
    <section className="border-b border-border/60 bg-background" aria-label="Destaques Betfcom SQs">
      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-5">
        <div
          className="relative h-[19rem] overflow-hidden rounded-lg border border-border bg-bet-surface sm:h-[25rem]"
          aria-roledescription="carrossel"
          onMouseEnter={keepPaused}
          onMouseLeave={() => setPaused(false)}
          onPointerDown={keepPaused}
          onPointerUp={pauseTemporarily}
          onFocusCapture={keepPaused}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
          }}
        >
          <div
            className="flex h-full w-[200%] transition-transform duration-700 ease-in-out motion-reduce:transition-none"
            style={{ transform: `translateX(-${active * 50}%)` }}
          >
            {panels.map((panel) => (
              <article key={panel.href} className="relative h-full w-1/2 shrink-0 overflow-hidden">
                <img src={panel.image} alt={panel.alt} className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-bet-surface via-bet-surface/80 to-bet-surface/15" />
                <div className="relative z-10 flex h-full max-w-[78%] flex-col justify-center px-12 pb-12 pt-5 sm:max-w-xl sm:px-20">
                  <p className={`text-xs font-bold sm:text-sm ${panel.tone === "destructive" ? "text-destructive" : "text-primary"}`}>
                    {panel.eyebrow}
                  </p>
                  <h2 className="mt-3 text-3xl font-extrabold leading-[1.05] text-bet-foreground sm:text-5xl">
                    {panel.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium text-bet-foreground/85 sm:text-base">{panel.description}</p>
                  <div className="mt-5">
                    <Button
                      variant="outline"
                      className={`bg-bet-surface/35 font-bold backdrop-blur-sm ${
                        panel.tone === "destructive"
                          ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      }`}
                      asChild
                    >
                      <a href={panel.href}>
                        {panel.action} <ArrowRight className="size-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground backdrop-blur-sm hover:bg-bet-surface sm:left-4"
            aria-label="Destaque anterior"
            onClick={() => navigate(active - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground backdrop-blur-sm hover:bg-bet-surface sm:right-4"
            aria-label="Destaque seguinte"
            onClick={() => navigate(active + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2" aria-label="Escolher destaque">
            {panels.map((panel, index) => (
              <Button
                key={panel.href}
                type="button"
                variant="secondary"
                className={`size-2 min-h-0 rounded-full p-0 transition-[width,opacity] duration-300 ${
                  index === active ? "w-7 bg-primary" : "bg-bet-foreground/50"
                }`}
                aria-label={`Mostrar ${panel.eyebrow}`}
                aria-current={index === active ? "true" : undefined}
                onClick={() => navigate(index)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}