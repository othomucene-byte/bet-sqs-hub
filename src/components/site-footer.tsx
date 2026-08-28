import { BrandLogo } from "@/components/brand-logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <BrandLogo />
          <p className="text-sm text-muted-foreground">
            Plataforma modular de investimentos e apostas. Operação com dinheiro real depende de
            licenciamento e conformidade regulatória.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold">SQs Investimentos</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Carteira financeira</li>
            <li>Produtos de investimento</li>
            <li>Rendimentos</li>
            <li>Empresas</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">SQs Apostas</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Betting Wallet</li>
            <li>Eventos e odds</li>
            <li>Bilhetes</li>
            <li>Liquidação</li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold">Core Platform</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>Auth &amp; KYC</li>
            <li>Wallet &amp; Ledger</li>
            <li>Payments</li>
            <li>Risk/Fraud &amp; Admin</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60 px-4 py-6">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          BETFCOM SQs não apresenta retornos garantidos. Investir envolve risco de perda de capital.
          Apostas destinam-se a maiores de 18 anos. Jogue com responsabilidade.
        </p>
      </div>
    </footer>
  );
}
