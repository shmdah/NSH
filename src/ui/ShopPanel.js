import { bus } from "../systems/EventBus.js";
import { Items } from "../data/Items.js";
import { State } from "../game/State.js";
import { EconomySystem } from "../systems/EconomySystem.js";
import { formatKSh } from "../utils/format.js";

const COOK_PRICE = 800;
const WAITER_PRICE = 800;
const CARAVAN_PRICE = 5000;
const TOKEN_PRICE = 5;
const TOKEN_REWARD = 100000;
const MAX_STAFF = 2;

/**
 * Supplier shop (ingredients, staff, caravan upgrade and the simulated
 * KSh 100,000 token pack). Mounted on document.body as a centered modal.
 */
export class ShopPanel {
  constructor(root, economy = new EconomySystem()) {
    this.root = root;
    this.economy = economy;
    this.isOpen = false;
    this.ingredientButtons = new Map();

    this.backdrop = document.createElement("div");
    this.backdrop.className = "modal-backdrop shop-backdrop";
    this.backdrop.setAttribute("aria-hidden", "true");
    this.backdrop.addEventListener("click", (event) => {
      if (event.target === this.backdrop) this.close();
    });

    this.el = document.createElement("section");
    this.el.className = "ui-panel ui-panel--modal shop-panel";
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-modal", "true");
    this.el.setAttribute("aria-labelledby", "shop-title");
    this.backdrop.appendChild(this.el);
    this.root.appendChild(this.backdrop);

    this._buildUI();
    this._refresh();

    this._onKeyDown = (event) => {
      if (event.code === "Escape" && this.isOpen) this.close();
    };
    window.addEventListener("keydown", this._onKeyDown);

    this._unsubscribers = [
      bus.on("interaction:openShop", () => this.open()),
      bus.on("money:changed", () => this._refresh()),
      bus.on("inventory:changed", () => this._refresh()),
      bus.on("staff:changed", () => this._refresh()),
      bus.on("stall:changed", () => this._refresh()),
      bus.on("upgrade:caravan", () => this._refresh()),
    ];
  }

