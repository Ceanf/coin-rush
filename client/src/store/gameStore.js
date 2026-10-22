
import { create } from 'zustand';

// En desarrollo el servidor corre en :8080; en producción usa el mismo host.
const WS_URL =
  import.meta.env.VITE_WS_URL ??
  (import.meta.env.DEV
    ? `ws://${location.hostname}:8080`
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let socket = null;
let pingTimer = null;

// Store global de Zustand.
export const useGame = create((set, get) => ({
  status: 'disconnected',
  error: null,
  myId: null,
  room: null,
  world: { width: 800, height: 500 },
  config: { playerRadius: 16, coinRadius: 10, tickRate: 20 },
  snapshot: null,
  events: [],
  latency: null,

  connect(name, room) {
    if (socket) return;

    set({ status: 'connecting', error: null });
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      set({ status: 'connected' });

      // TODO 3.1: unirse a la sala.
      send({ type: 'join', name, room });

      // Medir latencia cada 2 segundos.
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        send({ type: 'ping', t: performance.now() });
      }, 2000);
    };

    socket.onmessage = (e) => {
      let msg;

      try {
        msg = JSON.parse(e.data);
      } catch {
        set({ error: 'El servidor envió un mensaje inválido' });
        return;
      }

      // TODO 3.2: procesar los mensajes del servidor.
      switch (msg.type) {
        case 'welcome':
          set({
            myId: msg.id,
            room: msg.room,
            world: msg.world,
            config: msg.config,
            error: null,
          });
          break;

        case 'state':
          set({ snapshot: msg });
          break;

        case 'event':
          set((s) => ({
            events: [...s.events, { ...msg, at: Date.now() }].slice(-8),
          }));
          break;

        case 'pong':
          set({
            latency: Math.round(performance.now() - msg.t),
          });
          break;

        case 'error':
          set({ error: msg.message });

          if (!get().myId) {
            get().disconnect(msg.message);
          }
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      get().disconnect(get().error);
    };

    socket.onerror = () => {
      set({ error: 'No se pudo conectar con el servidor' });
    };
  },

  disconnect(error = null) {
    clearInterval(pingTimer);
    pingTimer = null;

    if (socket) {
      const currentSocket = socket;
      socket = null;
      currentSocket.onclose = null;
      currentSocket.close();
    }

    set({
      status: 'disconnected',
      myId: null,
      room: null,
      snapshot: null,
      events: [],
      latency: null,
      error,
    });
  },

  sendInput: (input) => send({ type: 'input', ...input }),
  ready: () => send({ type: 'ready' }),
  chat: (text) => send({ type: 'chat', text }),
}));

function send(obj) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}
