import gsap from "gsap";
import { Items } from "../data/Items.js";
import { Recipes } from "../data/Recipes.js";
import { State } from "../game/State.js";
import { bus } from "../systems/EventBus.js";
import { formatKSh } from "../utils/format.js";

/**
 * Bottom slide-up cooking station with a progress bar.
 * Mounted on document.body so it can slide over the whole viewport.
 */
export class CookingPanel {
  constructor(root, inventorySystem) {
    this.root = root;
    this.inventorySystem = inventorySystem;
    this.isOpen = false;
    this._progressTween = null;
    this._lastTickText = "";

    this.el = document.createElement("section");
    this.el.className = "ui-panel ui-panel--sheet cooking-panel";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", "Cooking station");
    this.el.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.el);

    this._buildUI();
    this._sync();

    this._unsubscribers = [
      bus.on("interaction:openCooking", () => this.open()),
      bus.on("inventory:changed", () => this._sync()),
      bus.on("staff:changed", () => this._sync()),
      bus.on("stall:changed", () => this._sync()),
      bus.on("cooking:started", ({ duration, recipeName }) => this._showProgress(duration, recipeName)),
      bus.on("cooking:progress", ({ remaining }) => this._updateProgressLabel(remaining)),
      bus.on("food:cooked", () => this._finishProgress()),
    ];

