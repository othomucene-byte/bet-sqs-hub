import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/exchange/terminal";
import { supabase } from "@/integrations/supabase/client";
import { createOrder } from "@/lib/exchange/trading.functions";
import { estimatedCost, netProceeds, price as fmtPrice } from "@/lib/exchange/format";

type Props = {
  assetId: string;
  symbol: string;
  tickSize: number;
  lotSize: number;
  bestBid: number | null;
  bestAsk: number | null;
  lastPrice: number | null;
  marketStatus: string;
  onDone?: () => void;
};

const FEE_PCT = 0.0025;
const QUICK_QTY = [1, 5, 10, 50, 100];

/** Painel de compra e venda: valida no cliente, mas a autoridade é sempre o servidor. */
export function TradePanel(props: Props) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [orderType, setOrderType] = useState<"LIMIT" | "MARKET">("LIMIT");
  const [quantity, setQuantity] = useState("10");
  const [limitPrice, setLimitPrice] = useState("");
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  useEffect(() => {
    const reference =
      side === "BUY" ? props.bestAsk ?? props.lastPrice : props.bestBid ?? props.lastPrice;
    if (reference != null) setLimitPrice(reference.toFixed(2));
  }, [side, props.bestAsk, props.bestBid, props.lastPrice]);

  const submit = useServerFn(createOrder);
  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          assetId: props.assetId,
          side,
          orderType,
          quantity: Number(quantity),
          limitPrice: orderType === "LIMIT" ? Number(limitPrice) : null,
          idempotencyKey: `ord-${crypto.randomUUID()}`,
          environment: "LIVE" as const,
        },
      }),
    onSuccess: (order) => {
      const filled = Number(order.filledQuantity);
      toast.success(
        filled > 0
          ? `Ordem executada: ${filled} ${props.symbol} a ${order.avgFillPrice ?? "—"} MZN`
          : "Ordem colocada no livro",
      );
      props.onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const qty = Number(quantity);
  const unit =
    orderType === "LIMIT" ? Number(limitPrice) : (side === "BUY" ? props.bestAsk : props.bestBid) ?? 0;
  const estimate = useMemo(
    () => (side === "BUY" ? estimatedCost(qty, unit, FEE_PCT) : netProceeds(qty, unit, FEE_PCT)),
    [side, qty, unit],
  );

  const marketOpen = props.marketStatus === "OPEN";
  const disabled =
    !marketOpen ||
    mutation.isPending ||
    !Number.isFinite(qty) ||
    qty <= 0 ||
    qty % props.lotSize !== 0 ||
    (orderType === "LIMIT" && (!Number.isFinite(Number(limitPrice)) || Number(limitPrice) <= 0));

  if (signedIn === false) {
    return (
      <Panel title={`Investir em ${props.symbol}`}>
        <p className="text-sm text-muted-foreground">
          Entre na sua conta e verifique a identidade para comprar ou vender neste mercado.
        </p>
        <Button asChild className="mt-3 h-11 w-full font-semibold">
          <Link to="/auth">Entrar ou criar conta</Link>
        </Button>
      </Panel>
    );
  }

  return (
    <Panel title={`Investir em ${props.symbol}`}>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary/40 p-1">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              side === s
                ? s === "BUY"
                  ? "bg-primary text-primary-foreground"
                  : "bg-destructive text-destructive-foreground"
                : "text-muted-foreground"
            }`}
          >
            {s === "BUY" ? "Comprar" : "Vender"}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-secondary/40 p-1">
        {(["LIMIT", "MARKET"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={`rounded-md py-1.5 text-xs font-semibold transition-colors ${
              orderType === t ? "bg-card text-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "LIMIT" ? "Preço limite" : "A mercado"}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="qty" className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Quantidade
          </Label>
          <Input
            id="qty"
            inputMode="numeric"
            className="font-mono tabular-nums"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="px" className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Preço (MZN)
          </Label>
          <Input
            id="px"
            inputMode="decimal"
            className="font-mono tabular-nums"
            value={orderType === "MARKET" ? "" : limitPrice}
            placeholder={orderType === "MARKET" ? "melhor do livro" : undefined}
            disabled={orderType === "MARKET"}
            onChange={(e) => setLimitPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        {QUICK_QTY.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuantity(String(q))}
            className="flex-1 rounded-full border border-border/60 py-1 font-mono text-xs tabular-nums text-muted-foreground hover:text-foreground"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-1 rounded-lg border border-border/60 bg-secondary/30 p-2.5 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Melhor compra</span>
          <span className="font-mono tabular-nums text-foreground">{fmtPrice(props.bestBid)}</span>
        </div>
        <div className="flex justify-between">
          <span>Melhor venda</span>
          <span className="font-mono tabular-nums text-foreground">{fmtPrice(props.bestAsk)}</span>
        </div>
        <div className="flex justify-between border-t border-border/60 pt-1">
          <span>{side === "BUY" ? "Custo estimado (c/ comissão)" : "Recebimento estimado"}</span>
          <span className="font-mono font-semibold tabular-nums text-foreground">
            {estimate.toFixed(2)} MZN
          </span>
        </div>
      </div>

      <Button
        className="mt-3 h-12 w-full text-base font-semibold"
        variant={side === "BUY" ? "default" : "destructive"}
        disabled={disabled}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending
          ? "A enviar…"
          : side === "BUY"
            ? `Comprar ${props.symbol}`
            : `Vender ${props.symbol}`}
      </Button>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link to="/exchange/wallet">Depositar fundos</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to="/exchange/wallet">Levantar</Link>
        </Button>
      </div>

      {!marketOpen && (
        <p className="mt-2 text-center text-xs text-amber-400">
          Mercado fechado — as ordens só são aceites com o mercado aberto.
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Mercado real em meticais. Verificação de identidade, reserva de fundos, cruzamento e registo
        acontecem no servidor.
      </p>
    </Panel>
  );
}
