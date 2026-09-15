/** Tipos partilhados pela pesquisa fundamentada (Mistral principal, Gemini reserva). */

export type GroundedSource = { title: string; url: string; domain: string };

export type GroundedResult =
  | { ok: true; text: string; sources: GroundedSource[]; model: string; queries: string[] }
  | { ok: false; status?: number; error: string; terminal: boolean };

/** Lançada quando não existe chave configurada, para o trabalho pausar em vez de falhar em silêncio. */
export class AiNotConfigured extends Error {}
