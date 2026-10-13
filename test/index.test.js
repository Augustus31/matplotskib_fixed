import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderChart } from "../src/index.js";

const STR_BUGS = readFileSync(
  new URL("../fixtures/agents-vs-bugs.csv", import.meta.url),
  "utf8",
);

test("renders the fixture as a scatter", () => {
  const strSvg = renderChart(STR_BUGS, {
    strChart: "scatter",
    objFields: { x: "day", y: "bugs" },
    strTitle: "Bugs found per day",
  });
  assert.match(strSvg, /^<svg /);
  assert.equal(strSvg.match(/<circle /g)?.length, 15);
  assert.match(strSvg, />Bugs found per day</);
});

test("renders the fixture as a line", () => {
  const strSvg = renderChart(STR_BUGS, {
    strChart: "line",
    objFields: { x: "day", y: "bugs", series: "agent" },
  });
  // One polyline per agent; layout's own polylines are grid, axis and tick.
  const arrMarks = strSvg.match(/<polyline [^>]*class="(?!grid|axis|tick)/g);
  assert.equal(arrMarks?.length, 3);
});

test("throws layout's message when the CSV has errors", () => {
  assert.throws(
    () =>
      renderChart("day,bugs\n1,4\n2", {
        strChart: "scatter",
        objFields: { x: "day", y: "bugs" },
      }),
    /the data has errors: row 3: expected 2 fields, found 1/,
  );
});
