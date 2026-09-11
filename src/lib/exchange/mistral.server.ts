/**
 * Camada de inteligência do SQs Exchange.
 *
 * Serve exclusivamente para PROPOR dados informativos de empresas (resultados,
 * notícias, dividendos, eventos societários). Nunca toca em saldos, ledger,
 * ordens ou negócios: essas operações são exclusivas do motor no PostgreSQL.
 *
 * Fornecedor principal: Mistral AI (MISTRAL_API_KEY). Se o plano não permitir o
 * modelo, estiver limitado ou indisponível, há recurso ao fornecedor alternativo
 * já configurado no projeto (Google AI Studio / GEMINI_API_KEY). As chaves são
 * lidas apenas no servidor.
 */

import { callGemini, GEMINI_MODEL } from "@/lib/ai/gemini.server";

const ENDPOINT = "https://api.mistral.ai/v1/chat/completions";

/** Modelos por ordem de preferência (todos disponíveis em planos correntes). */
const MISTRAL_MODELS = ["mistral-medium-latest", "ministral-8b-latest", "mistral-small-latest"];

export const MISTRAL_MODEL = MISTRAL_MODELS[0] as string;

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MistralNotConfigured extends Error {
  constructor() {
    super("Camada de inteligência não configurada: falta a chave de IA.");
  }
}

export class MistralDenied extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type MistralMessage = { role: "system" | "user"; content: string };

export type JsonCall = { data: unknown; provider: string; model: string };

function parseJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Resposta da camada de inteligência não é JSON válido.");
  }
}

/** Chamada única, resposta em JSON. Erros são explícitos — nunca inventamos dados. */
export async function callMistralJson(
  messages: MistralMessage[],
  signal?: AbortSignal,
): Promise<JsonCall> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  let last: MistralDenied | null = null;

  if (apiKey) {
    for (const model of MISTRAL_MODELS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages,
          }),
          ...(signal ? { signal } : {}),
        });

        if (res.ok) {
          const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          const content = json.choices?.[0]?.message?.content;
          if (!content) throw new Error("Resposta vazia da camada de inteligência.");
          return { data: parseJson(content), provider: "mistral", model };
        }

        const body = await res.text().catch(() => "");
        last = new MistralDenied(body.slice(0, 300) || res.statusText, res.status);
        console.error(`[exchange-ai:mistral:${model}] ${res.status}`);
        if (!RETRYABLE.has(res.status)) break;
        await sleep(1500 * 2 ** attempt);
      }
    }
  }

  // Recurso ao fornecedor alternativo já configurado no projeto.
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n");
  const user = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  const fallback = await callGemini({
    system: `${system}\nResponde exclusivamente com JSON válido, sem texto fora do JSON.`,
    parts: [{ text: user }],
    temperature: 0.1,
    maxOutputTokens: 2000,
  });

  if (fallback.ok) {
    return { data: parseJson(fallback.text), provider: "gemini", model: GEMINI_MODEL };
  }

  if (last) throw last;
  if (!apiKey && !process.env["GEMINI_API_KEY"]) throw new MistralNotConfigured();
  throw new MistralDenied(fallback.error, fallback.status ?? 500);
}
