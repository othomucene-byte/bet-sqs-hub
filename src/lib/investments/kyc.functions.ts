import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type KycStatus = "not_started" | "pending" | "approved" | "rejected";

export type KycProfile = {
  id: string;
  status: KycStatus;
  fullName: string;
  documentType: string;
  documentNumber: string;
  dateOfBirth: string | null;
  address: string | null;
  province: string | null;
  nationality: string;
  riskProfile: string;
  reviewNotes: string | null;
  createdAt: string;
  documents: { id: string; docType: string; status: string; createdAt: string }[];
};

/** Estado do KYC do próprio utilizador (lido no servidor). */
export const getKyc = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KycProfile | null> => {
    const { data } = await context.supabase
      .from("kyc_profiles")
      .select(
        "id, status, full_name, document_type, document_number, date_of_birth, address, province, nationality, risk_profile, review_notes, created_at",
      )
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!data) return null;

    const { data: docs } = await context.supabase
      .from("kyc_documents")
      .select("id, doc_type, status, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });

    return {
      id: data.id,
      status: data.status as KycStatus,
      fullName: data.full_name,
      documentType: data.document_type,
      documentNumber: data.document_number,
      dateOfBirth: data.date_of_birth,
      address: data.address,
      province: data.province,
      nationality: data.nationality,
      riskProfile: data.risk_profile,
      reviewNotes: data.review_notes,
      createdAt: data.created_at,
      documents: (docs ?? []).map((d) => ({
        id: d.id,
        docType: d.doc_type,
        status: d.status,
        createdAt: d.created_at,
      })),
    };
  });

const kycSchema = z.object({
  fullName: z.string().trim().min(3).max(160),
  documentType: z.enum(["bi", "passaporte", "dire", "carta_conducao"]),
  documentNumber: z.string().trim().min(4).max(40),
  dateOfBirth: z.string().trim().min(8).max(10),
  address: z.string().trim().min(4).max(240),
  province: z.string().trim().min(2).max(80),
  nationality: z.string().trim().min(2).max(80).default("Moçambique"),
  riskProfile: z.enum(["conservador", "moderado", "arrojado"]),
});

/** Submissão/actualização do KYC. Só o próprio utilizador e apenas antes da aprovação. */
export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => kycSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("kyc_profiles")
      .select("id, status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.status === "approved") {
      throw new Error("O teu KYC já está aprovado. Contacta o suporte para alterações.");
    }

    const payload = {
      user_id: context.userId,
      full_name: data.fullName,
      document_type: data.documentType,
      document_number: data.documentNumber,
      date_of_birth: data.dateOfBirth,
      address: data.address,
      province: data.province,
      nationality: data.nationality,
      risk_profile: data.riskProfile,
      status: "pending" as const,
      review_notes: null,
    };

    if (existing) {
      const { error } = await context.supabase
        .from("kyc_profiles")
        .update(payload)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { id: existing.id, status: "pending" as const };
    }

    const { data: row, error } = await context.supabase
      .from("kyc_profiles")
      .insert(payload)
      .select("id, status")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, status: row.status as KycStatus };
  });

/** Registra no servidor um documento já carregado no armazenamento privado do utilizador. */
export const registerKycDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        docType: z.enum(["id_front", "id_back", "selfie", "proof_address", "other"]),
        storagePath: z.string().trim().min(3).max(400),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!data.storagePath.startsWith(`${context.userId}/`)) {
      throw new Error("Caminho de ficheiro inválido.");
    }

    const { data: profile } = await context.supabase
      .from("kyc_profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();

    const { error } = await context.supabase.from("kyc_documents").insert({
      user_id: context.userId,
      kyc_profile_id: profile?.id ?? null,
      doc_type: data.docType,
      storage_path: data.storagePath,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
