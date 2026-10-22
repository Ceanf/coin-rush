
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { CONFIG } from './config.js';
import { C2S, S2C, encode, decode } from './protocol.js';
import { Room } from './room.js';
import { serveStatic } from './static.js';

// ---------- 1. Servidor HTTP ----------
// Un mismo puerto atiende HTTP (salud + archivos del cliente) y WebSocket.
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        rooms: rooms.size,
        players: countPlayers(),
      })
    );
    return;
  }

  serveStatic(req, res);
});

// ---------- 2. Servidor WebSocket ----------
const wss = new WebSocketServer({
  server,
  maxPayload: CONFIG.MAX_MESSAGE_BYTES,
});

/** @type {Map<string, Room>} */
const rooms = new Map();

wss.on('connection', (socket, req) => {
  const id = randomUUID().slice(0, 8);
  let room = null;
  socket.isAlive = true;

  console.log(`[+] conexión ${id} desde ${req.socket.remoteAddress}`);

  // Heartbeat nativo de WebSocket.
  socket.on('pong', () => {
    socket.isAlive = true;
  });

  socket.on('message', (raw) => {
    const msg = decode(raw.toString());

    if (!msg) {
      return sendError(socket, 'Mensaje inválido');
    }

    // Antes de unirse a una sala, solo se acepta JOIN y PING.
    if (!room && msg.type !== C2S.JOIN && msg.type !== C2S.PING) {
      return sendError(socket, 'Primero debes unirte a una sala');
    }

    switch (msg.type) {
      case C2S.JOIN: {
        if (room) {
          return sendError(socket, 'Ya estás en una sala');
        }

        const name = sanitizeName(msg.name);
        const code = sanitizeRoom(msg.room);

        if (!name) {
          return sendError(socket, 'Nombre requerido');
        }

        if (!code) {
          return sendError(
            socket,
            'Código de sala inválido (4-6 letras/números)'
          );
        }

        // TODO 1.1: buscar o crear la sala.
        const targetRoom = rooms.get(code) ?? new Room(code);

        if (targetRoom.isFull()) {
          return sendError(socket, 'La sala está llena');
        }

        rooms.set(code, targetRoom);
        room = targetRoom;
        room.addPlayer(id, name, socket);

        // Enviar bienvenida con la configuración oficial.
        socket.send(
          encode(S2C.WELCOME, {
            id,
            room: code,
            world: {
              width: CONFIG.WORLD_WIDTH,
              height: CONFIG.WORLD_HEIGHT,
            },
            config: {
              playerRadius: CONFIG.PLAYER_RADIUS,
              coinRadius: CONFIG.COIN_RADIUS,
              tickRate: CONFIG.TICK_RATE,
            },
          })
        );
        break;
      }

      // TODO 1.2: delegar mensajes a la sala.
      case C2S.INPUT:
        room.setInput(id, msg);
        break;

      case C2S.READY:
        room.setReady(id);
        break;

      case C2S.CHAT:
        room.chat(id, msg.text);
        break;

      // TODO 1.3: responder ping con el mismo timestamp.
      case C2S.PING:
        socket.send(encode(S2C.PONG, { t: msg.t }));
        break;

      default:
        sendError(socket, `Tipo desconocido: ${msg.type}`);
    }
  });

  // TODO 1.4: limpiar al desconectar.
  socket.on('close', () => {
    console.log(`[-] desconexión ${id}`);

    if (!room) return;

    room.removePlayer(id);

    if (room.size === 0) {
      rooms.delete(room.code);
    }

    room = null;
  });

  socket.on('error', (err) => {
    console.error(`error en ${id}:`, err.message);
  });
});

// ---------- 3. Game loop ----------
// Actualiza todas las salas a la frecuencia indicada en CONFIG.
let last = Date.now();

const loop = setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;

  for (const room of rooms.values()) {
    room.tick(dt);
  }
}, 1000 / CONFIG.TICK_RATE);

// ---------- 4. Heartbeat ----------
// Detecta conexiones WebSocket que dejaron de responder.
const heartbeat = setInterval(() => {
  for (const socket of wss.clients) {
    if (!socket.isAlive) {
      socket.terminate();
      continue;
    }

    socket.isAlive = false;
    socket.ping();
  }
}, CONFIG.HEARTBEAT_MS);

wss.on('close', () => {
  clearInterval(loop);
  clearInterval(heartbeat);
});

// ---------- Utilidades ----------
function sendError(socket, message) {
  if (socket.readyState === socket.OPEN) {
    socket.send(encode(S2C.ERROR, { message }));
  }
}

function sanitizeName(name) {
  if (typeof name !== 'string') return '';

  return name
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, CONFIG.MAX_NAME_LENGTH);
}

function sanitizeRoom(code) {
  if (typeof code !== 'string') return '';

  const clean = code.trim().toUpperCase();

  return /^[A-Z0-9]{4,6}$/.test(clean) ? clean : '';
}

function countPlayers() {
  let n = 0;

  for (const room of rooms.values()) {
    n += room.size;
  }

  return n;
}

// ---------- 5. Iniciar servidor ----------
server.listen(CONFIG.PORT, () => {
  console.log(
    `Coin Rush escuchando en http://localhost:${CONFIG.PORT} (ws://localhost:${CONFIG.PORT})`
  );
});

// Cierre ordenado con Ctrl+C.
process.on('SIGINT', () => {
  console.log('\nCerrando servidor...');

  clearInterval(loop);
  clearInterval(heartbeat);

  wss.close();
  server.close(() => process.exit(0));
});

export { server, wss };
