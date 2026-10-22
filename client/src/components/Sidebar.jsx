import { useState } from 'react';
import { useGame } from '../store/gameStore.js';

export function Scoreboard() {
  const snapshot = useGame((s) => s.snapshot);
  const myId = useGame((s) => s.myId);
  if (!snapshot) return null;
  const players = [...snapshot.players].sort((a, b) => b.score - a.score);

  return (
    <div className="card">
      <h3>Marcador</h3>
      <ul className="scores">
        {players.map((p) => (
          <li key={p.id} className={p.id === myId ? 'me' : ''}>
            <i style={{ background: p.color }} />
            <span>{p.name}</span>
            {snapshot.phase === 'lobby' && <small>{p.ready ? '✔ listo' : '…'}</small>}
            <b>{p.score}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

const describe = (e) => {
  switch (e.kind) {
    case 'join': return `→ ${e.name} entró`;
    case 'leave': return `← ${e.name} salió`;
    case 'coin': return `● ${e.name} +1`;
    case 'winner': return e.name ? `🏆 ${e.name} ganó con ${e.score}` : '🤝 Empate';
    case 'chat': return `${e.name}: ${e.text}`;
    default: return JSON.stringify(e);
  }
};

export function EventFeed() {
  const events = useGame((s) => s.events);
  const chat = useGame((s) => s.chat);
  const [text, setText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (text.trim()) chat(text);
    setText('');
  };

  return (
    <div className="card feed">
      <h3>Eventos</h3>
      <ul>
        {events.map((e) => (
          <li key={e.at + e.kind + (e.name ?? '')} className={e.kind}>
            {describe(e)}
          </li>
        ))}
      </ul>
      <form onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Escribe y Enter…" maxLength={120} />
      </form>
    </div>
  );
}
