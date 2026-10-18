import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import "../src/charts/scatter.js";
import { COLUMN_TYPES, DEFAULTS, SCENE_KINDS } from "../src/contracts.js";
import { fnLayout } from "../src/layout/index.js";
import { parseCsv } from "../src/parser/index.js";
import { registerChart } from "../src/registry.js";

/** @typedef {import("../src/contracts.js").SceneItem} SceneItem */

/** What the stub chart was called with, so tests can check what layout hands a chart. */
const arrStubCalls = [];

// A stand-in chart: one circle per row, placed only with the scales layout passes in.
registerChart({
  strName: "stub",
  arrSlots: [
    { strSlot: "x", arrTypes: [COLUMN_TYPES.CATEGORY, COLUMN_TYPES.NUMBER] },
    { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
    { strSlot: "series", arrTypes: [COLUMN_TYPES.CATEGORY], bOptional: true },
  ],
  fnBuild: (objParse, objSpec, objFrame, objScales) => {
    arrStubCalls.push({ objFrame, objScales });
    return objParse.arrRows.map((objRow) => ({
      strKind: SCENE_KINDS.CIRCLE,
      numX: objScales.fnX(objRow[objSpec.objFields.x]),
      numY: objScales.fnY(Number(objRow[objSpec.objFields.y])),
      numR: 4,
      strClass: "point",
    }));
  },
});

const objBugs = parseCsv(
  readFileSync(
    new URL("../fixtures/agents-vs-bugs.csv", import.meta.url),
    "utf8",
  ),
);

/**
 * @param {SceneItem[]} arrItems
 * @param {string} strClass
 * @returns {SceneItem[]}
 */
function withClass(arrItems, strClass) {
  return arrItems.filter((objItem) => objItem.strClass === strClass);
}

/**
 * @param {SceneItem[]} arrItems
 * @param {string} strClass
 * @returns {string[]}
 */
function textsWithClass(arrItems, strClass) {
  return withClass(arrItems, strClass).map(
    (objItem) => /** @type {{strText: string}} */ (objItem).strText,
  );
}

test("builds a scene with axes first and the chart's marks after", () => {
  const objScene = fnLayout(objBugs, {
    strChart: "stub",
    objFields: { x: "day", y: "bugs" },
    strTitle: "Bugs found per day",
  });
  assert.equal(objScene.numWidth, DEFAULTS.numWidth);
  assert.equal(objScene.numHeight, DEFAULTS.numHeight);

  const numFirstMark = objScene.arrItems.findIndex(
    (objItem) => objItem.strKind === SCENE_KINDS.CIRCLE,
  );
  assert.equal(objScene.arrItems.length - numFirstMark, 15);
  assert.ok(
    objScene.arrItems
      .slice(numFirstMark)
      .every((objItem) => objItem.strKind === SCENE_KINDS.CIRCLE),
  );

  assert.equal(withClass(objScene.arrItems, "axis").length, 2);
  assert.deepEqual(textsWithClass(objScene.arrItems, "title"), [
    "Bugs found per day",
  ]);
  assert.deepEqual(textsWithClass(objScene.arrItems, "axis-label"), [
    "bugs",
    "day",
  ]);
});

test("draws a gridline for each y tick and a vertical guide at each x tick", () => {
  const objScene = fnLayout(objBugs, {
    strChart: "stub",
    objFields: { x: "day", y: "bugs" },
  });
  const arrGrid = withClass(objScene.arrItems, "grid");
  const arrLabels = textsWithClass(objScene.arrItems, "tick-label");
  // bugs runs 2 to 12, so the y ticks are 2, 4, ... 12 and the x ticks 1 to 5.
  assert.deepEqual(arrLabels, [
    "2",
    "4",
    "6",
    "8",
    "10",
    "12",
    "1",
    "2",
    "3",
    "4",
    "5",
  ]);
  assert.equal(arrGrid.length, 20);
});

test("gridlines line up with the marks at the same value", () => {
  const objScene = fnLayout(objBugs, {
    strChart: "stub",
    objFields: { x: "day", y: "bugs" },
  });
  const arrGridYs = withClass(objScene.arrItems, "grid").map(
    (objItem) =>
      /** @type {{arrPoints: number[][]}} */ (objItem).arrPoints[0][1],
  );
  // Agent A on day 1 found 4 bugs; the 4 gridline is the second one.
  const objFirstPoint = /** @type {{numY: number}} */ (
    objScene.arrItems.find((objItem) => objItem.strKind === SCENE_KINDS.CIRCLE)
  );
  assert.equal(objFirstPoint.numY, arrGridYs[1]);
});

test("labels a category x axis in order of first appearance", () => {
  const objParse = parseCsv("weekday,minutes\nTue,22\nMon,14\nTue,9");
  const objScene = fnLayout(objParse, {
    strChart: "stub",
    objFields: { x: "weekday", y: "minutes" },
  });
  const arrXLabels = withClass(objScene.arrItems, "tick-label")
    .filter(
      (objItem) =>
        /** @type {{strAnchor: string}} */ (objItem).strAnchor === "middle",
    )
    .map((objItem) => /** @type {{strText: string}} */ (objItem).strText);
  assert.deepEqual(arrXLabels, ["Tue", "Mon"]);
});

test("hands the chart the frame and the same scales the axes use", () => {
  arrStubCalls.length = 0;
  fnLayout(objBugs, {
    strChart: "stub",
    objFields: { x: "day", y: "bugs" },
    numWidth: 800,
    numHeight: 500,
    strTitle: "t",
  });
  assert.equal(arrStubCalls.length, 1);
  const { objFrame, objScales } = arrStubCalls[0];
  assert.equal(objFrame.numWidth, 800);
  assert.equal(objFrame.numHeight, 500);
  assert.ok(objFrame.objMargin.numTop > DEFAULTS.numMargin, "room for title");
  assert.equal(typeof objScales.fnX, "function");
  assert.equal(typeof objScales.fnY, "function");
});

test("leaves the title out when the spec has none", () => {
  const objScene = fnLayout(objBugs, {
    strChart: "stub",
    objFields: { x: "day", y: "bugs" },
  });
  assert.deepEqual(textsWithClass(objScene.arrItems, "title"), []);
});

test("an optional slot can be left out", () => {
  assert.doesNotThrow(() =>
    fnLayout(objBugs, { strChart: "stub", objFields: { x: "day", y: "bugs" } }),
  );
});

test("works with the real scatter chart", () => {
  const objScene = fnLayout(objBugs, {
    strChart: "scatter",
    objFields: { x: "day", y: "bugs" },
  });
  const arrPoints = withClass(objScene.arrItems, "point");
  assert.equal(arrPoints.length, 15);
  for (const objPoint of arrPoints) {
    const { numX, numY } = /** @type {{numX: number, numY: number}} */ (
      objPoint
    );
    assert.ok(numX > 0 && numX < objScene.numWidth);
    assert.ok(numY > 0 && numY < objScene.numHeight);
  }
});

test("throws when the parser reported errors", () => {
  const objParse = parseCsv("a,b\n1,2\n3");
  assert.throws(
    () =>
      fnLayout(objParse, { strChart: "stub", objFields: { x: "a", y: "b" } }),
    /the data has errors: row 3: expected 2 fields, found 1/,
  );
});

test("throws on an unknown chart", () => {
  assert.throws(
    () => fnLayout(objBugs, { strChart: "pie", objFields: {} }),
    /unknown chart type: pie/,
  );
});

test("throws when a required slot has no column", () => {
  assert.throws(
    () => fnLayout(objBugs, { strChart: "stub", objFields: { x: "day" } }),
    /stub needs a column for "y"/,
  );
});

test("throws when a column doesn't exist", () => {
  assert.throws(
    () =>
      fnLayout(objBugs, {
        strChart: "stub",
        objFields: { x: "day", y: "fixes" },
      }),
    /no column named "fixes"/,
  );
});

test("throws when a column's type doesn't fit the slot", () => {
  assert.throws(
    () =>
      fnLayout(objBugs, {
        strChart: "scatter",
        objFields: { x: "agent", y: "bugs" },
      }),
    /"x" takes number, but agent is category/,
  );
});

test("throws when an optional slot names a column of the wrong type", () => {
  assert.throws(
    () =>
      fnLayout(objBugs, {
        strChart: "stub",
        objFields: { x: "day", y: "bugs", series: "day" },
      }),
    /"series" takes category, but day is number/,
  );
});

test("throws when there are no rows", () => {
  assert.throws(
    () =>
      fnLayout(parseCsv("day,bugs"), {
        strChart: "stub",
        objFields: { x: "day", y: "bugs" },
      }),
    /no rows to plot/,
  );
});

test("throws when the size leaves no room to plot", () => {
  assert.throws(
    () =>
      fnLayout(objBugs, {
        strChart: "stub",
        objFields: { x: "day", y: "bugs" },
        numWidth: 50,
      }),
    /width must be a number above 92/,
  );
});

test("whole-number data gets only whole-number ticks", () => {
  // fnMakeTicks(1, 3) steps by 0.5; months 1.5 and 2.5 shouldn't be labelled.
  const objScene = fnLayout(parseCsv("month,rain\n1,49\n2,36\n3,47"), {
    strChart: "stub",
    objFields: { x: "month", y: "rain" },
  });
  const arrXLabels = withClass(objScene.arrItems, "tick-label")
    .filter(
      (objItem) =>
        /** @type {{strAnchor: string}} */ (objItem).strAnchor === "middle",
    )
    .map((objItem) => /** @type {{strText: string}} */ (objItem).strText);
  assert.deepEqual(arrXLabels, ["1", "2", "3"]);
});

test("decimal data keeps its decimal ticks", () => {
  const objScene = fnLayout(parseCsv("t,v\n0.1,1\n0.4,2"), {
    strChart: "stub",
    objFields: { x: "t", y: "v" },
  });
  assert.ok(textsWithClass(objScene.arrItems, "tick-label").includes("0.2"));
});

test("the left margin fits long y tick labels", () => {
  // From #30: 7-digit values used to run off the left edge.
  const objScene = fnLayout(
    parseCsv("month,revenue\n1,1250000\n2,1730000\n3,990000"),
    { strChart: "stub", objFields: { x: "month", y: "revenue" } },
  );
  const arrYLabels = withClass(objScene.arrItems, "tick-label").filter(
    (objItem) =>
      /** @type {{strAnchor: string}} */ (objItem).strAnchor === "end",
  );
  assert.ok(
    arrYLabels.some(
      (objItem) =>
        /** @type {{strText: string}} */ (objItem).strText === "1800000",
    ),
  );
  for (const objItem of arrYLabels) {
    const { numX, strText } = /** @type {{numX: number, strText: string}} */ (
      objItem
    );
    // Labels are right-aligned at numX; about 7px per character must fit left of it.
    assert.ok(numX - strText.length * 7 >= 0, `${strText} is cut off`);
  }
});

test("short y tick labels keep the default left margin", () => {
  arrStubCalls.length = 0;
  fnLayout(objBugs, { strChart: "stub", objFields: { x: "day", y: "bugs" } });
  assert.equal(
    arrStubCalls[0].objFrame.objMargin.numLeft,
    DEFAULTS.numMargin + 12,
  );
});
