import { Items } from "../data/Items.js";
import { Recipes } from "../data/Recipes.js";
import { State } from "../game/State.js";
import { bus } from "../systems/EventBus.js";

/**
 * Bottom-left inventory: ingredients, cooked food and plated counter food.
 */
export class Inventory {
  constructor(root) {
    this.root = root;

    this.el = document.createElement("section");
    this.el.className = "hud-inventory";
    this.el.setAttribute("aria-label", "Inventory");
    this.root.appendChild(this.el);

    this._unsubscribers = [
      bus.on("inventory:changed", () => this._render()),
      bus.on("food:cooked", () => this._render()),
      bus.on("food:served", () => this._render()),
      bus.on("food:counterChanged", () => this._render()),
    ];

    this._render();
  }

  _render() {
    const title = document.createElement("div");
    title.className = "hud-inventory__title";
    title.textContent = "Inventory";

    const ingredientRows = Object.values(Items).map((item) => {
      const amount = State.inventory[item.id] ?? 0;
      return this._row(
        `${item.icon ?? ""} ${item.name}`.trim(),
        `${this._formatAmount(amount)} ${item.unit}`,
        amount <= 0,
      );
    });

    const divider = document.createElement("div");
    divider.className = "hud-inventory__divider";

    const cookedRows = Object.values(Recipes).map((recipe) => {
      const amount = State.cookedFood[recipe.id] ?? 0;
      return this._row(recipe.name, String(amount), amount <= 0, "cooked");
    });

    const counterRow = this._row(
      "On the counter",
      String(State.foodOnCounter),
      State.foodOnCounter <= 0,
      "counter",
    );

    this.el.replaceChildren(
      title,
      ...ingredientRows,
      divider,
      ...cookedRows,
      counterRow,
    );
  }

  _row(label, value, dim = false, variant = "") {
    const row = document.createElement("div");
    row.className = `hud-inventory__row${
      variant ? ` hud-inventory__row--${variant}` : ""
    }${dim ? " hud-inventory__row--dim" : ""}`;

    const name = document.createElement("span");
    name.className = "hud-inventory__name";
    name.textContent = label;

    const amount = document.createElement("span");
    amount.className = "hud-inventory__amount";
    amount.textContent = value;

    row.append(name, amount);
    return row;
  }

  _formatAmount(amount) {
    if (!Number.isFinite(amount)) return "0";
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this.el.remove();
  }
}
