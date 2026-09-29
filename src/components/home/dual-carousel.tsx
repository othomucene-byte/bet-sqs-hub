import * as React from "react";
import { ArrowRight, ChevronLeft, ChevronRight, LineChart, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import investmentImage from "@/assets/hero.jpg";
import bettingImage from "@/assets/games/track-bg.jpg";
import skyImage from "@/assets/games/sky-bg.jpg.asset.json";

const slides = [
  {
    title: "SQs Investimentos",
    description: "Acompanhe mercados, analise oportunidades e invista com informação clara sobre cada risco.",
    image: investmentImage,
    alt: "Visual de mercado financeiro com gráfico em crescimento",
    href: "/investimentos",
    action: "Explorar investimentos",
    icon: LineChart,
  },
  {
    title: "SQs Apostas",
    description: "Desportos, jogos rápidos e uma experiência criada para decisões simples em qualquer dispositivo.",
    image: bettingImage,
    alt: "Pista iluminada que representa a velocidade dos jogos e apostas",
    href: "/desportos",
    action: "Ver apostas",
    icon: Trophy,
  },
  {
    title: "Jogos Betfcom SQs",
    description: "Entre nos jogos da plataforma com rondas verificáveis e operações confirmadas no servidor.",
    image: skyImage.url,
    alt: "Céu aberto usado na experiência de jogos Betfcom SQs",
    href: "/jogos",
    action: "Descobrir jogos",
    icon: Trophy,
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
  const current = slides[active];
  const CurrentIcon = current.icon;

  return (
    <section className="border-y border-border/60 bg-card/40" aria-roledescription="carrossel">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
        <div
          className="relative h-72 overflow-hidden rounded-xl border border-border bg-bet-surface sm:h-96"
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
          <div className="absolute inset-0 bg-gradient-to-r from-bet-surface via-bet-surface/80 to-bet-surface/10" />
          <article className="relative z-10 flex h-full max-w-2xl flex-col justify-center px-6 pb-16 pt-7 sm:px-12 sm:pb-14" aria-live="polite">
            <CurrentIcon className="mb-3 size-7 text-bet-green sm:mb-4" aria-hidden="true" />
            <h2 className="text-2xl font-bold text-bet-foreground sm:text-4xl">{current.title}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-bet-muted sm:text-base">
              {current.description}
            </p>
            <div className="mt-5">
              <Button className="bg-bet-green text-bet-green-foreground hover:bg-bet-green/90" asChild>
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
            className="absolute bottom-3 left-3 z-20 bg-background/80 shadow-md backdrop-blur-sm sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
            aria-label="Imagem anterior"
            onClick={() => navigate(active - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-3 right-3 z-20 bg-background/80 shadow-md backdrop-blur-sm sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2"
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
                className={`h-2 min-h-0 p-0 transition-[width,opacity] duration-300 ${
                  index === active ? "w-7 bg-bet-green" : "w-2 bg-bet-foreground/60"
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