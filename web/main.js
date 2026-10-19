// Workbench UI. Holds the user's choices, runs parse -> layout -> renderSvg on every change,
// and shows each contract in the inspector.

import { COLUMN_TYPES, DEFAULTS, SCENE_KINDS } from "../src/contracts.js";
import { ARR_DATASETS, guessSpec, loadRaw } from "./datasets.js";
import {
  ARR_CHART_NAMES,
  OBJ_STAGE_STATUS,
  getChart,
  layout,
  parse,
  renderSvg,
} from "./pipeline.js";

/** @typedef {import("../src/contracts.js").ParseResult} ParseResult */
/** @typedef {import("../src/contracts.js").ChartSpec} ChartSpec */
/** @typedef {import("../src/contracts.js").Scene} Scene */

/** What each inspector tab shows, worded for the team. */
const OBJ_TABS = {
  raw: {
    strTitle: "raw CSV",
    strRole: "The file as it sits on disk. Input to the parser.",
  },
  parse: {
    strTitle: "Validated Data",
    strRole:
      "Output from parser, input to layout. First row are the labels and consecutive rows are the data.",
  },
  scene: {
    strTitle: "Scene",
    strRole:
      "Output from layout, input to svg. Graph data with pixel positions for points and lines.",
  },
  svg: {
    strTitle: "<svg>",
    strRole: "What renderSvg returns. This is what the stage shows.",
  },
};

const NUM_HOVER_RADIUS = 18;
const NUM_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const STR_PIPELINE_KEY = "matplotskib.showPipeline";

/** Built-in files plus anything uploaded this session, newest upload first. */
const arrDatasets = [...ARR_DATASETS];
let numUploads = 0;

/** @type {Map<string, string>} raw text by dataset id */
const mapRaw = new Map();

const objState = {
  strDatasetId: ARR_DATASETS[0].strId,
  strChart: ARR_DATASETS[0].objStartSpec.strChart,
  /** @type {Object<string, string>} */
  objFields: { ...ARR_DATASETS[0].objStartSpec.objFields },
  strTitle: ARR_DATASETS[0].objStartSpec.strTitle,
  numWidth: DEFAULTS.numWidth,
  numHeight: DEFAULTS.numHeight,
  strTab: "parse",
  /** @type {null | {strRaw: string, objParse: ParseResult, objSpec: ChartSpec, objScene: Scene | null, strSvg: string, strLayoutError: string}} */
  objRun: null,
};

/**
 * @param {string} strId
 * @returns {HTMLElement}
 */
function byId(strId) {
  return /** @type {HTMLElement} */ (document.getElementById(strId));
}

/**
 * Escape text for innerHTML.
 * @param {unknown} valRaw
 * @returns {string}
 */
