# PHASES LOG — Ngara Street Hustle

A running log of what each phase actually delivered, what was deferred,
and what the user confirmed worked.

---

## Phase 1 — Project Foundation
**Started:** (today's date)
**Goal:** Vite + Three.js + GSAP skeleton, running scene, money HUD, docs.

### Delivered
- Vite dev server.
- Three.js scene: ground plane, bobbing amber box, warm 3-light rig,
  ACES tone mapping, PCF soft shadows, fog.
- GSAP: idle bob on the demo box, pulse on money change.
- EventBus with `money:changed` wired from Game → HUD.
- `formatKSh` money formatter.
- `KSh 500` shown in a top-right pill.
- Docs: GAME_DESIGN, GAME_ARCHITECTURE, DEVELOPMENT_ROADMAP, SYSTEMS, PHASES.

### Deferred (by design)
- Player, stall, cooking, customers, saving — all later phases.
- The `_buildDemoScene()` in Game.js is throwaway and will be replaced
  by `World.js` in Phase 2.

### User verification
- [ ] `npm run dev` opens without errors.
- [ ] Scene visible, box bobbing and rotating.
- [ ] `KSh 500` visible top-right, pulses once on load.
- [ ] Window resize keeps canvas full-screen.
- [ ] Console has no errors or warnings.