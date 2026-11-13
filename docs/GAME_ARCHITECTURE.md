# GAME ARCHITECTURE — Ngara Street Hustle

## Layer diagram
UI (DOM) → Systems (pure logic) → Game/Entities (3D) → Core (engine)

Communication flows **through** layers only via:
1. The EventBus (`src/systems/EventBus.js`) — for events.
2. The shared `game/State.js` — for serialisable data (Phase 4+).

## Non-negotiable rules
1. **Systems never import Three.js.** They are pure logic.
2. **UI never imports Three.js.** It only renders DOM.
3. **UI never mutates game state directly.** It emits events or calls
   a system method; the system updates State and emits a change event.
4. **All per-frame updates go through `core/Loop.js`.** No setInterval.
5. **Event names use `domain:action`.** e.g. `money:changed`, `customer:left`.

## Files and their jobs (Phase 1)
| File | Job |
|---|---|
| `src/main.js` | Boot: get DOM, create HUD, create Game. |
| `src/game/Game.js` | Orchestrator: owns Renderer/Camera/Loop/Input, wires the loop. |
| `src/core/Renderer.js` | Owns WebGLRenderer + Scene. Tone mapping, shadows, fog. |
| `src/core/Camera.js` | Owns PerspectiveCamera and resize. |
| `src/core/Loop.js` | Single RAF loop. Provides `dt` in seconds. |
| `src/core/Input.js` | Keyboard state. `isDown` / `wasPressed` / `endFrame`. |
| `src/systems/EventBus.js` | Pub/sub bus. The glue for everything. |
| `src/ui/HUD.js` | Subscribes to `money:changed`, renders the money pill. |
| `src/utils/format.js` | `formatKSh(n)` — every money display uses this. |
| `src/utils/math.js` | Pure math (clamp, lerp, damp, deg↔rad). |
| `src/utils/random.js` | Pure random helpers. |
| `src/data/GameConfig.js` | Tuning constants (frozen). |

## Frame order (every tick)
1. `Loop._tick(now)` computes `dt` (clamped to 0.1s).
2. Each registered callback runs in the order added.
3. `Game._update(dt)` runs — currently rotates demo box, renders.
4. `input.endFrame()` clears `justPressed`.

## Phase roadmap pointer
See `docs/DEVELOPMENT_ROADMAP.md`.