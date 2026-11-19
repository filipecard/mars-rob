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

// RN12: o mapa que o robô conhece. O desconhecido fica hachurado.
export const MapGrid = memo(function MapGrid({ map }: { map: MapDTO }) {
  const side = map.max - map.min + 1;
  return (
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
  );
});
