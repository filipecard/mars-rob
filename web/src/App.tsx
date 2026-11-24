import { useCallback, useMemo, useState } from 'react';
import { ApiClient } from './api/client.js';
import { useSimulation } from './api/useSimulation.js';
import { ClockControls } from './components/ClockControls.js';
import { OrdersBar } from './components/OrdersBar.js';
import { ReferencePanel } from './components/ReferencePanel.js';
import { RobotPanel } from './components/RobotPanel.js';
import { SaveControls } from './components/SaveControls.js';

const CONNECTION_TEXT = {
  connecting: 'Conectando',
  open: 'Conectado',
  closed: 'Sem conexão, tentando de novo',
} as const;

export function App() {
  const api = useMemo(() => new ApiClient(), []);
  const { update, errors, connection, clearError } = useSimulation();
  const [showReference, setShowReference] = useState(false);
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

function formatItems(items: Record<string, number>): string {
  const names: Record<string, string> = {
    branch: 'galhos',
    stone: 'pedras',
    log: 'troncos',
    iron: 'ferros',
  };
  const list = Object.entries(items)
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${String(count)} ${names[kind] ?? kind}`);
  return list.length === 0 ? 'vazio' : list.join(', ');
}
