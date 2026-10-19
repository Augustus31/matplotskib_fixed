// Browser smoke test for the page in web/: serve the repo, open /web/ in headless Chromium,
// and check that it draws. Lives outside test/ so `npm test` doesn't need a browser.
// Run with `npm run test:e2e`.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";
import { after, before, test } from "node:test";
import { chromium } from "playwright";

const URL_ROOT = new URL("../", import.meta.url);
const OBJ_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".csv": "text/csv",
};

// Static file server for the repo root, like `npx serve .`.
const objServer = createServer(async (objRequest, objResponse) => {
  const strPath = new URL(objRequest.url ?? "/", "http://localhost").pathname;
  const strFile = strPath.endsWith("/") ? `${strPath}index.html` : strPath;
  try {
    const bufBody = await readFile(new URL(`.${strFile}`, URL_ROOT));
    objResponse.writeHead(200, {
      "content-type": OBJ_TYPES[extname(strFile)] ?? "text/plain",
    });
    objResponse.end(bufBody);
  } catch {
    objResponse.writeHead(404).end();
  }
});

/** @type {import("playwright").Browser} */
let objBrowser;
/** @type {import("playwright").Page} */
let objPage;
/** Script errors, console errors and failed requests seen while the page runs. */
const arrProblems = [];

before(async () => {
  await new Promise((fnResolve) => objServer.listen(0, "127.0.0.1", fnResolve));
  const objAddress = /** @type {import("node:net").AddressInfo} */ (
    objServer.address()
  );
  objBrowser = await chromium.launch();
  objPage = await objBrowser.newPage();
  objPage.on("pageerror", (objError) => arrProblems.push(objError.message));
  objPage.on("console", (objMessage) => {
    if (objMessage.type() === "error") arrProblems.push(objMessage.text());
  });
  objPage.on("response", (objResponse) => {
    if (objResponse.status() >= 400) {
      arrProblems.push(`${objResponse.status()} ${objResponse.url()}`);
    }
  });
  await objPage.goto(`http://127.0.0.1:${objAddress.port}/web/`);
});

after(async () => {
  await objBrowser?.close();
  objServer.close();
});

test("the fixture draws one line per agent, with every stage live", async () => {
  const objLines = objPage.locator("#stage-canvas svg polyline.line");
  await objLines.first().waitFor();
  assert.equal(await objLines.count(), 3);
  assert.equal(await objPage.locator(".badge-live").count(), 3);
  assert.deepEqual(arrProblems, []);
});

test("switching to scatter draws one point per row", async () => {
  await objPage.locator("label[for='chart-scatter']").click();
  const objPoints = objPage.locator("#stage-canvas svg circle");
  await objPoints.first().waitFor();
  assert.equal(await objPoints.count(), 15);
  assert.deepEqual(arrProblems, []);
});

test("repeated switches preserve fields, series colors, legend and explicit None", async () => {
  await objPage.getByText("agents-vs-bugs.csv", { exact: true }).click();
  await objPage.locator("#slot-series").waitFor();
  await objPage.locator("label[for='chart-line']").click();
  const arrColors = await objPage
    .locator("polyline.line")
    .evaluateAll((arrEls) =>
      arrEls.map((objEl) => getComputedStyle(objEl).stroke),
    );
  for (let numCycle = 0; numCycle < 3; numCycle += 1) {
    await objPage.locator("label[for='chart-scatter']").click();
    assert.equal(await objPage.locator("#slot-x").inputValue(), "day");
    assert.equal(await objPage.locator("#slot-y").inputValue(), "bugs");
    assert.equal(await objPage.locator("#slot-series").inputValue(), "agent");
    assert.equal(await objPage.locator("#legend li").count(), 3);
    assert.equal(await objPage.locator("#legend").isVisible(), true);
    for (let numSeries = 0; numSeries < 3; numSeries += 1) {
      const objPoints = objPage.locator(`circle.point.series-${numSeries}`);
      assert.equal(await objPoints.count(), 5);
      assert.equal(
        await objPoints
          .first()
          .evaluate((objEl) => getComputedStyle(objEl).fill),
        arrColors[numSeries],
      );
    }
    await objPage.locator("label[for='chart-line']").click();
    assert.equal(await objPage.locator("polyline.line").count(), 3);
    assert.deepEqual(
      await objPage
        .locator("polyline.line")
        .evaluateAll((arrEls) =>
          arrEls.map(
            (objEl) => objEl.getAttribute("points").trim().split(/\s+/).length,
          ),
        ),
      [5, 5, 5],
    );
  }
  await objPage.locator("#slot-series").selectOption("");
  for (const strChart of ["scatter", "line", "scatter", "line"]) {
    await objPage.locator(`label[for='chart-${strChart}']`).click();
    assert.equal(await objPage.locator("#slot-series").inputValue(), "");
    assert.equal(await objPage.locator("#legend").isVisible(), false);
    assert.equal(
      await objPage
        .locator(
          strChart === "line"
            ? "polyline.line"
            : "circle.point:not([class*='series-'])",
        )
        .count(),
      strChart === "line" ? 1 : 15,
    );
  }
  assert.deepEqual(arrProblems, []);
});