function escapeHtml(valRaw) {
  return String(valRaw).replace(
    /[&<>"']/g,
    (strChar) =>
      /** @type {Object<string, string>} */ ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[strChar],
  );
}

/**
 * @param {number} numCount
 * @param {string} strWord
 * @returns {string}
 */
function plural(numCount, strWord) {
  return `${numCount} ${strWord}${numCount === 1 ? "" : "s"}`;
}

/** @returns {import("./datasets.js").Dataset} */
function currentDataset() {
  return (
    arrDatasets.find((objSet) => objSet.strId === objState.strDatasetId) ??
    arrDatasets[0]
  );
}

/**
 * The ChartSpec the controls describe. Empty optional slots are left out.
 * @returns {ChartSpec}
 */
function currentSpec() {
  /** @type {ChartSpec} */
  const objSpec = {
    strChart: objState.strChart,
    objFields: Object.fromEntries(
      Object.entries(objState.objFields).filter(([, strField]) => strField),
    ),
    numWidth: objState.numWidth,
    numHeight: objState.numHeight,
  };
  if (objState.strTitle.trim()) objSpec.strTitle = objState.strTitle.trim();
  return objSpec;
}

/**
 * Preserve explicit choices for validation; fill only unspecified required slots.
 * @param {ParseResult} objParse
 * @returns {void}
 */
function reconcileFields(objParse) {
  const objChart = getChart(objState.strChart);
  /** @type {Object<string, string>} */
  const objNext = {};
  const setUsed = new Set();
  for (const objSlot of objChart.arrSlots) {
    const strKept = objState.objFields[objSlot.strSlot];
    const objKept = objParse.arrColumns.find(
      (objCol) => objCol.strField === strKept,
    );
    if (strKept !== undefined) {
      objNext[objSlot.strSlot] = strKept;
      if (objKept) setUsed.add(strKept);
    }
  }
  for (const objSlot of objChart.arrSlots) {
    if (objSlot.strSlot in objNext) continue;
    if (/** @type {{bOptional?: boolean}} */ (objSlot).bOptional) {
      objNext[objSlot.strSlot] = "";
      continue;
    }
    const objFree = objParse.arrColumns.find(
      (objCol) =>
        !setUsed.has(objCol.strField) &&
        objSlot.arrTypes.includes(objCol.strType),
    );
    objNext[objSlot.strSlot] = objFree ? objFree.strField : "";
    if (objFree) setUsed.add(objFree.strField);
  }
  objState.objFields = objNext;
}

/** Run the whole pipeline from the current state. */
function run() {
  const strRaw = mapRaw.get(objState.strDatasetId) ?? "";
  const objParse = parse(strRaw);
  const objSpec = currentSpec();
  /** @type {Scene | null} */
  let objScene = null;
  let strLayoutError = "";
  if (objParse.arrErrors.length === 0) {
    try {
      objScene = layout(objParse, objSpec);
    } catch (objError) {
      strLayoutError = /** @type {Error} */ (objError).message;
      if (
        ["x", "y"].some(
          (strAxis) =>
            strLayoutError ===
            `${objState.strChart} needs a column for "${strAxis}"`,
        ) &&
        objParse.arrColumns.filter(
          (objCol) => objCol.strType === COLUMN_TYPES.NUMBER,
        ).length < 2
      ) {
        strLayoutError =
          "X and Y axes require numeric columns. Category columns can only be used for series.";
      }
    }
  }
  const strSvg = objScene ? renderSvg(objScene) : "";
  objState.objRun = {
    strRaw,
    objParse,
    objSpec,
    objScene,
    strSvg,
    strLayoutError,
  };
  renderRail();
  renderStage();
  renderInspector();
  pulseRail();
}

// ---------- controls ----------

function renderDatasets() {
  byId("dataset-list").innerHTML = arrDatasets
    .map(
      (objSet) => `
      <label class="dataset" for="dataset-${objSet.strId}">
        <input type="radio" name="dataset" id="dataset-${objSet.strId}" value="${objSet.strId}"
          ${objSet.strId === objState.strDatasetId ? "checked" : ""} />
        <span class="dataset-file">${escapeHtml(objSet.strPath.split("/").pop())}</span>
        <span class="dataset-about">${escapeHtml(objSet.strAbout)}</span>
        <span class="source source-${objSet.strSource}">${objSet.strSource}</span>
      </label>`,
    )
    .join("");
}

function renderChartPicker() {
  byId("chart-picker").innerHTML = ARR_CHART_NAMES.map(
    (strName) => `
      <label class="segment" for="chart-${strName}">
        <input type="radio" name="chart" id="chart-${strName}" value="${strName}"
          ${strName === objState.strChart ? "checked" : ""} />
        <span>${strName}</span>
      </label>`,
  ).join("");
}

/** @param {ParseResult} objParse */
function renderSlots(objParse) {
  const objChart = getChart(objState.strChart);
  byId("slot-list").innerHTML = objChart.arrSlots
    .map((objSlot) => {
      const boolOptional = /** @type {{bOptional?: boolean}} */ (objSlot)
        .bOptional;
      const strChosen = objState.objFields[objSlot.strSlot] ?? "";
      const strOptions = objParse.arrColumns
        .map((objCol) => {
          const boolFits = objSlot.arrTypes.includes(objCol.strType);
          return `<option value="${escapeHtml(objCol.strField)}" ${boolFits ? "" : "disabled"}
            ${objCol.strField === strChosen ? "selected" : ""}>${escapeHtml(objCol.strField)} (${objCol.strType})</option>`;
        })
        .join("");
      const strNone = `<option value="" ${strChosen ? "" : "selected"}>${boolOptional ? "None" : "Choose a column"}</option>`;
      return `
        <label class="slot" for="slot-${objSlot.strSlot}">
          <span class="slot-name">${objSlot.strSlot}</span>
          <span class="slot-types">${objSlot.arrTypes.join(" or ")}${boolOptional ? ", optional" : ""}</span>
          <select id="slot-${objSlot.strSlot}" data-slot="${objSlot.strSlot}">${strNone}${strOptions}</select>
        </label>`;
    })
    .join("");
}

function syncInputs() {
  /** @type {HTMLInputElement} */ (byId("input-title")).value =
    objState.strTitle;
  /** @type {HTMLInputElement} */ (byId("input-width")).value = String(
    objState.numWidth,
  );
  /** @type {HTMLInputElement} */ (byId("input-height")).value = String(
    objState.numHeight,
  );
}

/**
 * @param {string} strId
 * @param {number} numFallback
 * @returns {number}
 */
function readSize(strId, numFallback) {
  const objInput = /** @type {HTMLInputElement} */ (byId(strId));
  const numValue = Number(objInput.value);
  const numMin = Number(objInput.min);
  const numMax = Number(objInput.max);
  if (!Number.isFinite(numValue) || numValue < numMin || numValue > numMax)
    return numFallback;
  return numValue;
}

/** @param {string} strId */
async function selectDataset(strId) {
  const objSet = arrDatasets.find((objItem) => objItem.strId === strId);
  if (!objSet) return;
  objState.strDatasetId = strId;
  if (!mapRaw.has(strId)) {
    try {
      mapRaw.set(strId, await loadRaw(objSet));
    } catch (objError) {
      mapRaw.set(strId, "");
      showLoadError(/** @type {Error} */ (objError).message);
      return;
    }
  }
  objState.strChart = objSet.objStartSpec.strChart;
  objState.objFields = { ...objSet.objStartSpec.objFields };
  objState.strTitle = objSet.objStartSpec.strTitle;
  const objParse = parse(mapRaw.get(strId) ?? "");
  reconcileFields(objParse);
  renderChartPicker();
  renderSlots(objParse);
  syncInputs();
  run();
}

/** @param {string} strMessage */
function showLoadError(strMessage) {
  byId("legend").hidden = true;
  byId("stage-canvas").innerHTML = `
    <div class="stage-message">
      <h3>The data file didn't load</h3>
      <p>${escapeHtml(strMessage)}. Serve the repo root over HTTP (see web/README.md) rather than
      opening index.html from disk.</p>
    </div>`;
}

/**
 * Show or clear the message under the upload control.
 * @param {string} strMessage empty to clear
 */
function setUploadStatus(strMessage) {
  const objStatus = byId("upload-status");
  objStatus.textContent = strMessage;
  objStatus.hidden = strMessage === "";
}

/**
 * Add a CSV from the user's computer to the data list and draw it. The file never leaves
 * the browser. Uploading a file with the same name again replaces the earlier one.
 * @param {File} objFile
 */
async function addUpload(objFile) {
  if (!/\.csv$/i.test(objFile.name) && objFile.type !== "text/csv") {
    setUploadStatus(
      `${objFile.name} isn't a CSV file. Choose a file ending in .csv.`,
    );
    return;
  }
  if (objFile.size > NUM_MAX_UPLOAD_BYTES) {
    setUploadStatus(
      `${objFile.name} is ${(objFile.size / 1024 / 1024).toFixed(1)} MB. Choose a CSV under 5 MB.`,
    );
    return;
  }
  let strRaw;
  try {
    strRaw = await objFile.text();
  } catch {
    setUploadStatus(`Couldn't read ${objFile.name}. Try choosing it again.`);
    return;
  }
  const objParse = parse(strRaw);
  const objExisting = arrDatasets.find(
    (objSet) =>
      objSet.strSource === "upload" && objSet.strPath === objFile.name,
  );
  /** @type {import("./datasets.js").Dataset} */
  const objSet = {
    strId: objExisting?.strId ?? `upload-${(numUploads += 1)}`,
    strPath: objFile.name,
    strSource: "upload",
    strAbout: objParse.arrErrors.length
      ? `Uploaded, ${plural(objParse.arrErrors.length, "error")}`
      : `Uploaded, ${plural(objParse.arrRows.length, "row")} and ${plural(objParse.arrColumns.length, "column")}`,
    objStartSpec: guessSpec(objParse),
  };
  if (objExisting) arrDatasets.splice(arrDatasets.indexOf(objExisting), 1);
  arrDatasets.unshift(objSet);
  mapRaw.set(objSet.strId, strRaw);
  setUploadStatus("");
  objState.strDatasetId = objSet.strId;
  renderDatasets();
  await selectDataset(objSet.strId);
}

/** File picker plus drag and drop anywhere on the page. */
function wireUpload() {
  const objZone = byId("upload-zone");
  /** @param {DragEvent} objEvent */
  const fnHasFiles = (objEvent) =>
    Boolean(objEvent.dataTransfer?.types.includes("Files"));
  window.addEventListener("dragover", (objEvent) => {
    if (!fnHasFiles(objEvent)) return;
    objEvent.preventDefault();
    objZone.classList.add("is-dragging");
  });
  window.addEventListener("dragleave", (objEvent) => {
    if (objEvent.relatedTarget === null)
      objZone.classList.remove("is-dragging");
  });
  window.addEventListener("drop", (objEvent) => {
    if (!fnHasFiles(objEvent)) return;
    objEvent.preventDefault();
    objZone.classList.remove("is-dragging");
    const objFile = objEvent.dataTransfer?.files[0];
    if (objFile) addUpload(objFile);
  });
}

function wireControls() {
  const objForm = byId("controls");
  objForm.addEventListener("submit", (objEvent) => objEvent.preventDefault());
  objForm.addEventListener("change", (objEvent) => {
    const objTarget = /** @type {HTMLInputElement} */ (objEvent.target);
    if (objTarget.id === "input-file") {
      const objFile = objTarget.files?.[0];
      objTarget.value = "";
      if (objFile) addUpload(objFile);
    } else if (objTarget.name === "dataset") {
      selectDataset(objTarget.value);
    } else if (objTarget.name === "chart") {
      objState.strChart = objTarget.value;
      const objParse = parse(mapRaw.get(objState.strDatasetId) ?? "");
      reconcileFields(objParse);
      renderSlots(objParse);
      run();
    } else if (objTarget.dataset.slot) {
      objState.objFields[objTarget.dataset.slot] = objTarget.value;
      run();
    }
  });
  objForm.addEventListener("input", (objEvent) => {
    const objTarget = /** @type {HTMLInputElement} */ (objEvent.target);
    if (objTarget.id === "input-title") objState.strTitle = objTarget.value;
    else if (objTarget.id === "input-width")
      objState.numWidth = readSize("input-width", objState.numWidth);
    else if (objTarget.id === "input-height")
      objState.numHeight = readSize("input-height", objState.numHeight);
    else return;
    run();
  });
}

// ---------- pipeline rail ----------

/**
 * @param {string} strKey
 * @param {string} strText
 */
function setMeta(strKey, strText) {
  const objEl = document.querySelector(`[data-meta="${strKey}"]`);
  if (objEl) objEl.textContent = strText;
}

/**
 * @param {string} strStage
 * @param {"live" | "mock" | "error" | "skipped"} strState
 * @param {string} strText
 */
function setBadge(strStage, strState, strText) {
  const objBadge = /** @type {HTMLElement} */ (
    document.querySelector(`[data-badge="${strStage}"]`)
  );
  objBadge.className = `badge badge-${strState}`;
  objBadge.textContent = strText;
  objBadge.closest(".rail-module")?.setAttribute("data-state", strState);
}

function renderRail() {
  const objRun = /** @type {NonNullable<typeof objState.objRun>} */ (
    objState.objRun
  );
  const { objParse, objScene } = objRun;
  const numLines = objRun.strRaw
    .split(/\r?\n/)
    .filter((strLine) => strLine.trim()).length;
  setMeta("raw", plural(numLines, "line"));
  setMeta(
    "parse",
    objParse.arrErrors.length
      ? plural(objParse.arrErrors.length, "error")
      : `${plural(objParse.arrRows.length, "row")}, ${plural(objParse.arrColumns.length, "column")}`,
  );
  setMeta(
    "scene",
    objScene ? plural(objScene.arrItems.length, "item") : "none",
  );
  setMeta(
    "svg",
    objRun.strSvg
      ? `${(new Blob([objRun.strSvg]).size / 1024).toFixed(1)} KB`
      : "none",
  );

  const strParserBase = OBJ_STAGE_STATUS.parser === "live" ? "live" : "mock";
  if (objParse.arrErrors.length)
    setBadge("parser", "error", plural(objParse.arrErrors.length, "error"));
  else setBadge("parser", strParserBase, strParserBase);

  const strLayoutBase = OBJ_STAGE_STATUS.layout === "live" ? "live" : "mock";
  if (objParse.arrErrors.length) setBadge("layout", "skipped", "skipped");
  else if (objRun.strLayoutError) setBadge("layout", "error", "error");
  else setBadge("layout", strLayoutBase, strLayoutBase);

  const strSvgBase = OBJ_STAGE_STATUS.svg === "live" ? "live" : "mock";
  if (objScene) setBadge("svg", strSvgBase, strSvgBase);
  else setBadge("svg", "skipped", "skipped");

  document.querySelectorAll(".rail-contract").forEach((objButton) => {
    const boolActive =
      /** @type {HTMLElement} */ (objButton).dataset.tab === objState.strTab;
    objButton.setAttribute("aria-pressed", String(boolActive));
  });
}

/** One short highlight that walks the rail left to right after each run. */
function pulseRail() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let boolStopped = false;
  if (!isPipelineShown()) return;
  document.querySelectorAll(".rail-step").forEach((objStep, numIndex) => {
    const objEl = /** @type {HTMLElement} */ (objStep);
    objEl.classList.remove("is-pulsing");
    if (boolStopped) return;
    objEl.style.setProperty("--pulse-delay", `${numIndex * 45}ms`);
    void objEl.offsetWidth;
    objEl.classList.add("is-pulsing");
    // will pulse the component that failed
    boolStopped = Boolean(objEl.querySelector('[data-state="error"]'));
  });
}

