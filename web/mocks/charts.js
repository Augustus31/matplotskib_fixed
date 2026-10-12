// MOCK chart types: "scatter" (#16) and "line" (#17). They live in a private map, not the real
// registry, so the real chart modules can register the same names when they land.
// fnBuild takes the scales as a 4th argument and returns only marks, as decided in #13.
//
// Two things beyond the issues, listed under open questions in web/README.md:
//   - line points are drawn as circles with a series-N class, so the page can color and hover them
//   - circles carry numRowIndex, so the page can show the row in a tooltip

import { COLUMN_TYPES, SCENE_KINDS } from "../../src/contracts.js";

/** @typedef {import("../../src/contracts.js").ParseResult} ParseResult */
/** @typedef {import("../../src/contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../../src/contracts.js").ChartType} ChartType */
/** @typedef {import("../../src/contracts.js").SceneItem} SceneItem */
/** @typedef {{fnX: (value: string | number) => number, fnY: (value: number) => number}} Scales */

const NUM_POINT_RADIUS = 4;

/**
 * Group row indexes by the series column, in order of first appearance.
 * With no series slot filled, every row is one group.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {{strSeries: string, arrRowIndexes: number[]}[]}
 */
function groupSeries(objParse, objSpec) {
  const strField = objSpec.objFields.series;
  /** @type {Map<string, number[]>} */
  const mapGroups = new Map();
  objParse.arrRows.forEach((objRow, numIndex) => {
    const strKey = strField ? String(objRow[strField]) : "";
    if (!mapGroups.has(strKey)) mapGroups.set(strKey, []);
    mapGroups.get(strKey)?.push(numIndex);
  });
  return [...mapGroups].map(([strSeries, arrRowIndexes]) => ({
    strSeries,
    arrRowIndexes,
  }));
}

/** @type {Map<string, ChartType & {fnBuild: (objParse: ParseResult, objSpec: ChartSpec, objFrame: unknown, objScales: Scales) => SceneItem[]}>} */
const mapMockCharts = new Map();

mapMockCharts.set("scatter", {
  strName: "scatter",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
  ],
  fnBuild: (objParse, objSpec, _objFrame, objScales) =>
    objParse.arrRows.map((objRow, numIndex) => ({
      strKind: SCENE_KINDS.CIRCLE,
      numX: objScales.fnX(objRow[objSpec.objFields.x]),
      numY: objScales.fnY(Number(objRow[objSpec.objFields.y])),
      numR: NUM_POINT_RADIUS,
      strClass: "point",
      numRowIndex: numIndex,
    })),
});

mapMockCharts.set("line", {
  strName: "line",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.CATEGORY, COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "series", arrTypes: [COLUMN_TYPES.CATEGORY], bOptional: true },
  ],
  fnBuild: (objParse, objSpec, _objFrame, objScales) => {
    const { x: strX, y: strY } = objSpec.objFields;
    const boolLabelled = Boolean(objSpec.objFields.series);
    /** @type {SceneItem[]} */
    const arrLines = [];
    /** @type {SceneItem[]} */
    const arrOnTop = [];
    groupSeries(objParse, objSpec).forEach(
      ({ strSeries, arrRowIndexes }, numSeries) => {
        const strSeriesClass = `series-${numSeries}`;
        const arrPoints = arrRowIndexes.map((numIndex) => [
          objScales.fnX(objParse.arrRows[numIndex][strX]),
          objScales.fnY(Number(objParse.arrRows[numIndex][strY])),
        ]);
        arrLines.push({
          strKind: SCENE_KINDS.POLYLINE,
          arrPoints,
          strClass: `line ${strSeriesClass}`,
        });
        arrRowIndexes.forEach((numIndex, numPoint) => {
          arrOnTop.push({
            strKind: SCENE_KINDS.CIRCLE,
            numX: arrPoints[numPoint][0],
            numY: arrPoints[numPoint][1],
            numR: NUM_POINT_RADIUS,
            strClass: `point ${strSeriesClass}`,
            numRowIndex: numIndex,
          });
        });
        if (boolLabelled) {
          const [numEndX, numEndY] = arrPoints[arrPoints.length - 1];
          arrOnTop.push({
            strKind: SCENE_KINDS.TEXT,
            numX: numEndX + 10,
            numY: numEndY + 4,
            strText: strSeries,
            strAnchor: "start",
            strClass: `series-label ${strSeriesClass}`,
          });
        }
      },
    );
    return [...arrLines, ...arrOnTop];
  },
});

/**
 * Look up a mock chart type. Same behavior as getChart in src/registry.js.
 * @param {string} strName
 * @returns {ChartType}
 */
export function getMockChart(strName) {
  const objChart = mapMockCharts.get(strName);
  if (objChart === undefined) {
    throw new Error(`unknown chart type: ${strName}`);
  }
  return objChart;
}

/**
 * Names of the mock charts, in picker order. The real registry has no list call yet.
 * @returns {string[]}
 */
export function listMockCharts() {
  return [...mapMockCharts.keys()];
}
