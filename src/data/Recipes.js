/**
 * Recipes. The stall starts with Chapati Beans only.
 * Cook time is in seconds (the Cook's wrap animation matches it).
 */
export const Recipes = Object.freeze({
  chapatiBeans: {
    id: "chapatiBeans",
    name: "Chapati Beans",
    description: "Soft chapati folded around stewed beans.",
    cookTime: 2,
    ingredients: {
      flour: 1,
      beans: 1,
      oil: 0.2,
    },
    sellPrice: 150,
    requiredReputation: 0,
  },
});
