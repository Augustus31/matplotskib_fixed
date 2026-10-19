# Fixtures

Mock CSV inputs for the parser. Data is static and immutable: no uploads, no editing in the browser.

## CSV rules

- First row is the header. Column names are plain words, no spaces.
- A column is `number` only if every value in it parses as a number. Anything else is `category`.
- Numbers are bare: no units, no thousands separators, no `$`.
- No empty cells. Drop the row instead.
- One chart per file. Files need not be related to each other.
- Both charts require numeric X/Y columns; category columns are only for optional series grouping.
- The line builder sorts vertices by X within each series. Scatter points and parsed rows retain input order.
- Column names mean nothing to the library. The chart spec maps slots to columns, for example `{x: "day", y: "bugs", series: "agent"}`. The same CSV can feed a line chart or a scatter plot.

## Current fixtures

| file                 | columns            | what it is                                 |
| -------------------- | ------------------ | ------------------------------------------ |
| `agents-vs-bugs.csv` | `agent, day, bugs` | bugs found per day by each of three agents |
