import { InvalidOrderError } from '../errors/InvalidOrderError.js';
import { Command } from './Command.js';

// RN14: "ID:COMANDOS" move um robô, ex.: "1:NNDE"
export interface MoveOrder {
  readonly kind: 'move';
  readonly robotId: number;
  readonly command: Command;
}

// RN16: "DE>PARA" faz um robô enviar o mapa para outro, ex.: "1>2"
export interface ShareOrder {
  readonly kind: 'share';
  readonly from: number;
  readonly to: number;
}

export type Order = MoveOrder | ShareOrder;

// IDs sem zero à esquerda
const MOVE_PATTERN = /^([1-9]\d*):(.*)$/s;
const SHARE_PATTERN = /^([1-9]\d*)>([1-9]\d*)$/;

// Formato errado: InvalidOrderError. Letras erradas no comando: InvalidCommandError (RN07).
export function parseOrder(input: string): Order {
  const move = MOVE_PATTERN.exec(input);
  if (move !== null) {
    const [, id = '', command = ''] = move;
    return Object.freeze({
      kind: 'move',
      robotId: Number(id),
      command: Command.parse(command),
    });
  }
  const share = SHARE_PATTERN.exec(input);
  if (share !== null) {
    const [, from = '', to = ''] = share;
    // RN16: um robô não compartilha o mapa consigo mesmo
    if (from !== to) {
      return Object.freeze({
        kind: 'share',
        from: Number(from),
        to: Number(to),
      });
    }
  }
  throw new InvalidOrderError(input);
}

// RN14: as ordens de uma linha são separadas por espaços
export function splitOrders(line: string): string[] {
  return line.split(/\s+/).filter((token) => token !== '');
}
