import { useState } from 'react';
import { useGame } from '../store/gameStore.js';

function randomRoom() {
  return Math.random().toString(36).slice(2, 7).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
}

export default function Lobby() {
  const { connect, status, error } = useGame();
  const [name, setName] = useState('');
  const [room, setRoom] = useState('');

  const submit = (e) => {
    e.preventDefault();
    connect(name.trim(), (room.trim() || randomRoom()).toUpperCase());
  };

  return (
    <form className="card lobby" onSubmit={submit}>
      <h1>
        Coin <span>Rush</span>
      </h1>
      <p className="muted">Juego multijugador en tiempo real con WebSockets</p>

      <label>
        Tu nombre
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} required autoFocus />
      </label>
      <label>
        Código de sala <small>(vacío = crear una nueva)</small>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value.toUpperCase())}
          maxLength={6}
          pattern="[A-Za-z0-9]{4,6}"
          placeholder="Ej: ABCD"
        />
      </label>

      <button disabled={status === 'connecting'}>{status === 'connecting' ? 'Conectando…' : 'Entrar'}</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
