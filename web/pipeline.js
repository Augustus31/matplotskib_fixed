// The one place the page touches the library. When a module lands, change its line here and
// flip its entry in OBJ_STAGE_STATUS. Nothing else in web/ needs to change.

export { parseCsv as parse } from "../src/parser/index.js";
export { renderSvg } from "../src/svg/index.js";
// TODO(#14, #15): import fnLayout from "../src/layout/index.js".
export { fnLayout as layout } from "./mocks/layout.js";
// TODO(#16, #17): import the chart modules so they register, then use getChart from
// "../src/registry.js". The registry has no list call, so the picker list stays here.
export { getMockChart as getChart } from "./mocks/charts.js";
export const ARR_CHART_NAMES = Object.freeze(["scatter", "line"]);

/** Which stages are real and which are still mocked, for the pipeline rail. */
export const OBJ_STAGE_STATUS = Object.freeze({
  parser: "live",
  layout: "mock",
  svg: "live",
});
