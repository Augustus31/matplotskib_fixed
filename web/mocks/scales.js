// MOCK scales and nice ticks for the mock layout. Stands in for #14 until src/layout lands.
// Layout computes the scales once and hands { fnX, fnY } to the chart, as decided in #13.

import { COLUMN_TYPES } from "../../src/contracts.js";

/** @typedef {import("../../src/contracts.js").ParseResult} ParseResult */
/** @typedef {import("../../src/contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../../src/contracts.js").Frame} Frame */

/**
 * @typedef {object} Scale
 * @property {(value: string | number) => number} fnMap data value to pixel
 * @property {{value: string | number, strLabel: string}[]} arrTicks
 */

/**
 * Pick a tick step of 1, 2 or 5 times a power of ten.
 * @param {number} numSpan
 * @param {number} numTarget roughly how many ticks we want
 * @returns {number}
 */
function niceStep(numSpan, numTarget) {
  const numRaw = numSpan / numTarget;
  const numPower = 10 ** Math.floor(Math.log10(numRaw));
  const numFraction = numRaw / numPower;
  const numNice =
    numFraction <= 1 ? 1 : numFraction <= 2 ? 2 : numFraction <= 5 ? 5 : 10;
  return numNice * numPower;
}

/**
 * Format a tick value without float noise.
 * @param {number} numValue
 * @returns {string}
 */
function formatTick(numValue) {
  return String(Math.round(numValue * 1e6) / 1e6);
}

/**
 * Linear scale over number values with a nice domain. With boolFromZero, the domain starts at
 * zero when the data is close to it (used for y, so bar-like comparisons stay honest).
 * @param {number[]} arrValues
 * @param {number} numStart pixel for the low end
 * @param {number} numEnd pixel for the high end
 * @param {boolean} boolFromZero
 * @returns {Scale}
 */
function linearScale(arrValues, numStart, numEnd, boolFromZero) {
  let numMin = Math.min(...arrValues);
  let numMax = Math.max(...arrValues);
  if (boolFromZero && numMin >= 0 && numMin < numMax * 0.4) numMin = 0;
  if (numMin === numMax) {
    numMin -= 1;
    numMax += 1;
  }
  // Whole-number data (days, months, counts) never gets fractional ticks.
  const numStep = arrValues.every(Number.isInteger)
    ? Math.max(1, niceStep(numMax - numMin, 5))
    : niceStep(numMax - numMin, 5);
  const numLow = Math.floor(numMin / numStep) * numStep;
  const numHigh = Math.ceil(numMax / numStep) * numStep;
  const arrTicks = [];
  for (
    let numTick = numLow;
    numTick <= numHigh + numStep / 2;
    numTick += numStep
  ) {
    arrTicks.push({ value: numTick, strLabel: formatTick(numTick) });
  }
  return {
    fnMap: (value) =>
      numStart +
      ((Number(value) - numLow) / (numHigh - numLow)) * (numEnd - numStart),
    arrTicks,
  };
}

/**
 * Point scale over category values, in order of first appearance, half a step in from each end.
 * @param {(string | number)[]} arrValues
 * @param {number} numStart
 * @param {number} numEnd
 * @returns {Scale}
 */
function pointScale(arrValues, numStart, numEnd) {
  const arrCategories = [...new Set(arrValues.map(String))];
  const numStep = (numEnd - numStart) / arrCategories.length;
  const fnMap = (/** @type {string | number} */ value) =>
    numStart + numStep * (arrCategories.indexOf(String(value)) + 0.5);
  return {
    fnMap,
    arrTicks: arrCategories.map((strCategory) => ({
      value: strCategory,
      strLabel: strCategory,
    })),
  };
}

/**
 * Inner plot box of a frame, in pixels.
 * @param {Frame} objFrame
 * @returns {{numLeft: number, numRight: number, numTop: number, numBottom: number}}
 */
export function plotBox(objFrame) {
  const { objMargin } = objFrame;
  return {
    numLeft: objMargin.numLeft,
    numRight: objFrame.numWidth - objMargin.numRight,
    numTop: objMargin.numTop,
    numBottom: objFrame.numHeight - objMargin.numBottom,
  };
}

/**
 * Build the x and y scales for a spec, with the ticks layout needs for the axes.
 * @param {ParseResult} objParse
 * @param {ChartSpec} objSpec
 * @param {Frame} objFrame
 * @returns {{objX: Scale, objY: Scale}}
 */
export function buildScales(objParse, objSpec, objFrame) {
  const objBox = plotBox(objFrame);
  /**
   * @param {string} strSlot
   * @param {number} numStart
   * @param {number} numEnd
   * @returns {Scale}
   */
  const fnScaleFor = (strSlot, numStart, numEnd) => {
    const strField = objSpec.objFields[strSlot];
    const objColumn = objParse.arrColumns.find(
      (objCol) => objCol.strField === strField,
    );
    const arrValues = objParse.arrRows.map((objRow) => objRow[strField]);
    return objColumn?.strType === COLUMN_TYPES.NUMBER
      ? linearScale(
          /** @type {number[]} */ (arrValues),
          numStart,
          numEnd,
          strSlot === "y",
        )
      : pointScale(arrValues, numStart, numEnd);
  };
  return {
    objX: fnScaleFor("x", objBox.numLeft, objBox.numRight),
    objY: fnScaleFor("y", objBox.numBottom, objBox.numTop),
  };
}
