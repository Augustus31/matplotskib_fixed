// Scene to SVG markup. Pure string building, no DOM, so it runs in Node tests.

import { SCENE_KINDS } from "../contracts.js";

/** @typedef {import("../contracts.js").Scene} Scene */
/** @typedef {import("../contracts.js").SceneItem} SceneItem */
/** @typedef {import("../contracts.js").SceneCircle} SceneCircle */
/** @typedef {import("../contracts.js").ScenePolyline} ScenePolyline */
/** @typedef {import("../contracts.js").SceneText} SceneText */

const STR_SVG_NS = "http://www.w3.org/2000/svg";

/** @type {Object<string, string>} */
const OBJ_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escape a string for use in SVG text content or a double-quoted attribute.
 * @param {string} strRaw
 * @returns {string}
 */
function escapeXml(strRaw) {
  return String(strRaw).replace(/[&<>"']/g, (strChar) => OBJ_ESCAPES[strChar]);
}

/**
 * Format a coordinate with at most two decimals and no trailing zeros.
 * @param {number} numValue
 * @returns {string}
 */
function formatNumber(numValue) {
  return String(Math.round(numValue * 100) / 100);
}

/**
 * @param {SceneCircle} objCircle
 * @returns {string}
 */
function renderCircle(objCircle) {
  return (
    `<circle cx="${formatNumber(objCircle.numX)}" cy="${formatNumber(objCircle.numY)}"` +
    ` r="${formatNumber(objCircle.numR)}" class="${escapeXml(objCircle.strClass)}"/>`
  );
}

/**
 * Polylines have no fill and default to the current text color for their stroke.
 * CSS can override both presentation attributes.
 * @param {ScenePolyline} objPolyline
 * @returns {string}
 */
function renderPolyline(objPolyline) {
  const strPoints = objPolyline.arrPoints
    .map(([numX, numY]) => `${formatNumber(numX)},${formatNumber(numY)}`)
    .join(" ");
  return `<polyline points="${strPoints}" fill="none" stroke="currentColor" class="${escapeXml(objPolyline.strClass)}"/>`;
}

/**
 * @param {SceneText} objText
 * @returns {string}
 */
function renderText(objText) {
  return (
    `<text x="${formatNumber(objText.numX)}" y="${formatNumber(objText.numY)}"` +
    ` text-anchor="${escapeXml(objText.strAnchor)}" class="${escapeXml(objText.strClass)}">` +
    `${escapeXml(objText.strText)}</text>`
  );
}

/**
 * @param {SceneItem} objItem
 * @returns {string}
 */
function renderItem(objItem) {
  switch (objItem.strKind) {
    case SCENE_KINDS.CIRCLE:
      return renderCircle(objItem);
    case SCENE_KINDS.POLYLINE:
      return renderPolyline(objItem);
    case SCENE_KINDS.TEXT:
      return renderText(objItem);
    default:
      throw new Error(
        `unknown scene item kind: ${/** @type {{strKind: string}} */ (objItem).strKind}`,
      );
  }
}

/**
 * Render a Scene as an SVG string, items in order (later items draw on top).
 * Throws on an unknown item kind so layout bugs surface early.
 * @param {Scene} objScene
 * @returns {string}
 */
export function renderSvg(objScene) {
  const strWidth = formatNumber(objScene.numWidth);
  const strHeight = formatNumber(objScene.numHeight);
  const strItems = objScene.arrItems.map(renderItem).join("");
  return (
    `<svg xmlns="${STR_SVG_NS}" width="${strWidth}" height="${strHeight}"` +
    ` viewBox="0 0 ${strWidth} ${strHeight}">${strItems}</svg>`
  );
}
