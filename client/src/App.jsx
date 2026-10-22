import { useGame } from './store/gameStore.js';
import { useKeyboardInput } from './hooks/useKeyboardInput.js';
import Lobby from './components/Lobby.jsx';
import GameCanvas from './components/GameCanvas.jsx';
import { Scoreboard, EventFeed } from './components/Sidebar.jsx';

export default function App() {
  const { myId, room, latency, snapshot, ready, disconnect } = useGame();
  useKeyboardInput(!!myId);

  if (!myId) {
    return (
      <main className="center">
        <Lobby />
      </main>
    );
  }

  const me = snapshot?.players.find((p) => p.id === myId);
  const phase = snapshot?.phase;

  return (
    <main className="game">
      <header>
        <div>
          Sala <code>{room}</code>
          <span className="muted"> · comparte este código</span>
        </div>
        <div className="hud">
          {phase === 'playing' && <span className="timer">⏱ {snapshot.timeLeft}s</span>}
          <span className={`ping ${latency > 150 ? 'bad' : ''}`}>{latency ?? '–'} ms</span>
          <button className="ghost" onClick={() => disconnect()}>Salir</button>
        </div>
      </header>

      <section className="layout">
        <div>
          <GameCanvas />
          <p className="muted help">
            Muévete con <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> o flechas. Atrapa más monedas que el resto en 60 s.
          </p>
        </div>
        <aside>
          {phase === 'lobby' && (
            <button onClick={ready} disabled={me?.ready}>
              {me?.ready ? 'Esperando a los demás…' : 'Estoy listo'}
            </button>
          )}
          <Scoreboard />
          <EventFeed />
        </aside>
      </section>
    </main>
  );
}
