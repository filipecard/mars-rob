import { readFile, stat } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { WebSocketServer } from 'ws';
import type { SimulationController } from './SimulationController.js';

export const WEBSOCKET_PATH = '/ws';
const MAX_BODY_BYTES = 100_000;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

export interface ServerOptions {
  port: number;
  host?: string;
  // Pasta do frontend já compilado (web/dist). Sem ela, só a API responde.
  staticDir?: string;
}

export interface RunningServer {
  server: Server;
  port: number;
  close: () => Promise<void>;
}

// RN17: API HTTP (/api/...) + WebSocket (/ws) + arquivos do frontend
export async function startServer(
  controller: SimulationController,
  { port, host = '127.0.0.1', staticDir }: ServerOptions,
): Promise<RunningServer> {
  const server = createServer((request, response) => {
    void route(controller, staticDir, request, response).catch(
      (error: unknown) => {
        console.error(error);
        send(response, 500, { error: 'Erro interno' });
      },
    );
  });

  const sockets = new WebSocketServer({ server, path: WEBSOCKET_PATH });
  sockets.on('connection', (socket) => {
    const unsubscribe = controller.subscribe((update) => {
      socket.send(JSON.stringify(update));
    });
    socket.on('close', unsubscribe);
    void controller.snapshot().then((update) => {
      socket.send(JSON.stringify(update));
    });
  });

  await new Promise<void>((done) => {
    server.listen(port, host, done);
  });
  const address = server.address();
  return {
    server,
    port: typeof address === 'object' && address !== null ? address.port : port,
    close: async () => {
      controller.clock.pause();
      for (const socket of sockets.clients) {
        socket.terminate();
      }
      await new Promise<void>((done) => {
        sockets.close(() => {
          done();
        });
      });
      await new Promise<void>((done, fail) => {
        server.close((error) => {
          if (error === undefined) {
            done();
          } else {
            fail(error);
          }
        });
      });
    },
  };
}

async function route(
  controller: SimulationController,
  staticDir: string | undefined,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const method = request.method ?? 'GET';
  if (url.pathname.startsWith('/api/')) {
    let body: unknown;
    try {
      body = await readJson(request);
    } catch {
      send(response, 400, { error: 'O corpo deve ser um JSON válido' });
      return;
    }
    const result = await controller.handle({
      method,
      path: url.pathname,
      body,
    });
    send(response, result.status, result.body);
    return;
  }
  if (staticDir !== undefined && method === 'GET') {
    await serveStatic(staticDir, url.pathname, response);
    return;
  }
  send(response, 404, { error: 'Rota não encontrada' });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new RangeError('Corpo grande demais');
    }
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text === '' ? undefined : (JSON.parse(text) as unknown);
}

// Caminhos fora da pasta são recusados; rotas desconhecidas devolvem o index.html
async function serveStatic(
  dir: string,
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  const root = resolve(dir);
  const requested = normalize(join(root, decodeURIComponent(pathname)));
  if (requested !== root && !requested.startsWith(root + sep)) {
    send(response, 404, { error: 'Rota não encontrada' });
    return;
  }
  const isFile = await stat(requested).then(
    (info) => info.isFile(),
    () => false,
  );
  const file = isFile ? requested : join(root, 'index.html');
  try {
    const content = await readFile(file);
    response.writeHead(200, {
      'content-type':
        CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
    });
    response.end(content);
  } catch {
    send(response, 404, { error: 'Frontend não encontrado' });
  }
}
