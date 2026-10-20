# Workbench (frontend)

The browser page for matplotskib. Pick a data file, choose a chart, map columns to the chart's slots, and see the SVG. The pipeline rail across the top shows each contract (`ParseResult`, `ChartSpec`, `Scene`, `<svg>`); click one to inspect it. The rail and inspector are hidden by default; **Show pipeline** in the header brings them back, and the page remembers the choice in this browser.

## Run it

The page uses ES modules and loads CSV files with `fetch`, so serve the repo root instead of opening the file directly:

```
npx serve .
```

Then open `/web/` on the port it prints. `python3 -m http.server` from the repo root works too.

## Where each stage comes from

| stage   | where                              |
| ------- | ---------------------------------- |
| parser  | `src/parser/index.js` (`parseCsv`) |
| layout  | `src/layout/index.js` (`fnLayout`) |
| scatter | `src/charts/scatter.js`            |
| line    | `src/charts/line.js`               |
| svg     | `src/svg/index.js` (`renderSvg`)   |

`web/pipeline.js` is the only file that touches the library. The page calls each stage itself, rather than `renderChart`, so the inspector can show every stage's output.

## Data

- `../fixtures/agents-vs-bugs.csv` is the shared fixture.
- Uploads are added to the top of the list for the current session.
- `samples/` holds page-only files: a numeric scatter, `ci-minutes.csv` with an incompatible weekday axis, and a file with two bad rows that shows the parser error state. Both charts require numeric X/Y; string labels can only group series. The weekday sample deliberately shows the numeric-axis validation message in both modes.

## Upload your own CSV

Use **Upload a CSV** in the Data panel, or drop a file anywhere on the page. The file is read in the browser and never sent anywhere. It goes through the same `parseCsv`, so bad rows show the same error view as `broken.csv`. The page picks a starting chart from the column types (`guessSpec` in `datasets.js`), and you can change it from there. Files up to 5 MB; uploading a file with the same name replaces it.

Automatic setup needs two distinct numeric columns. With fewer, an axis stays unselected and the page explains the requirement. A category column with at least two distinct values is automatically grouped. Charts support at most eight selected series; choosing a series column with more values shows an error without removing rows from the parsed data. You may explicitly choose the same numeric column for both axes. Valid X/Y/series choices, including series None, survive chart switches.

## How the page styles a Scene

Layout and chart types set `strClass`; `style.css` gives them color.

- Any `circle` or `polyline` is drawn as a data mark in series color, unless its class is `grid`, `axis` or `tick`.
- Series 0–3 use the theme colors; additional series get deterministic generated colors. Without a series class, a mark uses the first color.
- Text classes: `title`, `axis-label`, `tick-label`. Other text gets the default label style.

## Open questions for the module owners

1. **Tooltip row mapping.** Both charts emit one circle per original row. Line circles carry `line-point` and are invisible tooltip targets; only the connecting polyline vertices are sorted. Preserve circle row order and series classes when changing either builder.
2. **List charts.** The registry has no list call, so the chart picker hard-codes `["scatter", "line"]` in `web/pipeline.js`.
3. **Text.** `SceneText` supports rotation but has no vertical alignment. The y-axis label is rotated vertically beside the axis; labels are nudged down 4px to sit centered.
