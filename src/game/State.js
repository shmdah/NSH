/**
 * State.js — the single source of truth for run-time game data.
 *
 * Rules:
 *   - Systems mutate State; UI only reads it (usually via bus events).
 *   - Never store Three.js objects in here. State must stay serialisable.
 *   - Money is always a number of Kenyan shillings (KSh).
 */
export const State = {
  // Wallet -----------------------------------------------------------------
  money: 3000,

  // Ingredients (units are defined in data/Items.js) -----------------------
  inventory: {
    flour: 2,
    beans: 2,
    oil: 1,
  },

  // Food the player cooked manually (served by hand) ------------------------
  cookedFood: {
    chapatiBeans: 0,
  },

  // Plated food waiting on the caravan counter for a waiter to collect -----
  foodOnCounter: 0,

  // Progression -------------------------------------------------------------
  hasCaravan: false,
  level: 1,
  customersServed: 0,
  tokenUnits: 100,
  rentPaidToday: false,

  // Staff (counts, not booleans — 0..2 each) -------------------------------
  cooksHired: 0,
  waitersHired: 0,

  // Upgrades ---------------------------------------------------------------
  upgrades: {
    betterJiko: false,
    extraTable: false,
  },

  // Menu / reputation ------------------------------------------------------
  unlockedRecipes: ["chapatiBeans"],
  reputation: 0,
};

/** True when the whole counter / kitchen / serving loop runs by itself. */
export function isFullyAutomated() {
  return State.cooksHired > 0 && State.waitersHired > 0;
}

/** Total daily wage bill: KSh 100 per cook + KSh 100 per waiter. */
export function dailyWages() {
  return State.cooksHired * 100 + State.waitersHired * 100;
}
