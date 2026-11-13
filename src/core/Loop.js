/**
 * The single requestAnimationFrame loop for the entire game.
 *
 * Why a dedicated class:
 *   - Every system that needs per-frame updates registers here.
 *   - No ad-hoc setInterval / setTimeout for game logic (those are banned).
 *   - Pause / resume becomes trivial (important for menus later).
 *
 * Time is provided in seconds as `dt` (delta time). Systems must use `dt`
 * so that gameplay feels identical at 30, 60, or 144 Hz.
 */
export class Loop {
  constructor() {
    this._callbacks = new Set();
    this._running = false;
    this._lastTime = 0;
    this._rafId = null;

    this._tick = this._tick.bind(this);
  }

  /** Register a callback: fn(dt, elapsedSeconds) */
  add(callback) {
    this._callbacks.add(callback);
    return () => this._callbacks.delete(callback);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this._running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _tick(now) {
    if (!this._running) return;

    // Seconds since last frame. Clamped to 0.1s so a tab-switch
    // doesn't deliver a 5-second dt that breaks physics or timers.
    const dt = Math.max(0, Math.min((now - this._lastTime) / 1000, 0.1));
    this._lastTime = now;

    for (const callback of this._callbacks) {
      try {
        callback(dt, now / 1000);
      } catch (error) {
        console.error("[Loop] callback threw:", error);
      }
    }

    this._rafId = requestAnimationFrame(this._tick);
  }
}