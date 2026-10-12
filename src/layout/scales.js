// Scales and nice ticks for layout. Pure functions, no DOM.
// Layout builds the scales once and hands them to the chart's fnBuild, so axes and marks agree.

import { COLUMN_TYPES } from "../contracts.js";

/** @typedef {import("../contracts.js").ParseResult} ParseResult */
/** @typedef {import("../contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../contracts.js").Frame} Frame */
/** @typedef {import("../contracts.js").Scales} Scales */

// Slack for float division, so 0.3 / 0.1 counts as 3 and not 2.9999999999999996.
const NUM_EPSILON = 1e-9;

/**
 * Round a tick to the precision of its step, so 3 * 0.1 gives 0.3 and not 0.30000000000000004.
 * @param {number} numValue
 * @param {number} numStep
 * @returns {number}
 */
function roundToStep(numValue, numStep) {
  const numDecimals = Math.max(0, -Math.floor(Math.log10(numStep)));
  // `|| 0` turns -0 into 0.
  return Number(numValue.toFixed(numDecimals)) || 0;
}

/**
 * Nice tick values for a number axis: about numCount ticks on a round step (1, 2 or 5 times a
 * power of ten), from at or below numMin to at or above numMax. When numMin equals numMax, the
 * range is widened around the value first, so there are always at least two ticks.
 * @param {number} numMin smallest data value
 * @param {number} numMax largest data value
 * @param {number} [numCount=5] roughly how many ticks to aim for
 * @returns {number[]} ascending tick values
 */
export function fnMakeTicks(numMin, numMax, numCount = 5) {
  if (!Number.isFinite(numMin) || !Number.isFinite(numMax)) {
    throw new Error("axis values must be finite numbers");
  }
  let numLow = Math.min(numMin, numMax);
  let numHigh = Math.max(numMin, numMax);
  if (numLow === numHigh) {
    const numPad =
      numLow === 0 ? 1 : 10 ** Math.floor(Math.log10(Math.abs(numLow)));
    numLow -= numPad;
    numHigh += numPad;
  }

  const numRaw = (numHigh - numLow) / Math.max(1, numCount);
  const numPower = 10 ** Math.floor(Math.log10(numRaw));
  const numFraction = numRaw / numPower - NUM_EPSILON;
  const numMultiple =
    numFraction <= 1 ? 1 : numFraction <= 2 ? 2 : numFraction <= 5 ? 5 : 10;
  const numStep = numMultiple * numPower;

  const numFirst = Math.floor(numLow / numStep + NUM_EPSILON);
  const numLast = Math.ceil(numHigh / numStep - NUM_EPSILON);
  /** @type {number[]} */
  const arrTicks = [];
  for (let numIndex = numFirst; numIndex <= numLast; numIndex += 1) {
    arrTicks.push(roundToStep(numIndex * numStep, numStep));
  }
  return arrTicks;
}

/**
 * Smallest and largest value, without spreading into Math.min, which overflows on big files.
 * @param {number[]} arrNumbers
 * @returns {{numMin: number, numMax: number}}
 */
function extentOf(arrNumbers) {
  let numMin = Infinity;
  let numMax = -Infinity;
  for (const numValue of arrNumbers) {
    if (numValue < numMin) numMin = numValue;
    if (numValue > numMax) numMax = numValue;
  }
  return { numMin, numMax };
}

/**
 * Linear scale from the span of the values' nice ticks onto a pixel range.
 * @param {(string | number)[]} arrValues
 * @param {number} numStart pixel for the low end of the domain
 * @param {number} numEnd pixel for the high end of the domain
 * @returns {(value: string | number) => number}
 */
function linearScale(arrValues, numStart, numEnd) {
  const { numMin, numMax } = extentOf(arrValues.map(Number));
  const arrTicks = fnMakeTicks(numMin, numMax);
  const numLow = arrTicks[0];
  const numHigh = arrTicks[arrTicks.length - 1];
  return (value) =>
    numStart +
    ((Number(value) - numLow) / (numHigh - numLow)) * (numEnd - numStart);
}

/**
 * Evenly spaced bands, one per category in order of first appearance. Returns the band center.
 * @param {(string | number)[]} arrValues
 * @param {number} numStart
 * @param {number} numEnd
 * @returns {(value: string | number) => number}
 */
function bandScale(arrValues, numStart, numEnd) {
  const arrCategories = [...new Set(arrValues.map(String))];
  const mapIndex = new Map(
    arrCategories.map((strCategory, numIndex) => [strCategory, numIndex]),
  );
  const numBand = (numEnd - numStart) / arrCategories.length;
  return (value) => {
    const numIndex = mapIndex.get(String(value));
    if (numIndex === undefined) {
      throw new Error(`unknown category: ${value}`);
    }
    return numStart + (numIndex + 0.5) * numBand;
  };
}

/**
 * The column a spec slot points at, and its values in row order.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @param {string} strSlot
 * @returns {{strField: string, strType: string, arrValues: (string | number)[]}}
 */
function columnForSlot(objParse, objSpec, strSlot) {
  const strField = objSpec.objFields[strSlot];
  const objColumn = objParse.arrColumns.find(
    (objCandidate) => objCandidate.strField === strField,
  );
  if (objColumn === undefined) {
    throw new Error(`no column for slot "${strSlot}"`);
  }
  return {
    strField,
    strType: objColumn.strType,
    arrValues: objParse.arrRows.map((objRow) => objRow[strField]),
  };
}

/**
 * Build the x and y scales for a spec, in absolute SVG pixels inside the frame's margins.
 *
 * - A number column gets a linear scale whose domain is exactly the first to last value of
 *   fnMakeTicks(min, max) for that column. Layout gets matching axis ticks by calling
 *   fnMakeTicks with the same min and max.
 * - A category x gets evenly spaced bands in order of first appearance; fnX returns the band
 *   center and throws on a category that is not in the data.
 * - y must be a number column, and fnY is flipped so bigger values sit higher.
 *
 * Throws a plain Error when there are no rows, a slot has no column, or y is not a number.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @param {Frame} objFrame
 * @returns {Scales}
 */
export function fnMakeScales(objParse, objSpec, objFrame) {
  if (objParse.arrRows.length === 0) {
    throw new Error("no rows to plot");
  }
  const { objMargin } = objFrame;
  const numLeft = objMargin.numLeft;
  const numRight = objFrame.numWidth - objMargin.numRight;
  const numTop = objMargin.numTop;
  const numBottom = objFrame.numHeight - objMargin.numBottom;

  const objX = columnForSlot(objParse, objSpec, "x");
  const objY = columnForSlot(objParse, objSpec, "y");
  if (objY.strType !== COLUMN_TYPES.NUMBER) {
    throw new Error(
      `slot "y" needs a number column, "${objY.strField}" is not`,
    );
  }

  return {
    fnX:
      objX.strType === COLUMN_TYPES.CATEGORY
        ? bandScale(objX.arrValues, numLeft, numRight)
        : linearScale(objX.arrValues, numLeft, numRight),
    fnY: linearScale(objY.arrValues, numBottom, numTop),
  };
}
