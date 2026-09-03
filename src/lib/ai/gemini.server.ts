/**
 * Cliente da API Google AI Studio (Gemini) com a chave do próprio projeto.
 * Server-only: a chave nunca chega ao browser.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_MODEL = "gemini-3.7-flash";

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; status?: number; error: string };

type GeminiOptions = {
  system: string;
  parts: GeminiPart[];
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
};

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "A chave do Google AI Studio é inválida ou sem permissões. Actualiza a configuração.";
  }
  if (status === 429) {
    return "Demasiados pedidos ao Gemini. Aguarda alguns segundos e tenta novamente.";
  }
  if (status === 400) return "O pedido ao Gemini foi recusado. Verifica os dados enviados.";
  return "O serviço de IA falhou a responder. Tenta novamente.";
}

/** Faz uma chamada de texto/visão ao Gemini. Sem timeouts artificiais. */
export async function callGemini({
  system,
  parts,
  temperature = 0.2,
  maxOutputTokens = 900,
  model = GEMINI_MODEL,
}: GeminiOptions): Promise<GeminiResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    return { ok: false, error: "A IA ainda não está configurada (falta a chave do Google AI Studio)." };
  }

  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { temperature, maxOutputTokens },
      }),
    });
  } catch (error) {
    console.error("[gemini] network error", error);
    return { ok: false, error: "Não foi possível contactar o serviço de IA. Tenta novamente." };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[gemini] ${response.status}: ${body.slice(0, 400)}`);
    return { ok: false, status: response.status, error: messageForStatus(response.status) };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) return { ok: false, error: "A IA devolveu uma resposta vazia." };
  return { ok: true, text };
}
