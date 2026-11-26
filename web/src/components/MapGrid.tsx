import { memo, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MapDTO } from '../api/types.js';
import {
  mapRows,
  ORIENTATION_ARROWS,
  type MapCell,
} from '../logic/mapCells.js';

function label(cell: MapCell): string {
  if (cell.kind === 'self' && cell.orientation !== null) {
    return ORIENTATION_ARROWS[cell.orientation];
  }
  if (cell.kind === 'other') return String(cell.robotId);
  if (cell.kind === 'obstacle') {
    return cell.ground === 'tree' ? 'T' : cell.ground === 'ore' ? '$' : 'R';
  }
  return '';
}

const LEGEND = [
  ['visited', 'Pisou'],
  ['seen', 'Só viu'],
  ['obstacle', 'Obstáculo'],
  ['unknown', 'Desconhecido'],
] as const;

const MAP_DETAILS = [
  { classes: 'cell-unknown', symbol: '?', text: 'Casa que este robô ainda não viu' },
  { classes: 'cell-visited', symbol: '·', text: 'Casa onde este robô já pisou' },
  { classes: 'cell-seen', symbol: '·', text: 'Casa vista, mas ainda não visitada' },
  { classes: 'cell-obstacle', symbol: 'R', text: 'Rocha: bloqueia a passagem' },
  { classes: 'cell-obstacle', symbol: 'T', text: 'Árvore: bloqueia a passagem' },
  { classes: 'cell-obstacle', symbol: '$', text: 'Jazida: bloqueia a passagem' },
  { classes: 'cell-base', symbol: 'B', text: 'Base' },
  { classes: 'cell-visited', symbol: '', text: 'Casa livre sem item' },
  { classes: 'cell-self', symbol: '▲', text: 'Este robô; a seta indica para onde olha' },
  { classes: 'cell-other', symbol: '2', text: 'Outro robô; o número é o ID' },
  { classes: 'cell-seen ground-sand', symbol: '~', text: 'Areia: cada passo custa 2 de bateria' },
  { classes: 'cell-seen ground-ice', symbol: '_', text: 'Gelo: passos não gastam bateria' },
  { classes: 'cell-visited cell-item-branch', symbol: ',', text: 'Galho no chão' },
  { classes: 'cell-visited cell-item-stone', symbol: 'o', text: 'Pedra no chão' },
  { classes: 'cell-visited cell-item-log', symbol: '=', text: 'Tronco no chão' },
  { classes: 'cell-visited cell-item-log', symbol: 'H', text: 'Madeira nobre no chão' },
  { classes: 'cell-visited cell-item-log', symbol: 'A', text: 'Madeira ancestral no chão' },
  { classes: 'cell-visited cell-item-iron', symbol: 'c', text: 'Cobre no chão' },
  { classes: 'cell-visited cell-item-iron', symbol: '%', text: 'Ferro no chão' },
  { classes: 'cell-visited cell-item-iron', symbol: 'G', text: 'Ouro no chão' },
  { classes: 'cell-visited cell-item-iron', symbol: 'D', text: 'Diamante no chão' },
] as const;

const MIN_CELL_SIZE = 4;
const MAX_CELL_SIZE = 24;
const DEFAULT_CELL_SIZE = 16;
const OVERVIEW_CELL_SIZE = 8;

