import { useEffect, useState } from 'react';
import { lastErrors, type ScriptErrorInfo } from '../logic/events.js';
import type { UpdateMessage } from './types.js';

export type Connection = 'connecting' | 'open' | 'closed';

export interface SimulationView {
  update: UpdateMessage | null;
  // Último erro de execução de cada robô (some ao rodar outro script)
  errors: ReadonlyMap<number, ScriptErrorInfo>;
  connection: Connection;
  clearError: (robotId: number) => void;
}

const RETRY_MS = 1500;

// Recebe o estado e os eventos pelo WebSocket; reconecta se a conexão cair
export function useSimulation(): SimulationView {
  const [update, setUpdate] = useState<UpdateMessage | null>(null);
  const [errors, setErrors] = useState<ReadonlyMap<number, ScriptErrorInfo>>(
    () => new Map(),
  );
  const [connection, setConnection] = useState<Connection>('connecting');

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = (): void => {
      setConnection('connecting');
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://${location.host}/ws`);
      socket.onopen = () => {
        setConnection('open');
      };
      socket.onmessage = (message: MessageEvent<string>) => {
        const data = JSON.parse(message.data) as UpdateMessage;
        setUpdate(data);
        if (data.events.length === 0) {
          return;
        }
        const found = lastErrors(data.events);
        if (found.size > 0) {
          setErrors((current) => new Map([...current, ...found]));
        }
      };
      socket.onclose = () => {
        setConnection('closed');
        if (!stopped) {
          retry = setTimeout(connect, RETRY_MS);
        }
      };
    };
    connect();

    return () => {
      stopped = true;
      if (retry !== null) {
        clearTimeout(retry);
      }
      socket?.close();
    };
  }, []);

  const clearError = (robotId: number): void => {
    setErrors((current) => {
      const next = new Map(current);
      next.delete(robotId);
      return next;
    });
  };

  return { update, errors, connection, clearError };
}
