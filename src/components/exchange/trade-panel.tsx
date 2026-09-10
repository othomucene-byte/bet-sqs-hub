import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  environment: "LIVE" | "PAPER";
  onDone?: () => void;
};

const FEE_PCT = 0.0025;

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
    const reference = side === "BUY" ? props.bestAsk ?? props.lastPrice : props.bestBid ?? props.lastPrice;
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
          environment: props.environment,
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
  const unit = orderType === "LIMIT" ? Number(limitPrice) : (side === "BUY" ? props.bestAsk : props.bestBid) ?? 0;
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
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Negociar {props.symbol}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            {props.environment === "LIVE"
              ? "Inicie sessão e verifique a identidade para colocar ordens no mercado real."
              : "Inicie sessão para colocar ordens no mercado de simulação."}
          </p>
          <Button asChild className="w-full">
            <Link to="/auth">Entrar ou criar conta</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Negociar {props.symbol}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={side} onValueChange={(v) => setSide(v as "BUY" | "SELL")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="BUY">Comprar</TabsTrigger>
            <TabsTrigger value="SELL">Vender</TabsTrigger>
          </TabsList>
        </Tabs>

        <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "LIMIT" | "MARKET")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="LIMIT">Preço limite</TabsTrigger>
            <TabsTrigger value="MARKET">A mercado</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="qty" className="text-xs">
              Quantidade
            </Label>
            <Input
              id="qty"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="px" className="text-xs">
              Preço (MZN)
            </Label>
            <Input
              id="px"
              inputMode="decimal"
              value={orderType === "MARKET" ? "" : limitPrice}
              placeholder={orderType === "MARKET" ? "melhor preço do livro" : undefined}
              disabled={orderType === "MARKET"}
              onChange={(e) => setLimitPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Melhor compra</span>
            <span className="text-foreground">{fmtPrice(props.bestBid)}</span>
          </div>
          <div className="flex justify-between">
            <span>Melhor venda</span>
            <span className="text-foreground">{fmtPrice(props.bestAsk)}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-border/60 pt-1">
            <span>{side === "BUY" ? "Custo estimado (c/ comissão)" : "Recebimento estimado"}</span>
            <span className="font-semibold text-foreground">{estimate.toFixed(2)} MZN</span>
          </div>
        </div>

        <Button
          className="h-11 w-full text-base font-semibold"
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

        {!marketOpen && (
          <p className="text-center text-xs text-amber-400">
            Mercado fechado — as ordens só são aceites com o mercado aberto.
          </p>
        )}
        <p className="text-center text-[11px] text-muted-foreground">
          {props.environment === "LIVE"
            ? "Mercado real em meticais. Validação, verificação de identidade, reserva de fundos e cruzamento acontecem no servidor."
            : "Ambiente de simulação. Validação, reserva de fundos e cruzamento acontecem no servidor."}
        </p>
      </CardContent>
    </Card>
  );
}
