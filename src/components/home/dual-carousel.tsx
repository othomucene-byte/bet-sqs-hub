import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight, LineChart, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import investmentImage from "@/assets/hero.jpg";
import bettingImage from "@/assets/games/track-bg.jpg";

const slides = [
  {
    eyebrow: "SQs Investimentos",
    title: "INVISTA NO SEU FUTURO",
    description: "Empresas. Oportunidades. Rendimentos.",
    image: investmentImage,
    alt: "Mercado financeiro com gráfico verde em crescimento",
    href: "/investimentos",
    action: "Saber mais",
    icon: LineChart,
    tone: "primary",
  },
  {
    eyebrow: "SQs Apostas",
    title: "APOSTAS COM MAIS EMOÇÃO",
    description: "Desportos. Odds reais. Viva a experiência.",
    image: bettingImage,
    alt: "Pista desportiva iluminada com sensação de velocidade",
    href: "/desportos",
    action: "Apostar agora",
    icon: Trophy,
    tone: "destructive",
  },
] as const;

export function DualCarousel() {
  const [active, setActive] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = React.useCallback((index: number) => {
    setActive((index + slides.length) % slides.length);
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

  const resume = () => setPaused(false);
  const current = slides[active] ?? slides[0];
  const CurrentIcon = current.icon;

  return (
    <section className="border-b border-border/60 bg-background" aria-roledescription="carrossel" aria-label="Destaques Betfcom SQs">
      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4 sm:py-5">
        <div
          className="relative h-[19rem] overflow-hidden rounded-lg border border-border bg-bet-surface sm:h-[25rem]"
          onMouseEnter={keepPaused}
          onMouseLeave={resume}
          onPointerDown={keepPaused}
          onPointerUp={resume}
          onFocusCapture={keepPaused}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) resume();
          }}
        >
          {slides.map((slide, index) => (
            <img
              key={slide.title}
              src={slide.image}
              alt={index === active ? slide.alt : ""}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-700 motion-reduce:transition-none ${
                index === active ? "opacity-100" : "opacity-0"
              }`}
              loading={index === 0 ? "eager" : "lazy"}
              aria-hidden={index !== active}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-r from-bet-surface via-bet-surface/85 to-bet-surface/15" />
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-bet-surface to-transparent" />
          <article className="relative z-10 flex h-full max-w-xl flex-col justify-center px-12 pb-14 pt-6 sm:px-16 sm:pb-12" aria-live="polite">
            <div className={`mb-3 flex items-center gap-2 text-sm font-bold ${current.tone === "destructive" ? "text-destructive" : "text-primary"}`}>
              <CurrentIcon className="size-5" aria-hidden="true" />
              <span>{current.eyebrow}</span>
            </div>
            <h2 className="max-w-md text-3xl font-extrabold leading-tight text-bet-foreground sm:text-5xl">{current.title}</h2>
            <p className="mt-3 max-w-md text-sm font-medium leading-relaxed text-bet-foreground/85 sm:text-base">
              {current.description}
            </p>
            <div className="mt-5">
              <Button variant="outline" className={`bg-bet-surface/35 font-bold backdrop-blur-sm ${current.tone === "destructive" ? "border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground" : "border-primary text-primary hover:bg-primary hover:text-primary-foreground"}`} asChild>
                <a href={current.href}>
                  {current.action} <ArrowRight className="size-4" />
                </a>
              </Button>
            </div>
          </article>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground shadow-md backdrop-blur-sm hover:bg-bet-surface sm:left-4"
            aria-label="Imagem anterior"
            onClick={() => navigate(active - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 border-bet-foreground/30 bg-bet-surface/65 text-bet-foreground shadow-md backdrop-blur-sm hover:bg-bet-surface sm:right-4"
            aria-label="Imagem seguinte"
            onClick={() => navigate(active + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2" aria-label="Escolher imagem">
            {slides.map((slide, index) => (
              <Button
                key={slide.title}
                type="button"
                variant="secondary"
                className={`size-2 min-h-0 rounded-full p-0 transition-[width,opacity] duration-300 ${
                  index === active ? "w-7 bg-primary" : "bg-bet-foreground/50"
                }`}
                aria-label={`Mostrar ${slide.title}`}
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