import gsap from "gsap";
import { bus } from "../systems/EventBus.js";
import { formatKSh } from "../utils/format.js";
import { State } from "../game/State.js";

/**
 * Money pill (top-right) + interaction prompt (bottom-centre).
 * Two roots, two independent panels — exactly one job each.
 */
export class HUD {
  constructor(moneyRoot, promptRoot) {
    this.moneyRoot = moneyRoot;
    this.promptRoot = promptRoot;

    this._buildMoneyPill();
    this._buildInteractionPrompt();

    this._unsubscribers = [
      bus.on("money:changed", ({ balance }) => this._setMoney(balance)),
      bus.on("interaction:prompt", ({ text }) => this._setPrompt(text)),
    ];

    this._setMoney(State.money, false);
  }

  _buildMoneyPill() {
    this.moneyPill = document.createElement("div");
    this.moneyPill.className = "hud-money";
    this.moneyPill.setAttribute("aria-label", "Wallet balance");

    const label = document.createElement("span");
    label.className = "hud-money__label";
    label.textContent = "Balance";

    this.moneyValue = document.createElement("span");
    this.moneyValue.className = "hud-money__value";
    this.moneyValue.textContent = formatKSh(State.money);

    this.moneyPill.append(label, this.moneyValue);
    this.moneyRoot.appendChild(this.moneyPill);
  }

  _buildInteractionPrompt() {
    this.prompt = document.createElement("div");
    this.prompt.className = "hud-interaction";
    this.prompt.setAttribute("role", "status");
    this.prompt.hidden = true;
    this.promptRoot.appendChild(this.prompt);
  }

  _setMoney(balance, animate = true) {
    if (!this.moneyValue) return;
    this.moneyValue.textContent = formatKSh(balance);

    if (!animate) return;
    gsap.killTweensOf(this.moneyPill);
    gsap.fromTo(
      this.moneyPill,
      { scale: 1 },
      { scale: 1.06, duration: 0.12, yoyo: true, repeat: 1, ease: "power2.out" },
    );
  }

  _setPrompt(text) {
    if (!this.prompt) return;
    if (typeof text === "string" && text.trim() !== "") {
      this.prompt.textContent = text;
      this.prompt.hidden = false;
    } else {
      this.prompt.textContent = "";
      this.prompt.hidden = true;
    }
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.moneyPill.remove();
    this.prompt.remove();
  }
}
