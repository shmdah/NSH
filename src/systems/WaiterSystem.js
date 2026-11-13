import * as THREE from "three";
import { Waiter } from "../entities/Waiter.js";
import { State } from "../game/State.js";
import { bus } from "./EventBus.js";

const MAX_WAITERS = 2;
const COUNTER_REACH = 1.6;
const SERVE_REACH = 1.7;
const FORCE_SERVE_RANGE = 3.0;
const FORCE_SERVE_TIME = 2.0;
const HARD_UNSTICK_TIME = 3.5;

/**
 * Owns the waiters.
 *
 * Loop per waiter:
 *   idle → find a waiting order (cars first) → walk to counter → pick up
 *   → walk to the customer → serve → idle.
 *
 * Stuck prevention:
 *   - if within 3 units of the target for > 2 s, the waiter force-serves;
 *   - if it makes no progress for > 3.5 s, it is teleported next to the
 *     target and serves there.
 */
export class WaiterSystem {
  constructor(scene, world, customerSystem, driveThruSystem = null) {
    this.scene = scene;
    this.world = world;
    this.customerSystem = customerSystem;
    this.driveThruSystem = driveThruSystem;
    this.waiters = [];
    this.counterPosition = new THREE.Vector3();
    this.idlePositions = [];

    this._syncPositions();

    this._unsubscribers = [
      bus.on("waiter:hired", () => this.hireWaiter()),
      bus.on("stall:changed", () => this._onStallChanged()),
      bus.on("day:started", () => this._resetWaiters()),
    ];

    if (State.waitersHired > 0) {
      for (let index = 0; index < Math.min(State.waitersHired, MAX_WAITERS); index++) {
        this.hireWaiter(false);
      }
    }
  }

  _syncPositions() {
    this.counterPosition.copy(this.world.counterPosition);
    this.idlePositions = (this.world.waiterIdlePositions ?? []).map((position) => position.clone());
    if (!this.idlePositions.length) {
      this.idlePositions.push(new THREE.Vector3(-3.4, 0.2, -2));
    }
  }

  hireWaiter(announce = true) {
    if (this.waiters.length >= MAX_WAITERS) return false;

    if (!State.hasCaravan) {
      bus.emit("notification:show", {
        text: "Hire waiters after upgrading to the caravan.",
        tone: "warning",
      });
      return false;
    }

    const position = this.idlePositions[this.waiters.length] ?? this.idlePositions[0];
    const waiter = new Waiter(this.scene, this.world, position, this.waiters.length);
    waiter._targetCustomer = null;
    waiter._targetInfo = null;
    waiter._serveTimer = 0;
    waiter.serveCooldown = 0;
    this.waiters.push(waiter);

    State.waitersHired = this.waiters.length;
    bus.emit("staff:changed", { role: "waiter", count: State.waitersHired });

    if (announce) {
      bus.emit("notification:show", {
        text: `Waiter ${this.waiters.length} hired! They auto-serve orders.`,
        tone: "success",
      });
      bus.emit("log:add", { text: `Waiter ${this.waiters.length} hired.` });
    }
    return true;
  }

  _onStallChanged() {
    this._syncPositions();
    for (const waiter of this.waiters) {
      if (waiter.hasFood) {
        this._returnFoodToCounter(waiter);
        waiter.hideFood();
      }
      waiter.stop();
      waiter.teleport(this.idlePositions[waiter.index] ?? this.idlePositions[0]);
      this._clearTarget(waiter);
    }
  }

  _resetWaiters() {
    for (const waiter of this.waiters) {
      if (waiter.hasFood) {
        this._returnFoodToCounter(waiter);
        waiter.hideFood();
      }
      waiter.stop();
      waiter.teleport(this.idlePositions[waiter.index] ?? this.idlePositions[0]);
      waiter.serveCooldown = 0;
      this._clearTarget(waiter);
    }
  }

  update(dt) {
    if (!this.waiters.length) return;

    const assignedIds = new Set();
    for (const waiter of this.waiters) {
      const target = waiter._targetCustomer;
      if (target && !target.destroyed) assignedIds.add(target.id);
    }

    const pending = this._countPending();
    const rushing = pending >= 2;

    for (const waiter of this.waiters) {
      waiter.setRushing(rushing);
      waiter.serveCooldown = Math.max(0, waiter.serveCooldown - dt);
      this._updateWaiter(waiter, dt, assignedIds);
      waiter.update(dt);
    }
  }

  // -------------------------------------------------------------------------
  // Per-waiter brain
  // -------------------------------------------------------------------------
  _updateWaiter(waiter, dt, assignedIds) {
    if (waiter.hasFood) {
      this._carryFoodToCustomer(waiter, dt);
      return;
    }

    if (waiter.serveCooldown > 0) {
      this._returnToIdle(waiter, dt);
      return;
    }

    if (waiter._targetCustomer && !this._isValidTarget(waiter._targetCustomer)) {
      this._clearTarget(waiter);
    }

    if (!waiter._targetCustomer) {
      if (!this._hasFoodAvailable()) {
        this._returnToIdle(waiter, dt);
        return;
      }

      const target = this._chooseTarget(assignedIds);
      if (!target) {
        this._returnToIdle(waiter, dt);
        return;
      }

      waiter._targetCustomer = target.customer;
      waiter._targetInfo = target;
      waiter._serveTimer = 0;
      assignedIds.add(target.customer.id);
    }

    // Walk to the counter and pick up a plate.
    const distanceToCounter = waiter.distanceTo(this.counterPosition);
    if (distanceToCounter > COUNTER_REACH) {
      waiter.moveTo(this.counterPosition);
      this._hardUnstick(waiter, this.counterPosition, false);
      return;
    }

    this._pickUpFood(waiter);
  }

