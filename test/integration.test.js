// End to end: CSV text through renderChart to an SVG string, using only the public entry point.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderChart } from "../src/index.js";

const STR_BUGS = readFileSync(
  new URL("../fixtures/agents-vs-bugs.csv", import.meta.url),
  "utf8",
);

/**
 * Count the marks in an SVG string: circles, and polylines other than layout's own
 * grid, axis and tick lines.
 * @param {string} strSvg
 * @returns {{numCircles: number, numLines: number}}
 */
function countMarks(strSvg) {
  return {
    numCircles: strSvg.match(/<circle /g)?.length ?? 0,
    numLines:
      strSvg.match(/<polyline [^>]*class="(?!grid|axis|tick)/g)?.length ?? 0,
  };
}

test("fixture to scatter: one circle per row, title and axis labels", () => {
  const strSvg = renderChart(STR_BUGS, {
    strChart: "scatter",
    objFields: { x: "day", y: "bugs" },
    strTitle: "Bugs found per day",
  });
  assert.deepEqual(countMarks(strSvg), { numCircles: 15, numLines: 0 });
  assert.match(strSvg, /class="title">Bugs found per day</);
  assert.match(strSvg, /class="axis-label">day</);
  assert.match(strSvg, /class="axis-label">bugs</);
});

test("fixture to scatter: honors the spec's size", () => {
  const strSvg = renderChart(STR_BUGS, {
    strChart: "scatter",
    objFields: { x: "day", y: "bugs" },
    numWidth: 800,
    numHeight: 300,
  });
  assert.match(strSvg, /^<svg [^>]*width="800" height="300"/);
});

test("fixture to line: one line per agent", () => {
  const strSvg = renderChart(STR_BUGS, {
    strChart: "line",
    objFields: { x: "day", y: "bugs", series: "agent" },
    strTitle: "Bugs found per day",
  });
  assert.equal(countMarks(strSvg).numLines, 3);
  assert.match(strSvg, /class="title">Bugs found per day</);
});

test("fixture to line: one line when there is no series", () => {
  const strSvg = renderChart("day,minutes\n1,14\n2,22\n3,19", {
    strChart: "line",
    objFields: { x: "day", y: "minutes" },
  });
  assert.equal(countMarks(strSvg).numLines, 1);
});

test("error: unknown chart", () => {
  assert.throws(
    () => renderChart(STR_BUGS, { strChart: "pie", objFields: {} }),
    /unknown chart type: pie/,
  );
});

test("error: missing column", () => {
  assert.throws(
    () =>
      renderChart(STR_BUGS, {
        strChart: "scatter",
        objFields: { x: "day", y: "fixes" },
      }),
    /no column named "fixes"/,
  );
});

test("error: wrong column type", () => {
  assert.throws(
    () =>
      renderChart(STR_BUGS, {
        strChart: "scatter",
        objFields: { x: "agent", y: "bugs" },
      }),
    /X and Y axes require numeric columns/,
  );
});

test("error: empty CSV", () => {
  assert.throws(
    () =>
      renderChart("", {
        strChart: "scatter",
        objFields: { x: "day", y: "bugs" },
      }),
    /no rows to plot/,
  );
});

test("error: parser errors surface as a thrown error naming the row", () => {
  assert.throws(
    () =>
      renderChart("agent,day,bugs\nAgent A,1,4\nAgent A,2\n", {
        strChart: "scatter",
        objFields: { x: "day", y: "bugs" },
      }),
    /the data has errors: row 3: expected 3 fields, found 2/,
  );
});

test("interleaved string series share palette indices while lines sort independently", () => {
  const strCsv = "agent,x,y\nMon,3,9\nTue,2,5\nMon,1,4\nTue,1,7\nMon,1,6";
  for (const strChart of ["line", "scatter", "line"]) {
    const strSvg = renderChart(strCsv, {
      strChart,
      objFields: { x: "x", y: "y", series: "agent" },
    });
    if (strChart === "scatter") {
      assert.deepEqual(
        [...strSvg.matchAll(/class="point series-(\d)"/g)].map(
          (arrMatch) => arrMatch[1],
        ),
        ["0", "1", "0", "1", "0"],
      );
    } else {
      const arrLines = [
        ...strSvg.matchAll(
          /<polyline points="([^"]+)"[^>]*class="line series-\d"/g,
        ),
      ];
      assert.equal(arrLines.length, 2);
      for (const arrLine of arrLines) {
        const arrXs = arrLine[1]
          .split(" ")
          .map((strPoint) => Number(strPoint.split(",")[0]));
        assert.ok(
          arrXs.every(
            (numX, numIndex) => numIndex === 0 || arrXs[numIndex - 1] <= numX,
          ),
        );
      }
    }
  }
});
