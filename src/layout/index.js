// Layout: ParseResult + ChartSpec to Scene. Pure functions, no DOM.
// Layout owns validation, the frame and every non-data mark (axes, ticks, gridlines, labels,
// title). The chart type adds only its own marks, placed with the scales layout hands it.

import { COLUMN_TYPES, DEFAULTS, SCENE_KINDS } from "../contracts.js";
import { getChart } from "../registry.js";
import { fnMakeScales, fnMakeTicks } from "./scales.js";

/** @typedef {import("../contracts.js").ParseResult} ParseResult */
/** @typedef {import("../contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../contracts.js").ChartType} ChartType */
/** @typedef {import("../contracts.js").Frame} Frame */
/** @typedef {import("../contracts.js").Scales} Scales */
/** @typedef {import("../contracts.js").Scene} Scene */
/** @typedef {import("../contracts.js").SceneItem} SceneItem */

const NUM_TICK_LENGTH = 5;
// Room for the y tick labels left of the axis, and the x tick labels below it.
const NUM_LABEL_ROOM = 12;
// Room for the title above the plot.
const NUM_TITLE_ROOM = 24;
// Tick labels are drawn at about 12px; a digit is about 7px wide. Used to size the left
// margin so long y labels fit.
const NUM_CHAR_WIDTH = 7;
// Gap between a y tick label and its tick mark, and between the label and the left edge.
const NUM_LABEL_GAP = 3;
const NUM_EDGE_GAP = 4;
// SceneText has no vertical alignment, so labels move down by about a third of the font size
// to sit centered on their tick.
const NUM_TEXT_NUDGE = 4;

/**
 * Throw a plain Error when the spec can't be drawn from this data.
 * Checks, in order: parser errors, chart key, rows, then each slot's column and type.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {ChartType}
 */
function validate(objParse, objSpec) {
  if (objParse.arrErrors.length > 0) {
    throw new Error(`the data has errors: ${objParse.arrErrors.join("; ")}`);
  }
  const objChart = getChart(objSpec.strChart);
  // Before the type checks: with no rows the parser types every column as category.
  if (objParse.arrRows.length === 0) {
    throw new Error("no rows to plot");
  }
  for (const objSlot of objChart.arrSlots) {
    const strField = objSpec.objFields[objSlot.strSlot];
    if (!strField) {
      if (objSlot.bOptional) continue;
      throw new Error(
        `${objChart.strName} needs a column for "${objSlot.strSlot}"`,
      );
    }
    const objColumn = objParse.arrColumns.find(
      (objCandidate) => objCandidate.strField === strField,
    );
    if (objColumn === undefined) {
      throw new Error(`no column named "${strField}"`);
    }
    if (!objSlot.arrTypes.includes(objColumn.strType)) {
      if (
        (objChart.strName === "line" || objChart.strName === "scatter") &&
        (objSlot.strSlot === "x" || objSlot.strSlot === "y") &&
        objColumn.strType === COLUMN_TYPES.CATEGORY
      ) {
        throw new Error(
          "X and Y axes require numeric columns. Category columns can only be used for series.",
        );
      }
      throw new Error(
        `"${objSlot.strSlot}" takes ${objSlot.arrTypes.join(" or ")}, but ${strField} is ${objColumn.strType}`,
      );
    }
  }
  return objChart;
}

/**
 * Frame for a spec: its size, or the defaults, and margins with room for labels and title.
 * The left margin grows to fit the longest y tick label, so big numbers aren't cut off.
 * Throws when the size leaves no room to plot inside the margins.
 * @param {ChartSpec} objSpec
 * @param {number} numYLabelChars characters in the longest y tick label
 * @returns {Frame}
 */
