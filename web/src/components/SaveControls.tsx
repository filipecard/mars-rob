import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';

export function SaveControls({ api }: { api: ApiClient }) {
  const [name, setName] = useState('partida1');
  const [saves, setSaves] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  const refresh = async (): Promise<void> => {
    setSaves(await api.listSaves());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const save = async (): Promise<void> => {
    const result = await api.saveGame(name);
    setMessage(
      result.ok
        ? `Salva no tick ${String(result.tick)}.`
        : 'Nome inválido. Use letras, números, _ ou - (até 40 caracteres).',
    );
    if (result.ok) await refresh();
  };

  const load = async (): Promise<void> => {
    const result = await api.loadGame(name);
    setMessage(
      result.ok
        ? `Carregada no tick ${String(result.tick)}.`
        : result.error === 'NOT_FOUND'
          ? 'Save não encontrado.'
          : 'Não foi possível carregar esse save.',
    );
    if (result.ok) await refresh();
  };

  return (
    <section className="save-controls" aria-label="Salvar e carregar simulação">
      <label htmlFor="save-name">Partida</label>
      <input
        id="save-name"
        value={name}
        list="save-names"
        maxLength={40}
        onChange={(event) => {
          setName(event.target.value);
        }}
      />
      <datalist id="save-names">
        {saves.map((saveName) => (
          <option key={saveName} value={saveName} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={() => {
          void save();
        }}
      >
        Salvar
      </button>
      <button
        type="button"
        onClick={() => {
          void load();
        }}
      >
        Carregar
      </button>
      <button
        type="button"
        onClick={() => {
          void refresh();
        }}
      >
        Atualizar lista
      </button>
      {message !== '' && <span role="status">{message}</span>}
    </section>
  );
}
