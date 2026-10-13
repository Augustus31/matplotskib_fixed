import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { COLUMN_TYPES } from "../src/contracts.js";
import { fnMakeScales, fnMakeTicks } from "../src/layout/scales.js";
import { parseCsv } from "../src/parser/index.js";

// 600 x 400 with 40px margins: the plot runs x 40..560 and y 360 (low) up to 40 (high).
// Number scales keep a 5% gap inside that, so the outer ticks land at x 66 and 534, y 344 and 56.
const OBJ_FRAME = {
  numWidth: 600,
  numHeight: 400,
  objMargin: { numTop: 40, numRight: 40, numBottom: 40, numLeft: 40 },
};

/**
 * Build a ParseResult with number columns x and y from pairs.
 * @param {number[][]} arrPairs
 */
function numberParse(arrPairs) {
  return {
    arrColumns: [
      { strField: "x", strType: COLUMN_TYPES.NUMBER },
      { strField: "y", strType: COLUMN_TYPES.NUMBER },
    ],
    arrRows: arrPairs.map(([numX, numY]) => ({ x: numX, y: numY })),
    arrErrors: [],
  };
}

const OBJ_SPEC = { strChart: "scatter", objFields: { x: "x", y: "y" } };

/**
 * @param {number} numActual
 * @param {number} numExpected
 */
function assertClose(numActual, numExpected) {
  assert.ok(
    Math.abs(numActual - numExpected) < 1e-9,
    `${numActual} is not close to ${numExpected}`,
  );
}

