// MOCK "line" chart until #17 lands. Registered in the real registry, so the real layout
// draws it like any other chart. Delete this file and import src/charts/line.js in
// web/pipeline.js when #17 merges.
//
// Beyond #17: each point is also a circle with a series-N class and numRowIndex, so the page
// can color the legend and show the row in a tooltip. See open questions in web/README.md.

import { COLUMN_TYPES, SCENE_KINDS } from "../../src/contracts.js";
import { registerChart } from "../../src/registry.js";

/** @typedef {import("../../src/contracts.js").ParseResult} ParseResult */
/** @typedef {import("../../src/contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../../src/contracts.js").SceneItem} SceneItem */

const NUM_LINE_POINT_RADIUS = 4;

/**
 * Group row indexes by the series column, in order of first appearance.
 * With no series slot filled, every row is one group.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {number[][]}
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
  return [...mapGroups.values()];
}

registerChart({
  strName: "line",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.CATEGORY, COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "series", arrTypes: [COLUMN_TYPES.CATEGORY], bOptional: true },
  ],
  fnBuild: (objParse, objSpec, _objFrame, objScales) => {
    const { x: strX, y: strY } = objSpec.objFields;
    /** @type {SceneItem[]} */
    const arrLines = [];
    /** @type {SceneItem[]} */
    const arrPoints = [];
    groupSeries(objParse, objSpec).forEach((arrRowIndexes, numSeries) => {
      const strSeriesClass = `series-${numSeries}`;
      const arrXY = arrRowIndexes.map((numIndex) => [
        objScales.fnX(objParse.arrRows[numIndex][strX]),
        objScales.fnY(Number(objParse.arrRows[numIndex][strY])),
      ]);
      arrLines.push({
        strKind: SCENE_KINDS.POLYLINE,
        arrPoints: arrXY,
        strClass: `line ${strSeriesClass}`,
      });
      arrRowIndexes.forEach((numIndex, numPoint) => {
        arrPoints.push({
          strKind: SCENE_KINDS.CIRCLE,
          numX: arrXY[numPoint][0],
          numY: arrXY[numPoint][1],
          numR: NUM_LINE_POINT_RADIUS,
          strClass: `point ${strSeriesClass}`,
          numRowIndex: numIndex,
        });
      });
    });
    return [...arrLines, ...arrPoints];
  },
});
