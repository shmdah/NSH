/**
 * Theme.js — centralised colour palette for the 3D world.
 * Keep every raw hex used by entities/world in here where practical.
 */
export const Theme = Object.freeze({
  // Sky, ground & street ---------------------------------------------------
  sky: 0x1a1613,
  fog: 0x2b211a,
  ground: 0x4a3b32,
  road: 0x2c2c2c,
  roadLine: 0xd4c4a8,
  pavement: 0x6b635d,
  pavementEdge: 0x8a8078,
  parkingLot: 0x5a5a5a,
  parkingLine: 0xf2f2f2,

  // NSH-BLD-001 building materials ----------------------------------------
  wallPrimary: 0xe8ddcd,
  wallSecondary: 0xa8a8a8,
  groundFloorWall: 0x3a3a3a,
  glass: 0x4a5c6b,
  frameBronze: 0x2b2621,
  railing: 0x1a1a1a,
  roofConcrete: 0x888888,
  signboardA: 0xc43b3b,
  signboardB: 0x2e6b9e,

  // Food stall -------------------------------------------------------------
  stallWood: 0x8b5a2b,
  stallWoodDark: 0x5f3c1c,
  stallMetal: 0x8fa1b3,
  stallUmbrella: 0xbf3b36,
  stallCloth: 0xf1e3c6,
  stallCounter: 0x6b4e3d,

  // Caravan ----------------------------------------------------------------
  caravanBody: 0x2a9d8f,
  caravanTrim: 0x264653,
  caravanAwning: 0xe76f51,
  caravanWheel: 0x111111,
  caravanWindow: 0x18242b,

  // Lighting ---------------------------------------------------------------
  sunLight: 0xffe4b8,
  skyFill: 0xd4b89d,
  groundFill: 0x2e241e,

  // Props ------------------------------------------------------------------
  chair: 0xb04b38,
  lampPost: 0x5c5c5c,
  benchWood: 0x6b4e3d,
  metal: 0x333333,
  skin: 0x5c3a21,
  pants: 0x1a1613,
  chefHat: 0xffffff,
  waiterShirt: 0x1e7a3a,
  food: 0xf5deb3,
  plate: 0xf5f5f5,
  chapati: 0xc98a3a,
  beans: 0x8b3a2a,
});