test("ticks use a round step and cover the data", () => {
  assert.deepEqual(fnMakeTicks(0, 10), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(fnMakeTicks(1, 5), [1, 2, 3, 4, 5]);
});

test("ticks always include the data range with about five round steps", () => {
  const arrRanges = [
    [0, 1],
    [0, 7],
    [3, 97],
    [-0.03, 0.04],
    [1200, 5300],
    [0.001, 0.0013],
  ];

  for (const [numMin, numMax] of arrRanges) {
    const arrTicks = fnMakeTicks(numMin, numMax);
    const strCase = `${numMin}..${numMax}: ${arrTicks.join(", ")}`;
    assert.ok(arrTicks[0] <= numMin, strCase);
    assert.ok(arrTicks[arrTicks.length - 1] >= numMax, strCase);
    assert.ok(arrTicks.length >= 3 && arrTicks.length <= 8, strCase);

    const numStep = arrTicks[1] - arrTicks[0];
    const numMantissa = numStep / 10 ** Math.floor(Math.log10(numStep));
    assert.ok(
      [1, 2, 5].some((numNice) => Math.abs(numMantissa - numNice) < 1e-6),
      strCase,
    );
  }
});

test("ticks handle negative ranges", () => {
  assert.deepEqual(fnMakeTicks(-3, 7), [-4, -2, 0, 2, 4, 6, 8]);
  assert.deepEqual(fnMakeTicks(-50, -10), [-50, -40, -30, -20, -10]);
});

test("ticks widen a single value so there is still an axis", () => {
  assert.deepEqual(fnMakeTicks(5, 5), [4, 4.5, 5, 5.5, 6]);
  assert.deepEqual(fnMakeTicks(0, 0), [-1, -0.5, 0, 0.5, 1]);
  assert.deepEqual(fnMakeTicks(-300, -300), [-400, -350, -300, -250, -200]);
});

test("ticks have no float noise and no negative zero", () => {
  assert.deepEqual(fnMakeTicks(0, 0.3), [0, 0.1, 0.2, 0.3]);
  assert.ok(Object.is(fnMakeTicks(-1, 1)[2], 0));
  assert.ok(Object.is(fnMakeTicks(-0, -0)[2], 0));
});

test("ticks accept min and max in either order", () => {
  assert.deepEqual(fnMakeTicks(10, 0), fnMakeTicks(0, 10));
});

test("ticks reject values that are not finite", () => {
  assert.throws(() => fnMakeTicks(0, Infinity), /finite/);
  assert.throws(() => fnMakeTicks(NaN, 1), /finite/);
});

test("number scales map the tick span onto the plot area, with y flipped", () => {
  const objScales = fnMakeScales(
    numberParse([
      [0, 0],
      [10, 100],
    ]),
    OBJ_SPEC,
    OBJ_FRAME,
  );

  assert.equal(objScales.fnX(0), 66);
  assert.equal(objScales.fnX(5), 300);
  assert.equal(objScales.fnX(10), 534);
  assert.equal(objScales.fnY(0), 344);
  assert.equal(objScales.fnY(50), 200);
  assert.equal(objScales.fnY(100), 56);
});

test("the first and last tick sit 5% inside the plot edges", () => {
  const objParse = numberParse([
    [3, 12],
    [97, 41],
  ]);
  const objScales = fnMakeScales(objParse, OBJ_SPEC, OBJ_FRAME);
  const arrXTicks = fnMakeTicks(3, 97);
  const arrYTicks = fnMakeTicks(12, 41);

  assertClose(objScales.fnX(arrXTicks[0]), 66);
  assertClose(objScales.fnX(arrXTicks[arrXTicks.length - 1]), 534);
  assertClose(objScales.fnY(arrYTicks[0]), 344);
  assertClose(objScales.fnY(arrYTicks[arrYTicks.length - 1]), 56);
});

test("number scales handle negative values", () => {
  const objScales = fnMakeScales(
    numberParse([
      [-3, -50],
      [7, -10],
    ]),
    OBJ_SPEC,
    OBJ_FRAME,
  );

  // x domain is -4..8 and y domain is -50..-10.
  assert.equal(objScales.fnX(-4), 66);
  assert.equal(objScales.fnX(2), 300);
  assert.equal(objScales.fnX(8), 534);
  assert.equal(objScales.fnY(-50), 344);
  assert.equal(objScales.fnY(-10), 56);
});

test("a single row sits in the middle of the plot", () => {
  const objScales = fnMakeScales(numberParse([[3, 7]]), OBJ_SPEC, OBJ_FRAME);

  assert.equal(objScales.fnX(3), 300);
  assert.equal(objScales.fnY(7), 200);
});

test("a category x gets even bands in order of first appearance", () => {
  const objParse = {
    arrColumns: [
      { strField: "day", strType: COLUMN_TYPES.CATEGORY },
      { strField: "bugs", strType: COLUMN_TYPES.NUMBER },
    ],
    arrRows: [
      { day: "Tue", bugs: 1 },
      { day: "Mon", bugs: 2 },
      { day: "Tue", bugs: 3 },
      { day: "Wed", bugs: 4 },
    ],
    arrErrors: [],
  };
  const objSpec = { strChart: "line", objFields: { x: "day", y: "bugs" } };
  const objScales = fnMakeScales(objParse, objSpec, OBJ_FRAME);
  const numBand = 520 / 3;

  assertClose(objScales.fnX("Tue"), 40 + numBand / 2);
  assertClose(objScales.fnX("Mon"), 300);
  assertClose(objScales.fnX("Wed"), 560 - numBand / 2);
  assert.throws(() => objScales.fnX("Fri"), /unknown category: Fri/);
});

test("scales follow the slot mapping, not the column names", () => {
  const objParse = numberParse([
    [0, 0],
    [10, 100],
  ]);
  const objSwapped = { strChart: "scatter", objFields: { x: "y", y: "x" } };
  const objScales = fnMakeScales(objParse, objSwapped, OBJ_FRAME);

  assert.equal(objScales.fnX(100), 534);
  assert.equal(objScales.fnY(10), 56);
});

test("scales reject missing data with a plain message", () => {
  assert.throws(
    () => fnMakeScales(numberParse([]), OBJ_SPEC, OBJ_FRAME),
    /no rows to plot/,
  );
  assert.throws(
    () =>
      fnMakeScales(
        numberParse([[1, 2]]),
        { strChart: "scatter", objFields: { x: "x", y: "nope" } },
        OBJ_FRAME,
      ),
    /no column for slot "y"/,
  );
});

test("scales reject a category y", () => {
  const objParse = {
    arrColumns: [
      { strField: "x", strType: COLUMN_TYPES.NUMBER },
      { strField: "y", strType: COLUMN_TYPES.CATEGORY },
    ],
    arrRows: [{ x: 1, y: "high" }],
    arrErrors: [],
  };

  assert.throws(
    () => fnMakeScales(objParse, OBJ_SPEC, OBJ_FRAME),
    /slot "y" needs a number column/,
  );
});

test("every fixture point lands inside the plot area", () => {
  const strCsv = readFileSync(
    new URL("../fixtures/agents-vs-bugs.csv", import.meta.url),
    "utf8",
  );
  const objParse = parseCsv(strCsv);
  const objSpec = { strChart: "line", objFields: { x: "day", y: "bugs" } };
  const objScales = fnMakeScales(objParse, objSpec, OBJ_FRAME);

  assert.deepEqual(objParse.arrErrors, []);
  for (const objRow of objParse.arrRows) {
    const numX = objScales.fnX(objRow.day);
    const numY = objScales.fnY(Number(objRow.bugs));
    assert.ok(numX >= 40 && numX <= 560, `x ${numX}`);
    assert.ok(numY >= 40 && numY <= 360, `y ${numY}`);
  }
});

test("the data's min and max land inside the plot, not on its edges", () => {
  // From #32: in the fixture, day 1 sat on the y axis and the fewest bugs on the x axis.
  const objScales = fnMakeScales(
    numberParse([
      [1, 2],
      [5, 12],
    ]),
    OBJ_SPEC,
    OBJ_FRAME,
  );
  for (const numX of [objScales.fnX(1), objScales.fnX(5)]) {
    assert.ok(numX > 40 && numX < 560, `x ${numX} is on an edge`);
  }
  for (const numY of [objScales.fnY(2), objScales.fnY(12)]) {
    assert.ok(numY > 40 && numY < 360, `y ${numY} is on an edge`);
  }
});
