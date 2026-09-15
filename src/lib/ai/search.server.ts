/**
 * Ponto único de pesquisa fundamentada da Betfcom SQs.
 *
 * Fornecedor principal: Mistral (Agents API + web_search) — a chave da Mistral
 * é do próprio utilizador e não consome créditos Lovable.
 * Reserva: Gemini com pesquisa Google, usado apenas se a Mistral falhar.
 */

import { groundedSearch as geminiGroundedSearch } from "./gemini-search.server";
import { mistralGroundedSearch } from "./mistral-search.server";
import { AiNotConfigured, type GroundedResult } from "./search-types";

export { AiNotConfigured };
export type { GroundedResult, GroundedSource } from "./search-types";
export { extractJson } from "./gemini-search.server";

export async function groundedSearch(args: {
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<GroundedResult> {
  const hasMistral = Boolean(process.env["MISTRAL_API_KEY"]);
  const hasGemini = Boolean(process.env["GEMINI_API_KEY"]);

  if (!hasMistral && !hasGemini) {
    throw new AiNotConfigured("Falta a chave de pesquisa (MISTRAL_API_KEY).");
  }

  if (hasMistral) {
    const result = await mistralGroundedSearch({ system: args.system, prompt: args.prompt });
    if (result.ok || !hasGemini) return result;
    console.warn(`[search] Mistral falhou (${result.status ?? "-"}); a tentar reserva Gemini.`);
  }

  return geminiGroundedSearch(args);
}
