/**
 * Formatting helpers for Kenyan shillings and other display values.
 */

/**
 * Format a number as Kenyan shillings.
 * Examples:
 *   formatKSh(500)     -> "KSh 500"
 *   formatKSh(1250)    -> "KSh 1,250"
 *   formatKSh(-80)     -> "-KSh 80"
 *   formatKSh(12.5)    -> "KSh 12.50"
 */
export function formatKSh(amount) {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return "KSh 0";
  }

  const isNegative = amount < 0;
  const absolute = Math.abs(amount);

  // Show decimals only when they exist, so 500 -> "500" but 12.5 -> "12.50".
  const hasDecimals = !Number.isInteger(absolute);
  const formatted = absolute.toLocaleString("en-KE", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? "-" : ""}KSh ${formatted}`;
}