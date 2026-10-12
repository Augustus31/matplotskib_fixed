// Registry of chart types. Layout looks charts up here by name.

/** @typedef {import("./contracts.js").ChartType} ChartType */

/** @type {Map<string, ChartType>} */
const mapCharts = new Map();

/**
 * Register a chart type under its strName.
 * @param {ChartType} objChartType
 * @returns {void}
 */
export function registerChart(objChartType) {
  if (mapCharts.has(objChartType.strName)) {
    throw new Error(`chart type already registered: ${objChartType.strName}`);
  }
  mapCharts.set(objChartType.strName, objChartType);
}

/**
 * Look up a chart type.
 * @param {string} strName
 * @returns {ChartType}
 */
export function getChart(strName) {
  const objChartType = mapCharts.get(strName);
  if (objChartType === undefined) {
    throw new Error(`unknown chart type: ${strName}`);
  }
  return objChartType;
}
