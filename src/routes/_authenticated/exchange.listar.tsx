import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site-header";
import { ExchangeNav } from "@/components/exchange/exchange-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyListingApplications,
  submitListingApplication,
} from "@/lib/exchange/listing.functions";

export const Route = createFileRoute("/_authenticated/exchange/listar")({
  head: () => ({
    meta: [
      { title: "Listar a sua empresa no SQs Exchange | Betfcom SQs" },
      {
        name: "description",
        content:
          "Candidate a sua empresa moçambicana à listagem no SQs Exchange: ações, obrigações e papel comercial em meticais, sujeitos a aprovação da administração.",
      },
      { property: "og:title", content: "Listar a sua empresa no SQs Exchange" },
      {
        property: "og:description",
        content: "Candidatura à listagem no mercado da Betfcom SQs, com decisão da administração.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ListingPage,
});

const TYPES = [
  { value: "EQUITY", label: "Ações" },
  { value: "BOND", label: "Obrigações" },
  { value: "COMMERCIAL_PAPER", label: "Papel comercial" },
  { value: "FUND", label: "Fundo" },
  { value: "OTHER", label: "Outro" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submetida",
  under_review: "Em análise",
  approved: "Aprovada e listada",
  rejected: "Recusada",
};

function ListingPage() {
  const queryClient = useQueryClient();
  const submit = useServerFn(submitListingApplication);
  const fetchMine = useServerFn(getMyListingApplications);

  const [companyName, setCompanyName] = useState("");
  const [proposedSymbol, setProposedSymbol] = useState("");
  const [assetType, setAssetType] = useState<(typeof TYPES)[number]["value"]>("EQUITY");
  const [sector, setSector] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [shares, setShares] = useState("");
  const [refPrice, setRefPrice] = useState("");
  const [description, setDescription] = useState("");

  const mine = useQuery({ queryKey: ["my-listings"], queryFn: () => fetchMine() });

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          companyName: companyName.trim(),
          proposedSymbol: proposedSymbol.trim().toUpperCase(),
          assetType,
          sector: sector.trim() || undefined,
          description: description.trim() || undefined,
          website: website.trim() || undefined,
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || undefined,
          sharesOffered: shares.trim() ? Number(shares) : null,
          referencePrice: refPrice.trim() ? Number(refPrice) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Candidatura submetida para análise");
      setCompanyName("");
      setProposedSymbol("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["my-listings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready =
    companyName.trim().length >= 2 &&
    proposedSymbol.trim().length >= 2 &&
    /.+@.+\..+/.test(contactEmail.trim());

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5">
        <h1 className="text-2xl font-bold">Listar a sua empresa</h1>
        <ExchangeNav />

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Candidatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A listagem depende de aprovação da administração da Betfcom SQs. Submeter uma
              candidatura não cria qualquer instrumento nem garante negociação.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cn" className="text-xs">
                  Nome da empresa
                </Label>
                <Input id="cn" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sym" className="text-xs">
                  Código pretendido
                </Label>
                <Input
                  id="sym"
                  value={proposedSymbol}
                  onChange={(e) => setProposedSymbol(e.target.value.toUpperCase())}
                  placeholder="Ex.: EASY"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Tipo de instrumento</Label>
                <div className="flex flex-wrap gap-1">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setAssetType(t.value)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        assetType === t.value
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="sec" className="text-xs">
                  Setor
                </Label>
                <Input id="sec" value={sector} onChange={(e) => setSector(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="site" className="text-xs">
                  Website
                </Label>
                <Input id="site" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mail" className="text-xs">
                  Email de contacto
                </Label>
                <Input id="mail" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="tel" className="text-xs">
                  Telefone
                </Label>
                <Input id="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qtd" className="text-xs">
                  Títulos a oferecer
                </Label>
                <Input id="qtd" inputMode="numeric" value={shares} onChange={(e) => setShares(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="px" className="text-xs">
                  Preço de referência (MZN)
                </Label>
                <Input id="px" inputMode="decimal" value={refPrice} onChange={(e) => setRefPrice(e.target.value)} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="desc" className="text-xs">
                  Descrição da empresa
                </Label>
                <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!ready || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Submeter candidatura
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">As suas candidaturas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(mine.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">Ainda não submeteu candidaturas.</p>
            )}
            {(mine.data ?? []).map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-2 text-sm"
              >
                <span className="font-semibold">{r.proposedSymbol}</span>
                <span className="text-muted-foreground">{r.companyName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                {r.decisionNote && <span className="text-xs text-amber-400">{r.decisionNote}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
      <ExchangeNav />
    </div>
  );
}
