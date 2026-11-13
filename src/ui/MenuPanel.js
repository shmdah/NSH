import { Recipes } from "../data/Recipes.js";
import { State } from "../game/State.js";
import { bus } from "../systems/EventBus.js";

/**
 * Compact menu panel, mounted under the DayHUD in the top-left anchor.
 * Shows cooked stock and what is currently plated on the counter.
 */
export class MenuPanel {
  constructor(root) {
    this.root = root;

    this.el = document.createElement("section");
    this.el.className = "hud-menu";
    this.el.setAttribute("aria-label", "Food menu");
    this.root.appendChild(this.el);
    this._cookingName = null;

    this._unsubscribers = [
      bus.on("food:cooked", () => {
        this._cookingName = null;
        this._render();
      }),
      bus.on("food:served", () => this._render()),
      bus.on("food:counterChanged", () => this._render()),
      bus.on("cooking:started", ({ recipeName }) => {
        this._cookingName = recipeName ?? "food";
        this._renderCookingStatus();
      }),
    ];

    this._render();
  }

  _render() {
    const title = document.createElement("div");
    title.className = "hud-menu__title";
    title.textContent = "Menu";

    const rows = Object.values(Recipes).map((recipe) => {
      const row = document.createElement("div");
      row.className = "hud-menu__item";

      const name = document.createElement("span");
      name.className = "hud-menu__name";
      name.textContent = recipe.name;

      const count = document.createElement("span");
      count.className = "hud-menu__count";
      count.textContent = `${State.cookedFood[recipe.id] ?? 0} ready`;
      row.append(name, count);
      return row;
    });

    const counter = document.createElement("div");
    counter.className = "hud-menu__counter";
    const counterLabel = document.createElement("span");
    counterLabel.textContent = "Counter";
    const counterValue = document.createElement("strong");
    counterValue.textContent = String(State.foodOnCounter);
    counter.append(counterLabel, counterValue);

    const status = document.createElement("div");
    status.className = "hud-menu__status";
    status.hidden = true;
    this.status = status;

    this.el.replaceChildren(title, ...rows, counter, this.status);
    this._renderCookingStatus();
  }

  _renderCookingStatus() {
    if (!this.status) return;
    if (!this._cookingName) {
      this.status.hidden = true;
      return;
    }
    this.status.hidden = false;
    this.status.textContent = `Cooking ${this._cookingName}…`;
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.el.remove();
  }
}
