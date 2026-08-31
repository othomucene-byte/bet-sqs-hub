/** Mascara o nome de um jogador para exibição pública. */
export function maskName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name) return "Jogador";
  const first = name.split(/\s+/)[0] ?? name;
  if (first.length <= 2) return `${first}**`;
  return `${first.slice(0, 2)}${"*".repeat(Math.min(4, first.length - 2))}`;
}
