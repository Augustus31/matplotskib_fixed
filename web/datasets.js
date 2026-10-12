// Data the page can load. Fixtures are the team's shared test inputs; samples are page-only
// files that show other column shapes and the parser error state. Uploads are added at runtime.

import { COLUMN_TYPES } from "../src/contracts.js";

/** @typedef {import("../src/contracts.js").ParseResult} ParseResult */

/**
 * @typedef {object} Dataset
 * @property {string} strId
 * @property {string} strPath path relative to web/index.html, or the file name for an upload
 * @property {"fixture" | "sample" | "upload"} strSource
 * @property {string} strAbout one line shown in the picker
 * @property {StartSpec} objStartSpec
 */

/**
 * @typedef {object} StartSpec
 * @property {string} strChart
 * @property {Object<string, string>} objFields
 * @property {string} strTitle
 */

/** Series colors the page has. A category column with more values than this is not a series. */
const NUM_MAX_SERIES = 4;

/** @type {Dataset[]} */
export const ARR_DATASETS = [
  {
    strId: "agents-vs-bugs",
    strPath: "../fixtures/agents-vs-bugs.csv",
    strSource: "fixture",
    strAbout: "Bugs found per day by three agents",
    objStartSpec: {
      strChart: "line",
      objFields: { x: "day", y: "bugs", series: "agent" },
      strTitle: "Bugs found per day",
    },
  },
  {
    strId: "review-times",
    strPath: "samples/review-times.csv",
    strSource: "sample",
    strAbout: "Lines changed against minutes to review, per PR",
    objStartSpec: {
      strChart: "scatter",
      objFields: { x: "linesChanged", y: "minutesToReview" },
      strTitle: "Bigger PRs take longer to review",
    },
  },
  {
    strId: "ci-minutes",
    strPath: "samples/ci-minutes.csv",
    strSource: "sample",
    strAbout: "CI minutes per weekday, a category x axis",
    objStartSpec: {
      strChart: "line",
      objFields: { x: "weekday", y: "minutes" },
      strTitle: "CI minutes this week",
    },
  },
  {
    strId: "broken",
    strPath: "samples/broken.csv",
    strSource: "sample",
    strAbout: "Two rows with the wrong number of fields, to show parser errors",
    objStartSpec: {
      strChart: "line",
      objFields: { x: "day", y: "bugs", series: "agent" },
      strTitle: "",
    },
  },
];

/**
 * Load a dataset's raw text. A bundled build can preload files on globalThis.OBJ_INLINE_FILES.
 * @param {Dataset} objDataset
 * @returns {Promise<string>}
 */
export async function loadRaw(objDataset) {
  const objInline = /** @type {any} */ (globalThis).OBJ_INLINE_FILES;
  if (objInline && objDataset.strPath in objInline)
    return objInline[objDataset.strPath];
  const objResponse = await fetch(objDataset.strPath);
  if (!objResponse.ok) {
    throw new Error(
      `could not load ${objDataset.strPath} (HTTP ${objResponse.status})`,
    );
  }
  return objResponse.text();
}

/**
 * Pick a starting chart for a file the page has not seen, such as an upload.
 * Two number columns make a scatter, or a line per series when a category column has a few
 * values. A category and a number column make a line. Slots it can't fill are left empty.
 * @param {ParseResult} objParse
 * @returns {StartSpec}
 */
export function guessSpec(objParse) {
  const arrNumbers = objParse.arrColumns.filter(
    (objCol) => objCol.strType === COLUMN_TYPES.NUMBER,
  );
  const arrCategories = objParse.arrColumns.filter(
    (objCol) => objCol.strType === COLUMN_TYPES.CATEGORY,
  );
  const objSeries = arrCategories.find((objCol) => {
    const numValues = new Set(
      objParse.arrRows.map((objRow) => objRow[objCol.strField]),
    ).size;
    return numValues >= 2 && numValues <= NUM_MAX_SERIES;
  });
  if (arrNumbers.length >= 2 && objSeries) {
    return {
      strChart: "line",
      objFields: {
        x: arrNumbers[0].strField,
        y: arrNumbers[1].strField,
        series: objSeries.strField,
      },
      strTitle: "",
    };
  }
  if (arrNumbers.length >= 2) {
    return {
      strChart: "scatter",
      objFields: { x: arrNumbers[0].strField, y: arrNumbers[1].strField },
      strTitle: "",
    };
  }
  if (arrNumbers.length === 1 && arrCategories.length >= 1) {
    return {
      strChart: "line",
      objFields: { x: arrCategories[0].strField, y: arrNumbers[0].strField },
      strTitle: "",
    };
  }
  return { strChart: "line", objFields: {}, strTitle: "" };
}
