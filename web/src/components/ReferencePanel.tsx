import { useEffect, useRef, useState } from 'react';
import { ENTRIES, EXAMPLES, SECTIONS, type Entry } from '../logic/reference.js';

interface Props {
  onClose: () => void;
}

const matches = (entry: Entry, query: string): boolean => {
  const q = query.trim().toLowerCase();
  return (
    q === '' ||
    entry.signature.toLowerCase().includes(q) ||
    entry.description.toLowerCase().includes(q)
  );
};

// Painel lateral com tudo o que um script pode usar. Esc fecha.
export function ReferencePanel({ onClose }: Props) {
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    search.current?.focus();
    const onKey = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const copy = async (title: string, source: string): Promise<void> => {
    await navigator.clipboard.writeText(source);
    setCopied(title);
  };

  const sections = SECTIONS.map((section) => ({
    ...section,
    entries: ENTRIES.filter(
      (entry) => section.kinds.includes(entry.kind) && matches(entry, query),
    ),
  })).filter((section) => section.entries.length > 0);

  return (
    <aside className="reference" aria-labelledby="reference-title">
      <header className="reference-head">
        <h2 id="reference-title">Referência</h2>
        <button type="button" onClick={onClose} aria-label="Fechar referência">
          Fechar
        </button>
      </header>
      <input
        ref={search}
        type="search"
        className="reference-search"
        placeholder="Buscar (ex.: casa, gira, unknown)"
        aria-label="Buscar na referência"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      <p className="reference-tip">
        No editor, as sugestões aparecem enquanto você digita. <kbd>Ctrl</kbd>+
        <kbd>Espaço</kbd> abre a lista, <kbd>↑</kbd>/<kbd>↓</kbd> escolhem,{' '}
        <kbd>Enter</kbd> ou <kbd>Tab</kbd> aceitam e <kbd>Esc</kbd> fecha.
      </p>

      {sections.map((section) => (
        <section key={section.title} className="reference-section">
          <h3>{section.title}</h3>
          <p className="reference-intro">{section.intro}</p>
          <dl>
            {section.entries.map((entry) => (
              <div key={`${entry.kind}:${entry.name}`}>
                <dt>
                  <code>{entry.signature}</code>
                </dt>
                <dd>{entry.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      {sections.length === 0 && (
        <p className="reference-intro">Nada encontrado para “{query}”.</p>
      )}

      {query.trim() === '' && (
        <section className="reference-section">
          <h3>Exemplos</h3>
          {EXAMPLES.map((example) => (
            <figure key={example.title} className="reference-example">
              <figcaption>
                {example.title}
                <button
                  type="button"
                  onClick={() => void copy(example.title, example.source)}
                >
                  {copied === example.title ? 'Copiado' : 'Copiar'}
                </button>
              </figcaption>
              <pre>{example.source}</pre>
            </figure>
          ))}
          <p className="reference-intro">
            Limites: até 10.000 operações entre duas ações (um laço sem ação
            vira erro) e até 200 chamadas de função aninhadas.
          </p>
        </section>
      )}
    </aside>
  );
}