  _buildUI() {
    const header = document.createElement("header");
    header.className = "ui-panel__header";

    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.id = "shop-title";
    title.textContent = "Supplier";
    const subtitle = document.createElement("p");
    subtitle.className = "ui-panel__subtitle";
    subtitle.textContent = "Ngara market · buy stock and hire staff";
    heading.append(title, subtitle);

    const headerRight = document.createElement("div");
    headerRight.className = "shop-header-right";

    this.balance = document.createElement("span");
    this.balance.className = "shop-balance";
    this.balance.textContent = formatKSh(State.money);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "ui-panel__close";
    close.setAttribute("aria-label", "Close supplier shop");
    close.textContent = "×";
    close.addEventListener("click", () => this.close());

    headerRight.append(this.balance, close);
    header.append(heading, headerRight);

    const content = document.createElement("div");
    content.className = "ui-panel__content shop-content";

    // Ingredients ----------------------------------------------------------
    const ingredientsSection = this._section("Ingredients", "Restock the jiko");
    for (const item of Object.values(Items)) {
      const row = document.createElement("div");
      row.className = "shop-item";

      const info = document.createElement("div");
      info.className = "shop-item__info";
      const name = document.createElement("div");
      name.className = "shop-item__name";
      name.textContent = `${item.icon ?? ""} ${item.name}`.trim();
      const price = document.createElement("div");
      price.className = "shop-item__price";
      price.textContent = `${formatKSh(item.basePrice)} / ${item.unit}`;
      info.append(name, price);

      const stock = document.createElement("span");
      stock.className = "shop-item__stock";
      stock.textContent = `${this._formatAmount(State.inventory[item.id] ?? 0)} ${item.unit}`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-buy";
      button.textContent = "Buy 1";
      button.addEventListener("click", () => this._buyIngredient(item));

      const controls = document.createElement("div");
      controls.className = "shop-item__controls";
      controls.append(stock, button);

      row.append(info, controls);
      ingredientsSection.list.appendChild(row);
      this.ingredientButtons.set(item.id, { button, stock, item });
    }
    content.appendChild(ingredientsSection.section);

    // Staff ----------------------------------------------------------------
    const staffSection = this._section("Staff", "KSh 100/day each · max 2 each");
    this.staffRows = new Map();
    for (const role of ["cook", "waiter"]) {
      const row = document.createElement("div");
      row.className = "shop-item";

      const info = document.createElement("div");
      info.className = "shop-item__info";
      const name = document.createElement("div");
      name.className = "shop-item__name";
      name.textContent = role === "cook" ? "Cook 👨‍🍳" : "Waiter 🤵";
      const description = document.createElement("div");
      description.className = "shop-item__price";
      description.textContent = role === "cook"
        ? "Auto-cooks Chapati Beans on the caravan roof."
        : "Collects from the counter and serves customers.";
      info.append(name, description);

      const status = document.createElement("span");
      status.className = "shop-item__stock";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn-buy";
      button.textContent = `Hire · ${formatKSh(COOK_PRICE)}`;
      button.addEventListener("click", () => this._hire(role));

      const controls = document.createElement("div");
      controls.className = "shop-item__controls";
      controls.append(status, button);

      row.append(info, controls);
      staffSection.list.appendChild(row);
      this.staffRows.set(role, { button, status });
    }
    content.appendChild(staffSection.section);

    // Caravan --------------------------------------------------------------
    const upgradeSection = this._section("Upgrades", "Grow the hustle");
    const caravanRow = document.createElement("div");
    caravanRow.className = "shop-item shop-item--feature";

    const caravanInfo = document.createElement("div");
    caravanInfo.className = "shop-item__info";
    const caravanName = document.createElement("div");
    caravanName.className = "shop-item__name";
    caravanName.textContent = "Food Caravan";
    const caravanDescription = document.createElement("div");
    caravanDescription.className = "shop-item__price";
    caravanDescription.textContent = "Bigger stall, rooftop kitchen, drive-thru bays and staff hiring.";
    caravanInfo.append(caravanName, caravanDescription);

    this.caravanButton = document.createElement("button");
    this.caravanButton.type = "button";
    this.caravanButton.className = "btn-buy";
    this.caravanButton.textContent = `Upgrade · ${formatKSh(CARAVAN_PRICE)}`;
    this.caravanButton.addEventListener("click", () => this._upgradeCaravan());

    caravanRow.append(caravanInfo, this.caravanButton);
    upgradeSection.list.appendChild(caravanRow);
    content.appendChild(upgradeSection.section);

    // Token pack -----------------------------------------------------------
    const tokenSection = document.createElement("section");
    tokenSection.className = "shop-section token-section";

    const tokenTitle = document.createElement("h3");
    tokenTitle.textContent = "Token Pack";
    const tokenHint = document.createElement("p");
    tokenHint.className = "token-section__hint";
    tokenHint.textContent = "Simulated in-game purchase — no real money is charged.";

    const tokenRow = document.createElement("div");
    tokenRow.className = "shop-item shop-item--token";
    const tokenInfo = document.createElement("div");
    tokenInfo.className = "shop-item__info";
    const tokenName = document.createElement("div");
    tokenName.className = "shop-item__name";
    tokenName.textContent = `Buy ${formatKSh(TOKEN_REWARD)} for ${formatKSh(TOKEN_PRICE)}`;
    const tokenDescription = document.createElement("div");
    tokenDescription.className = "shop-item__price";
    tokenDescription.textContent = "Test the late-game economy instantly (simulated).";
    tokenInfo.append(tokenName, tokenDescription);

    this.tokenButton = document.createElement("button");
    this.tokenButton.type = "button";
    this.tokenButton.className = "btn-buy btn-buy--token";
    this.tokenButton.textContent = `Buy · ${formatKSh(TOKEN_PRICE)}`;
    this.tokenButton.addEventListener("click", () => this._buyTokenPack());
    tokenRow.append(tokenInfo, this.tokenButton);

    tokenSection.append(tokenTitle, tokenHint, tokenRow);
    content.appendChild(tokenSection);

    this.el.append(header, content);
  }

  _section(title, hint) {
    const section = document.createElement("section");
    section.className = "shop-section";

    const heading = document.createElement("div");
    heading.className = "shop-section__heading";
    const titleEl = document.createElement("h3");
    titleEl.textContent = title;
    heading.appendChild(titleEl);
    if (hint) {
      const hintEl = document.createElement("span");
      hintEl.className = "shop-section__hint";
      hintEl.textContent = hint;
      heading.appendChild(hintEl);
    }

    const list = document.createElement("div");
    list.className = "shop-list";

    section.append(heading, list);
    return { section, list };
  }

