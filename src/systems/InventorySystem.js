import { Recipes } from "../data/Recipes.js";
import { State } from "../game/State.js";
import { bus } from "./EventBus.js";

/**
 * Ingredients, manual cooking and the cooking timer.
 *
 * Manual cooking (the player at the jiko) produces `State.cookedFood`, which
 * the player serves by hand. The Cook NPC produces `State.foodOnCounter`,
 * which waiters collect. Both paths consume the same ingredients.
 */
export class InventorySystem {
  constructor() {
    this.isCooking = false;
    this.cookTimer = 0;
    this.cookDuration = 0;
    this.currentRecipe = null;
  }

  hasIngredients(recipeId) {
    const recipe = Recipes[recipeId];
    if (!recipe) return false;

    return Object.entries(recipe.ingredients).every(
      ([itemId, amount]) => (State.inventory[itemId] ?? 0) >= amount - 1e-9,
    );
  }

  /** Deducts ingredients without starting a cook. Used by CookSystem. */
  tryConsumeIngredients(recipeId) {
    const recipe = Recipes[recipeId];
    if (!recipe || !this.hasIngredients(recipeId)) return false;

    for (const [itemId, amount] of Object.entries(recipe.ingredients)) {
      State.inventory[itemId] = Math.max(0, (State.inventory[itemId] ?? 0) - amount);
    }

    bus.emit("inventory:changed", { ...State.inventory });
    return true;
  }

  startCooking(recipeId) {
    if (this.isCooking) {
      bus.emit("notification:show", {
        text: "The jiko is already busy.",
        tone: "warning",
      });
      return false;
    }

    const recipe = Recipes[recipeId];
    if (!recipe) {
      bus.emit("notification:show", { text: "That recipe is unavailable." });
      return false;
    }

    if (!this.hasIngredients(recipeId)) {
      bus.emit("notification:show", {
        text: "Missing ingredients — buy flour, beans and oil from the supplier.",
        tone: "warning",
      });
      return false;
    }

    for (const [itemId, amount] of Object.entries(recipe.ingredients)) {
      State.inventory[itemId] = Math.max(0, (State.inventory[itemId] ?? 0) - amount);
    }

    this.isCooking = true;
    this.cookDuration = State.upgrades.betterJiko ? recipe.cookTime / 2 : recipe.cookTime;
    this.cookTimer = this.cookDuration;
    this.currentRecipe = recipeId;

    bus.emit("inventory:changed", { ...State.inventory });
    bus.emit("cooking:started", {
      recipeId,
      duration: this.cookDuration,
      recipeName: recipe.name,
    });
    bus.emit("notification:show", { text: `Cooking ${recipe.name}…` });
    bus.emit("log:add", { text: `Started cooking ${recipe.name}.` });
    return true;
  }

  update(dt) {
    if (!this.isCooking) return;

    this.cookTimer -= dt;
    bus.emit("cooking:progress", {
      recipeId: this.currentRecipe,
      remaining: Math.max(0, this.cookTimer),
      duration: this.cookDuration,
    });

    if (this.cookTimer > 0) return;

    const recipeId = this.currentRecipe;
    this.isCooking = false;
    this.cookTimer = 0;
    this.cookDuration = 0;
    this.currentRecipe = null;

    State.cookedFood[recipeId] = (State.cookedFood[recipeId] ?? 0) + 1;

    bus.emit("food:cooked", {
      recipeId,
      amount: State.cookedFood[recipeId],
      recipeName: Recipes[recipeId].name,
    });
    bus.emit("food:served", {
      recipeId,
      amount: State.cookedFood[recipeId],
      reason: "cooked",
    });
    bus.emit("notification:show", {
      text: `${Recipes[recipeId].name} is ready! Serve it to a customer.`,
      tone: "success",
    });
    bus.emit("log:add", { text: `${Recipes[recipeId].name} cooked and ready.` });
  }

  dispose() {
    this.isCooking = false;
    this.currentRecipe = null;
  }
}
