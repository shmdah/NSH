/**
 * Random helpers. Uses Math.random() for now.
 * If we ever want deterministic replays, we swap this for a seeded PRNG.
 */

export const randomFloat = (min = 0, max = 1) => min + Math.random() * (max - min);

export const randomInt = (min, max) =>
  Math.floor(randomFloat(min, max + 1));

export const randomFrom = (array) =>
  array[Math.floor(Math.random() * array.length)];

export const chance = (probability) => Math.random() < probability;