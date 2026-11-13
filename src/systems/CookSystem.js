import * as THREE from "three";
import { Cook } from "../entities/Cook.js";
import { State } from "../game/State.js";
import { bus } from "./EventBus.js";

const MAX_COOKS = 2;
const MAX_COUNTER_FOOD = 2;
const WRAP_SECONDS = 2;

/**
 * Owns the cooks standing on the caravan roof.
 *
 * Auto-cook rule: while `foodOnCounter` (plus dishes already being wrapped)
 * is below 2 and ingredients exist, an idle cook starts wrapping. Exactly
 * WRAP_SECONDS later the dish is placed on the counter.
 */
export class CookSystem {
  constructor(scene, inventorySystem, world) {
    this.scene = scene;
    this.inventorySystem = inventorySystem;
    this.world = world;
    this.cooks = [];

    this._unsubscribers = [
      bus.on("cook:hired", () => this.hireCook()),
      bus.on("stall:changed", () => this._repositionCooks()),
      bus.on("food:counterChanged", ({ amount }) => this._syncFoodVisuals(amount)),
      bus.on("day:started", () => this._syncFoodVisuals(State.foodOnCounter)),
    ];

    if (State.cooksHired > 0) {
      for (let index = 0; index < Math.min(State.cooksHired, MAX_COOKS); index++) {
        this.hireCook(false);
      }
    }
  }

  hireCook(announce = true) {
    if (this.cooks.length >= MAX_COOKS) return false;

    if (!State.hasCaravan) {
      bus.emit("notification:show", {
        text: "Hire cooks after upgrading to the caravan.",
        tone: "warning",
      });
      return false;
    }

    const positions = this.world.cookPositions ?? [];
    const position = positions[this.cooks.length] ?? new THREE.Vector3(-6, 2, 0);
    const cook = new Cook(this.scene, position, this.cooks.length);
    cook.cooking = false;
    cook.cookTimer = 0;
    this.cooks.push(cook);

    State.cooksHired = this.cooks.length;
    bus.emit("staff:changed", { role: "cook", count: State.cooksHired });

    if (announce) {
      bus.emit("notification:show", {
        text: `Cook ${this.cooks.length} hired! They cook on the caravan roof.`,
        tone: "success",
      });
      bus.emit("log:add", { text: `Cook ${this.cooks.length} hired.` });
    }
    return true;
  }

  _repositionCooks() {
    const positions = this.world.cookPositions ?? [];
    this.cooks.forEach((cook, index) => {
      const position = positions[index];
      if (!position) return;
      cook.position.copy(position);
      cook.group.position.copy(position);
    });
  }

  _syncFoodVisuals(amount) {
    for (const cook of this.cooks) cook.setFoodOnCounter(amount > 0);
  }

  update(dt) {
    if (!this.cooks.length) return;

    for (const cook of this.cooks) {
      cook.update(dt);

      if (!cook.cooking) continue;
      cook.cookTimer -= dt;
      if (cook.cookTimer > 0) continue;

      cook.cooking = false;
      cook.cookTimer = 0;
      State.foodOnCounter += 1;
      cook.setFoodOnCounter(true);

      bus.emit("food:counterChanged", {
        amount: State.foodOnCounter,
        recipeId: "chapatiBeans",
      });
      bus.emit("log:add", { text: "Cook plated a Chapati Beans on the counter." });
    }

    const pending = State.foodOnCounter
      + this.cooks.filter((cook) => cook.cooking).length;
    let freeSlots = Math.max(0, MAX_COUNTER_FOOD - pending);
    if (freeSlots <= 0) return;

    for (const cook of this.cooks) {
      if (freeSlots <= 0) break;
      if (cook.cooking) continue;
      if (!this.inventorySystem.hasIngredients("chapatiBeans")) break;
      if (!this.inventorySystem.tryConsumeIngredients("chapatiBeans")) break;

      cook.cooking = true;
      cook.cookTimer = WRAP_SECONDS;
      cook.playWrappingAnimation(WRAP_SECONDS);
      freeSlots -= 1;
    }
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    for (const cook of this.cooks) cook.dispose();
    this.cooks.length = 0;
  }
}
