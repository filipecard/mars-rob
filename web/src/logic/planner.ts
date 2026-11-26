import type { MapDTO } from '../api/types.js';

export function routeCommands(map: MapDTO, target: { x: number; y: number }): string | null {
  const known = new Set(map.explored.filter((c) => !c.blocked).map((c) => `${c.x},${c.y}`));
  const start = { x: map.robot.x, y: map.robot.y };
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  if (!known.has(key(target))) return null;
  const queue = [start];
  const previous = new Map<string, { x: number; y: number } | null>([[key(start), null]]);
  while (queue.length) {
    const at = queue.shift()!;
    if (key(at) === key(target)) break;
    for (const next of [{ x: at.x + 1, y: at.y }, { x: at.x - 1, y: at.y }, { x: at.x, y: at.y + 1 }, { x: at.x, y: at.y - 1 }]) {
      if (known.has(key(next)) && !previous.has(key(next))) { previous.set(key(next), at); queue.push(next); }
    }
  }
  if (!previous.has(key(target))) return null;
  const path = [target];
  while (key(path[0]!) !== key(start)) path.unshift(previous.get(key(path[0]!))!);
  const dirs = { '0,1': 'N', '1,0': 'L', '0,-1': 'S', '-1,0': 'O' } as const;
  const order = ['N', 'L', 'S', 'O'];
  let facing = order.indexOf(map.robot.orientation);
  let commands = '';
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!; const b = path[i]!;
    const direction = dirs[`${b.x - a.x},${b.y - a.y}` as keyof typeof dirs];
    const desired = order.indexOf(direction);
    const delta = (desired - facing + 4) % 4;
    if (delta === 1) commands += 'D';
    else if (delta === 2) commands += 'DD';
    else if (delta === 3) commands += 'E';
    commands += 'N'; facing = desired;
  }
  return commands;
}
