import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMN_TYPES, SCENE_KINDS } from "../src/contracts.js";
import { getChart, registerChart } from "../src/registry.js";

test("registers and looks up a chart type", () => {
  const objChart = { strName: "demo", arrSlots: [], fnBuild: () => [] };
  registerChart(objChart);
  assert.equal(getChart("demo"), objChart);
});

test("rejects duplicate registration", () => {
  const objChart = { strName: "dup", arrSlots: [], fnBuild: () => [] };
  registerChart(objChart);
  assert.throws(() => registerChart(objChart), /already registered/);
});

test("rejects unknown chart type", () => {
  assert.throws(() => getChart("nope"), /unknown chart type/);
});

test("scene kinds are frozen circle, polyline and text", () => {
  assert.deepEqual(SCENE_KINDS, {
    CIRCLE: "circle",
    POLYLINE: "polyline",
    TEXT: "text",
  });
  assert.ok(Object.isFrozen(SCENE_KINDS));
  assert.throws(() => {
    SCENE_KINDS.CIRCLE = "dot";
  }, TypeError);
});

test("scatter and line register independently with their own slots", () => {
  const objScatter = {
    strName: "scatter",
    arrSlots: [
      { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
      { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    ],
    fnBuild: () => [],
  };
  const objLine = {
    strName: "line",
    arrSlots: [
      { strSlot: "x", arrTypes: [COLUMN_TYPES.CATEGORY, COLUMN_TYPES.NUMBER] },
      { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
      { strSlot: "series", arrTypes: [COLUMN_TYPES.CATEGORY], bOptional: true },
    ],
    fnBuild: () => [],
  };
  registerChart(objScatter);
  registerChart(objLine);

  assert.equal(getChart("scatter"), objScatter);
  assert.equal(getChart("line"), objLine);
  assert.deepEqual(getChart("scatter").arrSlots, [
    { strSlot: "x", arrTypes: ["number"] },
    { strSlot: "y", arrTypes: ["number"] },
  ]);
  assert.deepEqual(getChart("line").arrSlots, [
    { strSlot: "x", arrTypes: ["category", "number"] },
    { strSlot: "y", arrTypes: ["number"] },
    { strSlot: "series", arrTypes: ["category"], bOptional: true },
  ]);
});

test("fnBuild receives scales as its fourth argument", () => {
  const objParse = {
    arrColumns: [
      { strField: "day", strType: COLUMN_TYPES.NUMBER },
      { strField: "bugs", strType: COLUMN_TYPES.NUMBER },
    ],
    arrRows: [{ day: 1, bugs: 4 }],
    arrErrors: [],
  };
  const objSpec = { strChart: "dots", objFields: { x: "day", y: "bugs" } };
  const objFrame = {
    numWidth: 600,
    numHeight: 400,
    objMargin: { numTop: 40, numRight: 40, numBottom: 40, numLeft: 40 },
  };
  const objScales = {
    fnX: (value) => Number(value) * 10,
    fnY: (value) => 400 - value * 10,
  };

  registerChart({
    strName: "dots",
    arrSlots: [
      { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
      { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    ],
    fnBuild: (objP, objS, objF, objSc) =>
      objP.arrRows.map((objRow) => ({
        strKind: SCENE_KINDS.CIRCLE,
        numX: objSc.fnX(objRow[objS.objFields.x]),
        numY: objSc.fnY(Number(objRow[objS.objFields.y])),
        numR: 3,
        strClass: "dot",
      })),
  });

  const arrItems = getChart("dots").fnBuild(
    objParse,
    objSpec,
    objFrame,
    objScales,
  );
  assert.deepEqual(arrItems, [
    { strKind: "circle", numX: 10, numY: 360, numR: 3, strClass: "dot" },
  ]);
});
