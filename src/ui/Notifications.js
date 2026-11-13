import gsap from "gsap";
import { bus } from "../systems/EventBus.js";

/**
 * Top-centre toast notifications. Toasts stack vertically and fade out after
 * 3 seconds.
 */
export class Notifications {
  constructor(root) {
    this.root = root;
    this.maxVisible = 5;
    this.toasts = new Set();

    this.container = document.createElement("div");
    this.container.className = "notifications-container";
    this.container.setAttribute("aria-live", "polite");
    this.container.setAttribute("aria-relevant", "additions");
    this.root.appendChild(this.container);

    this._unsubscribe = bus.on("notification:show", ({ text, tone }) => this.show(text, tone));
  }

  show(text, tone = "info") {
    if (typeof text !== "string" || text.trim() === "") return;

    while (this.toasts.size >= this.maxVisible) {
      const oldest = this.toasts.values().next().value;
      this._removeToast(oldest);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast--${this._safeTone(tone)}`;
    toast.setAttribute("role", tone === "warning" ? "alert" : "status");
    toast.textContent = text;
    this.container.appendChild(toast);
    this.toasts.add(toast);

    // Existing toasts slide down to make room.
    for (const existing of this.toasts) {
      if (existing === toast) continue;
      gsap.to(existing, { y: 4, duration: 0.18, overwrite: false });
    }

    gsap.fromTo(
      toast,
      { autoAlpha: 0, y: -14, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: "back.out(1.6)" },
    );

    gsap.to(toast, {
      autoAlpha: 0,
      y: -12,
      duration: 0.32,
      delay: 3,
      ease: "power2.in",
      onComplete: () => this._removeToast(toast),
    });
  }

  _safeTone(tone) {
    return ["info", "success", "warning"].includes(tone) ? tone : "info";
  }

  _removeToast(toast) {
    if (!toast || !this.toasts.has(toast)) return;
    gsap.killTweensOf(toast);
    this.toasts.delete(toast);
    toast.remove();
  }

  dispose() {
    this._unsubscribe();
    for (const toast of this.toasts) gsap.killTweensOf(toast);
    this.toasts.clear();
    this.container.remove();
  }
}
