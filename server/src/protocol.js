// Protocolo de mensajes (JSON). Todo mensaje tiene la forma { type, ...datos }.
// Es el "contrato" entre cliente y servidor: ambos lados deben respetarlo.

// Cliente -> Servidor
export const C2S = {
  JOIN: 'join',     // { name, room }
  INPUT: 'input',   // { up, down, left, right }  (booleanos)
  READY: 'ready',   // {}  el jugador quiere empezar
  PING: 'ping',     // { t }  marca de tiempo del cliente
  CHAT: 'chat',     // { text }
};

// Servidor -> Cliente
export const S2C = {
  WELCOME: 'welcome', // { id, room, world }
  STATE: 'state',     // { phase, timeLeft, players, coins }
  EVENT: 'event',     // { kind, ... }  (join, leave, coin, winner, chat)
  PONG: 'pong',       // { t }
  ERROR: 'error',     // { message }
};

export const PHASE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  RESULTS: 'results',
};

export function encode(type, data = {}) {
  return JSON.stringify({ type, ...data });
}

// Nunca confiar en lo que llega del cliente: parsear con cuidado.
export function decode(raw) {
  try {
    const msg = JSON.parse(raw);
    if (!msg || typeof msg.type !== 'string') return null;
    return msg;
  } catch {
    return null;
  }
}
