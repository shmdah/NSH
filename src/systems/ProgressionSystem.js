import { State } from "../game/State.js";
import { bus } from "./EventBus.js";

/**
 * Tracks customers served and unlocks Level 3 (restaurant) at 20.
 * The restaurant itself is a stub for now — it logs and notifies.
 */
export class ProgressionSystem {
  constructor() {
    this.level3Threshold = 20;
    this._unsubscribers = [
      bus.on("customer:served", () => this._onCustomerServed()),
      bus.on("progression:requestUpdate", () => this._emit()),
    ];
    this._emit();
  }

  _onCustomerServed() {
    State.customersServed += 1;
    this._emit();

    if (State.level < 3 && State.customersServed >= this.level3Threshold) {
      State.level = 3;
      this._emit();
      bus.emit("level:unlocked", { level: 3 });
      bus.emit("notification:show", {
        text: "Level 3 unlocked — you can now rent a restaurant!",
        tone: "success",
      });
      bus.emit("log:add", {
        text: "LEVEL 3 UNLOCKED: restaurant tier available (stub).",
        tone: "success",
      });
    }
  }

  _emit() {
    bus.emit("progression:changed", {
      level: State.level,
      customersServed: State.customersServed,
      nextLevelThreshold: State.level < 3 ? this.level3Threshold : null,
    });
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
  }
}
