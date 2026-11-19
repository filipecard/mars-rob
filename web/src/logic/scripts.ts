// Os scripts ficam no navegador (localStorage), um por robô

export const EXAMPLE_SCRIPT = `// Anda reto; quando algo bloqueia a frente, vira à direita
while (true) {
  if (front().isEmpty) {
    forward()
  } else {
    turnRight()
  }
}
`;

export interface ScriptStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const keyOf = (robotId: number): string => `mars-rob:script:${String(robotId)}`;

export function loadSavedScript(
  storage: ScriptStorage,
  robotId: number,
): string {
  return storage.getItem(keyOf(robotId)) ?? EXAMPLE_SCRIPT;
}

export function saveScript(
  storage: ScriptStorage,
  robotId: number,
  source: string,
): void {
  storage.setItem(keyOf(robotId), source);
}

// Tab no editor: insere 2 espaços no cursor
export function insertIndent(
  source: string,
  start: number,
  end: number,
): { source: string; cursor: number } {
  return {
    source: `${source.slice(0, start)}  ${source.slice(end)}`,
    cursor: start + 2,
  };
}