function wireRail() {
  byId("rail").addEventListener("click", (objEvent) => {
    const objButton = /** @type {HTMLElement} */ (objEvent.target).closest(
      "[data-tab]",
    );
    if (!objButton) return;
    objState.strTab =
      /** @type {HTMLElement} */ (objButton).dataset.tab ?? "parse";
    renderRail();
    renderInspector();
  });
}

// ---------- pipeline toggle ----------

function isPipelineShown() {
  return (
    /** @type {HTMLElement} */ (document.querySelector(".page")).dataset
      .pipeline === "shown"
  );
}

/** @param {boolean} boolShown */
function setPipelineShown(boolShown) {
  const objPage = /** @type {HTMLElement} */ (document.querySelector(".page"));
  objPage.dataset.pipeline = boolShown ? "shown" : "hidden";
  const objToggle = byId("pipeline-toggle");
  objToggle.setAttribute("aria-expanded", String(boolShown));
  objToggle.textContent = boolShown ? "Hide pipeline" : "Show pipeline";
  try {
    localStorage.setItem(STR_PIPELINE_KEY, String(boolShown));
  } catch {
    // storage blocked: the choice just won't survive a reload
  }
}

/** Hidden by default; the masthead button shows the rail and inspector. */
function wirePipelineToggle() {
  let boolSaved = false;
  try {
    boolSaved = localStorage.getItem(STR_PIPELINE_KEY) === "true";
  } catch {
    // storage blocked: fall back to hidden
  }
  setPipelineShown(boolSaved);
  byId("pipeline-toggle").addEventListener("click", () => {
    setPipelineShown(!isPipelineShown());
    pulseRail();
  });
}

