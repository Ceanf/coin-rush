// Parámetros del juego. Cambiarlos aquí afecta a todo el servidor.
export const CONFIG = {
  PORT: Number(process.env.PORT) || 8080,

  TICK_RATE: 20,            // actualizaciones de simulación por segundo
  WORLD_WIDTH: 800,
  WORLD_HEIGHT: 500,

  PLAYER_RADIUS: 16,
  PLAYER_SPEED: 220,        // píxeles por segundo
  COIN_RADIUS: 10,
  MAX_COINS: 6,

  MAX_PLAYERS_PER_ROOM: 4,
  MIN_PLAYERS_TO_START: 2,
  ROUND_SECONDS: 60,
  COUNTDOWN_SECONDS: 3,
  RESULTS_SECONDS: 6,

  MAX_NAME_LENGTH: 16,
  MAX_MESSAGE_BYTES: 1024,  // protege al servidor de mensajes gigantes
  HEARTBEAT_MS: 10000,      // detecta conexiones muertas
};

export const COLORS = ['#ff6b6b', '#4dabf7', '#51cf66', '#fcc419'];
