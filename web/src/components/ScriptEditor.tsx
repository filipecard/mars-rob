import { useRef, type KeyboardEvent } from 'react';
import { insertIndent } from '../logic/scripts.js';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  // Linha com erro, destacada na margem
  errorLine: number | null;
}

// Textarea com números de linha; Tab indenta (Esc e depois Tab sai do campo)
export function ScriptEditor({ id, value, onChange, errorLine }: Props) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Tab' || event.shiftKey) {
      return;
    }
    event.preventDefault();
    const area = event.currentTarget;
    const next = insertIndent(value, area.selectionStart, area.selectionEnd);
    onChange(next.source);
    requestAnimationFrame(() => {
      area.selectionStart = next.cursor;
      area.selectionEnd = next.cursor;
    });
  };

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
      <textarea
        id={id}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
        }}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          if (gutter.current !== null) {
            gutter.current.scrollTop = event.currentTarget.scrollTop;
          }
        }}
      />
    </div>
  );
}
