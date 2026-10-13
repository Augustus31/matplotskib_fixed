import { test } from "node:test";
import assert from "node:assert/strict";
import { objLine } from "../src/charts/line.js";
import { getChart } from "../src/registry.js";

/** @type {import("../src/contracts.js").ParseResult} */
const objParse = {
  arrColumns: [
    { strField: "day", strType: "number" },
    { strField: "bugs", strType: "number" },
  ],
  arrRows: [
    { day: 3, bugs: 5 },
    { day: 1, bugs: 4 },
    { day: 2, bugs: 7 },
  ],
  arrErrors: [],
};

/** @type {import("../src/contracts.js").Frame} */
const objFrame = {
  numWidth: 600,
  numHeight: 400,
  objMargin: {
    numTop: 40,
    numRight: 40,
    numBottom: 40,
    numLeft: 40,
  },
};

/** @type {import("../src/contracts.js").Scales} */
const objScales = {
  fnX: (value) => Number(value) * 10,
  fnY: (value) => 100 - value,
};

/** @type {import("../src/contracts.js").ChartSpec} */
const objSpec = {
  strChart: "line",
  objFields: {
    x: "day",
    y: "bugs",
  },
};

test("builds one line in row order when series is omitted", () => {
  const arrItems = getChart("line").fnBuild(
    objParse,
    objSpec,
    objFrame,
    objScales,
  );

  assert.equal(arrItems.length, 1);
  assert.equal(arrItems[0].strKind, "polyline");

  assert.deepEqual(arrItems[0].arrPoints, [
    [30, 95],
    [10, 96],
    [20, 93],
  ]);
});

test("registers line with x, y and optional series slots", () => {
  assert.equal(getChart("line"), objLine);

  assert.deepEqual(objLine.arrSlots, [
    {
      strSlot: "x",
      arrTypes: ["category", "number"],
    },
    {
      strSlot: "y",
      arrTypes: ["number"],
    },
    {
      strSlot: "series",
      arrTypes: ["category"],
      bOptional: true,
    },
  ]);
});

/** @type {import("../src/contracts.js").ParseResult} */
const objSeriesParse = {
  arrColumns: [
    { strField: "agent", strType: "category" },
    { strField: "day", strType: "number" },
    { strField: "bugs", strType: "number" },
  ],
  arrRows: [
    { agent: "B", day: 1, bugs: 2 },
    { agent: "A", day: 1, bugs: 4 },
    { agent: "B", day: 2, bugs: 3 },
    { agent: "A", day: 2, bugs: 7 },
  ],
  arrErrors: [],
};

/** @type {import("../src/contracts.js").ChartSpec} */
const objSeriesSpec = {
  strChart: "line",
  objFields: {
    x: "day",
    y: "bugs",
    series: "agent",
  },
};

test("builds one line per series in first-appearance order", () => {
  const arrItems = getChart("line").fnBuild(
    objSeriesParse,
    objSeriesSpec,
    objFrame,
    objScales,
  );

  assert.deepEqual(arrItems, [
    {
      strKind: "polyline",
      arrPoints: [
        [10, 98],
        [20, 97],
      ],
      strClass: "line series-0",
    },
    {
      strKind: "polyline",
      arrPoints: [
        [10, 96],
        [20, 93],
      ],
      strClass: "line series-1",
    },
  ]);
});

test("maps category x values through the x scale", () => {
  /** @type {import("../src/contracts.js").ParseResult} */
  const objCategoryParse = {
    arrColumns: [
      { strField: "weekday", strType: "category" },
      { strField: "minutes", strType: "number" },
    ],
    arrRows: [
      { weekday: "Mon", minutes: 10 },
      { weekday: "Tue", minutes: 14 },
      { weekday: "Wed", minutes: 12 },
    ],
    arrErrors: [],
  };

  /** @type {import("../src/contracts.js").ChartSpec} */
  const objCategorySpec = {
    strChart: "line",
    objFields: {
      x: "weekday",
      y: "minutes",
    },
  };

  const objPositions = {
    Mon: 100,
    Tue: 300,
    Wed: 500,
  };

  /** @type {import("../src/contracts.js").Scales} */
  const objCategoryScales = {
    fnX: (value) => objPositions[String(value)],
    fnY: (value) => 200 - value,
  };

  const arrItems = getChart("line").fnBuild(
    objCategoryParse,
    objCategorySpec,
    objFrame,
    objCategoryScales,
  );

  assert.deepEqual(arrItems, [
    {
      strKind: "polyline",
      arrPoints: [
        [100, 190],
        [300, 186],
        [500, 188],
      ],
      strClass: "line series-0",
    },
  ]);
});

test("returns no lines when there are no rows", () => {
  const arrItems = getChart("line").fnBuild(
    {
      ...objParse,
      arrRows: [],
    },
    objSpec,
    objFrame,
    objScales,
  );

  assert.deepEqual(arrItems, []);
});
