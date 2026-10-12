// Shared contracts between parser, layout and svg. Types and constants only.
// Change these through a PR that every module owner reviews.

/** Column types the parser can report. */
export const COLUMN_TYPES = Object.freeze({
  CATEGORY: "category",
  NUMBER: "number",
});

/** Kinds of drawable item in a Scene. */
export const SCENE_KINDS = Object.freeze({
  RECT: "rect",
  POLYLINE: "polyline",
  TEXT: "text",
});

/** Defaults shared by layout and tests. */
export const DEFAULTS = Object.freeze({
  numWidth: 600,
  numHeight: 400,
  numMargin: 40,
});

/**
 * @typedef {"category" | "number"} ColumnType
 */

/**
 * One column of parsed data.
 * @typedef {object} Column
 * @property {string} strField column name
 * @property {ColumnType} strType inferred by the parser: number only if every value is numeric
 */

/**
 * Parser output. Never thrown: bad input fills arrErrors and leaves arrRows empty.
 * @typedef {object} ParseResult
 * @property {Column[]} arrColumns
 * @property {Object<string, string | number>[]} arrRows one plain object per row, keyed by strField
 * @property {string[]} arrErrors for example "row 3: score is not a number"
 */

/**
 * Drawing area handed to a chart type. Layout owns the margins and axes.
 * @typedef {object} Frame
 * @property {number} numWidth
 * @property {number} numHeight
 * @property {{numTop: number, numRight: number, numBottom: number, numLeft: number}} objMargin
 */

/**
 * What the caller asks for. strChart is a registry key, not a fixed list.
 * @typedef {object} ChartSpec
 * @property {string} strChart registry key such as "bar" or "line"
 * @property {Object<string, string>} objFields chart slot name to column name, for example {x: "name", y: "score"}
 * @property {string} [strTitle]
 * @property {number} [numWidth]
 * @property {number} [numHeight]
 * @property {Object} [objOptions] chart-specific options
 */

/**
 * @typedef {object} SceneRect
 * @property {"rect"} strKind
 * @property {number} numX
 * @property {number} numY
 * @property {number} numW
 * @property {number} numH
 * @property {string} strClass styling hook, left to CSS
 */

/**
 * @typedef {object} ScenePolyline
 * @property {"polyline"} strKind
 * @property {number[][]} arrPoints list of [x, y]
 * @property {string} strClass
 */

/**
 * @typedef {object} SceneText
 * @property {"text"} strKind
 * @property {number} numX
 * @property {number} numY
 * @property {string} strText
 * @property {"start" | "middle" | "end"} strAnchor
 * @property {string} strClass
 */

/**
 * @typedef {SceneRect | ScenePolyline | SceneText} SceneItem
 */

/**
 * Layout output and svg input. Plain data, no DOM.
 * @typedef {object} Scene
 * @property {number} numWidth
 * @property {number} numHeight
 * @property {SceneItem[]} arrItems
 */

/**
 * One data slot a chart type needs.
 * @typedef {object} ChartSlot
 * @property {string} strSlot slot name, for example "x" or "y"
 * @property {ColumnType[]} arrTypes column types the slot accepts
 */

/**
 * A pluggable chart type. Adding a chart means adding one of these and registering it.
 * fnBuild returns only the chart's own marks. Axes, ticks and titles stay in layout.
 * @typedef {object} ChartType
 * @property {string} strName registry key
 * @property {ChartSlot[]} arrSlots
 * @property {(objParse: ParseResult, objSpec: ChartSpec, objFrame: Frame) => SceneItem[]} fnBuild
 */
