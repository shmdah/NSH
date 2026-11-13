# SYSTEMS — Ngara Street Hustle

This file documents every system as it is built. Phase 1 has one system.

## EventBus (Phase 1 — live)
**File:** `src/systems/EventBus.js`
**Job:** Decouple systems and UI via pub/sub.
**API:** `bus.on(name, fn)`, `bus.once(name, fn)`, `bus.off(name, fn)`,
`bus.emit(name, payload)`, `bus.clear()`.
**Conventions:** event names are `domain:action`. Payloads are plain objects.

### Events emitted in Phase 1
| Event | Payload | Emitted by | Consumed by |
|---|---|---|---|
| `money:changed` | `{ balance: number }` | `Game` (initial 500) | `HUD` |

### Events planned (not yet implemented)
- `notification:show` — toast messages (Phase 7).
- `customer:orderPlaced` / `customer:left` (Phase 5).
- `food:cooked` / `cooking:started` (Phase 4).
- `supplier:purchase` (Phase 6).
- `recipe:unlocked` (Phase 8).