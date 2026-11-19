import { useState } from 'react';
import { visibleLines, type EventLine } from '../logic/events.js';

interface Props {
  log: EventLine[];
  robotIds: number[];
}

// Do mais novo para o mais antigo. Os passos de rotina ficam escondidos por padrão.
export function EventLog({ log, robotIds }: Props) {
  const [robot, setRobot] = useState<number | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const visible = visibleLines(log, { robot, showSteps });

  return (
    <aside className="log" aria-labelledby="log-title">
      <h2 id="log-title">Diário</h2>
      <div className="log-filters">
        <select
          aria-label="Filtrar por robô"
          value={robot ?? ''}
          onChange={(event) => {
            setRobot(
              event.target.value === '' ? null : Number(event.target.value),
            );
          }}
        >
          <option value="">Todos os robôs</option>
          {robotIds.map((id) => (
            <option key={id} value={id}>
              Robô {id}
            </option>
          ))}
        </select>
        <label>
          <input
            type="checkbox"
            checked={showSteps}
            onChange={(event) => {
              setShowSteps(event.target.checked);
            }}
          />
          Mostrar cada passo
        </label>
      </div>
      {visible.length === 0 ? (
        <p className="log-empty">
          Nada por aqui ainda. Rode um script ou envie ordens e toque o relógio.
        </p>
      ) : (
        <ol className="log-lines">
          {visible.map((line) => (
            <li key={line.id} className={`log-line log-${line.tone}`}>
              <span className="log-when">
                tick {line.tick}, robô {line.robot}
              </span>
              <span className="log-text">{line.text}</span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