  _carryFoodToCustomer(waiter, dt) {
    const customer = waiter._targetCustomer;
    if (!customer || customer.destroyed || customer.state !== "ORDER_TAKEN") {
      this._dropFood(waiter);
      return;
    }

    const targetPosition = this._resolveTargetPosition(waiter._targetInfo, customer);
    const distance = waiter.distanceTo(targetPosition);

    if (distance > SERVE_REACH) {
      waiter.moveTo(targetPosition);

      if (distance <= FORCE_SERVE_RANGE) {
        waiter._serveTimer += dt;
        if (waiter._serveTimer >= FORCE_SERVE_TIME) {
          this._serve(waiter, customer);
          return;
        }
      } else {
        waiter._serveTimer = 0;
      }

      this._hardUnstick(waiter, targetPosition, true);
      return;
    }

    this._serve(waiter, customer);
  }

  _serve(waiter, customer) {
    const served = this.customerSystem.serveCustomer(customer, {
      alreadyPickedUp: true,
      by: "waiter",
    });

    if (served) {
      waiter.hideFood();
      waiter.stop();
      waiter.serveCooldown = 0.6;
      this._clearTarget(waiter);
      return;
    }

    this._dropFood(waiter);
  }

  _pickUpFood(waiter) {
    let pickedUp = false;

    if (State.foodOnCounter > 0) {
      State.foodOnCounter -= 1;
      pickedUp = true;
      bus.emit("food:counterChanged", {
        amount: State.foodOnCounter,
        recipeId: "chapatiBeans",
      });
    } else if ((State.cookedFood.chapatiBeans ?? 0) > 0) {
      State.cookedFood.chapatiBeans -= 1;
      pickedUp = true;
      bus.emit("food:served", {
        recipeId: "chapatiBeans",
        amount: State.cookedFood.chapatiBeans,
      });
    }

    if (!pickedUp) {
      this._clearTarget(waiter);
      return;
    }

    waiter.showFood("chapatiBeans");
    waiter.stop();
  }

  /** Put carried food back instead of deleting it. */
  _dropFood(waiter) {
    if (waiter.hasFood) this._returnFoodToCounter(waiter);
    waiter.hideFood();
    waiter.stop();
    waiter.serveCooldown = 0.5;
    this._clearTarget(waiter);
  }

  _returnFoodToCounter(waiter) {
    if (State.foodOnCounter < 2) {
      State.foodOnCounter += 1;
      bus.emit("food:counterChanged", {
        amount: State.foodOnCounter,
        recipeId: "chapatiBeans",
      });
    } else {
      State.cookedFood.chapatiBeans = (State.cookedFood.chapatiBeans ?? 0) + 1;
      bus.emit("food:cooked", {
        recipeId: "chapatiBeans",
        amount: State.cookedFood.chapatiBeans,
      });
    }
  }

  _returnToIdle(waiter, dt) {
    const idlePosition = this.idlePositions[waiter.index] ?? this.idlePositions[0];
    if (waiter.distanceTo(idlePosition) > 1.0) {
      waiter.moveTo(idlePosition);
      this._hardUnstick(waiter, idlePosition, false);
    } else {
      waiter.stop();
    }
  }

  // -------------------------------------------------------------------------
  // Targeting
  // -------------------------------------------------------------------------
  _chooseTarget(assignedIds) {
    const targets = [];

    // Cars get priority over walking customers.
    if (this.driveThruSystem) {
      for (const carTarget of this.driveThruSystem.getPendingCarTargets()) {
        targets.push(carTarget);
      }
    }

    for (const customer of this.customerSystem.getCustomersAwaitingFood()) {
      targets.push({
        customer,
        isCar: false,
        position: new THREE.Vector3(
          customer.position.x - 1.15,
          0.2,
          customer.position.z,
        ),
      });
    }

    return targets.find((target) => (
      this._isValidTarget(target.customer) && !assignedIds.has(target.customer.id)
    )) ?? null;
  }

  _resolveTargetPosition(targetInfo, customer) {
    if (targetInfo?.isCar && targetInfo.carData && !targetInfo.carData.car.destroyed) {
      const carPosition = targetInfo.carData.car.group.position;
      return new THREE.Vector3(carPosition.x - 1.9, 0.2, carPosition.z);
    }

    return new THREE.Vector3(customer.position.x - 1.15, 0.2, customer.position.z);
  }

  _isValidTarget(customer) {
    return Boolean(
      customer
      && !customer.destroyed
      && customer.state === "ORDER_TAKEN",
    );
  }

  _hasFoodAvailable() {
    return State.foodOnCounter > 0 || (State.cookedFood.chapatiBeans ?? 0) > 0;
  }

  _countPending() {
    let count = this.customerSystem.getCustomersAwaitingFood().length;
    if (this.driveThruSystem) count += this.driveThruSystem.getPendingCarTargets().length;
    return count;
  }

  _clearTarget(waiter) {
    waiter._targetCustomer = null;
    waiter._targetInfo = null;
    waiter._serveTimer = 0;
  }

  _hardUnstick(waiter, targetPosition, forceServe) {
    if (waiter.stuckTimer < HARD_UNSTICK_TIME) return;

    waiter.teleport(new THREE.Vector3(targetPosition.x, 0.2, targetPosition.z));
    waiter.stuckTimer = 0;

    if (forceServe && waiter._targetCustomer) {
      this._serve(waiter, waiter._targetCustomer);
    }
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    for (const waiter of this.waiters) waiter.dispose();
    this.waiters.length = 0;
  }
}
