import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSvg } from "../src/svg/index.js";

const STR_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">';

test("renders an empty scene as an empty svg", () => {
  const objScene = { numWidth: 600, numHeight: 400, arrItems: [] };
  assert.equal(renderSvg(objScene), `${STR_OPEN}</svg>`);
});

test("renders a circle", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      { strKind: "circle", numX: 120, numY: 200, numR: 4, strClass: "point" },
    ],
  };
  assert.equal(
    renderSvg(objScene),
    `${STR_OPEN}<circle cx="120" cy="200" r="4" class="point"/></svg>`,
  );
});

test("renders a polyline with no fill and a default currentColor stroke", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      {
        strKind: "polyline",
        arrPoints: [
          [40, 360],
          [300, 200],
          [560, 80],
        ],
        strClass: "line",
      },
    ],
  };
  assert.equal(
    renderSvg(objScene),
    `${STR_OPEN}<polyline points="40,360 300,200 560,80" fill="none" stroke="currentColor" class="line"/></svg>`,
  );
});

test("renders text with its anchor", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      {
        strKind: "text",
        numX: 300,
        numY: 25,
        strText: "Height vs Weight",
        strAnchor: "middle",
        strClass: "title",
      },
    ],
  };
  assert.equal(
    renderSvg(objScene),
    `${STR_OPEN}<text x="300" y="25" text-anchor="middle" class="title">Height vs Weight</text></svg>`,
  );
});

test("keeps item order", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      { strKind: "circle", numX: 1, numY: 1, numR: 1, strClass: "a" },
      { strKind: "circle", numX: 2, numY: 2, numR: 1, strClass: "b" },
    ],
  };
  const strSvg = renderSvg(objScene);
  assert.ok(strSvg.indexOf('class="a"') < strSvg.indexOf('class="b"'));
});

test("escapes text content and attributes", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      {
        strKind: "text",
        numX: 0,
        numY: 0,
        strText: `A<B & "C"`,
        strAnchor: "start",
        strClass: `x" onload="y`,
      },
    ],
  };
  const strSvg = renderSvg(objScene);
  assert.ok(strSvg.includes(">A&lt;B &amp; &quot;C&quot;</text>"));
  assert.ok(strSvg.includes('class="x&quot; onload=&quot;y"'));
});

test("rounds coordinates to two decimals", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [
      {
        strKind: "circle",
        numX: 173.33333,
        numY: 0.1 + 0.2,
        numR: 4,
        strClass: "point",
      },
    ],
  };
  assert.ok(renderSvg(objScene).includes('cx="173.33" cy="0.3"'));
});

test("rejects an unknown item kind", () => {
  const objScene = {
    numWidth: 600,
    numHeight: 400,
    arrItems: [{ strKind: "rect" }],
  };
  assert.throws(() => renderSvg(objScene), /unknown scene item kind: rect/);
});
