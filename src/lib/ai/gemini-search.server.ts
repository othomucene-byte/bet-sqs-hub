/**
 * Pesquisa fundamentada (grounded) com o Gemini + pesquisa Google.
 *
 * Server-only. A chave (GEMINI_API_KEY) nunca chega ao browser.
 *
 * Ao contrário de uma chamada normal ao modelo, aqui o Google devolve, em
 * `groundingMetadata`, as páginas realmente consultadas. Só essas ligações são
 * aceites como fonte — nada é assumido a partir da memória do modelo.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const MODELS = ["gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"];

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type GroundedSource = { title: string; url: string; domain: string };

export type GroundedResult =
  | { ok: true; text: string; sources: GroundedSource[]; model: string; queries: string[] }
  | { ok: false; status?: number; error: string; terminal: boolean };

export class AiNotConfigured extends Error {}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

type GroundingChunk = { web?: { uri?: string; title?: string; domain?: string } };

type Payload = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: GroundingChunk[];
      webSearchQueries?: string[];
    };
  }>;
};

async function once(
  apiKey: string,
  model: string,
  body: string,
): Promise<GroundedResult & { retryable?: boolean }> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
    });
  } catch (error) {
    console.error(`[gemini-search:${model}] rede`, error);
    return { ok: false, error: "Não foi possível contactar o serviço de pesquisa.", terminal: false, retryable: true };
  }

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    console.error(`[gemini-search:${model}] ${response.status}: ${raw.slice(0, 400)}`);
    const terminal = [400, 401, 402, 403].includes(response.status);
    return {
      ok: false,
      status: response.status,
      error: `Pesquisa recusada pelo fornecedor (${response.status}).`,
      terminal,
      retryable: RETRYABLE.has(response.status),
    };
  }

  const payload = (await response.json()) as Payload;
  const candidate = payload.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  const seen = new Set<string>();
  const sources: GroundedSource[] = [];
  for (const chunk of candidate?.groundingMetadata?.groundingChunks ?? []) {
    const url = chunk.web?.uri;
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({
      url,
      title: chunk.web?.title?.trim() || domainOf(url) || "fonte",
      domain: (chunk.web?.domain ?? domainOf(url)).replace(/^www\./, "").toLowerCase(),
    });
  }

  if (!text) {
    return { ok: false, error: "A pesquisa devolveu uma resposta vazia.", terminal: false, retryable: true };
  }

  return {
    ok: true,
    text,
    sources,
    model,
    queries: candidate?.groundingMetadata?.webSearchQueries ?? [],
  };
}

/**
 * Executa uma pesquisa fundamentada. Sem chave configurada lança AiNotConfigured
 * para que o trabalho automático pause em vez de falhar em silêncio.
 */
export async function groundedSearch({
  system,
  prompt,
  temperature = 0.1,
  maxOutputTokens = 2400,
}: {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<GroundedResult> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) throw new AiNotConfigured("Falta a chave do Google AI Studio (GEMINI_API_KEY).");

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature, maxOutputTokens },
  });

  let last: GroundedResult = {
    ok: false,
    error: "O serviço de pesquisa falhou a responder.",
    terminal: false,
  };

  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await once(apiKey, model, body);
      if (result.ok) return result;
      last = result.status === undefined
        ? { ok: false, error: result.error, terminal: result.terminal }
        : { ok: false, status: result.status, error: result.error, terminal: result.terminal };
      if (result.terminal) return last;
      if (!result.retryable) break;
      if (attempt < 2) await sleep(800 * 2 ** attempt + Math.random() * 400);
    }
  }

  return last;
}

/** Extrai o primeiro objecto JSON de uma resposta em texto (tolerante a ```json). */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  const direct = tryParse(cleaned);
  if (direct !== undefined) return direct;
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = tryParse(cleaned.slice(start, end + 1));
    if (slice !== undefined) return slice;
  }
  return null;
}

function tryParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return undefined;
  }
}
