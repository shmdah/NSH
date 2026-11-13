import "./styles/main.css";

import { Game } from "./game/Game.js";
import { State } from "./game/State.js";
import { bus } from "./systems/EventBus.js";
import { EconomySystem } from "./systems/EconomySystem.js";
import { InventorySystem } from "./systems/InventorySystem.js";
import { DaySystem } from "./systems/DaySystem.js";
import { HUD } from "./ui/HUD.js";
import { DayHUD } from "./ui/DayHUD.js";
import { Inventory } from "./ui/Inventory.js";
import { MenuPanel } from "./ui/MenuPanel.js";
import { Notifications } from "./ui/Notifications.js";
import { OrderQueue } from "./ui/OrderQueue.js";
import { LogPanel } from "./ui/LogPanel.js";
import { CookingPanel } from "./ui/CookingPanel.js";
import { ShopPanel } from "./ui/ShopPanel.js";
import { PauseOverlay } from "./ui/PauseOverlay.js";

let fatalShown = false;

/** Replace a blank screen with a readable failure message. */
function showFatal(error) {
  if (fatalShown) return;
  fatalShown = true;
  console.error("[NSH] Fatal error:", error);

  const overlay = document.createElement("div");
  overlay.className = "fatal-error";
  overlay.innerHTML = `
    <div class="fatal-error__card">
      <h1>Ngara Street Hustle failed to start</h1>
      <p>${String(error?.message ?? error ?? "Unknown error")}</p>
      <button type="button" class="btn-primary" onclick="window.location.reload()">Reload</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

function getAnchor(id) {
  const anchor = document.getElementById(id);
  if (!anchor) {
    throw new Error(`NSH: missing UI anchor #${id}`);
  }
  return anchor;
}

function ensureBottomRightAnchor(uiRoot) {
  let anchor = document.getElementById("ui-bottom-right");
  if (!anchor) {
    anchor = document.createElement("div");
    anchor.id = "ui-bottom-right";
    anchor.className = "ui-anchor";
    uiRoot.appendChild(anchor);
  }
  return anchor;
}

/**
 * Entry point: read anchors, mount every UI panel, then boot the Game.
 */
function boot() {
  const canvas = document.getElementById("game-canvas");
  const uiRoot = document.getElementById("ui-root");

  if (!canvas || !uiRoot) {
    throw new Error("NSH: missing #game-canvas or #ui-root in index.html");
  }

  const anchors = {
    topLeft: getAnchor("ui-top-left"),
    topRight: getAnchor("ui-top-right"),
    bottomLeft: getAnchor("ui-bottom-left"),
    topCenter: getAnchor("ui-top-center"),
    rightMiddle: getAnchor("ui-right-middle"),
    bottomCenter: getAnchor("ui-bottom-center"),
  };
  const bottomRight = ensureBottomRightAnchor(uiRoot);

  // Systems that UI panels need to call (buying, cooking) ----------------
  const economySystem = new EconomySystem();
  const inventorySystem = new InventorySystem();
  const daySystem = new DaySystem(120, economySystem);

  // UI -------------------------------------------------------------------
  const dayHud = new DayHUD(anchors.topLeft);
  const hud = new HUD(anchors.topRight, anchors.bottomCenter);
  const inventory = new Inventory(anchors.bottomLeft);
  const menu = new MenuPanel(anchors.topLeft);
  const notifications = new Notifications(anchors.topCenter);
  const orderQueue = new OrderQueue(anchors.rightMiddle);
  const logPanel = new LogPanel(bottomRight);
  const cookingPanel = new CookingPanel(document.body, inventorySystem);
  const shopPanel = new ShopPanel(document.body, economySystem);
  const pauseOverlay = new PauseOverlay(document.body);

  // Game -----------------------------------------------------------------
  const game = new Game(canvas, economySystem, inventorySystem, daySystem);

  // Debug handle (useful in the console; harmless in production).
  window.__NSH__ = {
    game,
    State,
    bus,
    systems: {
      economy: economySystem,
      inventory: inventorySystem,
      day: daySystem,
      customers: game.customerSystem,
      cooks: game.cookSystem,
      waiters: game.waiterSystem,
      driveThru: game.driveThruSystem,
      progression: game.progressionSystem,
      log: game.logSystem,
    },
    ui: {
      dayHud,
      hud,
      inventory,
      menu,
      notifications,
      orderQueue,
      logPanel,
      cookingPanel,
      shopPanel,
      pauseOverlay,
    },
  };

  console.info("[NSH] Game booted");
}

window.addEventListener("error", (event) => {
  if (event.error) showFatal(event.error);
});
window.addEventListener("unhandledrejection", (event) => {
  showFatal(event.reason);
});

try {
  boot();
} catch (error) {
  showFatal(error);
}
