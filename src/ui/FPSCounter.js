import { bus } from "../systems/EventBus.js";

export class FPSCounter {
  constructor(root) {
    this.el = document.createElement("div");
    this.el.className = "hud-fps";
    this.el.hidden = true;
    this.el.setAttribute("aria-label", "Frames per second");
    root.appendChild(this.el);
    this._unsubscribers = [
      bus.on("performance:fps", ({ fps }) => {
        this.el.textContent = `${Math.round(fps)} FPS`;
      }),
      bus.on("performance:visible", ({ visible }) => {
        this.el.hidden = !visible;
      }),
    ];
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.el.remove();
  }
}
