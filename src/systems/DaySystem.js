import { State, dailyWages } from "../game/State.js";
import { bus } from "./EventBus.js";
import { EconomySystem } from "./EconomySystem.js";
import { formatKSh } from "../utils/format.js";

const DAILY_REWARD = 5000;

/**
 * Day clock: 120 seconds per day.
 *
 * At the end of the day: wages are deducted first (KSh 100 per cook and per
 * waiter), then the KSh 5,000 daily reward is added. The summary is emitted
 * through the bus so DayHUD can show a centred modal.
 */
export class DaySystem {
  constructor(dayLength = 120, economySystem = new EconomySystem()) {
    if (!Number.isFinite(dayLength) || dayLength <= 0) {
      throw new RangeError("Day length must be a positive finite number.");
    }

    this.dayLength = dayLength;
    this.economySystem = economySystem;
    this.timeRemaining = dayLength;
    this.day = 1;
    this.isDayOver = false;
    this.sales = 0;
    this.wagesPaid = 0;
    this.reward = 0;

    this._unsubscribers = [
      bus.on("customer:served", ({ price }) => {
        if (Number.isFinite(price)) this.sales += price;
      }),
      bus.on("day:startNext", () => this.startNextDay()),
      bus.on("day:requestUpdate", () => this._emitTime()),
    ];

    this._emitTime();
  }

  _emitTime() {
    bus.emit("day:time", {
      remaining: this.timeRemaining,
      total: this.dayLength,
      day: this.day,
    });
  }

  update(dt) {
    if (this.isDayOver) return;
    if (!Number.isFinite(dt) || dt < 0) {
      throw new RangeError("Day update delta must be a non-negative finite number.");
    }

    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this._emitTime();
    if (this.timeRemaining <= 0) this._endDay();
  }

  _endDay() {
    if (this.isDayOver) return;
    this.isDayOver = true;

    const wages = dailyWages();
    this.wagesPaid = wages;

    if (wages > 0) {
      this.economySystem.chargeWages(wages);
      State.rentPaidToday = true;
      bus.emit("notification:show", {
        text: `Staff wages paid: -${formatKSh(wages)}`,
        tone: "warning",
      });
      bus.emit("log:add", { text: `Wages paid: -${formatKSh(wages)}`, tone: "warning" });
    }

    this.reward = DAILY_REWARD;
    this.economySystem.addMoney(DAILY_REWARD, "daily-reward");
    bus.emit("notification:show", {
      text: `Daily reward: +${formatKSh(DAILY_REWARD)}`,
      tone: "success",
    });
    bus.emit("log:add", {
      text: `Day ${this.day} complete — reward +${formatKSh(DAILY_REWARD)}.`,
      tone: "success",
    });

    bus.emit("day:ended", {
      day: this.day,
      sales: this.sales,
      wages,
      reward: this.reward,
      customersServed: State.customersServed,
      finalMoney: State.money,
      cooks: State.cooksHired,
      waiters: State.waitersHired,
    });
  }

  startNextDay() {
    if (!this.isDayOver) return false;

    this.day += 1;
    this.timeRemaining = this.dayLength;
    this.isDayOver = false;
    this.sales = 0;
    this.wagesPaid = 0;
    this.reward = 0;
    State.rentPaidToday = false;

    this._emitTime();
    bus.emit("day:started", { day: this.day });
    bus.emit("log:add", { text: `Day ${this.day} started. Let's hustle.` });
    return true;
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
  }
}
