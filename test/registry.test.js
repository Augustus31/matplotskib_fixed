import assert from "node:assert/strict";
import { test } from "node:test";
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
