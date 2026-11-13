import gsap from "gsap";
import { State } from "../game/State.js";
import { bus } from "../systems/EventBus.js";
import { formatKSh } from "../utils/format.js";

const UPGRADES = [
  {
    id: "betterJiko",
    name: "Better Jiko",
    description: "Cuts cooking time in half.",
    price: 400,
  },
  {
    id: "extraTable",
    name: "Extra Table",
    description: "Adds seating for one more customer.",
    price: 350,
  },
];

export class UpgradesPanel {
  constructor(root, economy) {
    this.root = root;
    this.economy = economy;
    this._unsubscribers = [];
    this.el = document.createElement("section");
    this.el.className = "ui-panel";
    this.el.setAttribute("aria-label", "Stall upgrades");
    this.root.appendChild(this.el);
    this._buildUI();
    gsap.set(this.el, { y: "100%", display: "none" });
    this._unsubscribers.push(
      bus.on("interaction:openUpgrades", () => this.open()),
      bus.on("money:changed", () => this._syncButtons()),
      bus.on("upgrade:purchased", () => this._syncButtons()),
    );
  }

  _buildUI() {
    const header = document.createElement("header");
    header.className = "ui-panel__header";
    const title = document.createElement("h2");
    title.textContent = "Stall Upgrades";
    const close = document.createElement("button");
    close.className = "ui-panel__close";
    close.type = "button";
    close.setAttribute("aria-label", "Close upgrades panel");
    close.textContent = "×";
    close.addEventListener("click", this._onClose = () => this.close());
    header.append(title, close);

    this.content = document.createElement("div");
    this.content.className = "ui-panel__content";
    this.buttons = new Map();
    for (const upgrade of UPGRADES) {
      const card = document.createElement("article");
      card.className = "upgrade-card";
      const name = document.createElement("h3");
      name.textContent = upgrade.name;
      const description = document.createElement("p");
      description.textContent = upgrade.description;
      const button = document.createElement("button");
      button.className = "btn-buy";
      button.type = "button";
      button.addEventListener("click", () => this._purchase(upgrade));
      card.append(name, description, button);
      this.content.appendChild(card);
      this.buttons.set(upgrade.id, button);
    }

    this.el.append(header, this.content);
    this._syncButtons();
  }

  _purchase(upgrade) {
    if (State.upgrades[upgrade.id]) return;
    if (!this.economy.spendMoney(upgrade.price)) return;

    State.upgrades[upgrade.id] = true;
    bus.emit("upgrade:purchased", { upgradeId: upgrade.id });
    bus.emit("notification:show", { text: `${upgrade.name} purchased!` });
    this._syncButtons();
  }

  _syncButtons() {
    for (const upgrade of UPGRADES) {
      const button = this.buttons.get(upgrade.id);
      if (!button) continue;
      const purchased = State.upgrades[upgrade.id];
      button.textContent = purchased ? "Purchased" : `Buy · ${formatKSh(upgrade.price)}`;
      button.disabled = purchased || State.money < upgrade.price;
    }
  }

  open() {
    this._syncButtons();
    gsap.killTweensOf(this.el);
    gsap.to(this.el, { y: 0, display: "block", duration: 0.3, ease: "power2.out" });
  }

  close() {
    gsap.killTweensOf(this.el);
    gsap.to(this.el, { y: "100%", display: "none", duration: 0.3, ease: "power2.in" });
  }

  dispose() {
    for (const unsubscribe of this._unsubscribers) unsubscribe();
    gsap.killTweensOf(this.el);
    this.el.remove();
  }
}
