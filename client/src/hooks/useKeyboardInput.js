
import { useEffect } from 'react';
import { useGame } from '../store/gameStore.js';

const KEYS = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

// Envía el estado de las teclas solo cuando cambia.
export function useKeyboardInput(enabled) {
  const sendInput = useGame((s) => s.sendInput);

  useEffect(() => {
    if (!enabled) return;

    const pressed = {
      up: false,
      down: false,
      left: false,
      right: false,
    };

    const update = (e, value) => {
      const dir = KEYS[e.code];

      if (!dir || e.target.tagName === 'INPUT') return;

      e.preventDefault();

      // TODO 3.3: evitar mensajes repetidos.
      if (pressed[dir] === value) return;

      pressed[dir] = value;
      sendInput({ ...pressed });
    };

    const down = (e) => update(e, true);
    const up = (e) => update(e, false);

    // Soltar todas las teclas cuando la ventana pierde el foco.
    const blur = () => {
      const wasPressed = Object.values(pressed).some(Boolean);

      if (!wasPressed) return;

      Object.keys(pressed).forEach((k) => {
        pressed[k] = false;
      });

      sendInput({ ...pressed });
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);

    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [enabled, sendInput]);
}
