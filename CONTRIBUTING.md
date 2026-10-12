# Contributing

Short version: small PRs, someone else reviews, CI green, merge.

## Code standards

- JavaScript with JSDoc on every exported function.
- Hungarian notation for variable names: a type prefix, e.g. `strName`, `arrRows`, `objSpec`, `numWidth`.
- Run Prettier before pushing (`npm run format`). CI fails on unformatted code.
- Keep to the three modules: `src/parser`, `src/layout`, `src/svg`. The frontend lives in `demo/` and only calls `renderChart` from `src/index.js`. Agree on a contract (what goes in, what comes out) before building against it.

## Workflow

- `main` is protected. No direct pushes; open a PR.
- Branch from `main`, name it `yourname/short-topic`.
- Every PR needs one approval from someone who is not the author, and passing CI.
- Squash merge, then delete the branch.

## PR guidelines

- Each PR has one responsibility. Keep config-only changes separate from implementation; split mixed work into separate PRs.
- Small enough to review in 10 minutes.
- Say what changed and why in a couple of lines. Add a screenshot for visual changes.
- Review within a few hours if you can; unblock people. Leave comments on the code, not the person.
- Record real decisions in the design doc's decision log.

## Checks locally

```
npm ci
npm run format
npm run lint
npm run typecheck
npm test
```
