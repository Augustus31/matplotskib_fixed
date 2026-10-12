import { COLUMN_TYPES, SCENE_KINDS } from "../contracts.js";
import { registerChart } from "../registry.js";

const NUM_POINT_RADIUS = 4;

/**
 * Build one circle per row. All position math comes from objScales.
 * @param {import("../contracts.js").ParseResult} objParse
 * @param {import("../contracts.js").ChartSpec} objSpec
 * @param {import("../contracts.js").Frame} _objFrame
 * @param {import("../contracts.js").Scales} objScales
 * @returns {import("../contracts.js").SceneCircle[]}
 */
export function buildScatter(objParse, objSpec, _objFrame, objScales) {
  const strXField = objSpec.objFields.x;
  const strYField = objSpec.objFields.y;

  return objParse.arrRows.map((objRow) => ({
    strKind: SCENE_KINDS.CIRCLE,
    numX: objScales.fnX(objRow[strXField]),
    numY: objScales.fnY(/** @type {number} */ (objRow[strYField])),
    numR: NUM_POINT_RADIUS,
    strClass: "point",
  }));
}

/** @type {import("../contracts.js").ChartType} */
export const objScatter = {
  strName: "scatter",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
  ],
  fnBuild: buildScatter,
};

registerChart(objScatter);
