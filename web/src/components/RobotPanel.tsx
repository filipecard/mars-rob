import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ApiClient } from '../api/client.js';
import type { RobotStatusDTO } from '../api/types.js';
import type { ScriptErrorInfo } from '../logic/events.js';
import { exploration, ORIENTATION_NAMES } from '../logic/mapCells.js';
import { loadSavedScript, saveScript } from '../logic/scripts.js';
import { routeCommands } from '../logic/planner.js';
import { MapGrid } from './MapGrid.js';
import { ScriptEditor } from './ScriptEditor.js';

interface Props {
  robot: RobotStatusDTO;
  outputs: { tick: number; robot: number; text: string }[];
  api: ApiClient;
  baseMenu: ReactNode;
  runtimeError: ScriptErrorInfo | null;
  onClearError: () => void;
  onClearOutputs: (robotId: number) => void;
}

const PROGRAM_LABELS = {
  orders: 'Cumprindo ordens',
  script: 'Rodando script',
} as const;

export function RobotPanel({ robot, outputs, api, baseMenu, runtimeError, onClearError, onClearOutputs }: Props) {
  const [source, setSource] = useState(() =>
    loadSavedScript(localStorage, robot.id),
  );
  const [syntaxError, setSyntaxError] = useState<ScriptErrorInfo | null>(null);
  const [insertRequest, setInsertRequest] = useState<{
    text: string;
    id: number;
  } | null>(null);
  const [insertId, setInsertId] = useState(0);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [planning, setPlanning] = useState(false);
  const [routeMessage, setRouteMessage] = useState('');
  const [robotName, setRobotName] = useState(() => localStorage.getItem(`mars-rob-name-${robot.id}`) ?? `Robô ${robot.id}`);
  const [robotColor, setRobotColor] = useState(() => localStorage.getItem(`mars-rob-color-${robot.id}`) ?? '#f3f7ff');
  const { map } = robot;
  const { known, total } = exploration(map);
  const error = syntaxError ?? runtimeError;
  const editorId = `script-${String(robot.id)}`;

  const change = (value: string): void => {
    setSource(value);
    saveScript(localStorage, robot.id, value);
  };

  const run = async (): Promise<void> => {
    onClearOutputs(robot.id);
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
        <div className="robot-identity"><span className="robot-color" style={{ background: robotColor }} /><input aria-label={`Nome do robô ${robot.id}`} value={robotName} maxLength={24} onChange={(event) => { setRobotName(event.target.value); localStorage.setItem(`mars-rob-name-${robot.id}`, event.target.value); }} /><input aria-label={`Cor do robô ${robot.id}`} type="color" value={robotColor} onChange={(event) => { setRobotColor(event.target.value); localStorage.setItem(`mars-rob-color-${robot.id}`, event.target.value); }} /></div>
        <h2 id={`robot-${String(robot.id)}`}>Robô {robot.id}</h2>
        <p className={`status status-${robot.program ?? 'idle'}`}>
          {robot.program === null ? 'Parado' : PROGRAM_LABELS[robot.program]}
        </p>
      </header>
      <div className="robot-workbench">
        <section className="robot-map-panel" aria-label="Mapa e recursos">
          <button type="button" aria-pressed={planning} onClick={() => { setPlanning(!planning); setRouteMessage(''); }}>{planning ? 'Cancelar rota' : 'Planejar rota'}</button>
          <MapGrid
            map={map}
            overlay={baseMenu}
            onCellClick={(x, y) => {
              if (planning) {
                const commands = routeCommands(map, { x, y });
                if (commands === null) setRouteMessage('Não há caminho conhecido até essa casa.');
                else if (commands === '') setRouteMessage('O robô já está nessa casa.');
                else void api.sendOrders(`${robot.id}:${commands}`).then(() => { setRouteMessage(`Rota enviada: ${commands.length} ações.`); setPlanning(false); });
                return;
              }
              setSelectedPosition(`(${String(x)}, ${String(y)})`);
              const id = insertId + 1;
              setInsertId(id);
              setInsertRequest({ text: `${String(x)}, ${String(y)}`, id });
            }}
          />
          {planning && <p className="robot-facts">Clique numa casa já explorada e livre para enviar uma rota segura.</p>}
          {routeMessage !== '' && <p role="status" className="robot-facts">{routeMessage}</p>}
          {selectedPosition !== null && (
            <p className="robot-facts">
              Posição selecionada: {selectedPosition} · coordenadas inseridas no
              cursor do script.
            </p>
          )}
          <div className="robot-map-row">
            <p className="robot-facts">
              Em ({map.robot.x}, {map.robot.y}), olhando para o{' '}
              {ORIENTATION_NAMES[map.robot.orientation]}. Conhece {known} de{' '}
              {total} casas.
            </p>
            <ForgetMapButton
              onConfirm={() => {
                void api.forgetMap(robot.id);
              }}
            />
          </div>
          <section
            className="robot-resources"
            aria-label={`Recursos do robô ${String(robot.id)}`}
          >
            <p>
              Bateria: {robot.battery}/{robot.maxBattery}
            </p>
            <p>
              Compartimento: {robot.cargo.used}/{robot.cargo.capacity} espaços
            </p>
            <UpgradePanel robot={robot} api={api} />
          </section>
        </section>
        <section className="robot-script-panel" aria-label="Editor do script">
          <div className="script-toolbar">
            <label className="editor-label" htmlFor={editorId}>
              Script
            </label>
            <div className="robot-actions">
              <button
                type="button"
                className="primary"
                onClick={() => void run()}
              >
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
          </div>
          <ScriptEditor
            id={editorId}
            value={source}
            onChange={change}
            errorLine={error?.line ?? null}
            insertRequest={insertRequest}
          />
          {error !== null && (
            <p className="script-error" role="alert">
              {syntaxError === null
                ? 'Parou com erro na'
                : 'Erro de sintaxe na'}{' '}
              linha {error.line}, coluna {error.column}: {error.message}
            </p>
          )}
          <section className="script-output" aria-label={`Saídas do robô ${robot.id}`}>
            <header>
              <h3>Saídas</h3>
              <button type="button" disabled={!outputs.some((line) => line.robot === robot.id)} onClick={() => onClearOutputs(robot.id)}>Limpar</button>
            </header>
            {outputs.filter((line) => line.robot === robot.id).length === 0 ? (
              <p className="script-output-empty">Chame <code>inventory()</code> ou <code>warehouse()</code> no script para listar os itens aqui.</p>
            ) : (
              <ol>{outputs.filter((line) => line.robot === robot.id).map((line, index) => <li key={`${line.tick}-${index}`}><small>tick {line.tick}</small><code>{line.text}</code></li>)}</ol>
            )}
          </section>
        </section>
      </div>
    </article>
  );
}