    this._onKeyDown = (event) => {
      if (event.code === "Escape" && this.isOpen) this.close();
    };
    window.addEventListener("keydown", this._onKeyDown);
  }

  _buildUI() {
    const header = document.createElement("header");
    header.className = "ui-panel__header";

    const titleWrap = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Cooking Station";
    this.subtitle = document.createElement("p");
    this.subtitle.className = "ui-panel__subtitle";
    this.subtitle.textContent = "Jiko at the stall";
    titleWrap.append(title, this.subtitle);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "ui-panel__close";
    close.setAttribute("aria-label", "Close cooking panel");
    close.textContent = "×";
    close.addEventListener("click", () => this.close());

    header.append(titleWrap, close);

    this.content = document.createElement("div");
    this.content.className = "ui-panel__content";

    const recipe = Recipes.chapatiBeans;
    const card = document.createElement("article");
    card.className = "recipe-card";

    const cardTop = document.createElement("div");
    cardTop.className = "recipe-card__top";

    const recipeName = document.createElement("h3");
    recipeName.textContent = recipe.name;

    const price = document.createElement("span");
    price.className = "recipe-card__price";
    price.textContent = formatKSh(recipe.sellPrice);

    cardTop.append(recipeName, price);

    const description = document.createElement("p");
    description.className = "recipe-card__description";
    description.textContent = recipe.description;

    const ingredients = document.createElement("div");
    ingredients.className = "recipe-card__ingredients";
    for (const [id, amount] of Object.entries(recipe.ingredients)) {
      const item = Items[id];
      const chip = document.createElement("span");
      chip.className = "ingredient-chip";
      chip.dataset.item = id;
      chip.textContent = `${item.icon ?? ""} ${amount} ${item.unit} ${item.name}`;
      ingredients.appendChild(chip);
    }

    this.ingredientHint = document.createElement("p");
    this.ingredientHint.className = "recipe-card__hint";

    this.cookButton = document.createElement("button");
    this.cookButton.type = "button";
    this.cookButton.className = "btn-primary";
    this.cookButton.textContent = `Cook ${recipe.name}`;
    this.cookButton.addEventListener("click", () => {
      this.inventorySystem.startCooking(recipe.id);
      this._sync();
    });

    card.append(cardTop, description, ingredients, this.ingredientHint, this.cookButton);
    this.content.appendChild(card);

    this.staffHint = document.createElement("p");
    this.staffHint.className = "cooking-panel__staff-hint";
    this.content.appendChild(this.staffHint);

    this.progress = document.createElement("div");
    this.progress.className = "cook-progress";
    this.progress.hidden = true;

    const progressHeader = document.createElement("div");
    progressHeader.className = "cook-progress__header";
    this.progressLabel = document.createElement("span");
    this.progressLabel.textContent = "Cooking…";
    this.progressTime = document.createElement("span");
    this.progressTime.textContent = "";
    progressHeader.append(this.progressLabel, this.progressTime);

    const progressTrack = document.createElement("div");
    progressTrack.className = "cook-progress__track";
    this.progressBar = document.createElement("div");
    this.progressBar.className = "cook-progress__bar";
    progressTrack.appendChild(this.progressBar);

    this.progress.append(progressHeader, progressTrack);

    this.el.append(header, this.content, this.progress);
  }

  _sync() {
    if (!this.cookButton) return;

    const recipe = Recipes.chapatiBeans;
    const busy = this.inventorySystem.isCooking;
    const hasIngredients = this.inventorySystem.hasIngredients(recipe.id);

    this.cookButton.disabled = busy || !hasIngredients;
    this.cookButton.textContent = busy ? "Cooking…" : `Cook ${recipe.name}`;

    this.ingredientHint.textContent = hasIngredients
      ? "All ingredients in stock."
      : "Missing ingredients — buy flour, beans and oil at the supplier.";
    this.ingredientHint.classList.toggle("recipe-card__hint--warning", !hasIngredients);

    for (const chip of this.content.querySelectorAll(".ingredient-chip")) {
      const id = chip.dataset.item;
      const have = State.inventory[id] ?? 0;
      const need = recipe.ingredients[id] ?? 0;
      const enough = have >= need - 1e-9;
      chip.classList.toggle("ingredient-chip--missing", !enough);
      chip.title = enough ? "In stock" : `Need ${need} ${Items[id].unit}, have ${have}`;
    }

    if (State.cooksHired > 0) {
      this.staffHint.textContent = `${State.cooksHired} cook(s) on the caravan roof are auto-cooking. Manual cooking is optional.`;
    } else if (State.hasCaravan) {
      this.staffHint.textContent = "Hire a cook at the supplier to automate this station.";
    } else {
      this.staffHint.textContent = "Upgrade to the caravan to hire cooks and waiters.";
    }
  }

  open() {
    this.isOpen = true;
    this.el.classList.add("is-open");
    this.el.setAttribute("aria-hidden", "false");
    this._sync();

    if (this.inventorySystem.isCooking) {
      this._showProgress(
        Math.max(0, this.inventorySystem.cookTimer),
        Recipes[this.inventorySystem.currentRecipe]?.name ?? "Chapati Beans",
        this.inventorySystem.cookDuration,
      );
    }
  }

  close() {
    this.isOpen = false;
    this.el.classList.remove("is-open");
    this.el.setAttribute("aria-hidden", "true");
  }

  _showProgress(duration, recipeName, totalDuration = duration) {
    if (duration <= 0) return;

    this.progress.hidden = false;
    this.progressLabel.textContent = `Cooking ${recipeName ?? "food"}`;
    this._progressTween?.kill();
    this.progressBar.style.width = "0%";

    const elapsed = Math.max(0, (totalDuration ?? duration) - duration);
    if (elapsed > 0) {
      this.progressBar.style.width = `${Math.min(100, (elapsed / (totalDuration ?? duration)) * 100)}%`;
    }

    this._progressTween = gsap.to(this.progressBar, {
      width: "100%",
      duration,
      ease: "none",
    });
    this._sync();
  }

  _updateProgressLabel(remaining) {
    if (this.progress.hidden) return;
    const text = `${Math.max(0, remaining).toFixed(1)}s`;
    if (text === this._lastTickText) return;
    this._lastTickText = text;
    this.progressTime.textContent = text;
  }

  _finishProgress() {
    this._progressTween?.kill();
    this.progress.hidden = true;
    this.progressBar.style.width = "0%";
    this.progressTime.textContent = "";
    this._sync();
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    window.removeEventListener("keydown", this._onKeyDown);
    this._progressTween?.kill();
    this.el.remove();
  }
}
