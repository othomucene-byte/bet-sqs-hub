/**
 * Oséias — assistente de verificação automática de identidade (KYC).
 *
 * O assistente lê os dados declarados e os documentos carregados pelo próprio
 * utilizador e devolve uma decisão. A decisão é aplicada no servidor:
 * o frontend nunca escreve o estado do KYC.
 *
 * Regras:
 * - Aprova apenas quando os documentos são legíveis e coerentes com os dados.
 * - Recusa quando há incoerência clara.
 * - Em qualquer dúvida deixa em análise humana (`pending`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODEL = "google/gemini-3.7-flash";
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

const REQUIRED_DOCS = ["id_front", "selfie"] as const;

export type KycReviewOutcome = {
  ok: boolean;
  status?: "approved" | "rejected" | "pending";
  decision?: "approve" | "reject" | "manual";
  confidence?: number;
  summary?: string;
  issues?: string[];
  error?: string;
};

const DecisionSchema = z.object({
  decision: z.enum(["approve", "reject", "manual"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(600),
  issues: z.array(z.string().max(240)).max(8).default([]),
});

const SYSTEM_PROMPT = `Chamas-te Oséias e és o analista automático de KYC da BETFCOM SQs (Moçambique).
Analisas dados declarados e imagens de documentos de identidade (BI, passaporte, DIRE, carta de condução) e selfies.

Verifica, por esta ordem:
1. Legibilidade: a imagem é nítida, completa e sem cortes ou brilho que impeçam a leitura?
2. Autenticidade aparente: sinais óbvios de edição digital, fotocópia de ecrã, ou documento claramente falso.
3. Coerência: nome, número de documento, tipo de documento e data de nascimento coincidem com o que foi declarado.
4. Selfie: parece a mesma pessoa do documento e é uma pessoa real (não foto de foto).

Decide:
- "approve" apenas se tudo estiver legível e coerente e a tua confiança for alta.
- "reject" só quando há incoerência clara, documento inválido ou fraude aparente.
- "manual" em qualquer dúvida, imagem má, documento em falta ou caso fora do teu alcance.

Responde SEMPRE só com JSON válido, sem markdown:
{"decision":"approve|reject|manual","confidence":0.0-1.0,"summary":"explicação curta em português de Portugal","issues":["..."]}
Nunca inventes dados que não vês. Nunca reveles informação de outros utilizadores.`;

async function readJsonDecision(content: string) {
  const cleaned = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error("resposta sem JSON");
  return DecisionSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

/** Corre a verificação automática do KYC do próprio utilizador. */
export const runKycReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({}).passthrough().optional().parse(input) ?? {})
  .handler(async ({ context }): Promise<KycReviewOutcome> => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("kyc_profiles")
      .select(
        "id, status, full_name, document_type, document_number, date_of_birth, address, province, nationality",
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) {
      return { ok: false, error: "Submete primeiro os teus dados de identificação." };
    }
    if (profile.status === "approved") {
      return { ok: true, status: "approved", summary: "O teu KYC já está aprovado." };
    }

    const { data: docs } = await supabase
      .from("kyc_documents")
      .select("id, doc_type, storage_path")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const byType = new Map<string, string>();
    for (const doc of docs ?? []) {
      if (!byType.has(doc.doc_type)) byType.set(doc.doc_type, doc.storage_path);
    }
    const missing = REQUIRED_DOCS.filter((type) => !byType.has(type));
    if (missing.length > 0) {
      return {
        ok: false,
        error:
          missing.length === REQUIRED_DOCS.length
            ? "Carrega o documento de identificação (frente) e uma selfie com o documento."
            : missing[0] === "selfie"
              ? "Falta a selfie com o documento."
              : "Falta a frente do documento de identificação.",
      };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { ok: false, error: "A verificação automática ainda não está configurada." };
    }

    // Leitura das imagens no armazenamento privado (só do próprio utilizador).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const images: { label: string; dataUrl: string }[] = [];
    for (const type of ["id_front", "id_back", "selfie", "proof_address"] as const) {
      const path = byType.get(type);
      if (!path) continue;
      if (!path.startsWith(`${userId}/`)) continue;
      const { data: file, error } = await supabaseAdmin.storage.from("kyc").download(path);
      if (error || !file) continue;
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.byteLength > 6_000_000) continue;
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      const mime = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
      images.push({ label: type, dataUrl: `data:${mime};base64,${btoa(binary)}` });
    }

    if (images.length === 0) {
      return { ok: false, error: "Não foi possível ler os documentos carregados. Carrega novamente." };
    }

    const declared = [
      `Nome declarado: ${profile.full_name}`,
      `Tipo de documento: ${profile.document_type}`,
      `Número do documento: ${profile.document_number}`,
      `Data de nascimento: ${profile.date_of_birth ?? "não indicada"}`,
      `Nacionalidade: ${profile.nationality}`,
      `Província: ${profile.province ?? "não indicada"}`,
      `Morada: ${profile.address ?? "não indicada"}`,
    ].join("\n");

    let response: Response;
    try {
      response = await fetch(GATEWAY, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.1,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "text", text: `Dados declarados pelo utilizador:\n${declared}` },
                ...images.flatMap((image) => [
                  { type: "text" as const, text: `Imagem: ${image.label}` },
                  { type: "image_url" as const, image_url: { url: image.dataUrl } },
                ]),
              ],
            },
          ],
        }),
      });
    } catch (error) {
      console.error("[kyc-review] network error", error);
      return { ok: false, error: "Não foi possível contactar o Oséias. Tenta novamente." };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[kyc-review] gateway ${response.status}: ${body.slice(0, 400)}`);
      const error =
        response.status === 429
          ? "O Oséias está com muitos pedidos. Tenta novamente dentro de um minuto."
          : response.status === 402
            ? "Sem créditos de IA disponíveis para a verificação automática."
            : response.status === 403
              ? "A verificação automática está bloqueada nas configurações do espaço."
              : "A verificação automática falhou. A tua submissão fica em análise humana.";
      return { ok: false, error };
    }

    let verdict: z.infer<typeof DecisionSchema>;
    try {
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      verdict = await readJsonDecision(payload.choices?.[0]?.message?.content ?? "");
    } catch (error) {
      console.error("[kyc-review] parse error", error);
      return { ok: false, error: "O Oséias devolveu uma resposta inválida. Fica em análise humana." };
    }

    const status =
      verdict.decision === "approve" && verdict.confidence >= 0.8
        ? "approved"
        : verdict.decision === "reject" && verdict.confidence >= 0.8
          ? "rejected"
          : "pending";

    const notes = [
      `Oséias (verificação automática): ${verdict.decision}${
        status === "pending" ? " → análise humana" : ""
      } · confiança ${(verdict.confidence * 100).toFixed(0)}%`,
      verdict.summary,
      ...(verdict.issues.length > 0 ? [`Observações: ${verdict.issues.join("; ")}`] : []),
    ].join("\n");

    await supabaseAdmin
      .from("kyc_profiles")
      .update({
        status,
        review_notes: notes,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (status !== "pending") {
      await supabaseAdmin
        .from("kyc_documents")
        .update({ status: status === "approved" ? "approved" : "rejected" })
        .eq("user_id", userId);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      category: "kyc",
      title:
        status === "approved"
          ? "Identidade verificada"
          : status === "rejected"
            ? "Verificação de identidade recusada"
            : "Verificação em análise",
      body: verdict.summary,
      metadata: { source: "oseias", decision: verdict.decision, confidence: verdict.confidence },
    });

    return {
      ok: true,
      status,
      decision: verdict.decision,
      confidence: verdict.confidence,
      summary: verdict.summary,
      issues: verdict.issues,
    };
  });
