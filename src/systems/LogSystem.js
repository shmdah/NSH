import { bus } from "./EventBus.js";

/**
 * Keeps the last 10 gameplay log entries and emits log:updated whenever the
 * list changes. UI (LogPanel) never touches the array directly.
 */
export class LogSystem {
  constructor() {
    this.logs = [];
    this._unsubscribers = [
      bus.on("log:add", ({ text, tone }) => this._addLog(text, tone)),
      bus.on("log:requestUpdate", () => this._emit()),
    ];

    this._addLog("Ngara Street is waking up. Open the stall!", "info");
    this._addLog("Press E at the supplier to buy ingredients.", "info");
  }

  _addLog(text, tone = "info") {
    if (typeof text !== "string" || text.trim() === "") return;

    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");

    this.logs.push({ time, text, tone });
    if (this.logs.length > 10) this.logs.shift();
    this._emit();
  }

  _emit() {
    bus.emit("log:updated", this.logs.slice());
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.logs.length = 0;
  }
}
