import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Building2, CheckCircle2, ExternalLink, MapPin } from "lucide-react";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listCompanies, submitCompanyApplication } from "@/lib/investments/investments.functions";

export const Route = createFileRoute("/empresas")({
  loader: () => listCompanies(),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">Não foi possível carregar as empresas</h1>
    </main>
  ),
  notFoundComponent: () => <p className="p-8">Página não encontrada.</p>,
  head: () => ({
    meta: [
      { title: "Empresas na BETFCOM SQs — perfis e candidaturas" },
      {
        name: "description",
        content:
          "Empresas moçambicanas com perfil na BETFCOM SQs e formulário real de candidatura para empresas que procuram financiamento.",
      },
      { property: "og:title", content: "Empresas na BETFCOM SQs" },
      {
        property: "og:description",
        content: "Perfis de empresas moçambicanas e submissão de candidatura com estado acompanhado.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const companies = Route.useLoaderData();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pt-12 sm:pt-16">
          <Badge variant="secondary" className="mb-4">
            Empresas
          </Badge>
          <h1 className="max-w-3xl font-display text-3xl font-bold sm:text-5xl">
            Empresas moçambicanas na plataforma
          </h1>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Perfis com sector, sede, ano de fundação e presença na Bolsa de Valores de Moçambique.
            A informação é pública e verificável junto de cada empresa.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => (
              <Card key={c.id} className="card-elevated">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{c.sector}</Badge>
                    {c.listedBvm && (
                      <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary">
                        Cotada na BVM
                      </span>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base">{c.name}</CardTitle>
                  <CardDescription>{c.legalName ?? ""}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">{c.description}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {c.headquarters && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" /> {c.headquarters}
                      </span>
                    )}
                    {c.foundedYear && <span>Desde {c.foundedYear}</span>}
                  </div>
                  {c.website && (
                    <a
                      href={c.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline"
                    >
                      Site oficial <ExternalLink className="size-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="candidatura" className="mx-auto w-full max-w-3xl px-4 py-16">
          <ApplicationForm />
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function ApplicationForm() {
  const submit = useServerFn(submitCompanyApplication);
  const [done, setDone] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState({
    companyName: "",
    nuit: "",
    sector: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    website: "",
    fundingGoal: "",
    description: "",
  });

  const mutation = useMutation({
    mutationFn: async () =>
      submit({
        data: {
          companyName: form.companyName,
          nuit: form.nuit,
          sector: form.sector,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          website: form.website,
          fundingGoal: form.fundingGoal ? Number(form.fundingGoal) : undefined,
          description: form.description,
        },
      }),
    onSuccess: (result) => {
      setDone({ id: result.id });
      toast.success("Candidatura submetida. A equipa de conformidade vai analisar.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Não foi possível submeter."),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  if (done) {
    return (
      <Card className="card-elevated">
        <CardHeader>
          <CheckCircle2 className="size-6 text-primary" />
          <CardTitle className="mt-3">Candidatura recebida</CardTitle>
          <CardDescription>
            Referência: <span className="font-mono text-xs">{done.id}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O estado inicial é <strong>submetida</strong>. Seguem-se KYC/KYB, análise interna e, só
          depois da conformidade legal, a publicação de projectos.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-elevated">
      <CardHeader>
        <Building2 className="size-6 text-primary" />
        <CardTitle className="mt-3">Submeter candidatura de empresa</CardTitle>
        <CardDescription>
          Os dados são gravados no servidor com validação. Nenhum projecto é publicado antes de
          KYC/KYB e análise interna.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input id="companyName" required maxLength={160} value={form.companyName} onChange={set("companyName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nuit">NUIT</Label>
            <Input id="nuit" maxLength={30} value={form.nuit} onChange={set("nuit")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector">Sector</Label>
            <Input id="sector" required maxLength={80} value={form.sector} onChange={set("sector")} placeholder="Ex.: Agronegócio" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactName">Responsável</Label>
            <Input id="contactName" required maxLength={120} value={form.contactName} onChange={set("contactName")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email</Label>
            <Input id="contactEmail" type="email" required maxLength={255} value={form.contactEmail} onChange={set("contactEmail")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Telefone</Label>
            <Input id="contactPhone" maxLength={30} value={form.contactPhone} onChange={set("contactPhone")} placeholder="+258 8x xxx xxxx" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fundingGoal">Necessidade de financiamento (MZN)</Label>
            <Input id="fundingGoal" type="number" min={0} step="1000" value={form.fundingGoal} onChange={set("fundingGoal")} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="website">Site</Label>
            <Input id="website" maxLength={255} value={form.website} onChange={set("website")} placeholder="https://" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Descrição do negócio e do projecto</Label>
            <Textarea
              id="description"
              required
              minLength={30}
              maxLength={2000}
              rows={5}
              value={form.description}
              onChange={set("description")}
            />
            <p className="text-xs text-muted-foreground">Mínimo de 30 caracteres.</p>
          </div>
          <Button type="submit" className="sm:col-span-2" disabled={mutation.isPending}>
            {mutation.isPending ? "A submeter…" : "Submeter candidatura"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
