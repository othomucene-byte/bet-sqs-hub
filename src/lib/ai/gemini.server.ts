/**
 * Cliente da API Google AI Studio (Gemini) com a chave do próprio projeto.
 * Server-only: a chave nunca chega ao browser.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const GEMINI_MODEL = "gemini-3.7-flash";

/** Modelos alternativos quando o principal está sobrecarregado (503) ou limitado (429). */
const FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"];

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; status?: number; error: string };

export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

type GeminiOptions = {
  system: string;
  parts?: GeminiPart[];
  contents?: GeminiContent[];
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
  if (status === 503) {
    return "O serviço de IA está sobrecarregado neste momento. Tenta novamente dentro de um minuto.";
  }
  if (status === 400) return "O pedido ao Gemini foi recusado. Verifica os dados enviados.";
  return "O serviço de IA falhou a responder. Tenta novamente.";
}

/** Uma única tentativa contra um modelo concreto. */
async function callOnce(
  apiKey: string,
  model: string,
  body: string,
): Promise<GeminiResult & { retryable?: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
    });
  } catch (error) {
    console.error(`[gemini:${model}] network error`, error);
    return {
      ok: false,
      retryable: true,
      error: "Não foi possível contactar o serviço de IA. Tenta novamente.",
    };
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.error(`[gemini:${model}] ${response.status}: ${raw.slice(0, 400)}`);
    return {
      ok: false,
      status: response.status,
      retryable: RETRYABLE.has(response.status),
      error: messageForStatus(response.status),
    };
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) return { ok: false, retryable: true, error: "A IA devolveu uma resposta vazia." };
  return { ok: true, text };
}

/**
 * Faz uma chamada de texto/visão ao Gemini.
 * Sobrecarga (503), limite de pedidos (429) e falhas de rede são tentadas novamente
 * com espera crescente e, se necessário, num modelo alternativo — para que uma
 * indisponibilidade temporária do fornecedor não faça falhar o pedido.
 */
export async function callGemini({
  system,
  parts,
  contents,
  temperature = 0.2,
  maxOutputTokens = 900,
  model = GEMINI_MODEL,
}: GeminiOptions): Promise<GeminiResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) {
    return { ok: false, error: "A IA ainda não está configurada (falta a chave do Google AI Studio)." };
  }

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: contents ?? [{ role: "user", parts: parts ?? [] }],
    generationConfig: { temperature, maxOutputTokens },
  });

  const candidates = [model, ...FALLBACK_MODELS.filter((entry) => entry !== model)];
  let last: GeminiResult = { ok: false, error: "O serviço de IA falhou a responder. Tenta novamente." };

  for (const [index, candidate] of candidates.entries()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await callOnce(apiKey, candidate, body);
      if (result.ok) return result;
      last =
        result.status === undefined
          ? { ok: false, error: result.error }
          : { ok: false, status: result.status, error: result.error };
      if (!result.retryable) return last;
      if (attempt < 2) await sleep(700 * 2 ** attempt + Math.random() * 300);
    }
    if (index < candidates.length - 1) {
      console.warn(`[gemini] a passar para o modelo alternativo após falhas em ${candidate}`);
    }
  }

  return last;
}
