/**
 * Walking customer archetypes.
 *
 * patience       — seconds before the customer gives up and leaves.
 * budgetMultiplier — scales the base recipe sell price.
 * shirt/skin     — colours used by entities/Customer.js.
 */
export const CustomerTypes = Object.freeze([
  {
    id: "worker",
    name: "Office Worker",
    color: 0x3b5998,
    shirt: 0x3b5998,
    skin: 0x6b4423,
    budgetMultiplier: 1,
    patience: 30,
  },
  {
    id: "student",
    name: "Student",
    color: 0x8b4513,
    shirt: 0x8b4513,
    skin: 0x5c3a21,
    budgetMultiplier: 0.8,
    patience: 26,
  },
  {
    id: "matatu",
    name: "Matatu Driver",
    color: 0xcc3333,
    shirt: 0xcc3333,
    skin: 0x4a2f1b,
    budgetMultiplier: 1.2,
    patience: 22,
  },
]);
