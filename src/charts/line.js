import { COLUMN_TYPES, SCENE_KINDS } from "../contracts.js";
import { registerChart } from "../registry.js";
import { buildScatter } from "./scatter.js";

/**
 * Group rows by series in order of first appearance.
 * When series is omitted, every row belongs to the same group.
 *
 * @param {import("../contracts.js").ParseResult} objParse
 * @param {string | undefined} strSeriesField
 * @returns {Object<string, string | number>[][]}
 */
function groupRows(objParse, strSeriesField) {
  /** @type {Map<string, Object<string, string | number>[]>} */
  const mapGroups = new Map();

  objParse.arrRows.forEach((objRow) => {
    const strSeries =
      strSeriesField === undefined ? "" : String(objRow[strSeriesField]);

    if (!mapGroups.has(strSeries)) {
      mapGroups.set(strSeries, []);
    }

    mapGroups.get(strSeries)?.push(objRow);
  });

  return [...mapGroups.values()];
}

/**
 * Build one polyline per series. Points are sorted by their x pixel position,
 * so each line runs left to right. Tooltip circles retain input row order.
 * Points with the same x keep their input order.
 * @param {import("../contracts.js").ParseResult} objParse
 * @param {import("../contracts.js").ChartSpec} objSpec
 * @param {import("../contracts.js").Frame} _objFrame
 * @param {import("../contracts.js").Scales} objScales
 * @returns {(import("../contracts.js").ScenePolyline | import("../contracts.js").SceneCircle)[]}
 */
export function buildLine(objParse, objSpec, _objFrame, objScales) {
  const strXField = objSpec.objFields.x;
  const strYField = objSpec.objFields.y;
  const strSeriesField = objSpec.objFields.series;
  const arrGroups = groupRows(objParse, strSeriesField);
  const arrLines = arrGroups.map((arrRows, numSeries) => {
    const arrPoints = arrRows
      .map((objRow) => [
        objScales.fnX(objRow[strXField]),
        objScales.fnY(/** @type {number} */ (objRow[strYField])),
      ])
      .sort((arrA, arrB) => arrA[0] - arrB[0]);

    return {
      strKind: SCENE_KINDS.POLYLINE,
      arrPoints,
      strClass: `line series-${numSeries}`,
    };
  });

  // Reuse scatter's row order and series classes for tooltip targets.
  const arrDots = buildScatter(objParse, objSpec, _objFrame, objScales).map(
    (objPoint) => ({
      ...objPoint,
      strClass: `${objPoint.strClass} line-point`,
    }),
  );

  return [...arrLines, ...arrDots];
}

/**
 * build lines for series.
 * @type {import("../contracts.js").ChartType}
 */
export const objLine = {
  strName: "line",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "series", arrTypes: [COLUMN_TYPES.CATEGORY], bOptional: true },
  ],
  fnBuild: buildLine,
};

registerChart(objLine);
