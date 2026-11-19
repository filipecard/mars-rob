import type { OrderResult } from '../api/types.js';

// Texto das ordens recusadas, como na CLI
export function rejectionText(result: OrderResult): string | null {
  if (result.ok) {
    return null;
  }
  switch (result.error) {
    case 'INVALID_ORDER':
      return `"${result.input}" não é uma ordem: use ID:COMANDOS (1:NNDE) ou DE>PARA (1>2)`;
    case 'INVALID_COMMAND':
      return `"${result.input}" tem letras inválidas: use só N, S, L, O, D, E`;
    case 'UNKNOWN_ROBOT':
      return `"${result.input}": não existe robô com ID ${String(result.robotId)}`;
  }
}
