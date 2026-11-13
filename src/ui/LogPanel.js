import { bus } from "../systems/EventBus.js";

/**
 * Collapsible event log, pinned to the bottom-right anchor.
 * LogSystem keeps the last 10 entries and emits the whole array.
 */
export class LogPanel {
  constructor(root) {
    this.root = root;
    this.isCollapsed = false;
    this.logs = [];

    this.el = document.createElement("section");
    this.el.className = "hud-log";
    this.el.setAttribute("aria-label", "Game log");
    this.root.appendChild(this.el);

    this._buildUI();

    this._unsubscribe = bus.on("log:updated", (logs) => {
      this.logs = Array.isArray(logs) ? logs : [];
      this._render();
    });

    bus.emit("log:requestUpdate", {});
  }

  _buildUI() {
    const header = document.createElement("button");
    header.type = "button";
    header.className = "hud-log__header";
    header.setAttribute("aria-expanded", "true");

    const title = document.createElement("span");
    title.className = "hud-log__title";
    title.textContent = "Game Log";

    this.arrow = document.createElement("span");
    this.arrow.className = "hud-log__toggle";
    this.arrow.textContent = "▾";

    header.append(title, this.arrow);
    header.addEventListener("click", () => this._toggle());

    this.body = document.createElement("div");
    this.body.className = "hud-log__body";

    this.el.append(header, this.body);
    this._render();
  }

  _toggle() {
    this.isCollapsed = !this.isCollapsed;
    this.body.hidden = this.isCollapsed;
    this.arrow.textContent = this.isCollapsed ? "▸" : "▾";
    this.el.querySelector(".hud-log__header").setAttribute(
      "aria-expanded",
      String(!this.isCollapsed),
    );
  }

  _render() {
    if (!this.body) return;

    if (!this.logs.length) {
      this.body.replaceChildren(this._entry("Waiting for events…", "", true));
      return;
    }

    const entries = [];
    for (let index = this.logs.length - 1; index >= 0; index--) {
      const log = this.logs[index];
      entries.push(this._entry(log.text, log.time, false, log.tone));
    }
    this.body.replaceChildren(...entries);
  }

  _entry(text, time, empty = false, tone = "info") {
    const row = document.createElement("div");
    row.className = `hud-log__entry${empty ? " hud-log__entry--empty" : ""}${
      tone === "warning" ? " hud-log__entry--warning" : ""
    }${tone === "success" ? " hud-log__entry--success" : ""}`;

    if (time) {
      const stamp = document.createElement("span");
      stamp.className = "hud-log__time";
      stamp.textContent = time;
      row.appendChild(stamp);
    }

    const message = document.createElement("span");
    message.className = "hud-log__text";
    message.textContent = text;
    row.appendChild(message);
    return row;
  }

  dispose() {
    this._unsubscribe();
    this.el.remove();
  }
}