// ---------- stage ----------

function renderStage() {
  const objRun = /** @type {NonNullable<typeof objState.objRun>} */ (
    objState.objRun
  );
  const objCanvas = byId("stage-canvas");
  const objLegend = byId("legend");
  byId("tooltip").hidden = true;

  if (objRun.objParse.arrErrors.length) {
    objLegend.hidden = true;
    objCanvas.innerHTML = `
      <div class="stage-message is-error">
        <h3>The parser rejected this file</h3>
        <p>When any row is bad the parser returns no rows, so there is nothing to draw.
        Fix these rows in <code>${escapeHtml(currentDataset().strPath)}</code>:</p>
        <ul>${objRun.objParse.arrErrors.map((strError) => `<li>${escapeHtml(strError)}</li>`).join("")}</ul>
      </div>`;
    return;
  }
  if (objRun.strLayoutError) {
    objLegend.hidden = true;
    objCanvas.innerHTML = `
      <div class="stage-message is-error">
        <h3>Layout can't build this chart</h3>
        <p>${escapeHtml(objRun.strLayoutError)}${objRun.strLayoutError.endsWith(".") ? "" : "."} ${
          objRun.strLayoutError.startsWith("No column")
            ? "Pick the other chart, or upload a file that has one."
            : "Pick a different column under Columns."
        }</p>
      </div>`;
    return;
  }

  objCanvas.innerHTML = objRun.strSvg;
  const strSeriesField = objRun.objSpec.objFields.series;
  if (strSeriesField) {
    const arrSeries = [
      ...new Set(
        objRun.objParse.arrRows.map((objRow) => String(objRow[strSeriesField])),
      ),
    ];
    objLegend.innerHTML = arrSeries
      .map(
        (strName, numIndex) =>
          `<li><span class="swatch series-${numIndex}" aria-hidden="true"></span>${escapeHtml(strName)}</li>`,
      )
      .join("");
    objLegend.hidden = arrSeries.length < 2;
  } else {
    objLegend.hidden = true;
  }
  const objSvg = objCanvas.querySelector("svg");
  if (objSvg) {
    objSvg.setAttribute("role", "img");
    objSvg.setAttribute(
      "aria-label",
      objRun.objSpec.strTitle ??
        `${objRun.objSpec.strChart} of ${objRun.objSpec.objFields.y}`,
    );
  }
}

