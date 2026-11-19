import type { ApiClient } from '../api/client.js';
import type { ClockDTO } from '../api/types.js';

interface Props {
  tick: number;
  clock: ClockDTO;
  api: ApiClient;
}

// RN17: tocar, pausar, avançar 1 tick e a velocidade
export function ClockControls({ tick, clock, api }: Props) {
  return (
    <div className="clock">
      <p className="tick">
        <span className="tick-number">{tick}</span> ticks
      </p>
      <button
        type="button"
        className="primary"
        onClick={() => void (clock.playing ? api.pause() : api.play())}
      >
        {clock.playing ? 'Pausar' : 'Tocar'}
      </button>
      <button
        type="button"
        disabled={clock.playing}
        onClick={() => void api.step()}
      >
        Avançar 1 tick
      </button>
      <label className="speed">
        <span>{clock.ticksPerSecond} ticks por segundo</span>
        <input
          type="range"
          min={1}
          max={20}
          value={clock.ticksPerSecond}
          onChange={(event) => void api.setSpeed(Number(event.target.value))}
        />
      </label>
    </div>
  );
}
