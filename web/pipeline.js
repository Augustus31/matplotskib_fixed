// The one place the page touches the library. The page calls each stage itself, rather than
// renderChart, so the inspector can show every stage's output.

import "../src/charts/scatter.js";
// TODO(#17): import "../src/charts/line.js" instead, and delete web/mocks/line.js.
import "./mocks/line.js";

export { parseCsv as parse } from "../src/parser/index.js";
export { fnLayout as layout } from "../src/layout/index.js";
export { renderSvg } from "../src/svg/index.js";
export { getChart } from "../src/registry.js";

/** Charts in picker order. The registry has no list call, so the list lives here. */
export const ARR_CHART_NAMES = Object.freeze(["scatter", "line"]);

/** Which stages are real and which are still mocked, for the pipeline rail. */
export const OBJ_STAGE_STATUS = Object.freeze({
  parser: "live",
  layout: "live",
  svg: "live",
});
