import * as THREE from "three";
import { CustomerTypes } from "../data/Customers.js";
import { Recipes } from "../data/Recipes.js";
import { Customer } from "../entities/Customer.js";
import { State, isFullyAutomated } from "../game/State.js";
import { bus } from "./EventBus.js";
import { formatKSh } from "../utils/format.js";

/**
 * Walking customers, queueing, taking orders and serving.
 *
 * The system is also the single place that pays for a served meal, so both
 * the player and waiters use the same economy / progression path.
 */
export class CustomerSystem {
  constructor(scene, world, economySystem, driveThruSystem = null) {
    this.scene = scene;
    this.world = world;
    this.economySystem = economySystem;
    this.driveThruSystem = driveThruSystem;

    this.customers = [];
    this.queuePositions = world.customerQueuePositions ?? [];
    this.slots = new Array(Math.max(1, this.queuePositions.length)).fill(null);
    this.spawnTimer = 4;
    this.maxCustomers = this.queuePositions.length || 3;
    this._queueEmitTimer = 0;
    this._disposed = false;

    this._unsubscribers = [
      bus.on("customer:destroyed", ({ customer }) => this._removeCustomer(customer)),
      bus.on("customer:served", ({ customer }) => this._releaseSlot(customer)),
      bus.on("customer:leftAngry", ({ customer }) => this._releaseSlot(customer)),
      bus.on("day:ended", () => this._clearCustomers()),
      bus.on("day:started", () => {
        this.spawnTimer = 3;
        this._emitQueue();
      }),
      bus.on("queue:requestUpdate", () => this._emitQueue()),
    ];

    this._emitQueue();
  }

