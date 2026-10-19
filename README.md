# matplotskib

Small browser library for scatterplots and line graphs, drawn as SVG. CSE 210 warmup, team --dangerously-skip-permissions.

## Use it

```js
import { renderChart } from "./src/index.js";

const strSvg = renderChart(strCsv, {
  strChart: "line",
  objFields: { x: "day", y: "bugs", series: "agent" },
  strTitle: "Bugs found per day",
});
```

`renderChart` returns SVG markup. If the chart can't be drawn, for example the CSV has bad rows or a column doesn't fit its slot, it throws an `Error` with a plain message.

Both chart types require numeric X and Y columns and accept an optional category `series` for grouping. Switching between them preserves compatible field choices. Line vertices are sorted by X within each series; scatter points retain CSV row order.

## Pipeline

```
CSV text ──parseCsv──► ParseResult ──fnLayout + ChartSpec──► Scene ──renderSvg──► SVG string
```

| Step   | Function                       | In → out                              |
| ------ | ------------------------------ | ------------------------------------- |
| parser | `parseCsv(strCsv)`             | CSV text → `ParseResult`              |
| layout | `fnLayout(objParse, objSpec)`  | `ParseResult` + `ChartSpec` → `Scene` |
| svg    | `renderSvg(objScene)`          | `Scene` → SVG markup string           |
| public | `renderChart(strCsv, objSpec)` | CSV text + `ChartSpec` → SVG string   |

- The parser never throws. Bad input goes into `arrErrors`, and layout turns those into a thrown error.
- Layout checks the spec, draws the axes, gridlines and title, and asks the chart type for its marks.
- Chart types live in `src/charts/` (`scatter`, `line`) and plug in through `registerChart` in `src/registry.js`.
- Shared types and constants are in `src/contracts.js`.

## Try it in the browser

Run `npx serve .` and open `/web/`. Pick a sample file or upload your own CSV, choose a chart and columns, and inspect each stage's output. See `web/README.md`.

## Contributing

See CONTRIBUTING.md. Run `npm ci`, then `npm run format`, `npm run lint`, `npm run typecheck` and `npm test`.
