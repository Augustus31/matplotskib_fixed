# Workbench (frontend)

The browser page for matplotskib. Pick a data file, choose a chart, map columns to the chart's slots, and see the SVG. The pipeline rail across the top shows each contract (`ParseResult`, `ChartSpec`, `Scene`, `<svg>`); click one to inspect it.

## Run it

The page uses ES modules and loads CSV files with `fetch`, so serve the repo root instead of opening the file directly:

```
npx serve .
```

Then open `/web/` on the port it prints. `python3 -m http.server` from the repo root works too.

## What is real and what is mocked

| stage   | status | where                                                      |
| ------- | ------ | ---------------------------------------------------------- |
| parser  | real   | `src/parser/index.js` (`parseCsv`)                         |
| layout  | real   | `src/layout/index.js` (`fnLayout`)                         |
| scatter | real   | `src/charts/scatter.js`                                    |
| line    | mock   | `web/mocks/line.js`, registered in the real registry (#17) |
| svg     | real   | `src/svg/index.js` (`renderSvg`)                           |

`web/pipeline.js` is the only file that touches the library. The page calls each stage itself, rather than `renderChart`, so the inspector can show every stage's output. When #17 lands, import `src/charts/line.js` there and delete `web/mocks/line.js`.

## Data

- `../fixtures/agents-vs-bugs.csv` is the shared fixture.
- Uploads are added to the top of the list for the current session.
- `samples/` holds page-only files: a number-by-number scatter, a category x axis, and a file with two bad rows that shows the parser error state. Move any of them to `fixtures/` if the tests want them.

## Upload your own CSV

Use **Upload a CSV** in the Data panel, or drop a file anywhere on the page. The file is read in the browser and never sent anywhere. It goes through the same `parseCsv`, so bad rows show the same error view as `broken.csv`. The page picks a starting chart from the column types (`guessSpec` in `datasets.js`), and you can change it from there. Files up to 5 MB; uploading a file with the same name replaces it.

## How the page styles a Scene

Layout and chart types set `strClass`; `style.css` gives them color.

- Any `circle` or `polyline` is drawn as a data mark in series color, unless its class is `grid`, `axis` or `tick`.
- `series-0` to `series-3` pick the series color. Without one, a mark uses the first color.
- Text classes: `title`, `axis-label`, `tick-label`. Other text gets the default label style.

## Open questions for the module owners

1. **Series classes (#17).** The legend and line colors only match if the line chart puts `series-0`, `series-1`, … on each series' marks, in order of first appearance.
2. **Tooltips.** Hover needs to know which row a circle came from. The mock line adds `numRowIndex` to `SceneCircle`, and `renderSvg` ignores it. Without it, tooltips still work for scatter (one circle per row, in row order) but not for line points.
3. **List charts.** The registry has no list call, so the chart picker hard-codes `["scatter", "line"]` in `web/pipeline.js`.
4. **Text.** `SceneText` has no rotation or vertical alignment. The y-axis label sits horizontally above the axis, and labels are nudged down 4px to sit centered.
