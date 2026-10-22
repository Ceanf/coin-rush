
import { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore.js';

// Dibuja el juego en canvas a 60 fps e interpola posiciones
// recibidas del servidor a 20 actualizaciones por segundo.
export default function GameCanvas() {
  const canvasRef = useRef(null);
  const world = useGame((s) => s.world);

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const rendered = new Map();
    let frame;

    const draw = () => {
      const { snapshot, myId, config, events } = useGame.getState();

      ctx.clearRect(0, 0, world.width, world.height);
      drawGrid(ctx, world);

      if (snapshot) {
        // Monedas
        for (const c of snapshot.coins) {
          drawCoin(ctx, c, config.coinRadius);
        }

        // Jugadores
        const alive = new Set();

        for (const p of snapshot.players) {
          alive.add(p.id);

          const r = rendered.get(p.id) ?? { x: p.x, y: p.y };

          // TODO 3.4: interpolar un 30 % hacia la posición real.
          r.x += (p.x - r.x) * 0.3;
          r.y += (p.y - r.y) * 0.3;

          rendered.set(p.id, r);

          drawPlayer(
            ctx,
            { ...p, x: r.x, y: r.y },
            config.playerRadius,
            p.id === myId
          );
        }

        for (const id of rendered.keys()) {
          if (!alive.has(id)) rendered.delete(id);
        }

        drawOverlay(ctx, world, snapshot, events);
      }

      frame = requestAnimationFrame(draw);
    };

    frame = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(frame);
  }, [world]);

  return (
    <canvas
      ref={canvasRef}
      width={world.width}
      height={world.height}
      className="board"
    />
  );
}

function drawGrid(ctx, { width, height }) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x += 40) {
    line(ctx, x, 0, x, height);
  }

  for (let y = 0; y <= height; y += 40) {
    line(ctx, 0, y, width, y);
  }
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawCoin(ctx, c, r) {
  const pulse = 1 + Math.sin(performance.now() / 200 + c.id) * 0.08;

  ctx.beginPath();
  ctx.arc(c.x, c.y, r * pulse, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd43b';
  ctx.shadowColor = '#ffd43b';
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#e8a400';
  ctx.font = `bold ${r}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', c.x, c.y + 1);
}

function drawPlayer(ctx, p, r, isMe) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.fill();

  if (isMe) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.font = '600 12px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';

  const label = isMe ? `${p.name} (tú)` : p.name;
  const half = ctx.measureText(label).width / 2 + 4;
  const lx = Math.max(half, Math.min(ctx.canvas.width - half, p.x));
  const ly = p.y - r - 4 < 14 ? p.y + r + 16 : p.y - r - 4;

  ctx.fillText(label, lx, ly);
}

function drawOverlay(ctx, world, snap, events) {
  let title = null;
  let subtitle = null;

  if (snap.phase === 'lobby') {
    const ready = snap.players.filter((p) => p.ready).length;

    title = 'Sala de espera';
    subtitle =
      snap.players.length < 2
        ? 'Esperando a otro jugador… (comparte el código de sala)'
        : `${ready}/${snap.players.length} listos · presiona "Estoy listo"`;
  } else if (snap.phase === 'countdown') {
    title = String(snap.timeLeft);
    subtitle = '¡Prepárate!';
  } else if (snap.phase === 'results') {
    const w = [...events].reverse().find((e) => e.kind === 'winner');

    title = w?.name ? `🏆 ¡${w.name} gana!` : '¡Empate!';
    subtitle = w
      ? `${w.score} monedas · nueva ronda en ${snap.timeLeft}s`
      : '';
  }

  if (!title) return;

  ctx.fillStyle = 'rgba(10, 12, 20, 0.55)';
  ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${snap.phase === 'countdown' ? 96 : 40}px system-ui`;
  ctx.fillText(title, world.width / 2, world.height / 2 - 16);

  ctx.font = '500 16px system-ui';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(subtitle, world.width / 2, world.height / 2 + 40);
}
