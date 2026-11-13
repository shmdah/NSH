import { bus } from "../systems/EventBus.js";

/**
 * Right-middle queue of customers waiting to order / waiting for food.
 * Patience bars are refreshed by CustomerSystem ~4× per second.
 */
export class OrderQueue {
  constructor(root) {
    this.root = root;

    this.el = document.createElement("section");
    this.el.className = "hud-queue";
    this.el.setAttribute("aria-label", "Waiting orders");
    this.el.hidden = true;
    this.root.appendChild(this.el);

    this._unsubscribe = bus.on("queue:updated", ({ customers }) => this._render(customers));
    bus.emit("queue:requestUpdate", {});
  }

  _render(customers) {
    if (!Array.isArray(customers) || customers.length === 0) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }

    this.el.hidden = false;

    const title = document.createElement("div");
    title.className = "hud-queue__title";
    const titleText = document.createElement("span");
    titleText.textContent = "Orders";
    const count = document.createElement("span");
    count.className = "hud-queue__count";
    count.textContent = String(customers.length);
    title.append(titleText, count);

    this.el.replaceChildren(title, ...customers.map((customer) => this._createRow(customer)));
  }

  _createRow(customer) {
    const item = document.createElement("div");
    item.className = "hud-queue__item";
    item.dataset.customerId = String(customer.id);

    const header = document.createElement("div");
    header.className = "hud-queue__header";

    const label = document.createElement("span");
    label.className = "hud-queue__label";
    label.textContent = customer.type;

    const badges = document.createElement("span");
    badges.className = "hud-queue__badges";
    if (customer.isCar) {
      const carBadge = document.createElement("span");
      carBadge.className = "hud-queue__badge";
      carBadge.textContent = "CAR";
      badges.appendChild(carBadge);
    }
    const status = document.createElement("span");
    status.className = customer.status === "Waiting for food"
      ? "hud-queue__status hud-queue__status--food"
      : "hud-queue__status";
    status.textContent = customer.status === "Waiting for food" ? "Food" : "Order";
    badges.appendChild(status);

    header.append(label, badges);

    const detail = document.createElement("div");
    detail.className = "hud-queue__detail";
    detail.textContent = customer.detail || "1× Chapati Beans";

    const background = document.createElement("div");
    background.className = "hud-queue__bar-bg";
    background.setAttribute("role", "meter");
    background.setAttribute("aria-label", `${customer.type} patience`);

    const maxPatience = Number.isFinite(customer.maxPatience) && customer.maxPatience > 0
      ? customer.maxPatience
      : 1;
    const remaining = Number.isFinite(customer.patience) ? customer.patience : 0;
    const percentage = Math.max(0, Math.min(100, (remaining / maxPatience) * 100));

    const bar = document.createElement("div");
    bar.className = "hud-queue__bar";
    bar.style.width = `${percentage}%`;
    bar.classList.toggle("hud-queue__bar--warning", percentage < 50 && percentage >= 25);
    bar.classList.toggle("hud-queue__bar--critical", percentage < 25);

    background.setAttribute("aria-valuemin", "0");
    background.setAttribute("aria-valuemax", "100");
    background.setAttribute("aria-valuenow", percentage.toFixed(0));
    background.appendChild(bar);

    item.append(header, detail, background);
    return item;
  }

  dispose() {
    this._unsubscribe();
    this.el.remove();
  }
}
