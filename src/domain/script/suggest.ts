// "Você quis dizer ...?": o nome conhecido mais parecido com o que foi escrito.
// Só sugere quando a diferença é pequena (até 1 letra entre nomes curtos, até 2 nos maiores).
export function suggest(
  written: string,
  known: Iterable<string>,
): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const name of known) {
    if (name === written) {
      continue;
    }
    const distance =
      name.toLowerCase() === written.toLowerCase()
        ? 0
        : editDistance(written, name);
    const limit = Math.max(written.length, name.length) <= 4 ? 1 : 2;
    if (distance <= limit && distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

// Texto pronto para o fim de uma mensagem de erro (ou vazio)
export function didYouMean(written: string, known: Iterable<string>): string {
  const name = suggest(written, known);
  return name === undefined ? '' : `. Você quis dizer "${name}"?`;
}

// Distância de Levenshtein: inserções, remoções e trocas de uma letra
function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
