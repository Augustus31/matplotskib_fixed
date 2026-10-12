# matplotskib

Small browser library for scatterplots and line graphs, drawn as SVG. CSE 210 warmup, team --dangerously-skip-permissions.

Structure: `src/parser` (raw input to canonical data), `src/layout` (data + chart spec to scene), `src/svg` (scene to SVG). See CONTRIBUTING.md.

## Pipeline

```
CSV text ──parser──► ParseResult ──layout + ChartSpec──► Scene ──svg──► SVG string ──► page
```

| Step   | Function                        | In → out                              |
| ------ | ------------------------------- | ------------------------------------- |
| parser | `parseCsv(strCsv)`              | CSV text → `ParseResult`              |
| layout | `buildScene(objParse, objSpec)` | `ParseResult` + `ChartSpec` → `Scene` |
| svg    | `renderSvg(objScene)`           | `Scene` → SVG markup string           |
| public | `renderChart(strCsv, objSpec)`  | CSV + spec → `{ strSvg, arrErrors }`  |

Types for the parser, layout and svg steps live in `src/contracts.js`. Nothing throws past `renderChart`: problems come back in `arrErrors`.

## Frontend (`demo/`)

- Plain HTML + ES modules, no build step. It imports `../src/index.js`.
- Run `npx serve .` and open `/demo/`. Opening the file directly does not work.
- Data comes only from `fixtures/` (see `fixtures/README.md`). No uploads.
- Controls: fixture, chart type, one column picker per slot (only columns whose type the slot accepts), title.
- If `arrErrors` is not empty, show the errors instead of the chart.
- Style with CSS, using the `class` that layout sets on each scene item (`strClass`).
