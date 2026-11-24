import { memo, useState } from 'react';
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
  return cell.kind === 'other' ? String(cell.robotId) : '';
}

const LEGEND = [
  ['visited', 'Pisou'],
  ['seen', 'Só viu'],
  ['obstacle', 'Obstáculo'],
  ['unknown', 'Desconhecido'],
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
}: {
  map: MapDTO;
  onCellClick?: (x: number, y: number) => void;
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
      <div className="map-viewport">
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
                className={`cell cell-${cell.kind}${cell.isBase ? ' cell-base' : ''}${cell.item === null ? '' : ` cell-item-${cell.item}`}`}
                title={`(${String(cell.x)}, ${String(cell.y)})${cell.item === null ? '' : ` · ${cell.item}`}${cell.isBase ? ' · base' : ''}`}
                aria-label={`Casa (${String(cell.x)}, ${String(cell.y)})${cell.item === null ? '' : `, item ${cell.item}`}${cell.isBase ? ', base' : ''}`}
                onClick={() => onCellClick?.(cell.x, cell.y)}
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
                          : '%'
                    : label(cell)}
              </button>
            ))}
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
    </>
  );
});

function zoomKey(robotId: number): string {
  return `mars-rob-map-zoom-${String(robotId)}`;
}