// RN12: o mapa que o robô conhece. O desconhecido fica hachurado.
// RN19: o chão onde ele pisou tem cor diferente do chão que ele só viu.
export const MapGrid = memo(function MapGrid({
  map,
  onCellClick,
  overlay,
}: {
  map: MapDTO;
  onCellClick?: (x: number, y: number) => void;
  overlay?: ReactNode;
}) {
  const side = map.max - map.min + 1;
  const [cellSize, setCellSize] = useState(() => {
    const saved = Number(localStorage.getItem(zoomKey(map.robot.id)));
    return Number.isFinite(saved) &&
      saved >= MIN_CELL_SIZE &&
      saved <= MAX_CELL_SIZE
      ? saved
      : DEFAULT_CELL_SIZE;
  });
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const move = (event: PointerEvent): void => {
      const drag = dragRef.current;
      const viewport = viewportRef.current;
      if (drag === null || viewport === null || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) <= 4 && Math.abs(dy) <= 4) return;
      drag.moved = true;
      viewport.scrollLeft = drag.left - dx;
      viewport.scrollTop = drag.top - dy;
    };
    const finish = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (drag === null || event.pointerId !== drag.pointerId) return;
      suppressClickRef.current = drag.moved;
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const zoomWithWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.deltaY !== 0) {
        setZoom(cellSize + (event.deltaY < 0 ? 1 : -1));
      }
    };
    viewport.addEventListener('wheel', zoomWithWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', zoomWithWheel);
  }, [cellSize]);

  const setZoom = (value: number): void => {
    const next = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, value));
    setCellSize(next);
    localStorage.setItem(zoomKey(map.robot.id), String(next));
  };

  return (
    <>
      <div className="map-controls" aria-label="Controles de zoom do mapa">
        <span>Zoom</span>
        <button
          type="button"
          aria-label="Diminuir zoom do mapa"
          disabled={cellSize <= MIN_CELL_SIZE}
          onClick={() => {
            setZoom(cellSize - 1);
          }}
        >
          −
        </button>
        <input
          aria-label="Tamanho das casas do mapa"
          type="range"
          min={MIN_CELL_SIZE}
          max={MAX_CELL_SIZE}
          step="1"
          value={cellSize}
          onChange={(event) => {
            setZoom(Number(event.target.value));
          }}
        />
        <button
          type="button"
          aria-label="Aumentar zoom do mapa"
          disabled={cellSize >= MAX_CELL_SIZE}
          onClick={() => {
            setZoom(cellSize + 1);
          }}
        >
          +
        </button>
        <output>{cellSize}px/casa</output>
        <button
          type="button"
          onClick={() => {
            setZoom(OVERVIEW_CELL_SIZE);
          }}
        >
          Visão geral
        </button>
      </div>
      <p className="map-help">Role para zoom · Arraste para mover · Ctrl + clique numa casa para inserir a posição no script</p>
      <div className="map-stage">
        {overlay}
        <div
          ref={viewportRef}
          className={`map-viewport${dragging ? ' is-dragging' : ''}`}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            suppressClickRef.current = false;
            dragRef.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              left: event.currentTarget.scrollLeft,
              top: event.currentTarget.scrollTop,
              moved: false,
            };
            setDragging(true);
          }}
          onClickCapture={(event) => {
            if (suppressClickRef.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClickRef.current = false;
            }
          }}
        >
          <div
            className="map"
            style={{
              gridTemplateColumns: `repeat(${String(side)}, ${String(cellSize)}px)`,
              gridAutoRows: `${String(cellSize)}px`,
              width: `${String(side * cellSize + side - 1)}px`,
              fontSize: `${String(Math.max(6, cellSize * 0.65))}px`,
            }}
            role="group"
            aria-label={`Mapa do robô ${String(map.robot.id)}`}
          >
            {mapRows(map)
              .flat()
              .map((cell) => (
                <button
                  key={`${String(cell.x)},${String(cell.y)}`}
                  type="button"
                  className={`cell cell-${cell.kind} ground-${cell.ground}${cell.isBase ? ' cell-base' : ''}${cell.item === null ? '' : ` cell-item-${cell.item}`}`}
                  title={`(${String(cell.x)}, ${String(cell.y)})${cell.item === null ? '' : ` · ${cell.item}`}${cell.isBase ? ' · base' : ''}`}
                  aria-label={`Casa (${String(cell.x)}, ${String(cell.y)})${cell.item === null ? '' : `, item ${cell.item}`}${cell.isBase ? ', base' : ''}`}
                  onClick={(event) => {
                    if (event.ctrlKey) onCellClick?.(cell.x, cell.y);
                  }}
                >
                  {cell.isBase && cell.kind !== 'self' && cell.kind !== 'other'
                    ? 'B'
                    : cell.item !== null &&
                        cell.kind !== 'self' &&
                        cell.kind !== 'other'
                      ? cell.item === 'branch'
                        ? ','
                        : cell.item === 'stone'
                          ? 'o'
                          : cell.item === 'log'
                            ? '='
                        : cell.item === 'hardwood'
                          ? 'H'
                          : cell.item === 'ancientWood'
                            ? 'A'
                            : cell.item === 'copper'
                              ? 'c'
                              : cell.item === 'gold'
                                ? 'G'
                                : cell.item === 'diamond'
                                  ? 'D'
                                  : '%'
                      : label(cell)}
                  {cell.isBase && (cell.kind === 'self' || cell.kind === 'other') && (
                    <span className="cell-base-marker" aria-hidden="true">B</span>
                  )}
                </button>
              ))}
          </div>
        </div>
      </div>
      <ul className="map-legend" aria-label="Legenda do mapa">
        {LEGEND.map(([kind, text]) => (
          <li key={kind}>
            <span className={`cell cell-${kind}`} aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
      <ul className="map-legend map-legend-details" aria-label="Elementos e simbolos do mapa">
        {MAP_DETAILS.map(({ classes, symbol, text }, index) => (
          <li key={`${classes}-${index}`}>
            <span className={`cell ${classes}`} aria-hidden="true">{symbol}</span>
            {text}
          </li>
        ))}
      </ul>
    </>
  );
});

function zoomKey(robotId: number): string {
  return `mars-rob-map-zoom-${String(robotId)}`;
}
