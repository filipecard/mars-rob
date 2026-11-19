import { useState, type SyntheticEvent } from 'react';
import type { ApiClient } from '../api/client.js';
import { rejectionText } from '../logic/orders.js';

// Ordens diretas, como na CLI: andam 1 passo por tick quando o relógio corre
export function OrdersBar({ api }: { api: ApiClient }) {
  const [line, setLine] = useState('');
  const [rejected, setRejected] = useState<string[]>([]);

  const submit = async (event: SyntheticEvent): Promise<void> => {
    event.preventDefault();
    const results = await api.sendOrders(line);
    const texts = results.map(rejectionText).filter((text) => text !== null);
    setRejected(texts);
    if (texts.length === 0) {
      setLine('');
    }
  };

  return (
    <form className="orders" onSubmit={(event) => void submit(event)}>
      <label htmlFor="orders-line">Ordens</label>
      <input
        id="orders-line"
        value={line}
        placeholder="1:NNDE 2:L 1>2"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setLine(event.target.value);
        }}
      />
      <button type="submit">Enviar ordens</button>
      {rejected.length > 0 && (
        <ul className="orders-rejected" role="alert">
          {rejected.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      )}
    </form>
  );
}
