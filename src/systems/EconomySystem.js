import { State } from "../game/State.js";
import { bus } from "./EventBus.js";
import { formatKSh } from "../utils/format.js";

/**
 * Every shilling that enters or leaves the wallet goes through here.
 * Emits money:changed (UI) and economy:transaction (day accounting / logs).
 */
export class EconomySystem {
  addMoney(amount, reason = "income") {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Money added must be a positive finite amount.");
    }

    State.money += amount;
    bus.emit("money:changed", { balance: State.money, delta: amount, reason });
    bus.emit("economy:transaction", { type: "income", amount, balance: State.money, reason });
    return State.money;
  }

  spendMoney(amount, reason = "purchase") {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Money spent must be a positive finite amount.");
    }

    if (State.money < amount) {
      bus.emit("notification:show", {
        text: `Not enough money — you need ${formatKSh(amount - State.money)} more.`,
        tone: "warning",
      });
      return false;
    }

    State.money -= amount;
    bus.emit("money:changed", { balance: State.money, delta: -amount, reason });
    bus.emit("economy:transaction", { type: "expense", amount, balance: State.money, reason });
    return true;
  }

  /** Wages are taken even if the balance goes negative — the day is over. */
  chargeWages(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new RangeError("Wages charged must be a positive finite amount.");
    }

    State.money -= amount;
    bus.emit("money:changed", { balance: State.money, delta: -amount, reason: "wages" });
    bus.emit("economy:transaction", {
      type: "expense",
      amount,
      balance: State.money,
      reason: "wages",
    });
    return State.money;
  }

  canAfford(amount) {
    return State.money >= amount;
  }
}
