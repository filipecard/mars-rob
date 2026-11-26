import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiClient } from './api/client.js';
import { useSimulation } from './api/useSimulation.js';
import { ClockControls } from './components/ClockControls.js';
import { OrdersBar } from './components/OrdersBar.js';
import { ReferencePanel } from './components/ReferencePanel.js';
import { RobotPanel } from './components/RobotPanel.js';
import { SaveControls } from './components/SaveControls.js';
import type { RobotStatusDTO, UpgradeDTO } from './api/types.js';

const CONNECTION_TEXT = {
  connecting: 'Conectando',
  open: 'Conectado',
  closed: 'Sem conexão, tentando de novo',
} as const;

export function App() {
  const api = useMemo(() => new ApiClient(), []);
  const { update, errors, connection, clearError } = useSimulation();
  const [showReference, setShowReference] = useState(false);
  const [messages, setMessages] = useState<{ from: number; to: number; text: string; tick: number }[]>([]);
  useEffect(() => { void api.listMessages().then(setMessages).catch(() => undefined); }, [api]);
  const closeReference = useCallback(() => {
    setShowReference(false);
  }, []);

  return (
    <div className="app">
      <header className="top">
        <h1 className="brand">mars-rob</h1>
        {update !== null && (
          <ClockControls
            tick={update.state.tick}
            clock={update.clock}
            api={api}
          />
        )}
        <button
          type="button"
          className="reference-toggle"
          aria-expanded={showReference}
          onClick={() => {
            setShowReference((open) => !open);
          }}
        >
          Referência
        </button>
        <p className={`connection connection-${connection}`}>
          {CONNECTION_TEXT[connection]}
        </p>
      </header>

      {update !== null && (
        <BaseUpgradePanel
          robots={update.state.robots.filter((robot) => robot.atBase)}
          warehouse={update.state.warehouse.items}
          api={api}
        />
      )}

      {update === null ? (
        <main className="waiting">
          <p>
            Esperando o servidor. Na raiz do projeto, rode{' '}
            <code>npm run dev -- --servidor</code>.
          </p>
        </main>
      ) : (
        <>
          <div className="bar">
            <OrdersBar api={api} />
            <SaveControls api={api} />
            <p className="grid-summary">
              Malha de {update.state.fleet.min} a {update.state.fleet.max},{' '}
              {update.state.fleet.obstacleCount} obstáculos,{' '}
              {update.state.fleet.robotCount}{' '}
              {update.state.fleet.robotCount === 1 ? 'robô' : 'robôs'}
            </p>
          </div>
          <p className="warehouse-summary">
            Armazém da base: {update.state.warehouse.used}/
            {update.state.warehouse.capacity} espaços ·{' '}
            {formatItems(update.state.warehouse.items)}
          </p>
          <ProgressPanel state={update.state} />
          {update.state.robots.length > 1 && <MessagePanel robots={update.state.robots} messages={messages} onSend={async (from, to, text) => { setMessages(await api.sendMessage(from, to, text)); }} />}
          <main className="robots">
            {update.state.robots.map((robot) => (
              <RobotPanel
                key={robot.id}
                robot={robot}
                api={api}
                runtimeError={errors.get(robot.id) ?? null}
                onClearError={() => {
                  clearError(robot.id);
                }}
              />
            ))}
          </main>
        </>
      )}
      {showReference && <ReferencePanel onClose={closeReference} />}
    </div>
  );
}

const UPGRADE_LABELS: Record<UpgradeDTO, string> = {
  pickaxe: 'Picareta',
  battery: 'Bateria',
  cargo: 'Compartimento',
  vision: 'Visão',
  warehouse: 'Armazém da base',
};

const ITEM_NAMES: Record<string, string> = {
  branch: 'galhos',
  stone: 'pedras',
  log: 'troncos',
  iron: 'ferros',
};

