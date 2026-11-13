/**
 * Supplier stock. Prices are in KSh per unit.
 * The shop buys exactly one unit per click (keeps the economy easy to read).
 */
export const Items = Object.freeze({
  flour: {
    id: "flour",
    name: "Wheat Flour",
    basePrice: 50,
    unit: "kg",
    icon: "🌾",
  },
  beans: {
    id: "beans",
    name: "Beans",
    basePrice: 40,
    unit: "kg",
    icon: "🫘",
  },
  oil: {
    id: "oil",
    name: "Cooking Oil",
    basePrice: 30,
    unit: "litre",
    icon: "🛢️",
  },
});
