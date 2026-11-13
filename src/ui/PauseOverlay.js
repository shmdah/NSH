import { bus } from "../systems/EventBus.js";

/**
 * Full-screen pause overlay. P is handled by Game; this only reacts to the
 * game:paused / game:resumed events.
 */
export class PauseOverlay {
  constructor(root) {
    this.root = root;

    this.el = document.createElement("div");
    this.el.className = "pause-overlay";
    this.el.setAttribute("role", "status");
    this.el.setAttribute("aria-live", "assertive");

    const backdrop = document.createElement("div");
    backdrop.className = "pause-overlay__backdrop";

    const text = document.createElement("div");
    text.className = "pause-text";
    text.textContent = "PAUSED";

    const hint = document.createElement("div");
    hint.className = "pause-hint";
    hint.textContent = "Press P to Resume";

    const controls = document.createElement("div");
    controls.className = "pause-controls";
    controls.innerHTML = `
      <span><kbd>WASD</kbd> Move</span>
      <span><kbd>Space</kbd> Jump</span>
      <span><kbd>E</kbd> Interact</span>
      <span><kbd>C</kbd> Camera</span>
    `;

    this.el.append(backdrop, text, hint, controls);
    this.root.appendChild(this.el);

    this._unsubscribers = [
      bus.on("game:paused", () => this.show()),
      bus.on("game:resumed", () => this.hide()),
    ];
  }

  show() {
    this.el.classList.add("is-visible");
  }

  hide() {
    this.el.classList.remove("is-visible");
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.el.remove();
  }
}