const UPGRADE_NAMES: Record<string, string> = {
  pickaxe: 'Picareta',
  axe: 'Machado',
  battery: 'Bateria +50',
  cargo: 'Compartimento +5',
  vision: 'Visão 5×5',
  warehouse: 'Armazem +10',
};

function UpgradePanel({
  robot,
  api,
}: {
  robot: RobotStatusDTO;
  api: ApiClient;
}) {
  const [message, setMessage] = useState('');
  return (
    <div className="upgrade-panel">
      <strong>
        Melhorias {robot.atBase ? '(na base)' : '(disponíveis na base)'}
      </strong>
      <ul>
        {robot.upgrades.map((offer) => (
          <li key={offer.upgrade}>
            <span>
              {UPGRADE_NAMES[offer.upgrade] ?? offer.upgrade} · nível{' '}
              {offer.level}/{offer.maxLevel}
            </span>
            {offer.cost !== null && (
              <small> Custo: {formatItems(offer.cost)}</small>
            )}
            <button
              type="button"
              disabled={!offer.available}
              onClick={() => {
                void api
                  .upgradeRobot(robot.id, offer.upgrade)
                  .then((result) => {
                    setMessage(
                      result.ok
                        ? 'Melhoria comprada.'
                        : 'Não foi possível comprar a melhoria.',
                    );
                  });
              }}
            >
              Comprar
            </button>
          </li>
        ))}
      </ul>
      {message !== '' && <span role="status">{message}</span>}
    </div>
  );
}

function formatItems(items: Record<string, number>): string {
  const names: Record<string, string> = {
    branch: 'galhos',
    stone: 'pedras',
    log: 'troncos',
    hardwood: 'madeira nobre',
    ancientWood: 'madeira ancestral',
    copper: 'cobre',
    iron: 'ferros',
    gold: 'ouro',
    diamond: 'diamantes',
  };
  const list = Object.entries(items)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${String(count)} ${names[kind] ?? kind}`);
  return list.length === 0 ? 'vazio' : list.join(', ');
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
