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
