import * as THREE from "three";
import { Renderer } from "../core/Renderer.js";
import { Camera } from "../core/Camera.js";
import { Loop } from "../core/Loop.js";
import { Input } from "../core/Input.js";
import { bus } from "../systems/EventBus.js";
import { State, isFullyAutomated } from "./State.js";
import { World } from "./World.js";
import { Player } from "../entities/Player.js";
import { TriggerZone } from "../entities/TriggerZone.js";
import { CustomerSystem } from "../systems/CustomerSystem.js";
import { CookSystem } from "../systems/CookSystem.js";
import { WaiterSystem } from "../systems/WaiterSystem.js";
import { DriveThruSystem } from "../systems/DriveThruSystem.js";
import { LogSystem } from "../systems/LogSystem.js";
import { ProgressionSystem } from "../systems/ProgressionSystem.js";
import { DaySystem } from "../systems/DaySystem.js";

/**
 * Game orchestrator. Owns the renderer, world, systems and the single loop.
 * UI is created by main.js and only talks to the game through the EventBus.
 */
export class Game {
  constructor(canvas, economySystem, inventorySystem, daySystem = new DaySystem()) {
    this.canvas = canvas;
    this.economySystem = economySystem;
    this.inventorySystem = inventorySystem;
    this.daySystem = daySystem;

    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.world = new World(this.renderer.scene);
    this.camera = new Camera(canvas, this.renderer.scene);
    this.player = new Player(this.renderer.scene, this.world);

    // Systems -----------------------------------------------------------------
    this.logSystem = new LogSystem();
    this.progressionSystem = new ProgressionSystem();
    this.driveThruSystem = new DriveThruSystem(this.renderer.scene, this.world);
    this.customerSystem = new CustomerSystem(
      this.renderer.scene,
      this.world,
      this.economySystem,
      this.driveThruSystem,
    );
    this.cookSystem = new CookSystem(this.renderer.scene, this.inventorySystem, this.world);
    this.waiterSystem = new WaiterSystem(
      this.renderer.scene,
      this.world,
      this.customerSystem,
      this.driveThruSystem,
    );

    // Interaction zones ------------------------------------------------------
    this.cookZone = new TriggerZone(
      this.renderer.scene,
      this.world.cookInteractionPosition,
      2.4,
    );
    this.shopZone = new TriggerZone(
      this.renderer.scene,
      this.world.supplierPosition,
      3.2,
      0x38c172,
    );

    this.camera.setCollisionObjects(this.world.collisionObjects);

    this.isPaused = false;
    this._fpsFrames = 0;
    this._fpsWindowStart = null;
    this._lowPerformanceMode = false;

    this._unsubscribers = [
      bus.on("stall:changed", () => {
        this.cookZone.setPosition(this.world.cookInteractionPosition);
        this.shopZone.setPosition(this.world.supplierPosition);
        this.camera.setCollisionObjects(this.world.collisionObjects);
      }),
    ];

    // Prime every panel with the current State (UI mounts before Game).
    bus.emit("money:changed", { balance: State.money });
    bus.emit("inventory:changed", { ...State.inventory });
    bus.emit("reputation:changed", { reputation: State.reputation });
    bus.emit("progression:requestUpdate", {});
    bus.emit("day:requestUpdate", {});
    bus.emit("queue:requestUpdate", {});
    bus.emit("log:requestUpdate", {});

    this.loop = new Loop();
    this.loop.add(this._update.bind(this));
    this.loop.start();
  }

  get isAutomated() {
    return isFullyAutomated();
  }

  _update(dt, elapsedSeconds) {
    // Pause is handled even while paused so P can resume.
    if (this.input.wasPressed("KeyP")) {
      this.isPaused = !this.isPaused;
      bus.emit(this.isPaused ? "game:paused" : "game:resumed");
    }

    this.cookZone.update(dt);
    this.shopZone.update(dt);

    if (this.isPaused || this.daySystem.isDayOver) {
      this.renderer.render(this.camera.camera);
      this._updatePerformance(elapsedSeconds);
      this.input.endFrame();
      return;
    }

    // Camera modes ---------------------------------------------------------
    if (this.input.wasPressed("KeyC")) {
      const mode = this.camera.cycleMode();
      this.player.setVisible(mode !== "first");
      bus.emit("notification:show", {
        text: `Camera: ${mode === "first" ? "First-person" : mode === "wide" ? "Wide" : "Third-person"}`,
      });
    }

    // Player movement ------------------------------------------------------
    this.player.update(dt, this.input, this.camera);

    const inCookZone = this.cookZone.isPlayerInside(this.player.position);
    const inShopZone = this.shopZone.isPlayerInside(this.player.position);

    const customerHint = this.customerSystem.getInteractionHint(this.player.position);

    if (this.input.wasPressed("KeyE")) {
      if (inShopZone) {
        bus.emit("interaction:openShop");
      } else if (customerHint) {
        // Serving always wins over the cooking prompt at the counter.
        this.customerSystem.tryPlayerServe(this.player.position);
      } else if (inCookZone) {
        bus.emit("interaction:openCooking");
      } else {
        bus.emit("notification:show", {
          text: "Nothing nearby — cook at the stall, serve a customer, or visit the supplier.",
        });
      }
    }

    // U is the explicit cooking shortcut when one is standing at the stall.
    if (this.input.wasPressed("KeyU") && inCookZone) {
      bus.emit("interaction:openCooking");
    }

    // Interaction prompt ---------------------------------------------------
    let prompt = null;
    if (inShopZone) {
      prompt = "E: Supplier Shop";
    } else if (customerHint) {
      prompt = customerHint;
      if (inCookZone && !this.isAutomated) prompt += " · U: Cook";
    } else if (inCookZone) {
      prompt = "E: Cooking Station · U: Cook";
    }
    bus.emit("interaction:prompt", { text: prompt });

    // Simulation -----------------------------------------------------------
    this.inventorySystem.update(dt);
    this.customerSystem.update(dt);
    this.cookSystem.update(dt);
    this.driveThruSystem.update(dt);
    this.waiterSystem.update(dt);
    this.daySystem.update(dt);
    this.world.update(dt);
    this.camera.update(dt, this.player.position);

    this.renderer.render(this.camera.camera);
    this._updatePerformance(elapsedSeconds);
    this.input.endFrame();
  }

  _updatePerformance(elapsedSeconds) {
    if (this._fpsWindowStart === null) this._fpsWindowStart = elapsedSeconds;
    this._fpsFrames += 1;
    const elapsed = elapsedSeconds - this._fpsWindowStart;
    if (elapsed < 0.5) return;

    const fps = this._fpsFrames / elapsed;
    bus.emit("performance:fps", { fps });

    if (fps < 48 && !this._lowPerformanceMode) {
      this._lowPerformanceMode = true;
      this.world.setShadowMapSize(1024);
    }

    this._fpsWindowStart = elapsedSeconds;
    this._fpsFrames = 0;
  }

  dispose() {
    this.loop.stop();
    for (const unsubscribe of this._unsubscribers) unsubscribe();

    this.customerSystem.dispose();
    this.driveThruSystem.dispose();
    this.cookSystem.dispose();
    this.waiterSystem.dispose();
    this.inventorySystem.dispose();
    this.daySystem.dispose();
    this.logSystem.dispose();
    this.progressionSystem.dispose();

    this.cookZone.dispose();
    this.shopZone.dispose();
    this.player.dispose();
    this.camera.dispose();
    this.world.dispose();
    this.renderer.dispose();
    this.input.dispose();
  }
}
