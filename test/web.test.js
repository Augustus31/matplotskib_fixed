import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { guessSpec } from "../web/datasets.js";
import { layout, parse, renderSvg } from "../web/pipeline.js";

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
    /"x" takes number, but agent is category/,
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

test("an upload with only number columns starts as a scatter", () => {
  const objParse = parse("height,weight\n170,65\n182,80\n165,58");
  assert.equal(guessSpec(objParse).strChart, "scatter");
  assert.deepEqual(guessSpec(objParse).objFields, { x: "height", y: "weight" });
});

test("an upload with one category and one number starts as a line over the category", () => {
  const objParse = parse("weekday,minutes\nMon,14\nTue,22");
  assert.deepEqual(guessSpec(objParse), {
    strChart: "line",
    objFields: { x: "weekday", y: "minutes" },
    strTitle: "",
  });
});

test("a category with a value per row is not used as a series", () => {
  const objParse = parse("name,a,b\nw,1,2\nx,3,4\ny,5,6\nz,7,8\nv,9,10");
  assert.equal(guessSpec(objParse).strChart, "scatter");
});

test("an upload with no number column leaves the slots empty", () => {
  assert.deepEqual(guessSpec(parse("a,b\nx,y")).objFields, {});
});

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
  const objParse = parse(readText("web/samples/ci-minutes.csv"));
  const strSvg = renderSvg(
    layout(objParse, {
      strChart: "line",
      objFields: { x: "weekday", y: "minutes" },
    }),
  );
  assert.equal(strSvg.match(/<polyline[^>]*class="line/g)?.length, 1);
});
