import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { UpdateMessage } from '../../../../src/presentation/http/SimulationController.js';
import {
  startServer,
  WEBSOCKET_PATH,
  type RunningServer,
} from '../../../../src/presentation/http/startServer.js';
import { controller } from './httpFixture.js';

describe('startServer', () => {
  let running: RunningServer;
  let staticDir: string;
  let base: string;

  beforeEach(async () => {
    staticDir = await mkdtemp(join(tmpdir(), 'mars-rob-web-'));
    await writeFile(join(staticDir, 'index.html'), '<h1>mars-rob</h1>');
    await writeFile(join(staticDir, 'app.js'), 'console.log(1)');
    running = await startServer(controller(), { port: 0, staticDir });
    base = `http://127.0.0.1:${String(running.port)}`;
  });

  afterEach(async () => {
    await running.close();
    await rm(staticDir, { recursive: true, force: true });
  });

  it('responde a API em JSON', async () => {
    const response = await fetch(`${base}/api/orders`, {
      method: 'POST',
      body: JSON.stringify({ line: '1:N' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      { ok: true, input: '1:N', robotId: 1 },
    ]);
  });

  it('JSON inválido: 400', async () => {
    const response = await fetch(`${base}/api/orders`, {
      method: 'POST',
      body: '{',
    });

    expect(response.status).toBe(400);
  });

  it('serve o frontend e cai no index.html em rotas desconhecidas', async () => {
    const script = await fetch(`${base}/app.js`);
    const page = await fetch(`${base}/robo/1`);

    expect(script.headers.get('content-type')).toContain('text/javascript');
    expect(await page.text()).toBe('<h1>mars-rob</h1>');
  });

  it('não sai da pasta do frontend', async () => {
    const response = await fetch(`${base}/..%2f..%2fpackage.json`);

    expect(response.status).toBe(404);
  });

  it('WebSocket: envia o estado ao conectar e a cada mudança', async () => {
    const socket = new WebSocket(
      `ws://127.0.0.1:${String(running.port)}${WEBSOCKET_PATH}`,
    );
    const messages: UpdateMessage[] = [];
    const received = (count: number): Promise<void> =>
      new Promise((done) => {
        const check = (): void => {
          if (messages.length >= count) {
            done();
          } else {
            setTimeout(check, 5);
          }
        };
        check();
      });
    socket.on('message', (data: Buffer) => {
      messages.push(JSON.parse(data.toString()) as UpdateMessage);
    });

    await received(1);
    await fetch(`${base}/api/orders`, {
      method: 'POST',
      body: JSON.stringify({ line: '1:N' }),
    });
    await fetch(`${base}/api/clock/step`, { method: 'POST' });
    await received(3);
    socket.close();

    expect(messages.map((m) => m.state.tick)).toEqual([0, 0, 1]);
    expect(messages[2]?.events).toMatchObject([{ kind: 'moved' }]);
  });
});

describe('startServer sem frontend', () => {
  it('fora da API responde 404', async () => {
    const running = await startServer(controller(), { port: 0 });

    const response = await fetch(`http://127.0.0.1:${String(running.port)}/`);
    await running.close();

    expect(response.status).toBe(404);
  });
});