test("saving the SVG downloads the chart currently displayed", async () => {
  await objPage.locator("#pipeline-toggle").click();
  const objSaveButton = objPage.locator("#save-svg-button");
  await objSaveButton.waitFor();
  const objDownloadPromise = objPage.waitForEvent("download");
  await objSaveButton.click();
  const objDownload = await objDownloadPromise;
  assert.equal(objDownload.suggestedFilename(), "chart.svg");
  const objStream = await objDownload.createReadStream();
  let strSvg = "";
  for await (const bufChunk of objStream) strSvg += bufChunk.toString();
  assert.match(strSvg, /^<svg /);
  assert.match(strSvg, /style="[^"]*fill:/);
  assert.match(strSvg, /style="[^"]*stroke:/);
  assert.match(strSvg, /style="[^"]*font-family:/);
  assert.equal(
    (strSvg.match(/<circle /g) ?? []).length,
    await objPage.locator("#stage-canvas svg circle").count(),
  );
  await objPage.locator("#pipeline-toggle").click();
  assert.deepEqual(arrProblems, []);
});

test("broken.csv shows the parser errors instead of a chart", async () => {
  await objPage.getByText("broken.csv", { exact: true }).click();
  await objPage.getByText("The parser rejected this file").waitFor();
  assert.equal(await objPage.locator("#stage-canvas svg").count(), 0);
  assert.equal(await objPage.locator("#stage-canvas li").count(), 2);
  assert.equal(await objPage.locator("#save-svg-button").isDisabled(), true);
  assert.deepEqual(arrProblems, []);
});

test("weekday sample stays invalid in both charts without substituting axes", async () => {
  await objPage.getByText("ci-minutes.csv", { exact: true }).click();
  await objPage.getByText("Layout can't build this chart").waitFor();
  for (const strChart of ["line", "scatter", "line"]) {
    await objPage.locator(`label[for='chart-${strChart}']`).click();
    assert.match(
      await objPage.locator("#stage-canvas").innerText(),
      /X and Y axes require numeric columns\. Category columns can only be used for series\./,
    );
    assert.equal(await objPage.locator("#stage-canvas svg").count(), 0);
    assert.equal(await objPage.locator("#save-svg-button").isDisabled(), true);
    assert.equal(await objPage.locator("#slot-x").inputValue(), "weekday");
    assert.equal(await objPage.locator("#slot-y").inputValue(), "minutes");
    for (const strAxis of ["x", "y"]) {
      assert.equal(
        await objPage
          .locator(`#slot-${strAxis} option[value='weekday']`)
          .evaluate((objOption) => objOption.disabled),
        true,
      );
    }
    assert.equal(
      await objPage
        .locator("#slot-series option[value='weekday']")
        .evaluate((objOption) => objOption.disabled),
      false,
    );
  }
  await objPage.locator("#slot-x").selectOption("minutes");
  await objPage.locator("#stage-canvas svg").waitFor();
  await objPage.locator("label[for='chart-scatter']").click();
  assert.equal(await objPage.locator("#slot-x").inputValue(), "minutes");
  assert.equal(await objPage.locator("#slot-y").inputValue(), "minutes");
  assert.equal(await objPage.locator("circle.point").count(), 5);
});

