import { test } from "node:test";
import assert from "node:assert/strict";
import { objScatter } from "../src/charts/scatter.js";
import { getChart } from "../src/registry.js";

/** @type {import("../src/contracts.js").ParseResult} */
const objParse = {
  arrColumns: [
    { strField: "height", strType: "number" },
    { strField: "weight", strType: "number" },
  ],
  arrRows: [
    { height: 1, weight: 10 },
    { height: 2, weight: 20 },
    { height: 3, weight: 30 },
  ],
  arrErrors: [],
};

/** @type {import("../src/contracts.js").Frame} */
const objFrame = {
  numWidth: 600,
  numHeight: 400,
  objMargin: { numTop: 40, numRight: 40, numBottom: 40, numLeft: 40 },
};

/** @type {import("../src/contracts.js").Scales} */
const objFakeScales = {
  fnX: (value) => Number(value) * 10,
  fnY: (value) => 100 - value,
};

/** @type {import("../src/contracts.js").ChartSpec} */
const objSpec = {
  strChart: "scatter",
  objFields: { x: "height", y: "weight" },
};

/**
 * Call fnBuild the way layout does, through the registry.
 * @param {import("../src/contracts.js").ParseResult} objData
 * @param {import("../src/contracts.js").ChartSpec} objChartSpec
 * @param {import("../src/contracts.js").Scales} objScales
 */
function build(objData, objChartSpec, objScales) {
  return getChart("scatter").fnBuild(
    objData,
    objChartSpec,
    objFrame,
    objScales,
  );
}

test("registers as scatter with a number x slot and a number y slot", () => {
  assert.equal(getChart("scatter"), objScatter);
  assert.deepEqual(objScatter.arrSlots, [
    { strSlot: "x", arrTypes: ["number"] },
    { strSlot: "y", arrTypes: ["number"] },
  ]);
});

test("returns one circle per row", () => {
  const arrItems = build(objParse, objSpec, objFakeScales);
  assert.equal(arrItems.length, 3);
  assert.ok(arrItems.every((objItem) => objItem.strKind === "circle"));
});

test("positions come from the scales", () => {
  const arrItems = build(objParse, objSpec, objFakeScales);
  assert.deepEqual(
    arrItems.map((objItem) => [objItem.numX, objItem.numY]),
    [
      [10, 90],
      [20, 80],
      [30, 70],
    ],
  );
});

test("every circle has numR 4 and class point", () => {
  const arrItems = build(objParse, objSpec, objFakeScales);
  for (const objItem of arrItems) {
    assert.equal(objItem.numR, 4);
    assert.equal(objItem.strClass, "point");
  }
});

test("reads the columns named in objFields, not fixed names", () => {
  const arrCallsX = [];
  const arrCallsY = [];
  const objSpyScales = {
    fnX: (value) => {
      arrCallsX.push(value);
      return Number(value);
    },
    fnY: (value) => {
      arrCallsY.push(value);
      return value;
    },
  };
  /** @type {import("../src/contracts.js").ChartSpec} */
  const objSwapped = {
    strChart: "scatter",
    objFields: { x: "weight", y: "height" },
  };

  build(objParse, objSwapped, objSpyScales);

  assert.deepEqual(arrCallsX, [10, 20, 30]);
  assert.deepEqual(arrCallsY, [1, 2, 3]);
});

test("no rows gives no items", () => {
  const arrItems = build({ ...objParse, arrRows: [] }, objSpec, objFakeScales);
  assert.deepEqual(arrItems, []);
});
