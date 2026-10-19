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

/** Read polylines separately from the circles used for line tooltips. */
function buildLines(...arrArgs) {
  return objLine
    .fnBuild(...arrArgs)
    .filter((objItem) => objItem.strKind === "polyline");
}

test("connects numeric x values in ascending order when series is omitted", () => {
  const arrItems = buildLines(objParse, objSpec, objFrame, objScales);

  assert.equal(arrItems.length, 1);
  assert.equal(arrItems[0].strKind, "polyline");

  assert.deepEqual(arrItems[0].arrPoints, [
    [10, 96],
    [20, 93],
    [30, 95],
  ]);
});

test("registers line with x, y and optional series slots", () => {
  assert.equal(getChart("line"), objLine);

  assert.deepEqual(objLine.arrSlots, [
    {
      strSlot: "x",
      arrTypes: ["number"],
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
    { agent: "B", day: 2, bugs: 3 },
    { agent: "A", day: 2, bugs: 7 },
    { agent: "B", day: 1, bugs: 2 },
    { agent: "A", day: 1, bugs: 4 },
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

test("sorts numeric x within each series and keeps series order", () => {
  const arrItems = buildLines(
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

test("internal builder maps generic scale positions (public category axes are rejected)", () => {
  /** @type {import("../src/contracts.js").ParseResult} */
  const objCategoryParse = {
    arrColumns: [
      { strField: "weekday", strType: "category" },
      { strField: "minutes", strType: "number" },
    ],
    arrRows: [
      { weekday: "Wed", minutes: 12 },
      { weekday: "Mon", minutes: 10 },
      { weekday: "Tue", minutes: 14 },
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
    Wed: 100,
    Mon: 300,
    Tue: 500,
  };

  /** @type {import("../src/contracts.js").Scales} */
  const objCategoryScales = {
    fnX: (value) => objPositions[String(value)],
    fnY: (value) => 200 - value,
  };

  const arrItems = buildLines(
    objCategoryParse,
    objCategorySpec,
    objFrame,
    objCategoryScales,
  );

  assert.deepEqual(arrItems, [
    {
      strKind: "polyline",
      arrPoints: [
        [100, 188],
        [300, 190],
        [500, 186],
      ],
      strClass: "line series-0",
    },
  ]);
});

test("returns no lines when there are no rows", () => {
  const arrItems = buildLines(
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

test("internal sorter orders generic scale positions within each series", () => {
  /** @type {import("../src/contracts.js").ParseResult} */
  const objCategorySeriesParse = {
    arrColumns: [
      { strField: "agent", strType: "category" },
      { strField: "weekday", strType: "category" },
      { strField: "minutes", strType: "number" },
    ],
    arrRows: [
      { agent: "A", weekday: "Mon", minutes: 10 },
      { agent: "A", weekday: "Tue", minutes: 14 },
      { agent: "A", weekday: "Wed", minutes: 12 },
      { agent: "B", weekday: "Tue", minutes: 11 },
      { agent: "B", weekday: "Mon", minutes: 6 },
      { agent: "B", weekday: "Wed", minutes: 8 },
    ],
    arrErrors: [],
  };

  const objPositions = { Mon: 100, Tue: 300, Wed: 500 };

  /** @type {import("../src/contracts.js").Scales} */
  const objCategoryScales = {
    fnX: (value) => objPositions[String(value)],
    fnY: (value) => 200 - value,
  };

  const arrItems = buildLines(
    objCategorySeriesParse,
    {
      strChart: "line",
      objFields: { x: "weekday", y: "minutes", series: "agent" },
    },
    objFrame,
    objCategoryScales,
  );

  assert.deepEqual(
    arrItems.map((objItem) => objItem.arrPoints),
    [
      [
        [100, 190],
        [300, 186],
        [500, 188],
      ],
      [
        [100, 194],
        [300, 189],
        [500, 192],
      ],
    ],
  );
});

test("points with the same x keep their input order", () => {
  const arrItems = buildLines(
    {
      ...objParse,
      arrRows: [
        { day: 2, bugs: 3 },
        { day: 1, bugs: 4 },
        { day: 1, bugs: 7 },
      ],
    },
    objSpec,
    objFrame,
    objScales,
  );

  assert.deepEqual(arrItems[0].arrPoints, [
    [10, 96],
    [10, 93],
    [20, 97],
  ]);
});

test("does not reorder the parsed rows", () => {
  const arrRowsBefore = structuredClone(objParse.arrRows);

  buildLines(objParse, objSpec, objFrame, objScales);

  assert.deepEqual(objParse.arrRows, arrRowsBefore);
});

test("line tooltip circles keep original row order and series classes", () => {
  const arrBefore = structuredClone(objSeriesParse.arrRows);
  const arrItems = objLine.fnBuild(
    objSeriesParse,
    objSeriesSpec,
    objFrame,
    objScales,
  );
  const arrDots = arrItems.filter((objItem) => objItem.strKind === "circle");
  assert.equal(arrItems.length, 6);
  assert.deepEqual(
    arrDots.map((objItem) => [objItem.numX, objItem.numY]),
    [
      [20, 97],
      [20, 93],
      [10, 98],
      [10, 96],
    ],
  );
  assert.deepEqual(
    arrDots.map((objItem) => objItem.strClass),
    [
      "point series-0 line-point",
      "point series-1 line-point",
      "point series-0 line-point",
      "point series-1 line-point",
    ],
  );
  assert.deepEqual(objSeriesParse.arrRows, arrBefore);
});

test("ungrouped line tooltip circles retain the ungrouped scatter class", () => {
  const arrItems = objLine.fnBuild(objParse, objSpec, objFrame, objScales);
  const arrDots = arrItems.filter((objItem) => objItem.strKind === "circle");
  assert.equal(arrDots.length, 3);
  assert.ok(
    arrDots.every((objItem) => objItem.strClass === "point line-point"),
  );
});
