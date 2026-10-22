# Coin Rush — Servidor de Juego en Tiempo Real con WebSockets

Juego multijugador (2 a 4 jugadores) donde cada uno mueve su círculo y compite por atrapar
la mayor cantidad de monedas en 60 segundos. Tu tarea es completar el **servidor** (Node.js + `ws`)
y la **capa de tiempo real del cliente** (React + Zustand).

## Requisitos
- Node.js 18 o superior
- Dos terminales y un navegador (abre dos pestañas para simular dos jugadores)

## Cómo ejecutar
```bash
# Terminal 1 — servidor (puerto 8080)
cd server
npm install
npm run dev        # se reinicia solo al guardar

# Terminal 2 — cliente (puerto 5173)
cd client
npm install
npm run dev
```
Abre `http://localhost:5173` en dos pestañas, entra con el mismo código de sala y presiona **Estoy listo** en ambas.

Para jugar desde otro equipo de la misma red, usa la IP de tu máquina: `http://192.168.x.x:5173`.

## Autoevaluación
```bash
cd server
npm test
```
El test levanta el servidor, conecta dos clientes simulados y verifica 8 comportamientos.
Al terminar las fases 1 y 2 deben pasar **los 8**.

---

## Arquitectura

```
 Navegador (React)                         Servidor (Node.js)
 ┌──────────────────────┐   WebSocket   ┌──────────────────────────┐
 │ useKeyboardInput ────┼── input ─────▶│ index.js  (conexiones)   │
 │                      │               │    │                     │
 │ gameStore (Zustand) ◀┼── state ──────┤ room.js   (lógica)       │
 │    │                 │   20 veces/s  │    ▲  tick(dt)           │
 │ GameCanvas (60 fps)  │               │ game loop setInterval    │
 └──────────────────────┘               └──────────────────────────┘
```

**Servidor autoritativo:** el cliente NUNCA envía su posición, solo qué teclas tiene presionadas.
El servidor calcula movimientos, colisiones y puntajes. Así nadie puede hacer trampa editando el JavaScript del navegador.

**Fases de una sala:** `lobby` → `countdown` (3 s) → `playing` (60 s) → `results` (6 s) → `lobby`

## Protocolo de mensajes (JSON)

Todo mensaje tiene la forma `{ "type": "...", ...datos }`. Está definido en `server/src/protocol.js`.

| Dirección | type | Datos | Cuándo |
|---|---|---|---|
| Cliente → Servidor | `join` | `name`, `room` | Al conectar |
| Cliente → Servidor | `input` | `up`, `down`, `left`, `right` (booleanos) | Cuando cambia una tecla |
| Cliente → Servidor | `ready` | — | Botón "Estoy listo" |
| Cliente → Servidor | `chat` | `text` | Enviar mensaje |
| Cliente → Servidor | `ping` | `t` (timestamp) | Cada 2 s |
| Servidor → Cliente | `welcome` | `id`, `room`, `world`, `config` | Tras un `join` válido |
| Servidor → Cliente | `state` | `phase`, `timeLeft`, `players[]`, `coins[]` | En cada tick (20 Hz) |
| Servidor → Cliente | `event` | `kind`: join · leave · coin · winner · chat | Cuando ocurre |
| Servidor → Cliente | `pong` | `t` (el mismo recibido) | Respuesta a `ping` |
| Servidor → Cliente | `error` | `message` | Mensaje inválido o rechazado |

---

## Lo que debes implementar

Busca `TODO` en el código. Están numerados por fase.

### Fase 1 — Conexión y salas · `server/src/index.js`
| TODO | Qué hacer |
|---|---|
| 1.1 | Crear o reutilizar la sala, validar cupo, agregar al jugador y responder `welcome` |
| 1.2 | Delegar `input`, `ready` y `chat` a la sala |
| 1.3 | Responder `ping` con `pong` |
| 1.4 | Al desconectar: quitar al jugador y borrar salas vacías |

### Fase 2 — Game loop autoritativo · `server/src/index.js` y `server/src/room.js`
| TODO | Qué hacer |
|---|---|
| 2.1 | Game loop con `setInterval` a `TICK_RATE` Hz que llama `room.tick(dt)` |
| 2.2 | Iniciar la cuenta regresiva cuando todos estén listos |
| 2.3 | Mover jugadores según su input (normalizar diagonal y no salir del mundo) |
| 2.4 | Detectar colisión jugador–moneda y sumar puntos |
| 2.5 | `broadcast`: enviar un mensaje a todos los jugadores de la sala |

✅ Al terminar esta fase, `npm test` debe mostrar **8 pruebas OK**.

### Fase 3 — Cliente en tiempo real · `client/src`
| TODO | Archivo | Qué hacer |
|---|---|---|
| 3.1 | `store/gameStore.js` | Enviar `join` al conectar e iniciar el ping periódico |
| 3.2 | `store/gameStore.js` | Procesar `welcome`, `state`, `event` y `pong` |
| 3.3 | `hooks/useKeyboardInput.js` | Enviar el input solo cuando cambia |
| 3.4 | `components/GameCanvas.jsx` | Interpolar posiciones para un movimiento suave |

### Fase 4 — Extensiones (elige al menos una)
- **Reconexión automática:** si se cae la conexión, reintentar con espera exponencial (1 s, 2 s, 4 s…).
- **Power-ups:** una moneda especial que da velocidad x2 durante 5 s (lógica solo en el servidor).
- **Controles táctiles:** joystick en pantalla para jugar desde el celular.
- **Despliegue:** `npm run build` en el cliente; el servidor ya sirve `client/dist`, así que todo corre en un solo puerto (Render, Railway o Cloud Run).
- **Anti-flood:** limitar a 30 mensajes por segundo por conexión y desconectar a quien abuse.

## Preguntas para el informe
1. ¿Por qué el cliente envía teclas y no su posición? ¿Qué trampa evita?
2. El servidor envía 20 estados por segundo y el canvas dibuja a 60 fps. ¿Qué pasa sin interpolación?
3. ¿Qué diferencia hay entre el `ping` del protocolo (`type: 'ping'`) y el heartbeat de `ws` en `index.js`?
4. ¿Por qué `broadcast` serializa el JSON una sola vez antes del bucle?
5. ¿Qué cambiaría si quisieras 1 000 salas simultáneas en varios servidores?

## Estructura
```
server/
  src/config.js     parámetros del juego (velocidad, tamaño del mundo, tiempos)
  src/protocol.js   tipos de mensaje y helpers encode/decode
  src/index.js      servidor HTTP + WebSocket, salas, game loop      ← TODO 1.x, 2.1
  src/room.js       lógica de una partida                             ← TODO 2.2–2.5
  src/static.js     sirve el build del cliente en producción
  test/smoke.test.js  autoevaluación
client/
  src/store/gameStore.js       conexión WebSocket y estado global   ← TODO 3.1, 3.2
  src/hooks/useKeyboardInput.js  teclado → mensajes input            ← TODO 3.3
  src/components/GameCanvas.jsx  dibujo en canvas                    ← TODO 3.4
  src/components/Lobby.jsx, Sidebar.jsx, App.jsx   interfaz (completa)
```
