// Public entry point: CSV text and a ChartSpec in, SVG markup out.
//
//   import { renderChart } from "./src/index.js";
//
//   const strSvg = renderChart(strCsv, {
//     strChart: "scatter",
//     objFields: { x: "day", y: "bugs" },
//     strTitle: "Bugs found per day",
//   });
//   document.querySelector("#chart").innerHTML = strSvg;

import "./charts/line.js";
import "./charts/scatter.js";
import { fnLayout } from "./layout/index.js";
import { parseCsv } from "./parser/index.js";
import { renderSvg } from "./svg/index.js";

/** @typedef {import("./contracts.js").ChartSpec} ChartSpec */

/**
 * Draw a chart from CSV text: parseCsv, then fnLayout, then renderSvg.
 * Throws a plain Error with layout's message when the chart can't be drawn, including when
 * the CSV has errors (the parser never throws; layout reports its errors).
 * @param {string} strCsv raw CSV text, header row first
 * @param {ChartSpec} objSpec which chart, which column fills each slot, optional title and size
 * @returns {string} SVG markup
 */
export function renderChart(strCsv, objSpec) {
  return renderSvg(fnLayout(parseCsv(strCsv), objSpec));
}