/**
 * Nearest point to the pointer, within the hover radius. Uses the Scene, not the DOM,
 * because circles are emitted in the same order the Scene lists them.
 * @param {PointerEvent} objEvent
 */
function onStagePointer(objEvent) {
  const objRun = objState.objRun;
  const objSvg = /** @type {SVGSVGElement | null} */ (
    byId("stage-canvas").querySelector("svg")
  );
  const objTip = byId("tooltip");
  if (!objRun?.objScene || !objSvg) return;
  const objMatrix = objSvg.getScreenCTM();
  if (!objMatrix) return;
  const objPoint = new DOMPoint(
    objEvent.clientX,
    objEvent.clientY,
  ).matrixTransform(objMatrix.inverse());
  const arrCircles = objRun.objScene.arrItems.filter(
    (objItem) => objItem.strKind === SCENE_KINDS.CIRCLE,
  );
  let numBest = -1;
  let numBestDist = NUM_HOVER_RADIUS;
  arrCircles.forEach((objItem, numIndex) => {
    const objCircle = /** @type {import("../src/contracts.js").SceneCircle} */ (
      objItem
    );
    const numDist = Math.hypot(
      objCircle.numX - objPoint.x,
      objCircle.numY - objPoint.y,
    );
    if (numDist < numBestDist) {
      numBest = numIndex;
      numBestDist = numDist;
    }
  });
  const arrEls = objSvg.querySelectorAll("circle");
  arrEls.forEach((objEl) => objEl.classList.remove("is-hot"));
  if (numBest < 0) {
    objTip.hidden = true;
    return;
  }
  const objCircle = /** @type {any} */ (arrCircles[numBest]);
  arrEls[numBest]?.classList.add("is-hot");
  // numRowIndex is a proposed SceneCircle field. Without it, fall back to circle order when
  // there is one circle per row, which is what scatter emits.
  const numRowIndex =
    objCircle.numRowIndex ??
    (arrCircles.length === objRun.objParse.arrRows.length ? numBest : -1);
  const objRow = objRun.objParse.arrRows[numRowIndex];
  if (!objRow) {
    objTip.hidden = true;
    return;
  }
  const strSeries = objRun.objSpec.objFields.series;
  const arrOrder = [
    strSeries,
    objRun.objSpec.objFields.x,
    objRun.objSpec.objFields.y,
  ].filter(Boolean);
  objTip.innerHTML = arrOrder
    .map(
      (strField) =>
        `<div class="${strField === strSeries ? "tip-head" : "tip-row"}">${
          strField === strSeries
            ? escapeHtml(objRow[strField])
            : `<span>${escapeHtml(strField)}</span><b>${escapeHtml(objRow[strField])}</b>`
        }</div>`,
    )
    .join("");
  const objScreen = new DOMPoint(
    objCircle.numX,
    objCircle.numY,
  ).matrixTransform(objMatrix);
  const objStageBox = /** @type {HTMLElement} */ (
    objTip.parentElement
  ).getBoundingClientRect();
  objTip.hidden = false;
  const numLeft = Math.min(
    objScreen.x - objStageBox.left + 12,
    objStageBox.width - objTip.offsetWidth - 8,
  );
  objTip.style.left = `${Math.max(8, numLeft)}px`;
  objTip.style.top = `${Math.max(4, objScreen.y - objStageBox.top - objTip.offsetHeight - 10)}px`;
}

