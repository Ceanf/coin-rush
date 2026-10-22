// Prueba de humo: levanta el servidor, conecta 2 clientes simulados y verifica el flujo.
// Uso: npm test
import { spawn } from 'node:child_process';
import { WebSocket } from 'ws';
import assert from 'node:assert/strict';

const PORT = 18080;
const URL = `ws://localhost:${PORT}`;

const server = spawn(process.execPath, ['src/index.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});
await new Promise((ok) => server.stdout.once('data', ok));

function client(name) {
  const ws = new WebSocket(URL);
  const inbox = [];
  ws.on('message', (raw) => inbox.push(JSON.parse(raw)));
  const waitFor = (pred, ms = 6000) =>
    new Promise((ok, fail) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        const hit = inbox.find(pred);
        if (hit) { clearInterval(iv); ok(hit); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); fail(new Error(`${name}: timeout`)); }
      }, 20);
    });
  const send = (o) => ws.send(JSON.stringify(o));
  return { ws, inbox, waitFor, send, open: new Promise((ok) => ws.on('open', ok)) };
}

const results = [];
const check = (label, fn) => fn().then(() => results.push(`✔ ${label}`));

try {
  const a = client('Ana');
  const b = client('Beto');
  await Promise.all([a.open, b.open]);

  await check('rechaza acciones antes de JOIN', async () => {
    a.send({ type: 'ready' });
    await a.waitFor((m) => m.type === 'error');
  });

  await check('rechaza código de sala inválido', async () => {
    a.inbox.length = 0;
    a.send({ type: 'join', name: 'Ana', room: '!!' });
    await a.waitFor((m) => m.type === 'error' && /sala/i.test(m.message));
  });

  await check('JOIN devuelve WELCOME con id', async () => {
    a.send({ type: 'join', name: 'Ana', room: 'test1' });
    b.send({ type: 'join', name: 'Beto', room: 'TEST1' });
    const wa = await a.waitFor((m) => m.type === 'welcome');
    const wb = await b.waitFor((m) => m.type === 'welcome');
    assert.equal(wa.room, 'TEST1');
    assert.notEqual(wa.id, wb.id);
  });

  await check('STATE muestra a ambos jugadores', async () => {
    await a.waitFor((m) => m.type === 'state' && m.players.length === 2);
  });

  await check('PING/PONG devuelve el mismo timestamp', async () => {
    a.send({ type: 'ping', t: 12345 });
    const p = await a.waitFor((m) => m.type === 'pong');
    assert.equal(p.t, 12345);
  });

  await check('READY de todos inicia countdown y luego playing con monedas', async () => {
    a.send({ type: 'ready' });
    b.send({ type: 'ready' });
    await a.waitFor((m) => m.type === 'state' && m.phase === 'countdown');
    const s = await a.waitFor((m) => m.type === 'state' && m.phase === 'playing');
    assert.ok(s.coins.length > 0);
  });

  await check('INPUT mueve al jugador (servidor autoritativo)', async () => {
    const id = a.inbox.find((m) => m.type === 'welcome').id;
    a.inbox.length = 0;
    const before = (await a.waitFor((m) => m.type === 'state')).players.find((p) => p.id === id);
    a.send({ type: 'input', up: false, down: false, left: before.x > 400, right: before.x <= 400 });
    await new Promise((r) => setTimeout(r, 400));
    a.send({ type: 'input', up: false, down: false, left: false, right: false });
    const states = a.inbox.filter((m) => m.type === 'state');
    const after = states.at(-1).players.find((p) => p.id === id);
    assert.ok(Math.abs(after.x - before.x) > 30, `se movió ${after.x - before.x}px`);
  });

  await check('desconexión notifica y regresa al lobby', async () => {
    b.ws.close();
    await a.waitFor((m) => m.type === 'event' && m.kind === 'leave');
    await a.waitFor((m) => m.type === 'state' && m.phase === 'lobby' && m.players.length === 1);
  });

  a.ws.close();
  console.log(results.join('\n'));
  console.log(`\n${results.length} pruebas OK`);
} catch (err) {
  console.log(results.join('\n'));
  console.error('✘', err.message);
  console.error('\nRevisa los TODO del servidor relacionados con la prueba que falló.');
  process.exitCode = 1;
} finally {
  server.kill('SIGINT');
  setTimeout(() => process.exit(), 200); // cerrar sockets pendientes aunque falle una prueba
}
