// Fonte de aleatoriedade: devolve um número em [0, 1), como Math.random
export type Random = () => number;

// Fisher–Yates: devolve uma cópia embaralhada
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
