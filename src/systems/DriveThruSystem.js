import * as THREE from "three";
import { Car } from "../entities/Car.js";
import { Customer } from "../entities/Customer.js";
import { CustomerTypes } from "../data/Customers.js";
import { State } from "../game/State.js";
import { bus } from "./EventBus.js";

const MAX_CARS = 2;
const DRIVE_TIMEOUT = 5;
const CAR_COLORS = [0x336699, 0x993333, 0x339933, 0x999933, 0x663399, 0x2f4f4f];

/**
 * Drive-thru traffic.
 *
 * A car drives from the south end of the street to one of the two marked
 * bays. Its customer is synced to the car window every single frame (during
 * the drive too), then orders / eats while seated. If a car fails to reach
 * its bay within 5 seconds it is force-parked — it can never get stuck.
 */
export class DriveThruSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.spawnTimer = 8;

    this.parkingSpots = (world.parkingLotPositions ?? []).map((position) => position.clone());
    this.spawnPoint = (world.carSpawnPoint ?? new THREE.Vector3(3.5, 0.2, -28)).clone();
    this.exitPoint = (world.carExitPoint ?? new THREE.Vector3(3.5, 0.2, 34)).clone();

    // Offset from car centre to the passenger's head/torso at the left window.
    this._passengerOffset = new THREE.Vector3(-0.55, -0.13, 0.05);
    this._upAxis = new THREE.Vector3(0, 1, 0);
    this._syncVector = new THREE.Vector3();

    this._unsubscribers = [
      bus.on("customer:finished", ({ customer }) => this._onCustomerFinished(customer)),
      bus.on("customer:leftAngry", ({ customer }) => this._onCustomerLeftAngry(customer)),
      bus.on("stall:changed", () => {
        this.spawnTimer = State.hasCaravan ? 6 : 8;
        if (!State.hasCaravan) this._clearCars();
      }),
      bus.on("day:ended", () => this._clearCars()),
      bus.on("day:started", () => {
        this.spawnTimer = 6;
      }),
    ];
  }

  getActiveCars() {
    return this.cars;
  }

  getParkedCars() {
    return this.cars.filter((carData) => carData.state === "PARKED");
  }

  update(dt) {
    if (!State.hasCaravan) {
      if (this.cars.length) this._clearCars();
      return;
    }

    this.spawnTimer -= dt;

    if (this.spawnTimer <= 0) {
      if (this.cars.length < MAX_CARS) {
        const occupied = new Set(
          this.cars
            .filter((carData) => carData.state !== "LEAVING")
            .map((carData) => carData.spotIndex),
        );
        const freeIndex = this.parkingSpots.findIndex((_, index) => !occupied.has(index));

        if (freeIndex !== -1) {
          this._spawnCar(freeIndex);
          this.spawnTimer = 12 + Math.random() * 7;
        } else {
          this.spawnTimer = 2;
        }
      } else {
        this.spawnTimer = 3;
      }
    }

    for (const carData of [...this.cars]) {
      this._updateCar(carData, dt);
    }
  }

  _spawnCar(spotIndex) {
    const spot = this.parkingSpots[spotIndex];
    if (!spot) return;

    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const car = new Car(this.scene, color);
    car.setPosition(this.spawnPoint.clone());
    car.driveTo(spot.clone(), 0);

    const type = CustomerTypes[Math.floor(Math.random() * CustomerTypes.length)];
    const customer = new Customer(this.scene, this.world, type, {
      position: spot.clone(),
      riding: true,
      orderRecipeId: "chapatiBeans",
      target: spot.clone(),
    });
    customer.maxPatience = type.patience + 8;
    customer.patience = customer.maxPatience;
    customer.state = "WAITING_FOR_ORDER";
    customer.group.visible = true;
    customer.group.scale.setScalar(0.8);
    customer._setIndicator(0xff3333, 0.9);

    const carData = {
      car,
      customer,
      spot: spot.clone(),
      spotIndex,
      state: "DRIVING",
      driveTimer: 0,
      leaveTimer: 0,
      leaveDelay: 0,
    };

    this.cars.push(carData);
    this._syncCustomerToCar(carData);

    bus.emit("log:add", { text: "A car is pulling into the drive-thru." });
  }

  _updateCar(carData, dt) {
    if (carData.state === "REMOVED") return;

    carData.car.update(dt);
    this._syncCustomerToCar(carData);

    if (carData.state === "DRIVING") {
      carData.driveTimer += dt;
      const distance = carData.car.group.position.distanceTo(carData.spot);

      if (distance < 0.7 || carData.driveTimer >= DRIVE_TIMEOUT) {
        this._parkCar(carData);
      }
      return;
    }

    if (carData.state === "PARKED") {
      carData.customer.update(dt);

      if (carData.customer.state === "LEAVING") {
        this._startLeaving(carData);
        return;
      }

      if (carData.customer.state === "EATING") {
        // The car waits until the meal finishes (customer:finished handles it).
        return;
      }
      return;
    }

    if (carData.state === "WAITING_LEAVE") {
      carData.customer.update(dt);
      carData.leaveTimer += dt;
      if (carData.leaveTimer >= carData.leaveDelay) {
        this._startLeaving(carData);
      }
      return;
    }

    if (carData.state === "LEAVING") {
      carData.customer.update(dt);
      carData.leaveTimer += dt;

      if (carData.car.group.position.z > 31 || carData.leaveTimer > 8) {
        this._removeCar(carData);
      }
    }
  }

  _parkCar(carData) {
    carData.state = "PARKED";
    carData.driveTimer = 0;
    carData.car.stop();
    carData.car.group.position.copy(carData.spot);
    carData.car.group.rotation.y = 0;

    // Ensure the customer is visible and waiting by the window.
    carData.customer.state = "WAITING_FOR_ORDER";
    carData.customer._setIndicator(0xff3333, 1);
    this._syncCustomerToCar(carData);

    bus.emit("notification:show", {
      text: `${carData.customer.type.name} parked at the drive-thru window.`,
    });
    bus.emit("log:add", { text: `${carData.customer.type.name} parked — drive-thru order ready.` });
  }

  _syncCustomerToCar(carData) {
    const { car, customer } = carData;
    if (!customer || customer.destroyed) return;

    const offset = this._syncVector
      .copy(this._passengerOffset)
      .applyAxisAngle(this._upAxis, car.group.rotation.y);

    customer.group.position.copy(car.group.position).add(offset);
    customer.group.rotation.y = car.group.rotation.y - Math.PI / 2;
    customer.group.visible = true;
    customer.position.copy(car.group.position);
  }

  _onCustomerFinished(customer) {
    const carData = this.cars.find((entry) => entry.customer === customer);
    if (!carData) return;

    carData.state = "WAITING_LEAVE";
    carData.leaveTimer = 0;
    carData.leaveDelay = 0.8;
  }

  _onCustomerLeftAngry(customer) {
    const carData = this.cars.find((entry) => entry.customer === customer);
    if (!carData) return;
    this._startLeaving(carData);
  }

  _startLeaving(carData) {
    if (carData.state === "LEAVING" || carData.state === "REMOVED") return;
    carData.state = "LEAVING";
    carData.leaveTimer = 0;
    carData.car.driveAway(this.exitPoint.clone());
  }

  _removeCar(carData) {
    if (carData.state === "REMOVED") return;
    carData.state = "REMOVED";
    carData.car.destroy();
    if (!carData.customer.destroyed) carData.customer.destroy();

    const index = this.cars.indexOf(carData);
    if (index > -1) this.cars.splice(index, 1);
  }

  _clearCars() {
    for (const carData of [...this.cars]) this._removeCar(carData);
    this.cars.length = 0;
  }

  // -------------------------------------------------------------------------
  // Queries used by the player + waiters
  // -------------------------------------------------------------------------
  getNearbyCustomerCar(playerPosition, radius = 4.4) {
    let best = null;
    let bestDistance = radius;

    for (const carData of this.cars) {
      if (carData.state !== "PARKED") continue;
      const { customer, car } = carData;
      if (customer.destroyed) continue;
      if (customer.state !== "WAITING_FOR_ORDER" && customer.state !== "ORDER_TAKEN") continue;

      const distance = Math.hypot(
        car.group.position.x - playerPosition.x,
        car.group.position.z - playerPosition.z,
      );
      if (distance < bestDistance) {
        best = carData;
        bestDistance = distance;
      }
    }

    return best;
  }

  getPendingCarTargets() {
    const targets = [];
    for (const carData of this.cars) {
      if (carData.state !== "PARKED") continue;
      if (carData.customer.destroyed || carData.customer.state !== "ORDER_TAKEN") continue;

      targets.push({
        customer: carData.customer,
        carData,
        isCar: true,
        position: new THREE.Vector3(
          carData.car.group.position.x - 1.9,
          0.2,
          carData.car.group.position.z,
        ),
      });
    }
    return targets;
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._clearCars();
  }
}
