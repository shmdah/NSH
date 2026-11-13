# AGENTS.md — Notes for AI pair programmers

## Rules
1. Work in small phases. Do not skip phases.
2. Systems never import Three.js. UI never imports Three.js.
3. All per-frame updates go through `core/Loop.js`. No setInterval.
4. All money display uses `utils/format.formatKSh`.
5. All system↔UI communication goes through `systems/EventBus.js`.
6. Event names use the pattern `domain:action`.
7. No new dependencies without explicit approval.
8. Before declaring a phase complete, list the files changed and the
   manual verification steps for the user.