import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  FileCheck2,
  Gamepad2,
  LineChart,
  Lock,
  ScrollText,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MarketTicker } from "@/components/home/market-ticker";
import { MarketTable } from "@/components/home/market-table";
import { Sparkline } from "@/components/home/sparkline";
import { getPaymentsStatus } from "@/lib/payments/netshop.functions";
import { getMarketOverview } from "@/lib/exchange/market.functions";
import { getSportsBoard } from "@/lib/sports/sports.functions";
import { MARKET_STATUS_LABEL, pct } from "@/lib/exchange/format";
import { shortLabel } from "@/lib/sports/markets";
import { gameCatalog } from "@/lib/games/catalog";
import logoCard from "@/assets/logo-card.png.asset.json";
import logoMpesa from "@/assets/logo-mpesa.png.asset.json";
import logoEmola from "@/assets/logo-emola.png.asset.json";
import logoMkesh from "@/assets/logo-mkesh.png.asset.json";

const payLogos = [
  { src: logoMpesa.url, alt: "M-Pesa" },
  { src: logoEmola.url, alt: "e-Mola" },
  { src: logoMkesh.url, alt: "mKesh" },
  { src: logoCard.url, alt: "Visa e Mastercard" },
];

const title = "Betfcom SQs — Investimentos, Apostas e Casino em Moçambique";
const description =
  "Betfcom SQs: plataforma de investimentos, apostas desportivas e jogos de casino em meticais, com carteiras separadas, KYC e registo completo de cada movimento. Investir e apostar envolve risco.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "keywords",
        content:
          "Betfcom, Betfcom SQs, plataforma de investimentos, apostas desportivas, casino online, Moçambique, meticais",
      },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://betfcom.com/" },
      { property: "og:image", content: "https://betfcom.com/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://betfcom.com/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://betfcom.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Betfcom SQs",
          alternateName: "Betfcom",
          url: "https://betfcom.com/",
          inLanguage: "pt-MZ",
          description,
        }),
      },
    ],
  }),
  component: Landing,
});

const beneficios = [
  {
    icon: Wallet,
    title: "Duas carteiras, um só perfil",
    text: "Investimentos e apostas com saldos e contabilidade separados, sob a mesma identidade verificada.",
  },
  {
    icon: ScrollText,
    title: "Ledger imutável",
    text: "Cada movimento gera um registo com ID, tipo, valor, saldo antes e depois — sem alteração direta de saldo.",
  },
  {
    icon: ShieldCheck,
    title: "Risk & Fraud",
    text: "Limites de transação e de aposta, deteção de comportamento suspeito e revisão manual com audit log.",
  },
  {
    icon: LineChart,
    title: "Dashboards claros",
    text: "Cards financeiros, desempenho, próximos pagamentos e notificações em tempo útil.",
  },
];

const passos = [
  { n: "01", title: "Criar conta", text: "Registo com email verificado e perfil de utilizador." },
  { n: "02", title: "KYC", text: "Estado da conta: pending, verified, rejected ou suspended." },
  { n: "03", title: "Wallet", text: "Depósitos e levantamentos validados no backend, nunca no frontend." },
  { n: "04", title: "Operar", text: "Investir em produtos ou apostar em eventos, com registo no ledger." },
];

const seguranca = [
  "Acesso aos dados restrito ao próprio titular",
  "Todas as operações validadas e confirmadas no servidor",
  "Cada movimento registado com data, valor e saldo",
  "Limites e revisão manual em operações sensíveis",
  "Pagamentos confirmados apenas pelo provedor e pelo servidor",
  "Verificação de identidade obrigatória antes de operar",
];

const faq = [
  {
    q: "A Betfcom SQs garante rentabilidade?",
    a: "Não. A rentabilidade depende sempre das condições de cada produto e dos riscos envolvidos. Não apresentamos retornos garantidos nem promessas de lucro.",
  },
  {
    q: "As carteiras de investimento e de apostas são a mesma?",
    a: "Não. A carteira de apostas é separada contabilisticamente da carteira de investimentos, ainda que ambas pertençam ao mesmo perfil verificado.",
  },
  {
    q: "Como deposito e levanto dinheiro?",
    a: "Em meticais, através dos métodos disponíveis na página de pagamentos: M-Pesa, e-Mola, mKesh e cartão Visa/Mastercard. Cada depósito ou levantamento é confirmado pelo provedor e registado no seu extrato.",
  },
  {
    q: "Como funciona a candidatura de empresas?",
    a: "Empresa → candidatura → KYC/KYB → análise → aprovação → publicação. Só após conformidade legal os projetos podem receber investimento.",
  },
];