function wireStage() {
  const objCanvas = byId("stage-canvas");
  objCanvas.addEventListener("pointermove", onStagePointer);
  objCanvas.addEventListener("pointerleave", () => {
    byId("tooltip").hidden = true;
    objCanvas
      .querySelectorAll("circle.is-hot")
      .forEach((objEl) => objEl.classList.remove("is-hot"));
  });
}

// ---------- inspector ----------

/**
 * Scene as JSON with one item per line, so long scenes stay scannable.
 * @param {Scene} objScene
 * @returns {string}
 */
function formatScene(objScene) {
  const strItems = objScene.arrItems
    .map((objItem) => `    ${JSON.stringify(objItem)}`)
    .join(",\n");
  return `{\n  "numWidth": ${objScene.numWidth},\n  "numHeight": ${objScene.numHeight},\n  "arrItems": [\n${strItems}\n  ]\n}`;
}

/**
 * SVG markup with one element per line.
 * @param {string} strSvg
 * @returns {string}
 */
function formatSvg(strSvg) {
  return strSvg
    .replace(/></g, ">\n<")
    .replace(/\n<(circle|polyline|text)/g, "\n  <$1");
}

/** @returns {string} text the Copy button copies for the current tab */
function copyText() {
  const objRun = objState.objRun;
  if (!objRun) return "";
  switch (objState.strTab) {
    case "raw":
      return objRun.strRaw;
    case "parse":
      return JSON.stringify(objRun.objParse, null, 2);
    case "scene":
      return objRun.objScene ? formatScene(objRun.objScene) : "";
    default:
      return objRun.strSvg;
  }
}