test("review-times sorts line vertices and restores scatter order and tooltips", async () => {
  await objPage.getByText("review-times.csv", { exact: true }).click();
  await objPage.waitForFunction(
    () => document.querySelector("#slot-x")?.value === "linesChanged",
  );
  await objPage.locator("circle.point").first().waitFor();
  const arrOriginal = await objPage
    .locator("circle.point")
    .evaluateAll((arrEls) =>
      arrEls.map((objEl) => [
        objEl.getAttribute("cx"),
        objEl.getAttribute("cy"),
      ]),
    );
  await objPage.locator("label[for='chart-line']").click();
  const arrXs = await objPage.locator("polyline.line").evaluate((objEl) =>
    objEl
      .getAttribute("points")
      .trim()
      .split(/\s+/)
      .map((strPoint) => Number(strPoint.split(",")[0])),
  );
  assert.equal(arrXs.length, 16);
  assert.ok(
    arrXs.every(
      (numX, numIndex) => numIndex === 0 || arrXs[numIndex - 1] <= numX,
    ),
  );
  await objPage.locator("label[for='chart-scatter']").click();
  assert.equal(await objPage.locator("#slot-x").inputValue(), "linesChanged");
  assert.equal(
    await objPage.locator("#slot-y").inputValue(),
    "minutesToReview",
  );
  assert.deepEqual(
    await objPage
      .locator("circle.point")
      .evaluateAll((arrEls) =>
        arrEls.map((objEl) => [
          objEl.getAttribute("cx"),
          objEl.getAttribute("cy"),
        ]),
      ),
    arrOriginal,
  );
  await objPage.locator("circle.point").nth(2).hover({ force: true });
  assert.equal(await objPage.locator("#tooltip").isVisible(), true);
  assert.deepEqual(await objPage.locator("#tooltip b").allTextContents(), [
    "15",
    "4",
  ]);
});

test("custom fields, title and size survive switches; dataset selection resets fields", async () => {
  await objPage.getByText("agents-vs-bugs.csv", { exact: true }).click();
  await objPage
    .locator("#slot-series option[value='agent']")
    .waitFor({ state: "attached" });
  await objPage.locator("#slot-x").selectOption("bugs");
  await objPage.locator("#slot-y").selectOption("day");
  await objPage.locator("#input-title").fill("Custom title");
  await objPage.locator("#input-width").fill("800");
  await objPage.locator("#input-height").fill("500");
  for (const strChart of ["scatter", "line", "scatter"]) {
    await objPage.locator(`label[for='chart-${strChart}']`).click();
    assert.equal(await objPage.locator("#slot-x").inputValue(), "bugs");
    assert.equal(await objPage.locator("#slot-y").inputValue(), "day");
    assert.equal(await objPage.locator("#slot-series").inputValue(), "agent");
    assert.equal(
      await objPage.locator("svg .title").textContent(),
      "Custom title",
    );
    assert.equal(
      await objPage.locator("#stage-canvas svg").getAttribute("width"),
      "800",
    );
    assert.equal(
      await objPage.locator("#stage-canvas svg").getAttribute("height"),
      "500",
    );
  }
  await objPage.locator("circle.point").nth(5).hover();
  assert.equal(
    await objPage.locator("#tooltip .tip-head").textContent(),
    "Agent B",
  );
  assert.deepEqual(await objPage.locator("#tooltip b").allTextContents(), [
    "2",
    "1",
  ]);
  await objPage.getByText("review-times.csv", { exact: true }).click();
  assert.equal(await objPage.locator("#slot-x").inputValue(), "linesChanged");
  assert.equal(
    await objPage.locator("#slot-y").inputValue(),
    "minutesToReview",
  );
  assert.equal(await objPage.locator("#slot-series").inputValue(), "");
});

