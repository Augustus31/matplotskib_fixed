// Shared contracts between parser, layout and svg. Types and constants only.
// Change these through a PR that every module owner reviews.

/** Column types the parser can report. */
export const COLUMN_TYPES = Object.freeze({
  CATEGORY: "category",
  NUMBER: "number",
});

/** Kinds of drawable item in a Scene. */
export const SCENE_KINDS = Object.freeze({
  CIRCLE: "circle",
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
 * Pixel position from data value. Layout computes these once and hands them to the chart,
 * so axes and marks agree. Both return absolute SVG coordinates with margins already
 * applied, so charts put the result straight into numX / numY.
 * @typedef {object} Scales
 * @property {(value: string | number) => number} fnX takes the number for a number column, or the category string for a category column; a category maps to the center of its band
 * @property {(value: number) => number} fnY flipped: a bigger value gives a smaller y, since SVG y grows downward
 */

/**
 * What the caller asks for. strChart is a registry key, not a fixed list.
 * @typedef {object} ChartSpec
 * @property {string} strChart registry key such as "scatter" or "line"
 * @property {Object<string, string>} objFields chart slot name to column name, for example {x: "height", y: "weight"}
 * @property {string} [strTitle]
 * @property {number} [numWidth]
 * @property {number} [numHeight]
 * @property {Object} [objOptions] chart-specific options
 */

/**
 * @typedef {object} SceneCircle
 * @property {"circle"} strKind
 * @property {number} numX center x
 * @property {number} numY center y
 * @property {number} numR radius in px
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
 * @typedef {SceneCircle | ScenePolyline | SceneText} SceneItem
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
 * @property {boolean} [bOptional] the spec may leave this slot out; for example line's "series" slot (fixtures/README.md)
 */

/**
 * A pluggable chart type. Adding a chart means adding one of these and registering it.
 * fnBuild returns only the chart's own marks. Axes, ticks and titles stay in layout.
 * Warmup charts: "scatter" takes number x and number y; "line" takes category or number x and number y.
 * @example
 * registerChart({
 *   strName: "scatter",
 *   arrSlots: [
 *     { strSlot: "x", arrTypes: [COLUMN_TYPES.NUMBER] },
 *     { strSlot: "y", arrTypes: [COLUMN_TYPES.NUMBER] },
 *   ],
 *   fnBuild: (objParse, objSpec, objFrame, objScales) => [],
 * });
 * @typedef {object} ChartType
 * @property {string} strName registry key
 * @property {ChartSlot[]} arrSlots
 * @property {(objParse: ParseResult, objSpec: ChartSpec, objFrame: Frame, objScales: Scales) => SceneItem[]} fnBuild
 */