/** @param {ParseResult} objParse */
function parseView(objParse) {
  const strColumns = objParse.arrColumns
    .map(
      (objCol) =>
        `<li><code>${escapeHtml(objCol.strField)}</code><span class="type type-${objCol.strType}">${objCol.strType}</span></li>`,
    )
    .join("");
  const strErrors = objParse.arrErrors.length
    ? `<h3 class="sub">arrErrors</h3><ul class="error-list">${objParse.arrErrors
        .map((strError) => `<li>${escapeHtml(strError)}</li>`)
        .join("")}</ul>`
    : "";
  const strHead = objParse.arrColumns
    .map(
      (objCol) =>
        `<th scope="col" class="${objCol.strType === COLUMN_TYPES.NUMBER ? "num" : ""}">${escapeHtml(objCol.strField)}</th>`,
    )
    .join("");
  const strBody = objParse.arrRows
    .map(
      (objRow) =>
        `<tr>${objParse.arrColumns
          .map(
            (objCol) =>
              `<td class="${objCol.strType === COLUMN_TYPES.NUMBER ? "num" : ""}">${escapeHtml(objRow[objCol.strField])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const strTable = objParse.arrRows.length
    ? `<h3 class="sub">arrRows</h3><div class="table-wrap"><table><thead><tr>${strHead}</tr></thead><tbody>${strBody}</tbody></table></div>`
    : `<h3 class="sub">arrRows</h3><p class="muted">Empty, because arrErrors is not.</p>`;
  return `<h3 class="sub">arrColumns</h3><ul class="column-list">${strColumns}</ul>${strErrors}${strTable}`;
}

/** @param {Scene} objScene */
function sceneView(objScene) {
  const LAYOUT_LABELS = {
    grid: "gridline",
    tick: "tick mark",
    "tick-label": "tick label",
    axis: "axis line",
    "axis-label": "axis label",
    title: "title",
    point: "data point",
    line: "data line",
  };

  /** @type {Object<string, number>} */
  const objCounts = {};
  for (const objItem of objScene.arrItems) {
    const strBase = objItem.strClass.split(" ")[0];
    objCounts[strBase] = (objCounts[strBase] ?? 0) + 1;
  }
  const strCounts = Object.entries(objCounts)
    .map(([strClass, numCount]) => {
      const strLabel = LAYOUT_LABELS[strClass] ?? strClass;
      return `<li><span class="count">${numCount}</span> ${strLabel}${numCount === 1 ? "" : "s"}</li>`;
    })
    .join("");
  return `<ul class="count-list">${strCounts}</ul><pre class="code">${escapeHtml(formatScene(objScene))}</pre>`;
}

function renderInspector() {
  const objRun = objState.objRun;
  if (!objRun) return;
  const objTab =
    OBJ_TABS[/** @type {keyof typeof OBJ_TABS} */ (objState.strTab)];
  byId("inspector-title").textContent = objTab.strTitle;
  byId("inspector-role").textContent = objTab.strRole;
  const objBody = byId("inspector-body");
  const strNothing = (/** @type {string} */ strWhy) =>
    `<p class="muted">${strWhy}</p>`;
  let strHtml;
  switch (objState.strTab) {
    case "raw":
      strHtml = `<pre class="code numbered">${objRun.strRaw
        .split(/\r?\n/)
        .filter((strLine) => strLine !== "")
        .map((strLine) => `<span>${escapeHtml(strLine)}</span>`)
        .join("\n")}</pre>`;
      break;
    case "parse":
      strHtml = parseView(objRun.objParse);
      break;
    case "scene":
      strHtml = objRun.objScene
        ? sceneView(objRun.objScene)
        : strNothing(
            "No scene. Layout didn't run because an earlier stage failed.",
          );
      break;
    default:
      strHtml = objRun.strSvg
        ? `<pre class="code">${escapeHtml(formatSvg(objRun.strSvg))}</pre>`
        : strNothing("No markup. There was no scene to render.");
  }
  objBody.innerHTML = strHtml;
  const objCopy = /** @type {HTMLButtonElement} */ (byId("copy-button"));
  objCopy.disabled = copyText() === "";
  objCopy.textContent = "Copy";
}

function wireCopy() {
  const objCopy = /** @type {HTMLButtonElement} */ (byId("copy-button"));
  objCopy.addEventListener("click", () => {
    const strText = copyText();
    const fnDone = () => {
      objCopy.textContent = "Copied";
      window.setTimeout(() => (objCopy.textContent = "Copy"), 1400);
    };
    const fnFallback = () => {
      const objPre = byId("inspector-body").querySelector("pre, table");
      if (!objPre) return;
      const objRange = document.createRange();
      objRange.selectNodeContents(objPre);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(objRange);
      objCopy.textContent = "Selected, press Ctrl+C";
    };
    try {
      navigator.clipboard.writeText(strText).then(fnDone, fnFallback);
    } catch {
      fnFallback();
    }
  });
}

// ---------- start ----------

renderDatasets();
renderChartPicker();
syncInputs();
wireControls();
wireUpload();
wireRail();
wirePipelineToggle();
wireStage();
wireCopy();
selectDataset(objState.strDatasetId);
