import gsap from "gsap";
import { formatKSh } from "../utils/format.js";
import { bus } from "../systems/EventBus.js";
import { State } from "../game/State.js";

/**
 * Day clock + staff badge, and the centred end-of-day summary modal.
 * The summary is appended to document.body (never to a corner anchor) so it
 * always appears in the middle of the viewport.
 */
export class DayHUD {
  constructor(root) {
    this.root = root;
    this.summaryBackdrop = null;

    this.el = document.createElement("section");
    this.el.className = "hud-day";
    this.el.setAttribute("aria-label", "Day clock");
    this._buildUI();
    this.root.appendChild(this.el);

    this._unsubscribers = [
      bus.on("day:time", ({ remaining, total, day }) => this._updateClock(remaining, total, day)),
      bus.on("day:ended", (summary) => this._showSummary(summary)),
      bus.on("day:started", ({ day }) => {
        this._removeSummary();
        this.dayLabel.textContent = `DAY ${day}`;
      }),
      bus.on("progression:changed", ({ level, customersServed }) => {
        this.levelLabel.textContent = `Lv ${level}`;
        this.servedLabel.textContent = `${customersServed} served`;
      }),
      bus.on("staff:changed", () => this._renderStaff()),
    ];

    bus.emit("day:requestUpdate", {});
    bus.emit("progression:requestUpdate", {});
  }

  _buildUI() {
    const top = document.createElement("div");
    top.className = "hud-day__top";

    this.dayLabel = document.createElement("span");
    this.dayLabel.className = "hud-day__label";
    this.dayLabel.textContent = "DAY 1";

    this.timeLabel = document.createElement("span");
    this.timeLabel.className = "hud-day__time";
    this.timeLabel.textContent = "2:00";

    top.append(this.dayLabel, this.timeLabel);

    this.meter = document.createElement("div");
    this.meter.className = "hud-day__bar-bg";
    this.meter.setAttribute("role", "meter");
    this.meter.setAttribute("aria-label", "Time remaining today");
    this.meter.setAttribute("aria-valuemin", "0");
    this.meter.setAttribute("aria-valuemax", "100");

    this.bar = document.createElement("div");
    this.bar.className = "hud-day__bar";
    this.meter.appendChild(this.bar);

    const bottom = document.createElement("div");
    bottom.className = "hud-day__bottom";

    this.levelLabel = document.createElement("span");
    this.levelLabel.className = "hud-day__badge";
    this.levelLabel.textContent = "Lv 1";

    this.servedLabel = document.createElement("span");
    this.servedLabel.className = "hud-day__stat";
    this.servedLabel.textContent = "0 served";

    this.staffLabel = document.createElement("span");
    this.staffLabel.className = "hud-day__stat hud-day__stat--staff";
    this.staffLabel.textContent = "No staff";

    bottom.append(this.levelLabel, this.servedLabel, this.staffLabel);

    this.el.append(top, this.meter, bottom);
  }

  _renderStaff() {
    const parts = [];
    if (State.cooksHired > 0) parts.push(`👨‍🍳 ${State.cooksHired}`);
    if (State.waitersHired > 0) parts.push(`🤵 ${State.waitersHired}`);
    this.staffLabel.textContent = parts.length ? parts.join(" · ") : "No staff";
  }

  _updateClock(remaining, total, day) {
    const percentage = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
    this.dayLabel.textContent = `DAY ${day}`;
    this.timeLabel.textContent = this._formatTime(remaining);
    this.meter.setAttribute("aria-valuenow", percentage.toFixed(0));
    this.bar.style.width = `${percentage}%`;
    this.bar.classList.toggle("hud-day__bar--warning", percentage < 30 && percentage >= 10);
    this.bar.classList.toggle("hud-day__bar--critical", percentage < 10);
  }

  _formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safe / 60);
    return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
  }

  _showSummary({ day, sales, wages, reward, customersServed, finalMoney }) {
    this._removeSummary();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop is-open";
    backdrop.setAttribute("role", "presentation");

    const panel = document.createElement("section");
    panel.className = "day-summary";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "day-summary-title");

    const kicker = document.createElement("p");
    kicker.className = "day-summary__kicker";
    kicker.textContent = `Day ${day} complete`;

    const title = document.createElement("h2");
    title.id = "day-summary-title";
    title.textContent = "Karibu to the next day";

    const rewardLine = document.createElement("div");
    rewardLine.className = "day-summary__reward";
    const rewardValue = document.createElement("strong");
    rewardValue.textContent = `+${formatKSh(reward)}`;
    const rewardCaption = document.createElement("span");
    rewardCaption.textContent = "Daily reward";
    rewardLine.append(rewardValue, rewardCaption);

    const rows = document.createElement("div");
    rows.className = "day-summary__rows";
    rows.append(
      this._row("Sales today", formatKSh(sales ?? 0)),
      this._row("Customers served", String(customersServed ?? 0)),
      this._row("Staff wages", `-${formatKSh(wages ?? 0)}`),
    );

    const balance = document.createElement("p");
    balance.className = "day-summary__balance";
    balance.textContent = `New balance: ${formatKSh(finalMoney)}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn-primary day-summary__button";
    button.textContent = `Start Day ${day + 1}`;
    button.addEventListener("click", () => {
      this._removeSummary();
      bus.emit("day:startNext", {});
    });

    panel.append(kicker, title, rewardLine, rows, balance, button);
    backdrop.appendChild(panel);
    document.body.appendChild(backdrop);
    this.summaryBackdrop = backdrop;

    gsap.fromTo(
      panel,
      { autoAlpha: 0, y: 22, scale: 0.94 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)" },
    );
    button.focus({ preventScroll: true });
  }

  _row(label, value) {
    const row = document.createElement("p");
    row.className = "day-summary__row";
    const name = document.createElement("span");
    name.textContent = label;
    const amount = document.createElement("strong");
    amount.textContent = value;
    row.append(name, amount);
    return row;
  }

  _removeSummary() {
    if (!this.summaryBackdrop) return;
    gsap.killTweensOf(this.summaryBackdrop.querySelector(".day-summary"));
    this.summaryBackdrop.remove();
    this.summaryBackdrop = null;
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    this._removeSummary();
    this.el.remove();
  }
}