function BaseUpgradePanel({
  robots,
  warehouse,
  api,
}: {
  robots: RobotStatusDTO[];
  warehouse: Record<string, number>;
  api: ApiClient;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  if (robots.length === 0) return null;
  const robot = robots.find((candidate) => candidate.id === selectedId) ?? robots[0]!;
  return (
    <aside className="base-upgrades" aria-label="Melhorias disponiveis na base">
      <header>
        <h2>Melhorias na base</h2>
        {robots.length > 1 && (
          <label>
            Robô
            <select value={robot.id} onChange={(event) => setSelectedId(Number(event.target.value))}>
              {robots.map((candidate) => <option key={candidate.id} value={candidate.id}>Robô {candidate.id}</option>)}
            </select>
          </label>
        )}
      </header>
      <p className="base-upgrades-condition">Para comprar: o robô precisa estar na base e o armazém precisa ter os materiais do nível desejado.</p>
      <p className="base-upgrades-stock">Materiais no armazém: {formatItems(warehouse)}</p>
      <ul>
        {robot.upgrades.map((offer) => (
          <li key={offer.upgrade}>
            <div className="base-upgrade-title">
              <strong>{UPGRADE_LABELS[offer.upgrade]}</strong>
              <span>Nível {offer.level}/{offer.maxLevel}</span>
            </div>
            <ol>
              {offer.costs.map(({ level, items }) => {
                const completed = level <= offer.level;
                const nextLevel = level === offer.level + 1;
                const missing = Object.entries(items).filter(([item, amount]) => amount > (warehouse[item] ?? 0));
                return (
                  <li key={level} className={completed ? 'upgrade-complete' : undefined}>
                    Nível {level}: {formatItems(items)}
                    <small>{completed ? 'Concluído' : !nextLevel ? `Disponível após o nível ${level - 1}` : missing.length === 0 ? 'Materiais disponíveis' : `Faltam: ${missing.map(([item, amount]) => `${amount - (warehouse[item] ?? 0)} ${ITEM_NAMES[item] ?? item}`).join(', ')}`}</small>
                  </li>
                );
              })}
            </ol>
            {offer.cost !== null && (
              <button type="button" disabled={!offer.available} onClick={() => {
                void api.upgradeRobot(robot.id, offer.upgrade).then((result) => {
                  setMessage(result.ok ? `${UPGRADE_LABELS[offer.upgrade]} melhorado.` : 'Nao foi possivel comprar esta melhoria.');
                });
              }}>
                Melhorar para nível {offer.level + 1}
              </button>
            )}
          </li>
        ))}
      </ul>
      {message !== '' && <p role="status">{message}</p>}
    </aside>
  );
}

function MessagePanel({ robots, messages, onSend }: { robots: import('./api/types.js').RobotStatusDTO[]; messages: { from: number; to: number; text: string; tick: number }[]; onSend: (from: number, to: number, text: string) => Promise<void> }) {
  const [from, setFrom] = useState(robots[0]?.id ?? 1);
  const [to, setTo] = useState(robots[1]?.id ?? 2);
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState('');
  return <section className="message-panel" aria-label="Mensagens entre robôs"><h2>Comunicação entre robôs</h2><form onSubmit={(event) => { event.preventDefault(); void onSend(from, to, text).then(() => { setText(''); setFeedback('Mensagem entregue.'); }).catch((error: unknown) => setFeedback(error instanceof Error ? error.message : 'Não foi possível enviar.')); }}><label>De <select value={from} onChange={(event) => setFrom(Number(event.target.value))}>{robots.map((robot) => <option key={robot.id} value={robot.id}>Robô {robot.id}</option>)}</select></label><label>Para <select value={to} onChange={(event) => setTo(Number(event.target.value))}>{robots.filter((robot) => robot.id !== from).map((robot) => <option key={robot.id} value={robot.id}>Robô {robot.id}</option>)}</select></label><input aria-label="Mensagem" maxLength={240} value={text} onChange={(event) => setText(event.target.value)} placeholder="Escreva uma mensagem (até 240 caracteres)"/><button type="submit" disabled={!text.trim()}>Enviar</button></form>{feedback && <p role="status">{feedback}</p>}<ul>{messages.slice(-8).map((message, index) => <li key={`${message.tick}-${message.from}-${index}`}>Tick {message.tick} · Robô {message.from} → {message.to}: {message.text}</li>)}</ul></section>;
}

function ProgressPanel({ state }: { state: import('./api/types.js').SimulationDTO }) {
  const cells = state.robots.flatMap((robot) => robot.map.explored);
  const unique = new Set(cells.map(({ x, y }) => `${x},${y}`));
  const total = (state.fleet.max - state.fleet.min + 1) ** 2;
  const visited = new Set(state.robots.flatMap((robot) => robot.map.explored.filter((cell) => cell.visited).map(({ x, y }) => `${x},${y}`)));
  const items = Object.values(state.warehouse.items).reduce((sum, count) => sum + count, 0) + state.robots.reduce((sum, robot) => sum + Object.values(robot.cargo.items).reduce((subtotal, count) => subtotal + count, 0), 0);
  const upgrades = state.robots.reduce((sum, robot) => sum + robot.upgrades.reduce((subtotal, offer) => subtotal + offer.level, 0), 0);
  const goals = [
    { label: 'Explorar 10% do mapa', value: unique.size, target: Math.ceil(total * 0.1), unit: 'casas' },
    { label: 'Armazenar 5 itens', value: items, target: 5, unit: 'itens' },
    { label: 'Comprar uma melhoria', value: upgrades, target: 1, unit: 'níveis' },
  ];
  return <section className="progress-panel" aria-label="Missões e estatísticas">
    <h2>Missões e estatísticas</h2>
    <p>Mapa conhecido: {unique.size}/{total} casas · visitadas: {visited.size} · tick {state.tick}</p>
    <ul>{goals.map((goal) => <li key={goal.label}><span>{goal.value >= goal.target ? '✓' : '○'} {goal.label}</span><progress value={Math.min(goal.value, goal.target)} max={goal.target} /><small>{Math.min(goal.value, goal.target)}/{goal.target} {goal.unit}</small></li>)}</ul>
  </section>;
}

function formatItems(items: Record<string, number>): string {
  const list = Object.entries(items)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${String(count)} ${ITEM_NAMES[kind] ?? kind}`);
  return list.length === 0 ? 'vazio' : list.join(', ');
}
