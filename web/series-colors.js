const NUM_FIXED_COLORS = 4;
const NUM_GOLDEN_ANGLE = 137.508;
const NUM_START_HUE = 286;

/**
 * Return the CSS color for a series index. The first four colors follow the page theme;
 * additional colors use a deterministic golden-angle hue sequence.
 * @param {number} numIndex
 * @returns {string}
 */
export function getSeriesColor(numIndex) {
  if (numIndex < NUM_FIXED_COLORS) {
    return `var(--s${numIndex + 1})`;
  }
  const numHue =
    (NUM_START_HUE + (numIndex - NUM_FIXED_COLORS) * NUM_GOLDEN_ANGLE) % 360;
  return `hsl(${numHue.toFixed(1)} 68% 48%)`;
}
