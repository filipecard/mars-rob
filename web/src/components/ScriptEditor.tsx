import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import {
  applySuggestion,
  complete,
  lineAndColumn,
  type CompletionContext,
  type Suggestion,
} from '../logic/completion.js';
import { KIND_LABELS } from '../logic/reference.js';
import { insertIndent } from '../logic/scripts.js';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Linha com erro, destacada na margem
  errorLine: number | null;
  insertRequest?: { text: string; id: number } | null;
}

const MAX_SHOWN = 8;

// Textarea com números de linha e autocomplete.
// Sugestões: aparecem ao digitar um nome ou um ponto; Ctrl+Espaço abre na hora.
// ↑/↓ escolhem, Enter ou Tab aceitam, Esc fecha. Tab sem sugestão indenta.
export function ScriptEditor({
  id,
  value,
  onChange,
  errorLine,
  insertRequest = null,
}: Props) {
  const gutter = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [cursor, setCursor] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const lines = value.split('\n').length;

  const context: CompletionContext | null = useMemo(
    () => (open ? complete(value, cursor) : null),
    [open, value, cursor],
  );
  const shown = context?.suggestions.slice(0, MAX_SHOWN) ?? [];
  const active = shown[Math.min(selected, shown.length - 1)];

  useEffect(() => {
    setSelected(0);
  }, [context?.from, context?.prefix]);

  const place = (next: { source: string; cursor: number }): void => {
    onChange(next.source);
    setCursor(next.cursor);
    requestAnimationFrame(() => {
      const element = area.current;
      if (element !== null) {
        element.selectionStart = next.cursor;
        element.selectionEnd = next.cursor;
      }
    });
  };

  useEffect(() => {
    if (insertRequest === null || area.current === null) return;
    const element = area.current;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const source =
      value.slice(0, start) + insertRequest.text + value.slice(end);
    place({ source, cursor: start + insertRequest.text.length });
    element.focus();
    setOpen(false);
  }, [insertRequest]);

  const accept = (suggestion: Suggestion): void => {
    if (context === null) {
      return;
    }
    setOpen(false);
    place(applySuggestion(value, cursor, context, suggestion));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === ' ' && event.ctrlKey) {
      event.preventDefault();
      setCursor(event.currentTarget.selectionStart);
      setOpen(true);
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      setOpen(false);
      return;
    }
    if (active !== undefined) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setSelected((index) => (index + step + shown.length) % shown.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        accept(active);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
    }
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault();
      const element = event.currentTarget;
      place(insertIndent(value, element.selectionStart, element.selectionEnd));
    }
  };

  // Posição da lista: logo abaixo do começo da palavra
  const anchor = context === null ? null : lineAndColumn(value, context.from);

  return (
    <div className="editor">
      <div className="gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={index + 1 === errorLine ? 'gutter-error' : undefined}
          >
            {index + 1}
          </span>
        ))}
      </div>
      <div className="editor-body">
        <textarea
          ref={area}
          id={id}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={active !== undefined}
          aria-controls={listId}
          aria-activedescendant={
            active === undefined
              ? undefined
              : `${listId}-${String(shown.indexOf(active))}`
          }
          onChange={(event) => {
            const text = event.target.value;
            const at = event.target.selectionStart;
            onChange(text);
            setCursor(at);
            // Abre ao digitar uma letra, número, _ ou ponto; fecha com outros caracteres
            const typed = text.length > value.length ? text[at - 1] : undefined;
            setOpen(typed === undefined ? open : /[\w.]/.test(typed));
          }}
          onKeyDown={onKeyDown}
          onClick={() => {
            setOpen(false);
          }}
          onBlur={() => {
            setOpen(false);
          }}
          onScroll={(event) => {
            const { scrollTop, scrollLeft } = event.currentTarget;
            setScroll({ top: scrollTop, left: scrollLeft });
            if (gutter.current !== null) {
              gutter.current.scrollTop = scrollTop;
            }
          }}
        />
        {active !== undefined && anchor !== null && (
          <div
            className="completion"
            style={{
              top: `calc(${String(anchor.line + 1)} * 1.5em + 0.5rem - ${String(scroll.top)}px)`,
              left: `calc(${String(anchor.column)}ch + 0.65rem - ${String(scroll.left)}px)`,
            }}
          >
            <ul id={listId} role="listbox" aria-label="Sugestões">
              {shown.map((suggestion, index) => (
                <li
                  key={`${suggestion.kind}:${suggestion.label}`}
                  id={`${listId}-${String(index)}`}
                  role="option"
                  aria-selected={suggestion === active}
                  className={suggestion === active ? 'active' : undefined}
                  // mousedown para não tirar o foco do textarea antes de aceitar
                  onMouseDown={(event) => {
                    event.preventDefault();
                    accept(suggestion);
                  }}
                >
                  <span className="completion-label">{suggestion.label}</span>
                  <span className="completion-kind">
                    {suggestion.kind === 'declared'
                      ? 'seu'
                      : KIND_LABELS[suggestion.kind]}
                  </span>
                </li>
              ))}
            </ul>
            <div className="completion-detail">
              <code>{active.detail}</code>
              <p>{active.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
