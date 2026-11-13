/**
 * A tiny publish/subscribe bus.
 *
 * Why this exists:
 * Systems (Economy, Cooking, etc.) must not import each other or the UI.
 * Instead, they emit events like `money:changed` and other systems/UI
 * listen for them. This keeps the codebase decoupled and testable.
 *
 * Rules of use:
 *   - Event names use the pattern `domain:action` (e.g. `customer:left`).
 *   - Payloads are plain objects. Never pass Three.js objects through the bus.
 *   - Listeners should not throw. If they do, the bus logs and continues.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on(eventName, handler) {
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);

    return () => this.off(eventName, handler);
  }

  /**
   * Subscribe once. The handler is removed after the first call.
   */
  once(eventName, handler) {
    const wrapped = (payload) => {
      this.off(eventName, wrapped);
      handler(payload);
    };
    return this.on(eventName, wrapped);
  }

  /**
   * Unsubscribe a specific handler.
   */
  off(eventName, handler) {
    const set = this._listeners.get(eventName);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) this._listeners.delete(eventName);
  }

  /**
   * Emit an event. Listener errors are caught so one bad listener
   * cannot take down the whole game.
   */
  emit(eventName, payload) {
    const set = this._listeners.get(eventName);
    if (!set) return;

    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[EventBus] listener for "${eventName}" threw:`, error);
      }
    }
  }

  /**
   * Remove every listener. Used when tearing down the game (e.g. reload).
   */
  clear() {
    this._listeners.clear();
  }
}

/** A single shared bus for the whole game. */
export const bus = new EventBus();