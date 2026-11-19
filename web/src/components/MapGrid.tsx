import { memo } from 'react';
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

// RN12: o mapa que o robô conhece. O desconhecido fica hachurado.
// RN19: o chão onde ele pisou tem cor diferente do chão que ele só viu.
export const MapGrid = memo(function MapGrid({ map }: { map: MapDTO }) {
  const side = map.max - map.min + 1;
  return (
    <>
      <div
        className="map"
        style={{ gridTemplateColumns: `repeat(${String(side)}, 1fr)` }}
        role="img"
        aria-label={`Mapa do robô ${String(map.robot.id)}`}
      >
        {mapRows(map)
          .flat()
          .map((cell) => (
            <span
              key={`${String(cell.x)},${String(cell.y)}`}
              className={`cell cell-${cell.kind}`}
              title={`(${String(cell.x)}, ${String(cell.y)})`}
            >
              {label(cell)}
            </span>
          ))}
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