function makeFrame(objSpec, numYLabelChars) {
  const numWidth = objSpec.numWidth ?? DEFAULTS.numWidth;
  const numHeight = objSpec.numHeight ?? DEFAULTS.numHeight;
  const objMargin = {
    numTop: DEFAULTS.numMargin + (objSpec.strTitle ? NUM_TITLE_ROOM : 0),
    numRight: DEFAULTS.numMargin,
    numBottom: DEFAULTS.numMargin + NUM_LABEL_ROOM,
    numLeft: Math.max(
      DEFAULTS.numMargin + NUM_LABEL_ROOM,
      NUM_EDGE_GAP +
        numYLabelChars * NUM_CHAR_WIDTH +
        NUM_LABEL_GAP +
        NUM_TICK_LENGTH,
    ),
  };
  const numMinWidth = objMargin.numLeft + objMargin.numRight;
  const numMinHeight = objMargin.numTop + objMargin.numBottom;
  if (!Number.isFinite(numWidth) || numWidth <= numMinWidth) {
    throw new Error(`width must be a number above ${numMinWidth}`);
  }
  if (!Number.isFinite(numHeight) || numHeight <= numMinHeight) {
    throw new Error(`height must be a number above ${numMinHeight}`);
  }
  return { numWidth, numHeight, objMargin };
}

/**
 * Axis tick values for a slot: the nice ticks for a number column, which span exactly the
 * scale's domain, or each category in order of first appearance. Whole-number columns keep
 * only whole-number ticks.
 * @param {ParseResult} objParse
 * @param {string} strField
 * @returns {(string | number)[]}
 */
function ticksFor(objParse, strField) {
  const objColumn = objParse.arrColumns.find(
    (objCandidate) => objCandidate.strField === strField,
  );
  const arrValues = objParse.arrRows.map((objRow) => objRow[strField]);
  if (objColumn?.strType === COLUMN_TYPES.CATEGORY) {
    return [...new Set(arrValues.map(String))];
  }
  let numMin = Infinity;
  let numMax = -Infinity;
  for (const value of arrValues) {
    numMin = Math.min(numMin, Number(value));
    numMax = Math.max(numMax, Number(value));
  }
  const arrTicks = fnMakeTicks(numMin, numMax);
  // Whole-number data (days, months, counts) gets no fractional ticks. This only drops
  // labels and gridlines; the scale's domain still spans every tick from fnMakeTicks.
  return arrValues.every((value) => Number.isInteger(value))
    ? arrTicks.filter((numTick) => Number.isInteger(numTick))
    : arrTicks;
}

/**
 * @param {number} numX1
 * @param {number} numY1
 * @param {number} numX2
 * @param {number} numY2
 * @param {string} strClass
 * @returns {SceneItem}
 */
function line(numX1, numY1, numX2, numY2, strClass) {
  return {
    strKind: SCENE_KINDS.POLYLINE,
    arrPoints: [
      [numX1, numY1],
      [numX2, numY2],
    ],
    strClass,
  };
}

/**
 * @param {number} numX
 * @param {number} numY
 * @param {string} strText
 * @param {"start" | "middle" | "end"} strAnchor
 * @param {string} strClass
 * @param {number} [numRotation]
 * @returns {SceneItem}
 */
function text(numX, numY, strText, strAnchor, strClass, numRotation) {
  return {
    strKind: SCENE_KINDS.TEXT,
    numX,
    numY,
    strText,
    strAnchor,
    strClass,
    ...(numRotation === undefined ? {} : { numRotation }),
  };
}

/**
 * Axes, ticks, gridlines, axis labels and title for a frame.
 * Class names are the styling hooks: grid, axis, tick, tick-label, axis-label, title.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @param {Frame} objFrame
 * @param {Scales} objScales
 * @returns {SceneItem[]}
 */
