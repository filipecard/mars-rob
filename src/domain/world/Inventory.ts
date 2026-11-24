import {
  ITEM_KINDS,
  ITEM_SIZES,
  noItems,
  type ItemCounts,
  type ItemKind,
} from './Item.js';

// RN25: itens guardados, limitados pelo espaço (cada item ocupa ITEM_SIZES[tipo])
export class Inventory {
  #capacity: number;
  readonly #counts: ItemCounts;

  constructor(capacity: number, counts: Partial<ItemCounts> = {}) {
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError('A capacidade deve ser um inteiro >= 0');
    }
    this.#capacity = capacity;
    this.#counts = { ...noItems(), ...counts };
    if (this.used > capacity) {
      throw new RangeError('Os itens não cabem na capacidade');
    }
  }

  get capacity(): number {
    return this.#capacity;
  }

  get used(): number {
    return ITEM_KINDS.reduce(
      (total, kind) => total + this.#counts[kind] * ITEM_SIZES[kind],
      0,
    );
  }

  get isEmpty(): boolean {
    return this.used === 0;
  }

  counts(): ItemCounts {
    return { ...this.#counts };
  }

  count(kind: ItemKind): number {
    return this.#counts[kind];
  }

  // Os itens um a um, na ordem de ITEM_KINDS
  list(): ItemKind[] {
    return ITEM_KINDS.flatMap((kind) =>
      Array.from({ length: this.#counts[kind] }, () => kind),
    );
  }

  fits(kind: ItemKind): boolean {
    return this.used + ITEM_SIZES[kind] <= this.#capacity;
  }

  add(kind: ItemKind): boolean {
    if (!this.fits(kind)) {
      return false;
    }
    this.#counts[kind]++;
    return true;
  }

  grow(amount: number): void {
    this.#capacity += amount;
  }

  has(items: Partial<ItemCounts>): boolean {
    return ITEM_KINDS.every((kind) => this.#counts[kind] >= (items[kind] ?? 0));
  }

  // O que falta para ter `items` (zerado no que já tem)
  missing(items: Partial<ItemCounts>): ItemCounts {
    const result = noItems();
    for (const kind of ITEM_KINDS) {
      result[kind] = Math.max(0, (items[kind] ?? 0) - this.#counts[kind]);
    }
    return result;
  }

  // Tira os itens; devolve false (sem tirar nada) se faltar algum
  take(items: Partial<ItemCounts>): boolean {
    if (!this.has(items)) {
      return false;
    }
    for (const kind of ITEM_KINDS) {
      this.#counts[kind] -= items[kind] ?? 0;
    }
    return true;
  }

  // Passa para `other` tudo o que couber, dos itens maiores para os menores.
  // Devolve quantos itens passaram.
  transferTo(other: Inventory): number {
    let moved = 0;
    const bySize = [...ITEM_KINDS].sort((a, b) => ITEM_SIZES[b] - ITEM_SIZES[a]);
    for (const kind of bySize) {
      while (this.#counts[kind] > 0 && other.add(kind)) {
        this.#counts[kind]--;
        moved++;
      }
    }
    return moved;
  }
}