const HOUR = new Intl.DateTimeFormat("pt-PT", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function Landing() {
  const fetchStatus = useServerFn(getPaymentsStatus);
  const status = useQuery({ queryKey: ["payments-status"], queryFn: () => fetchStatus() });
  const active = Object.entries(status.data?.methods ?? {}).filter(([, on]) => on).length;

  const fetchMarket = useServerFn(getMarketOverview);
  const market = useQuery({
    queryKey: ["home-market"],
    queryFn: () => fetchMarket({ data: { environment: "LIVE" } }),
    staleTime: 60_000,
  });
  const assets = market.data?.assets ?? [];

  const fetchSports = useServerFn(getSportsBoard);
  const sports = useQuery({
    queryKey: ["home-sports"],
    queryFn: () => fetchSports(),
    staleTime: 60_000,
  });
  const events = (sports.data?.events ?? []).slice(0, 3);

  const topAsset = assets.find((a) => a.changePct != null) ?? assets[0];
  const crashGames = gameCatalog.filter((g) => g.kind === "Crash").slice(0, 4);
  const instantGames = gameCatalog.filter((g) => g.kind === "Instantâneo").slice(0, 3);
  const marketStatusLabel = market.data
    ? `Mercado ${(MARKET_STATUS_LABEL[market.data.marketStatus] ?? market.data.marketStatus).toLowerCase()}`
    : "SQs Exchange";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <MarketTicker
        assets={assets}
        loading={market.isLoading}
        marketStatusLabel={marketStatusLabel}
      />

      <main>
        {/* Hero — portal duplo */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="bg-hero-gradient absolute inset-0" aria-hidden="true" />
          <div className="grid-lines absolute inset-0 opacity-40" aria-hidden="true" />
          <div className="relative mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <div className="max-w-2xl">
              <Badge variant="secondary" className="mb-4">
                {status.isLoading
                  ? "A verificar métodos de pagamento…"
                  : active > 0
                    ? `${active} métodos de pagamento activos em MZN`
                    : "Métodos de pagamento em configuração"}
              </Badge>
              <h1 className="font-display text-3xl font-bold leading-[1.05] tracking-tight text-hero-foreground sm:text-5xl">
                Mercados e apostas na mesma plataforma, com a mesma exigência.
              </h1>
              <p className="mt-4 text-sm text-hero-muted sm:text-base">
                SQs Investimentos e SQs Apostas funcionam em separado, com carteiras independentes,
                verificação de identidade e registo completo de cada movimento.
              </p>
            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-2">
              {/* Portal investimentos */}
              <article className="rounded-2xl border border-hero-foreground/15 bg-background/85 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl text-primary-foreground">
                      <LineChart className="size-5" />
                    </span>
                    <div>
                      <p className="font-display text-base font-bold">SQs Investimentos</p>
                      <p className="text-xs text-muted-foreground">
                        {market.data ? market.data.marketName : "Mercado SQs Exchange"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {market.data
                      ? (MARKET_STATUS_LABEL[market.data.marketStatus] ?? market.data.marketStatus)
                      : "—"}
                  </Badge>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
                  {market.isLoading ? (
                    <p className="text-sm text-muted-foreground">A carregar mercado…</p>
                  ) : topAsset ? (
                    <>
                      <p className="text-xs text-muted-foreground">Em destaque</p>
                      <div className="mt-1 flex items-end justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-display text-xl font-bold">{topAsset.symbol}</p>
                          <p className="truncate text-xs text-muted-foreground">{topAsset.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-xl font-bold tabular-nums">
                            {(topAsset.lastPrice ?? topAsset.referencePrice) != null
                              ? `${(topAsset.lastPrice ?? topAsset.referencePrice)!.toFixed(2)} MZN`
                              : "Sem cotação"}
                          </p>
                          <p
                            className={`text-xs tabular-nums ${
                              (topAsset.changePct ?? 0) >= 0 ? "text-primary" : "text-destructive"
                            }`}
                          >
                            {pct(topAsset.changePct)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <Sparkline
                          points={
                            topAsset.spark.length > 1
                              ? topAsset.spark
                              : topAsset.referenceHistory.map((h) => h.price)
                          }
                          positive={(topAsset.changePct ?? 0) >= 0}
                          className="h-12 w-full"
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Ainda não há ativos publicados no mercado.
                    </p>
                  )}
                </div>

                <ul className="mt-4 grid gap-2 text-sm">
                  {["Ações e obrigações em meticais", "Produtos com prazo, taxa e risco explícitos", "Carteira e extrato sempre disponíveis"].map(
                    (i) => (
                      <li key={i} className="flex items-center gap-2">
                        <BadgeCheck className="size-4 shrink-0 text-primary" /> {i}
                      </li>
                    ),
                  )}
                </ul>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" asChild>
                    <a href="/exchange">
                      Explorar mercados <ArrowRight className="ml-1.5 size-4" />
                    </a>
                  </Button>
                  <Button variant="outline" className="flex-1" asChild>
                    <a href="/investimentos">Produtos de investimento</a>
                  </Button>
                </div>
              </article>

              {/* Portal apostas */}
              <article className="rounded-2xl border border-hero-foreground/15 bg-bet-surface p-5 shadow-[var(--shadow-card)] sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-bet-green text-bet-green-foreground">
                      <Trophy className="size-5" />
                    </span>
                    <div>
                      <p className="font-display text-base font-bold text-bet-foreground">
                        SQs Apostas
                      </p>
                      <p className="text-xs text-bet-muted">Desportos, crash e jogos rápidos</p>
                    </div>
                  </div>
                  <Badge className="bg-bet-green text-[10px] uppercase text-bet-green-foreground">
                    Ao vivo
                  </Badge>
                </div>

                <div className="mt-5 space-y-2">
                  {sports.isLoading ? (
                    <p className="text-sm text-bet-muted">A carregar jogos…</p>
                  ) : events.length === 0 ? (
                    <p className="rounded-xl border border-bet-line bg-bet-panel p-4 text-sm text-bet-muted">
                      Sem eventos disponíveis neste momento.
                    </p>
                  ) : (
                    events.map((ev) => {
                      const h2h = ev.odds.filter((o) => o.market === "h2h").slice(0, 3);
                      return (
                        <a
                          key={ev.id}
                          href={`/sports/matches/${ev.id}`}
                          className="block rounded-xl border border-bet-line bg-bet-panel p-3 transition-colors hover:border-bet-green/60"
                        >
                          <div className="flex items-center gap-2 text-[11px] text-bet-muted">
                            <CalendarClock className="size-3" />
                            {HOUR.format(new Date(ev.commenceAt))} · {ev.competitionName}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-bet-foreground">
                            {ev.homeTeam} <span className="text-bet-muted">vs</span> {ev.awayTeam}
                          </p>
                          {h2h.length > 0 && (
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {h2h.map((o) => (
                                <span
                                  key={o.selection}
                                  className="flex items-center justify-between rounded-lg bg-bet-chip px-2 py-1.5 text-xs"
                                >
                                  <span className="text-bet-muted">
                                    {shortLabel(o.market, o.selection, o.line)}
                                  </span>
                                  <span className="font-display font-bold tabular-nums text-bet-green">
                                    {o.price.toFixed(2)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </a>
                      );
                    })
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {crashGames.slice(0, events.length === 0 ? 4 : 2).map((g) => (
                    <a
                      key={g.slug}
                      href={g.href}
                      className="relative h-20 overflow-hidden rounded-xl border border-bet-line"
                    >
                      <img
                        src={g.background}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-bet-surface/90 to-transparent" />
                      <span className="absolute bottom-2 left-2 font-display text-sm font-bold text-bet-foreground">
                        {g.name}
                      </span>
                    </a>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="flex-1 bg-bet-green font-bold uppercase tracking-wide text-bet-green-foreground hover:bg-bet-green/90"
                    asChild
                  >
                    <a href="/desportos">
                      Apostar agora <ArrowRight className="ml-1.5 size-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-bet-line bg-transparent text-bet-foreground hover:bg-bet-panel hover:text-bet-foreground"
                    asChild
                  >
                    <a href="/jogos">Ver jogos</a>
                  </Button>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Mercados */}
        <section id="mercados" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Mercados SQs Exchange</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Preços, variação, livro de ofertas e volume vindos do servidor. Quando não há
                negócios executados, o valor mostrado é de referência e está assinalado.
              </p>
            </div>
            <Button variant="outline" asChild>
              <a href="/exchange">
                Abrir terminal <ArrowRight className="ml-1.5 size-4" />
              </a>
            </Button>
          </div>
          <div className="mt-6">
            <MarketTable assets={assets} loading={market.isLoading} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Câmbios (USD, EUR, ZAR) e commodities: fonte de dados de mercado ainda não configurada —
            não mostramos valores sem fonte verificável.
          </p>
        </section>

        {/* Jogos */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
                  <Gamepad2 className="size-6 text-primary" /> Jogos e rondas rápidas
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Rondas geradas e liquidadas no servidor, com histórico verificável.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href="/jogos">Ver todos os jogos</a>
              </Button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[...crashGames, ...instantGames].slice(0, 8).map((g) => (
                <a
                  key={g.slug}
                  href={g.href}
                  className="group relative h-40 overflow-hidden rounded-2xl border border-border"
                >
                  <img
                    src={g.background}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  {g.character && (
                    <img
                      src={g.character}
                      alt=""
                      loading="lazy"
                      className="absolute bottom-6 right-2 h-16 w-auto object-contain drop-shadow-lg"
                    />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-bet-surface via-bet-surface/30 to-transparent" />
                  <span className="absolute left-3 top-3 rounded-md bg-bet-surface/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bet-foreground">
                    {g.kind}
                  </span>
                  <span className="absolute bottom-3 left-3 right-3">
                    <span className="block font-display text-base font-bold text-bet-foreground">
                      {g.name}
                    </span>
                    <span className="block text-[11px] text-bet-muted">{g.studio}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* Pagamentos */}
        <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-4 py-8 sm:flex-row sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Depósitos e levantamentos em meticais, confirmados no servidor.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-6">
            {payLogos.map((logo) => (
              <li key={logo.alt}>
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  className="h-7 w-auto object-contain opacity-80"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Benefícios */}
        <section className="border-y border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
            <h2 className="text-2xl font-bold sm:text-3xl">Benefícios</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {beneficios.map((b) => (
                <article key={b.title} className="card-elevated p-5">
                  <b.icon className="size-5 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">Como funciona</h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {passos.map((s) => (
              <li key={s.n} className="card-elevated p-5">
                <span className="font-display text-sm font-bold text-primary">{s.n}</span>
                <h3 className="mt-2 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Segurança */}
        <section id="seguranca" className="border-y border-border/60 bg-card/40">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-2">
            <div>
              <Lock className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Segurança desde o início</h2>
              <p className="mt-3 text-muted-foreground">
                O frontend nunca é a autoridade sobre saldo, pagamento, investimento, aposta,
                liquidação ou levantamento. Tudo é validado no backend.
              </p>
            </div>
            <ul className="grid gap-3">
              {seguranca.map((s) => (
                <li key={s} className="card-elevated flex items-start gap-3 p-4 text-sm">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Empresas */}
        <section id="empresas" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <div className="card-elevated grid gap-8 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <Building2 className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Área para empresas</h2>
              <p className="mt-3 text-muted-foreground">
                Perfil empresarial, verificação KYB, projetos, necessidade de financiamento,
                documentos e dashboard financeiro — com estado da candidatura sempre visível.
              </p>
              <Button className="mt-6" variant="outline" asChild>
                <a href="/empresas#candidatura">
                  Submeter candidatura <ArrowRight className="ml-1.5 size-4" />
                </a>
              </Button>
            </div>
            <ol className="grid gap-3">
              {[
                "Candidatura da empresa",
                "KYC / KYB",
                "Análise interna",
                "Aprovação",
                "Publicação do projeto",
              ].map((step, i) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 p-3 text-sm"
                >
                  <span className="bg-brand-gradient flex size-7 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-border/60 bg-card/40">
          <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
            <h2 className="text-2xl font-bold sm:text-3xl">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="mt-6">
              {faq.map((f) => (
                <AccordionItem key={f.q} value={f.q}>
                  <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Conta */}
        <section id="conta" className="mx-auto w-full max-w-6xl px-4 py-12 sm:py-16">
          <div className="card-elevated flex flex-col items-start gap-6 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <FileCheck2 className="size-6 text-primary" />
              <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Contas e KYC</h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Registo com email verificado, login com palavra-passe ou Google, e carteiras
                separadas para investimentos e apostas — tudo validado no servidor.
              </p>
            </div>
            <div className="flex w-full gap-3 lg:w-auto">
              <Button className="flex-1 lg:flex-none" asChild>
                <a href="/auth">Criar conta</a>
              </Button>
              <Button variant="outline" className="flex-1 lg:flex-none" asChild>
                <a href="/auth">Entrar</a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