  // -------------------------------------------------------------------------
  // Spawning + queue
  // -------------------------------------------------------------------------
  update(dt) {
    this._autoTakeOrders(dt);

    const freeSlot = this._findFreeSlot();
    if (freeSlot !== -1 && this.customers.length < this.maxCustomers) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnCustomer(freeSlot);
        this.spawnTimer = 8 + Math.random() * 6;
      }
    } else {
      this.spawnTimer = Math.max(this.spawnTimer, 2);
    }

    for (let index = this.customers.length - 1; index >= 0; index--) {
      const customer = this.customers[index];
      customer.update(dt);
      if (customer.destroyed) this.customers.splice(index, 1);
    }

    this._queueEmitTimer -= dt;
    if (this._queueEmitTimer <= 0) {
      this._queueEmitTimer = 0.25;
      this._emitQueue();
    }
  }

  _spawnCustomer(slotIndex) {
    const type = CustomerTypes[Math.floor(Math.random() * CustomerTypes.length)];
    const recipeIds = State.unlockedRecipes.filter((id) => Recipes[id]);
    const recipeId = recipeIds[Math.floor(Math.random() * recipeIds.length)] ?? "chapatiBeans";
    const queuePosition = this.queuePositions[slotIndex];

    // Everyone walks up the street from the south; the route is kept clear of
    // the building footprints by world.collisionBoxes.
    const spawnPosition = new THREE.Vector3(
      5.3 + Math.random() * 0.6,
      0.2,
      -31 - Math.random() * 4,
    );

    const customer = new Customer(this.scene, this.world, type, {
      position: spawnPosition,
      target: queuePosition,
      orderRecipeId: recipeId,
      exit: this.world.customerExitPoint,
      speed: 2.8 + Math.random() * 0.5,
    });

    customer.queueSlotIndex = slotIndex;
    this.slots[slotIndex] = customer;
    this.customers.push(customer);

    bus.emit("log:add", { text: `${type.name} is walking to the stall.` });
    bus.emit("queue:requestUpdate", {});
  }

  _findFreeSlot() {
    return this.slots.findIndex((customer) => customer === null || customer?.destroyed);
  }

  _releaseSlot(customer) {
    if (!customer) return;
    const index = customer.queueSlotIndex;
    if (index === undefined) return;
    if (this.slots[index] === customer) this.slots[index] = null;
    this._emitQueue();
  }

  _removeCustomer(customer) {
    const index = this.customers.indexOf(customer);
    if (index > -1) this.customers.splice(index, 1);
    this._releaseSlot(customer);
  }

  _clearCustomers() {
    for (const customer of [...this.customers]) customer.destroy();
    this.customers.length = 0;
    this.slots.fill(null);
    this.spawnTimer = 4;
    this._emitQueue();
  }

  _autoTakeOrders(dt) {
    if (State.waitersHired <= 0) return;

    const waiting = this._allWaitingCustomers();
    for (const customer of waiting) {
      if (customer.state !== "WAITING_FOR_ORDER") continue;
      customer._autoOrderTimer = (customer._autoOrderTimer ?? 0) + dt;
      if (customer._autoOrderTimer >= 1.5) {
        customer._autoOrderTimer = 0;
        if (customer.takeOrder()) {
          bus.emit("log:add", { text: `${customer.type.name} ordered ${Recipes[customer.orderRecipeId].name}.` });
          bus.emit("queue:requestUpdate", {});
        }
      }
    }
  }

  _allWaitingCustomers() {
    const list = this.customers.filter(
      (customer) => !customer.destroyed
        && (customer.state === "WAITING_FOR_ORDER" || customer.state === "ORDER_TAKEN"),
    );

    if (this.driveThruSystem) {
      for (const carData of this.driveThruSystem.getActiveCars()) {
        if (carData.state !== "PARKED") continue;
        const customer = carData.customer;
        if (
          !customer.destroyed
          && (customer.state === "WAITING_FOR_ORDER" || customer.state === "ORDER_TAKEN")
        ) {
          list.push(customer);
        }
      }
    }

    return list;
  }

  _emitQueue() {
    if (this._disposed) return;

    const customers = this._allWaitingCustomers().map((customer) => ({
      id: customer.id,
      type: customer.type.name,
      patience: Math.max(0, customer.patience),
      maxPatience: customer.maxPatience,
      status: customer.state === "ORDER_TAKEN" ? "Waiting for food" : "Ready to order",
      detail: `1× ${Recipes[customer.orderRecipeId]?.name ?? "Chapati Beans"}`,
      isCar: customer.isRiding,
    }));

    bus.emit("queue:updated", { customers });
  }

  // -------------------------------------------------------------------------
  // Orders + serving
  // -------------------------------------------------------------------------
  takeOrder(customer) {
    if (!customer || customer.state !== "WAITING_FOR_ORDER") return false;
    if (!customer.takeOrder()) return false;

    bus.emit("notification:show", {
      text: `Order taken: ${customer.type.name} wants ${Recipes[customer.orderRecipeId]?.name ?? "Chapati Beans"}.`,
    });
    bus.emit("log:add", { text: `Took an order from ${customer.type.name}.` });
    this._emitQueue();
    return true;
  }

  /**
   * Serves a customer and pays the player.
   * `alreadyPickedUp` is true when a waiter is carrying the plate.
   */
  serveCustomer(customer, { alreadyPickedUp = false, by = "player" } = {}) {
    if (!customer || customer.destroyed || customer.state !== "ORDER_TAKEN") return false;

    const recipeId = customer.orderRecipeId;
    const recipe = Recipes[recipeId] ?? Recipes.chapatiBeans;

    if (!alreadyPickedUp) {
      if ((State.cookedFood[recipeId] ?? 0) > 0) {
        State.cookedFood[recipeId] -= 1;
        bus.emit("food:served", { recipeId, amount: State.cookedFood[recipeId] });
      } else if (State.foodOnCounter > 0) {
        // A cook plated this one; the player may still hand it over.
        State.foodOnCounter -= 1;
        bus.emit("food:counterChanged", { amount: State.foodOnCounter, recipeId });
      } else {
        bus.emit("notification:show", {
          text: `No ${recipe.name} ready — cook some at the stall first.`,
          tone: "warning",
        });
        return false;
      }
    }

    const price = Math.round(recipe.sellPrice * (customer.type.budgetMultiplier ?? 1));
    this.economySystem.addMoney(price, "sale");

    State.reputation += 1;
    bus.emit("reputation:changed", { reputation: State.reputation });

    customer.serve();

    bus.emit("customer:served", {
      customer,
      id: customer.id,
      type: customer.type.name,
      price,
      isCar: Boolean(customer.isRiding),
      by,
    });

    const verb = by === "waiter" ? "Waiter served" : "Served";
    bus.emit("notification:show", {
      text: `${verb} ${customer.type.name} · +${formatKSh(price)}`,
      tone: "success",
    });
    bus.emit("log:add", {
      text: `${verb} ${customer.type.name} — +${formatKSh(price)}`,
      tone: "success",
    });

    this._releaseSlot(customer);
    this._emitQueue();
    return true;
  }

  /**
   * Called by Game when the player presses E near a customer/car.
   * Returns true when an interaction happened (so no "nothing here" toast).
   */
  tryPlayerServe(playerPosition) {
    if (isFullyAutomated()) {
      bus.emit("notification:show", {
        text: "Your staff is handling the customers.",
      });
      return true;
    }

    // Drive-thru customers have priority when the player is next to a car.
    const carData = this.driveThruSystem?.getNearbyCustomerCar(playerPosition, 4.4);
    if (carData) {
      return this._interactWith(carData.customer);
    }

    const nearest = this._nearestCustomer(
      playerPosition,
      3.4,
      (customer) => !customer.isRiding
        && (customer.state === "WAITING_FOR_ORDER" || customer.state === "ORDER_TAKEN"),
    );

    if (!nearest) return false;
    return this._interactWith(nearest);
  }

  _interactWith(customer) {
    if (!customer || customer.destroyed) return false;

    if (customer.state === "WAITING_FOR_ORDER") {
      return this.takeOrder(customer);
    }

    if (customer.state === "ORDER_TAKEN") {
      return this.serveCustomer(customer, { alreadyPickedUp: false, by: "player" });
    }

    return false;
  }

  _nearestCustomer(position, radius, predicate = () => true) {
    let best = null;
    let bestDistance = radius;

    for (const customer of this.customers) {
      if (customer.destroyed || !predicate(customer)) continue;
      const distance = Math.hypot(
        customer.position.x - position.x,
        customer.position.z - position.z,
      );
      if (distance < bestDistance) {
        best = customer;
        bestDistance = distance;
      }
    }
    return best;
  }

  getInteractionHint(playerPosition) {
    const carData = this.driveThruSystem?.getNearbyCustomerCar(playerPosition, 4.4);
    const customer = carData?.customer
      ?? this._nearestCustomer(
        playerPosition,
        3.4,
        (entry) => !entry.isRiding
          && (entry.state === "WAITING_FOR_ORDER" || entry.state === "ORDER_TAKEN"),
      );

    if (!customer) return null;

    if (isFullyAutomated()) return "Your staff is handling the customers.";
    if (customer.state === "WAITING_FOR_ORDER") return "E: Take order";
    if (customer.state === "ORDER_TAKEN") return "E: Serve food";
    return null;
  }

  // WaiterSystem helpers ----------------------------------------------------
  getCustomersAwaitingFood() {
    return this.customers.filter(
      (customer) => !customer.destroyed && customer.state === "ORDER_TAKEN",
    );
  }

  dispose() {
    this._disposed = true;
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    for (const customer of [...this.customers]) customer.destroy();
    this.customers.length = 0;
    this.slots.fill(null);
  }
}
