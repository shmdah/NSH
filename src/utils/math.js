/**
 * Small, framework-free math helpers.
 * These are pure functions — safe to unit test and reuse anywhere.
 */

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Frame-rate independent damping.
 * Use this for camera follow, HUD pulses, etc.
 * `lambda` controls how "snappy" the motion is (higher = snappier).
 * Reference: https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/
 */
export const damp = (current, target, lambda, dt) =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));

export const degToRad = (deg) => (deg * Math.PI) / 180;

export const radToDeg = (rad) => (rad * 180) / Math.PI;