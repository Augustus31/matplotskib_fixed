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
  ]);
});