  _buyIngredient(item) {
    if (!this.economy.spendMoney(item.basePrice, `buy-${item.id}`)) return;

    State.inventory[item.id] = (State.inventory[item.id] ?? 0) + 1;
    bus.emit("inventory:changed", { ...State.inventory });
    bus.emit("notification:show", {
      text: `Bought 1 ${item.unit} of ${item.name}.`,
    });
    bus.emit("log:add", {
      text: `Bought ${item.name} for ${formatKSh(item.basePrice)}.`,
    });
    this._refresh();
  }

  _hire(role) {
    if (!State.hasCaravan) {
      bus.emit("notification:show", {
        text: "Buy the caravan before hiring staff.",
        tone: "warning",
      });
      return;
    }

    const isCook = role === "cook";
    const current = isCook ? State.cooksHired : State.waitersHired;
    if (current >= MAX_STAFF) return;

    if (!this.economy.spendMoney(COOK_PRICE, `hire-${role}`)) return;

    // The systems own the count; they update State synchronously.
    bus.emit(isCook ? "cook:hired" : "waiter:hired", {});
    this._refresh();
  }

  _upgradeCaravan() {
    if (State.hasCaravan) return;
    if (!this.economy.spendMoney(CARAVAN_PRICE, "caravan")) return;

    State.hasCaravan = true;
    bus.emit("upgrade:caravan", {});
    bus.emit("notification:show", {
      text: "Caravan unlocked! Hire cooks and waiters at the supplier.",
      tone: "success",
    });
    bus.emit("log:add", {
      text: `Upgraded to the food caravan for ${formatKSh(CARAVAN_PRICE)}.`,
      tone: "success",
    });
    this._refresh();
  }

  _buyTokenPack() {
    if (!this.economy.spendMoney(TOKEN_PRICE, "token-pack")) return;

    this.economy.addMoney(TOKEN_REWARD, "token-pack");
    State.tokenUnits += TOKEN_REWARD;
    bus.emit("notification:show", {
      text: `Simulated purchase complete: +${formatKSh(TOKEN_REWARD)}.`,
      tone: "success",
    });
    bus.emit("log:add", {
      text: `SIMULATED token purchase: ${formatKSh(TOKEN_REWARD)} for ${formatKSh(TOKEN_PRICE)}.`,
      tone: "success",
    });
    this._refresh();
  }

  _refresh() {
    if (!this.el) return;

    this.balance.textContent = formatKSh(State.money);

    for (const [, entry] of this.ingredientButtons) {
      const { item, button, stock } = entry;
      button.disabled = State.money < item.basePrice;
      stock.textContent = `${this._formatAmount(State.inventory[item.id] ?? 0)} ${item.unit}`;
    }

    for (const role of ["cook", "waiter"]) {
      const entry = this.staffRows.get(role);
      if (!entry) continue;
      const isCook = role === "cook";
      const count = isCook ? State.cooksHired : State.waitersHired;
      const price = isCook ? COOK_PRICE : WAITER_PRICE;

      entry.status.textContent = `${count}/${MAX_STAFF} hired`;
      if (!State.hasCaravan) {
        entry.button.textContent = "Requires Caravan";
        entry.button.disabled = true;
      } else if (count >= MAX_STAFF) {
        entry.button.textContent = "Hired";
        entry.button.disabled = true;
      } else {
        entry.button.textContent = `Hire · ${formatKSh(price)}`;
        entry.button.disabled = State.money < price;
      }
    }

    if (State.hasCaravan) {
      this.caravanButton.textContent = "Purchased";
      this.caravanButton.disabled = true;
    } else {
      this.caravanButton.textContent = `Upgrade · ${formatKSh(CARAVAN_PRICE)}`;
      this.caravanButton.disabled = State.money < CARAVAN_PRICE;
    }

    this.tokenButton.disabled = State.money < TOKEN_PRICE;
  }

  _formatAmount(amount) {
    if (!Number.isFinite(amount)) return "0";
    return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
  }

  open() {
    this.isOpen = true;
    this._refresh();
    this.backdrop.classList.add("is-open");
    this.backdrop.setAttribute("aria-hidden", "false");
  }

  close() {
    this.isOpen = false;
    this.backdrop.classList.remove("is-open");
    this.backdrop.setAttribute("aria-hidden", "true");
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    window.removeEventListener("keydown", this._onKeyDown);
    this.backdrop.remove();
  }
}