test("uploads need two numeric initial axes and replacement uploads reset mappings", async () => {
  await objPage.locator("#input-file").setInputFiles({
    name: "switch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("weekday,minutes\nMon,14\nTue,22"),
  });
  await objPage.getByText("switch.csv", { exact: true }).waitFor();
  assert.equal(await objPage.locator("#slot-x").inputValue(), "minutes");
  assert.equal(await objPage.locator("#slot-y").inputValue(), "");
  for (const strChart of ["scatter", "line"]) {
    await objPage.locator(`label[for='chart-${strChart}']`).click();
    assert.equal(await objPage.locator("#slot-y").inputValue(), "");
    assert.match(
      await objPage.locator("#stage-canvas").innerText(),
      /X and Y axes require numeric columns/,
    );
    assert.equal(await objPage.locator("#stage-canvas svg").count(), 0);
  }
  await objPage.locator("#slot-y").selectOption("minutes");
  await objPage.locator("#slot-series").selectOption("weekday");
  await objPage.locator("label[for='chart-scatter']").click();
  assert.equal(await objPage.locator("circle.point").count(), 2);
  await objPage.locator("#input-file").setInputFiles({
    name: "switch.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("a,b\n3,4\n1,2"),
  });
  await objPage.waitForFunction(
    () => document.querySelector("#slot-x")?.value === "a",
  );
  assert.equal(await objPage.locator("#slot-y").inputValue(), "b");
  assert.equal(await objPage.locator("#slot-series").inputValue(), "");
  assert.equal(
    await objPage.getByText("switch.csv", { exact: true }).count(),
    1,
  );
  assert.equal(await objPage.locator("circle.point").count(), 2);
  assert.deepEqual(arrProblems, []);
});

test("the pipeline is hidden until the toggle shows it, and stays shown on reload", async () => {
  const objToggle = objPage.locator("#pipeline-toggle");
  assert.equal(await objPage.locator("#rail-wrap").isVisible(), false);
  assert.equal(await objPage.locator("#inspector").isVisible(), false);

  await objToggle.click();
  assert.equal(await objPage.locator("#rail-wrap").isVisible(), true);
  assert.equal(await objPage.locator("#inspector").isVisible(), true);
  assert.equal(await objToggle.getAttribute("aria-expanded"), "true");

  await objPage.reload();
  await objPage.locator("#stage-canvas svg").first().waitFor();
  assert.equal(await objPage.locator("#rail-wrap").isVisible(), true);

  await objToggle.click();
  assert.equal(await objPage.locator("#rail-wrap").isVisible(), false);
  assert.deepEqual(arrProblems, []);
});

test("interleaved line tooltips retain row identity and group classes across switches", async () => {
  await objPage.locator("#input-file").setInputFiles({
    name: "interleaved-tooltip.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("team,x,y\nBeta,2,3\nAlpha,2,7\nBeta,1,2\nAlpha,1,4"),
  });
  await objPage
    .locator("#slot-series option[value='team']")
    .waitFor({ state: "attached" });
  for (const strChart of ["line", "scatter", "line"]) {
    await objPage.locator(`label[for='chart-${strChart}']`).click();
    const objDots = objPage.locator("#stage-canvas circle.point");
    assert.equal(await objDots.count(), 4);
    assert.deepEqual(
      await objDots.evaluateAll((arrEls) =>
        arrEls.map((objEl) => objEl.getAttribute("class")),
      ),
      [0, 1, 0, 1].map(
        (numSeries) =>
          `point series-${numSeries}${strChart === "line" ? " line-point" : ""}`,
      ),
    );
    if (strChart === "line") {
      assert.equal(
        await objDots
          .first()
          .evaluate((objEl) => getComputedStyle(objEl).opacity),
        "0",
      );
      assert.equal(await objPage.locator("polyline.line").count(), 2);
    }
    await objDots.nth(2).hover({ force: true });
    assert.equal(await objPage.locator("#tooltip").isVisible(), true);
    assert.equal(
      await objPage.locator("#tooltip .tip-head").textContent(),
      "Beta",
    );
    assert.deepEqual(await objPage.locator("#tooltip b").allTextContents(), [
      "1",
      "2",
    ]);
    await objDots.nth(1).hover({ force: true });
    assert.equal(
      await objPage.locator("#tooltip .tip-head").textContent(),
      "Alpha",
    );
    assert.deepEqual(await objPage.locator("#tooltip b").allTextContents(), [
      "2",
      "7",
    ]);
  }
  assert.deepEqual(arrProblems, []);
});
