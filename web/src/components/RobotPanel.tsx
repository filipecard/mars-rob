import { useEffect, useState } from 'react';
import type { ApiClient } from '../api/client.js';
import type { RobotStatusDTO } from '../api/types.js';
import type { ScriptErrorInfo } from '../logic/events.js';
import { exploration, ORIENTATION_NAMES } from '../logic/mapCells.js';
import { loadSavedScript, saveScript } from '../logic/scripts.js';
import { MapGrid } from './MapGrid.js';
import { ScriptEditor } from './ScriptEditor.js';

interface Props {
  robot: RobotStatusDTO;
  api: ApiClient;
  runtimeError: ScriptErrorInfo | null;
  onClearError: () => void;
}

const PROGRAM_LABELS = {
  orders: 'Cumprindo ordens',
  script: 'Rodando script',
} as const;

export function RobotPanel({ robot, api, runtimeError, onClearError }: Props) {
  const [source, setSource] = useState(() =>
    loadSavedScript(localStorage, robot.id),
  );
  const [syntaxError, setSyntaxError] = useState<ScriptErrorInfo | null>(null);
  const { map } = robot;
  const { known, total } = exploration(map);
  const error = syntaxError ?? runtimeError;
  const editorId = `script-${String(robot.id)}`;

  const change = (value: string): void => {
    setSource(value);
    saveScript(localStorage, robot.id, value);
  };

  const run = async (): Promise<void> => {
    const result = await api.loadScript(robot.id, source);
    onClearError();
    setSyntaxError(
      result.ok || result.error !== 'SYNTAX'
        ? null
        : {
            line: result.line,
            column: result.column,
            message: result.message,
          },
    );
  };

  return (
    <article className="robot" aria-labelledby={`robot-${String(robot.id)}`}>
      <header className="robot-head">
        <h2 id={`robot-${String(robot.id)}`}>Robô {robot.id}</h2>
        <p className={`status status-${robot.program ?? 'idle'}`}>
          {robot.program === null ? 'Parado' : PROGRAM_LABELS[robot.program]}
        </p>
      </header>
      <MapGrid map={map} />
      <div className="robot-map-row">
        <p className="robot-facts">
          Em ({map.robot.x}, {map.robot.y}), olhando para o{' '}
          {ORIENTATION_NAMES[map.robot.orientation]}. Conhece {known} de {total}{' '}
          casas.
        </p>
        <ForgetMapButton onConfirm={() => void api.forgetMap(robot.id)} />
      </div>
      <label className="editor-label" htmlFor={editorId}>
        Script
      </label>
      <ScriptEditor
        id={editorId}
        value={source}
        onChange={change}
        errorLine={error?.line ?? null}
      />
      {error !== null && (
        <p className="script-error" role="alert">
          {syntaxError === null ? 'Parou com erro na' : 'Erro de sintaxe na'}{' '}
          linha {error.line}, coluna {error.column}: {error.message}
        </p>
      )}
      <div className="robot-actions">
        <button type="button" className="primary" onClick={() => void run()}>
          Rodar script
        </button>
        <button
          type="button"
          disabled={robot.program === null}
          onClick={() => void api.stopProgram(robot.id)}
        >
          Parar
        </button>
      </div>
    </article>
  );
}

// RN20: apagar o mapa pede confirmação no próprio botão (sem janela do navegador).
// O pedido some sozinho depois de alguns segundos ou quando o botão perde o foco.
function ForgetMapButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = setTimeout(() => {
      setConfirming(false);
    }, 4000);
    return () => {
      clearTimeout(timer);
    };
  }, [confirming]);

  return (
    <button
      type="button"
      className={confirming ? 'danger' : undefined}
      onClick={() => {
        if (confirming) {
          setConfirming(false);
          onConfirm();
        } else {
          setConfirming(true);
        }
      }}
      onBlur={() => {
        setConfirming(false);
      }}
    >
      {confirming ? 'Confirmar: apagar' : 'Apagar mapa'}
    </button>
  );
}