function buildGuides(objParse, objSpec, objFrame, objScales) {
  const { objMargin } = objFrame;
  const numLeft = objMargin.numLeft;
  const numRight = objFrame.numWidth - objMargin.numRight;
  const numTop = objMargin.numTop;
  const numBottom = objFrame.numHeight - objMargin.numBottom;
  const strXField = objSpec.objFields.x;
  const strYField = objSpec.objFields.y;

  /** @type {SceneItem[]} */
  const arrItems = [];
  const arrYTicks = /** @type {number[]} */ (ticksFor(objParse, strYField));
  for (const numTick of arrYTicks) {
    const numY = objScales.fnY(numTick);
    arrItems.push(
      line(numLeft, numY, numRight, numY, "grid"),
      line(numLeft - NUM_TICK_LENGTH, numY, numLeft, numY, "tick"),
      text(
        numLeft - NUM_TICK_LENGTH - NUM_LABEL_GAP,
        numY + NUM_TEXT_NUDGE,
        String(numTick),
        "end",
        "tick-label",
      ),
    );
  }
  for (let numIndex = 0; numIndex < arrYTicks.length - 1; numIndex += 1) {
    const numPrev = arrYTicks[numIndex];
    const numNext = arrYTicks[numIndex + 1];
    const numMidY = (objScales.fnY(numPrev) + objScales.fnY(numNext)) / 2;
    arrItems.push(line(numLeft, numMidY, numRight, numMidY, "grid"));
  }

  const arrXTicks = ticksFor(objParse, strXField);
  for (const tick of arrXTicks) {
    const numX = objScales.fnX(tick);
    arrItems.push(
      line(numX, numTop, numX, numBottom, "grid"),
      line(numX, numBottom, numX, numBottom + NUM_TICK_LENGTH, "tick"),
      text(
        numX,
        numBottom + NUM_TICK_LENGTH + 14,
        String(tick),
        "middle",
        "tick-label",
      ),
    );
  }
  for (let numIndex = 0; numIndex < arrXTicks.length - 1; numIndex += 1) {
    const numPrev = arrXTicks[numIndex];
    const numNext = arrXTicks[numIndex + 1];
    const numMidX = (objScales.fnX(numPrev) + objScales.fnX(numNext)) / 2;
    arrItems.push(line(numMidX, numTop, numMidX, numBottom, "grid"));
  }
  arrItems.push(
    line(numLeft, numBottom, numRight, numBottom, "axis"),
    line(numLeft, numTop, numLeft, numBottom, "axis"),
    text(
      NUM_LABEL_ROOM,
      (numTop + numBottom) / 2,
      strYField,
      "middle",
      "axis-label",
      -90,
    ),
    text(
      (numLeft + numRight) / 2,
      objFrame.numHeight - 8,
      strXField,
      "middle",
      "axis-label",
    ),
  );
  if (objSpec.strTitle) {
    arrItems.push(text(numLeft, 26, objSpec.strTitle, "start", "title"));
  }
  return arrItems;
}

/**
 * Build the Scene for a spec: validate it, compute the frame and scales, emit the axes, ticks,
 * gridlines, labels and title, then add the chart type's marks. Axes come first in the scene
 * and marks after, so marks draw on top.
 *
 * Throws a plain Error, without drawing anything, when:
 * - the ParseResult has errors
 * - the chart key isn't registered
 * - there are no rows
 * - a required slot has no column, a column doesn't exist, or its type doesn't fit the slot
 * - the width or height leaves no room inside the margins
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @returns {Scene}
 * @example
 * const objScene = fnLayout(parseCsv(strCsv), {
 *   strChart: "line",
 *   objFields: { x: "day", y: "bugs", series: "agent" },
 *   strTitle: "Bugs found per day",
 * });
 */
export function fnLayout(objParse, objSpec) {
  const objChart = validate(objParse, objSpec);
  const numYLabelChars = Math.max(
    ...ticksFor(objParse, objSpec.objFields.y).map(
      (numTick) => String(numTick).length,
    ),
  );
  const objFrame = makeFrame(objSpec, numYLabelChars);
  const objScales = fnMakeScales(objParse, objSpec, objFrame);
  return {
    numWidth: objFrame.numWidth,
    numHeight: objFrame.numHeight,
    arrItems: [
      ...buildGuides(objParse, objSpec, objFrame, objScales),
      ...objChart.fnBuild(objParse, objSpec, objFrame, objScales),
    ],
  };
}
