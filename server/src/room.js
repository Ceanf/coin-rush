import { CONFIG, COLORS } from './config.js';
import { encode, S2C, PHASE } from './protocol.js';

let coinSeq = 0;

// Una sala = una partida. El servidor es AUTORITATIVO:
// los clientes solo envían intenciones (teclas), el servidor calcula posiciones y puntos.
export class Room {
  constructor(code) {
    this.code = code;
    this.players = new Map(); // id -> { id, name, color, x, y, score, input, ready, socket }
    this.coins = [];
    this.phase = PHASE.LOBBY;
    this.phaseEndsAt = 0;
  }

  get size() {
    return this.players.size;
  }

  isFull() {
    return this.players.size >= CONFIG.MAX_PLAYERS_PER_ROOM;
  }

  addPlayer(id, name, socket) {
    const usedColors = new Set([...this.players.values()].map((p) => p.color));
    const color = COLORS.find((c) => !usedColors.has(c)) ?? COLORS[0];
    const player = {
      id,
      name,
      color,
      ...this.randomPosition(CONFIG.PLAYER_RADIUS),
      score: 0,
      input: { up: false, down: false, left: false, right: false },
      ready: false,
      socket,
    };
    this.players.set(id, player);
    this.broadcast(S2C.EVENT, { kind: 'join', name });
    return player;
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.players.delete(id);
    this.broadcast(S2C.EVENT, { kind: 'leave', name: player.name });

    // Si la partida queda con un solo jugador, se vuelve al lobby.
    if (this.phase !== PHASE.LOBBY && this.players.size < CONFIG.MIN_PLAYERS_TO_START) {
      this.toLobby();
    }
  }

  setInput(id, input) {
    const player = this.players.get(id);
    if (!player) return;
    // Validación: solo aceptamos los 4 booleanos esperados.
    player.input = {
      up: !!input.up,
      down: !!input.down,
      left: !!input.left,
      right: !!input.right,
    };
  }

  setReady(id) {
    const player = this.players.get(id);
    if (!player || this.phase !== PHASE.LOBBY) return;
    player.ready = true;

   
    const players = [...this.players.values()];

    if (
      players.length >= CONFIG.MIN_PLAYERS_TO_START &&
      players.every((p) => p.ready)
    ) {
      this.startCountdown();
    }

  }

  chat(id, text) {
    const player = this.players.get(id);
    if (!player || typeof text !== 'string') return;
    const clean = text.trim().slice(0, 120);
    if (clean) this.broadcast(S2C.EVENT, { kind: 'chat', name: player.name, text: clean });
  }

  // ---------- Fases ----------

  startCountdown() {
    this.phase = PHASE.COUNTDOWN;
    this.phaseEndsAt = Date.now() + CONFIG.COUNTDOWN_SECONDS * 1000;
    for (const p of this.players.values()) {
      p.score = 0;
      Object.assign(p, this.randomPosition(CONFIG.PLAYER_RADIUS));
    }
    this.coins = [];
  }

  startRound() {
    this.phase = PHASE.PLAYING;
    this.phaseEndsAt = Date.now() + CONFIG.ROUND_SECONDS * 1000;
    while (this.coins.length < CONFIG.MAX_COINS) this.spawnCoin();
  }

  endRound() {
    this.phase = PHASE.RESULTS;
    this.phaseEndsAt = Date.now() + CONFIG.RESULTS_SECONDS * 1000;
    const ranking = [...this.players.values()].sort((a, b) => b.score - a.score);
    const top = ranking[0];
    const tie = ranking.length > 1 && ranking[1].score === top.score;
    this.broadcast(S2C.EVENT, {
      kind: 'winner',
      name: tie ? null : top.name,
      score: top.score,
    });
  }

  toLobby() {
    this.phase = PHASE.LOBBY;
    this.phaseEndsAt = 0;
    this.coins = [];
    for (const p of this.players.values()) p.ready = false;
  }

  // ---------- Simulación ----------

  // Se llama TICK_RATE veces por segundo. dt en segundos.
  tick(dt) {
    const now = Date.now();

    if (this.phase === PHASE.COUNTDOWN && now >= this.phaseEndsAt) this.startRound();
    else if (this.phase === PHASE.PLAYING && now >= this.phaseEndsAt) this.endRound();
    else if (this.phase === PHASE.RESULTS && now >= this.phaseEndsAt) this.toLobby();

    // En lobby y playing se puede mover; en countdown/results todos quietos.
    if (this.phase === PHASE.PLAYING || this.phase === PHASE.LOBBY) {
      for (const p of this.players.values()) this.movePlayer(p, dt);
    }

    if (this.phase === PHASE.PLAYING) this.checkCoinPickups();

    this.broadcastState();
  }

  
  movePlayer(p, dt) {
    // Calcular la dirección horizontal y vertical.
    let dx = (p.input.right ? 1 : 0) - (p.input.left ? 1 : 0);
    let dy = (p.input.down ? 1 : 0) - (p.input.up ? 1 : 0);

    // Si no hay teclas presionadas, no hay movimiento.
    if (dx === 0 && dy === 0) return;

    // Normalizar para evitar mayor velocidad en diagonal.
    const length = Math.hypot(dx, dy);
    dx /= length;
    dy /= length;

    // Calcular la nueva posición según la velocidad y el tiempo.
    const speed = CONFIG.PLAYER_SPEED * dt;

    p.x += dx * speed;
    p.y += dy * speed;

    // Mantener al jugador dentro de los límites del mundo.
    const radius = CONFIG.PLAYER_RADIUS;

    p.x = clamp(p.x, radius, CONFIG.WORLD_WIDTH - radius);
    p.y = clamp(p.y, radius, CONFIG.WORLD_HEIGHT - radius);
  }

  
checkCoinPickups() {
  for (const p of this.players.values()) {
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];

      // Calcular la distancia entre el jugador y la moneda.
      const distance = Math.hypot(p.x - c.x, p.y - c.y);
      const minDistance = CONFIG.PLAYER_RADIUS + CONFIG.COIN_RADIUS;

      // Si el jugador toca la moneda, la recoge.
      if (distance <= minDistance) {
        this.coins.splice(i, 1);
        p.score += 1;

        // Notificar a los jugadores que se recogió una moneda.
        this.broadcast(S2C.EVENT, {
          kind: 'coin',
          name: p.name,
        });

        // Generar una nueva moneda.
        this.spawnCoin();
      }
    }
  }
}

  spawnCoin() {
    this.coins.push({ id: ++coinSeq, ...this.randomPosition(CONFIG.COIN_RADIUS) });
  }

  randomPosition(margin) {
    return {
      x: margin + Math.random() * (CONFIG.WORLD_WIDTH - 2 * margin),
      y: margin + Math.random() * (CONFIG.WORLD_HEIGHT - 2 * margin),
    };
  }

  // ---------- Red ----------

  snapshot() {
    return {
      phase: this.phase,
      timeLeft: this.phaseEndsAt ? Math.max(0, Math.ceil((this.phaseEndsAt - Date.now()) / 1000)) : null,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        x: Math.round(p.x),
        y: Math.round(p.y),
        score: p.score,
        ready: p.ready,
      })),
      coins: this.coins.map((c) => ({ id: c.id, x: Math.round(c.x), y: Math.round(c.y) })),
    };
  }

  broadcastState() {
    this.broadcast(S2C.STATE, this.snapshot());
  }

 
  broadcast(type, data) {
    const message = encode(type, data);

    for (const p of this.players.values()) {
      if (p.socket.readyState === p.socket.OPEN) {
        p.socket.send(message);
      }
    }
  }

}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
