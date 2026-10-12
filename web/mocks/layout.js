// MOCK layout. Stands in for #15 until src/layout lands: validate the spec, build the frame,
// axes, ticks and title, then add the chart's own marks.

import { DEFAULTS, SCENE_KINDS } from "../../src/contracts.js";
import { getMockChart as getChart } from "./charts.js";
import { buildScales, plotBox } from "./scales.js";

/** @typedef {import("../../src/contracts.js").ParseResult} ParseResult */
/** @typedef {import("../../src/contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../../src/contracts.js").Frame} Frame */
/** @typedef {import("../../src/contracts.js").Scene} Scene */
/** @typedef {import("../../src/contracts.js").SceneItem} SceneItem */

const NUM_TICK_LENGTH = 5;

/**
 * Throw a readable error when a slot is missing or holds a column of the wrong type.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {void}
 */
function checkSlots(objParse, objSpec) {
  const objChart = getChart(objSpec.strChart);
  for (const objSlot of objChart.arrSlots) {
    const strField = objSpec.objFields[objSlot.strSlot];
    if (!strField) {
      if (/** @type {{bOptional?: boolean}} */ (objSlot).bOptional) continue;
      throw new Error(
        `${objSpec.strChart} needs a column for "${objSlot.strSlot}"`,
      );
    }
    const objColumn = objParse.arrColumns.find(
      (objCol) => objCol.strField === strField,
    );
    if (!objColumn) throw new Error(`no column named "${strField}"`);
    if (!objSlot.arrTypes.includes(objColumn.strType)) {
      throw new Error(
        `"${objSlot.strSlot}" takes ${objSlot.arrTypes.join(" or ")}, but ${strField} is ${objColumn.strType}`,
      );
    }
  }
}

/**
 * Frame for a spec. Extra room on the right when a series slot is filled, for direct labels.
 * @param {ChartSpec} objSpec
 * @returns {Frame}
 */
function makeFrame(objSpec) {
  const numMargin = DEFAULTS.numMargin;
  return {
    numWidth: objSpec.numWidth ?? DEFAULTS.numWidth,
    numHeight: objSpec.numHeight ?? DEFAULTS.numHeight,
    objMargin: {
      numTop: numMargin + (objSpec.strTitle ? 24 : 0),
      numRight: numMargin + (objSpec.objFields.series ? 56 : 0),
      numBottom: numMargin + 12,
      numLeft: numMargin + 12,
    },
  };
}

/**
 * Mock of fnLayout from #15: build the full scene for a spec.
 * Throws on parser errors or a bad spec, with a plain message.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {Scene}
 */
export function fnLayout(objParse, objSpec) {
  if (objParse.arrErrors.length > 0) {
    throw new Error(objParse.arrErrors.join("; "));
  }
  checkSlots(objParse, objSpec);
  const objFrame = makeFrame(objSpec);
  const objBox = plotBox(objFrame);
  const { objX, objY } = buildScales(objParse, objSpec, objFrame);

  /** @type {SceneItem[]} */
  const arrBack = [];
  /** @type {SceneItem[]} */
  const arrLabels = [];

  for (const objTick of objY.arrTicks) {
    const numY = objY.fnMap(objTick.value);
    arrBack.push({
      strKind: SCENE_KINDS.POLYLINE,
      arrPoints: [
        [objBox.numLeft, numY],
        [objBox.numRight, numY],
      ],
      strClass: "grid",
    });
    arrLabels.push({
      strKind: SCENE_KINDS.TEXT,
      numX: objBox.numLeft - 8,
      numY: numY + 4,
      strText: objTick.strLabel,
      strAnchor: "end",
      strClass: "tick-label",
    });
  }
  for (const objTick of objX.arrTicks) {
    const numX = objX.fnMap(objTick.value);
    arrBack.push({
      strKind: SCENE_KINDS.POLYLINE,
      arrPoints: [
        [numX, objBox.numBottom],
        [numX, objBox.numBottom + NUM_TICK_LENGTH],
      ],
      strClass: "tick",
    });
    arrLabels.push({
      strKind: SCENE_KINDS.TEXT,
      numX,
      numY: objBox.numBottom + NUM_TICK_LENGTH + 14,
      strText: objTick.strLabel,
      strAnchor: "middle",
      strClass: "tick-label",
    });
  }
  arrBack.push({
    strKind: SCENE_KINDS.POLYLINE,
    arrPoints: [
      [objBox.numLeft, objBox.numBottom],
      [objBox.numRight, objBox.numBottom],
    ],
    strClass: "axis",
  });

  // Scene text has no rotation, so the y label sits above the axis, reading left to right.
  arrLabels.push(
    {
      strKind: SCENE_KINDS.TEXT,
      numX: objBox.numLeft - 8,
      numY: objBox.numTop - 12,
      strText: objSpec.objFields.y,
      strAnchor: "start",
      strClass: "axis-label",
    },
    {
      strKind: SCENE_KINDS.TEXT,
      numX: objBox.numRight,
      numY: objFrame.numHeight - 8,
      strText: objSpec.objFields.x,
      strAnchor: "end",
      strClass: "axis-label",
    },
  );
  if (objSpec.strTitle) {
    arrLabels.push({
      strKind: SCENE_KINDS.TEXT,
      numX: objBox.numLeft - 8,
      numY: 26,
      strText: objSpec.strTitle,
      strAnchor: "start",
      strClass: "title",
    });
  }

  const objScales = { fnX: objX.fnMap, fnY: objY.fnMap };
  const arrMarks = getChart(objSpec.strChart).fnBuild(
    objParse,
    objSpec,
    objFrame,
    // scales are the 4th argument, as decided in #13
    objScales,
  );
  return {
    numWidth: objFrame.numWidth,
    numHeight: objFrame.numHeight,
    arrItems: [...arrBack, ...arrMarks, ...arrLabels],
  };
}
