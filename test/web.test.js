import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { guessSpec } from "../web/datasets.js";
import { layout, parse, renderSvg } from "../web/pipeline.js";
import { getSeriesColor } from "../web/series-colors.js";

/**
 * @param {string} strPath path from the repo root
 * @returns {string}
 */
function readText(strPath) {
  return readFileSync(new URL(`../${strPath}`, import.meta.url), "utf8");
}

test("web pipeline draws the fixture as a line chart with one line per agent", () => {
  const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
  const objScene = layout(objParse, {
    strChart: "line",
    objFields: { x: "day", y: "bugs", series: "agent" },
    strTitle: "Bugs found per day",
  });
  const strSvg = renderSvg(objScene);
  assert.equal(strSvg.match(/class="line series-\d"/g)?.length, 3);
  assert.match(strSvg, />Bugs found per day</);
});

test("web pipeline draws the fixture as a scatter with one point per row", () => {
  const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
  const objScene = layout(objParse, {
    strChart: "scatter",
    objFields: { x: "day", y: "bugs" },
  });
  assert.equal(renderSvg(objScene).match(/<circle/g)?.length, 15);
});

test("grouped scatter retains the line palette indices through the real pipeline", () => {
  const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
  const arrBefore = structuredClone(objParse.arrRows);
  for (const strChart of ["line", "scatter", "line"]) {
    const objScene = layout(objParse, {
      strChart,
      objFields: { x: "day", y: "bugs", series: "agent" },
    });
    const strSvg = renderSvg(objScene);
    for (let numSeries = 0; numSeries < 3; numSeries += 1) {
      assert.equal(
        strSvg.match(
          new RegExp(
            `class="${strChart === "line" ? "line" : "point"} series-${numSeries}"`,
            "g",
          ),
        )?.length,
        strChart === "line" ? 1 : 5,
      );
    }
    assert.deepEqual(objParse.arrRows, arrBefore);
  }
});

test("the broken sample fails in the parser, so the page shows errors", () => {
  const objParse = parse(readText("web/samples/broken.csv"));
  assert.equal(objParse.arrErrors.length, 2);
  assert.equal(objParse.arrRows.length, 0);
});

test("layout rejects a column of the wrong type with a plain message", () => {
  const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
  assert.throws(
    () =>
      layout(objParse, {
        strChart: "scatter",
        objFields: { x: "agent", y: "bugs" },
      }),
    /X and Y axes require numeric columns/,
  );
});

test("an upload with two numbers and a few categories starts as a line per series", () => {
  const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
  assert.deepEqual(guessSpec(objParse), {
    strChart: "line",
    objFields: { x: "day", y: "bugs", series: "agent" },
    strTitle: "",
  });
});

test("an upload with more than four repeated categories starts grouped", () => {
  const objParse = parse(
    "x,y,group\n1,10,A\n2,11,A\n3,12,B\n4,13,B\n5,14,C\n6,15,C\n7,16,D\n8,17,D\n9,18,E\n10,19,E",
  );
  assert.deepEqual(guessSpec(objParse), {
    strChart: "line",
    objFields: { x: "x", y: "y", series: "group" },
    strTitle: "",
  });
});

test("series colors continue deterministically beyond the four theme colors", () => {
  assert.equal(getSeriesColor(0), "var(--s1)");
  assert.equal(getSeriesColor(3), "var(--s4)");
  assert.match(getSeriesColor(4), /^hsl\(/);
  assert.notEqual(getSeriesColor(4), getSeriesColor(5));
  assert.equal(getSeriesColor(4), getSeriesColor(4));
});

test("an upload with only number columns starts as a scatter", () => {
  const objParse = parse("height,weight\n170,65\n182,80\n165,58");
  assert.equal(guessSpec(objParse).strChart, "scatter");
  assert.deepEqual(guessSpec(objParse).objFields, { x: "height", y: "weight" });
});

test("an upload with one numeric column leaves the second axis unselected", () => {
  const objParse = parse("weekday,minutes\nMon,14\nTue,22");
  assert.deepEqual(guessSpec(objParse), {
    strChart: "line",
    objFields: { x: "minutes" },
    strTitle: "",
  });
});

test("a category with a value per row can be used as a series", () => {
  const objParse = parse("name,a,b\nw,1,2\nx,3,4\ny,5,6\nz,7,8\nv,9,10");
  assert.deepEqual(guessSpec(objParse), {
    strChart: "line",
    objFields: { x: "a", y: "b", series: "name" },
    strTitle: "",
  });
});

test("an upload with no number column leaves the slots empty", () => {
  assert.deepEqual(guessSpec(parse("a,b\nx,y")).objFields, {});
});

test("one numeric column without categories also leaves the other axis empty", () => {
  assert.deepEqual(guessSpec(parse("value\n1\n2")).objFields, { x: "value" });
});

for (const strChart of ["line", "scatter"]) {
  for (const strAxis of ["x", "y"]) {
    test(`${strChart} layout rejects category ${strAxis} before building marks`, () => {
      const objParse = parse(readText("fixtures/agents-vs-bugs.csv"));
      assert.throws(
        () =>
          layout(objParse, {
            strChart,
            objFields: { x: "day", y: "bugs", [strAxis]: "agent" },
          }),
        {
          message:
            "X and Y axes require numeric columns. Category columns can only be used for series.",
        },
      );
    });
  }
  test(`${strChart} preserves missing and unknown field errors`, () => {
    const objParse = parse("day,bugs\n1,4\n2,6");
    assert.throws(
      () => layout(objParse, { strChart, objFields: { x: "day" } }),
      /needs a column for "y"/,
    );
    assert.throws(
      () =>
        layout(objParse, { strChart, objFields: { x: "day", y: "missing" } }),
      /no column named "missing"/,
    );
  });
}

test("whole-number data gets whole-number ticks", () => {
  const objParse = parse("month,rain\n1,49\n2,36\n3,47");
  const strSvg = renderSvg(
    layout(objParse, {
      strChart: "line",
      objFields: { x: "month", y: "rain" },
    }),
  );
  assert.doesNotMatch(strSvg, />\d+\.5</);
});

test("a line chart draws without the optional series slot", () => {
  const objParse = parse(readText("web/samples/review-times.csv"));
  const strSvg = renderSvg(
    layout(objParse, {
      strChart: "line",
      objFields: { x: "linesChanged", y: "minutesToReview" },
    }),
  );
  assert.equal(strSvg.match(/<polyline[^>]*class="line/g)?.length, 1);
});
