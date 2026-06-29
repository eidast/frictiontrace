# Contributing to FrictionTrace

## Adding an analyzer rule

1. Create a new file under `engine/src/analyzer/rules/<ruleName>.ts`.
2. Export a function `run<RuleName>Rule(db, runId): IssueRow[]` that queries `signals` and calls `issuesRepo.insert` for each issue found.
3. Add the rule to the closed catalog at `engine/src/analyzer/catalog.ts` with a default severity.
4. Wire the rule into `engine/src/analyzer/analyze.ts` (call it in `analyzeRun`).
5. Add a unit test at `tests/unit/analyzer/<ruleName>.test.ts` covering:
   - the rule fires on a matching signal
   - the rule does not fire when there are no matching signals
   - severity boundaries (if any)

Every issue MUST cite at least one `signal_id` in its `evidence` array. The `issuesRepo.insert` function enforces this invariant and throws if evidence is empty.

## Adding a journey template

1. Create a new YAML file under `engine/journeys/<name>.yaml`.
2. Reference the schema in `engine/JOURNEY.md` and follow the same primitives (`navigate`, `interact`, `extract_and_click`).
3. Validate locally: `ft validate engine/journeys/<name>.yaml`.
4. (Optional) Run it against the test fixture: `ft run http://localhost:<port>/index.html --journey engine/journeys/<name>.yaml`.

## Adding a new signal category

1. Create `engine/src/signals/<category>.ts` exporting a function that attaches listeners or runs once.
2. Wire the listener into `engine/src/signals/setup.ts` (`attachAllSignals`).
3. If the new category has derived facts, add them in `engine/src/analyzer/facts.ts`.
4. If the new category has corresponding issues, add a rule per the "Adding an analyzer rule" steps.

## Adding a new site to the CrUX benchmark

1. Add the site to `docs/sites.md` under the appropriate group.
2. Add a corresponding entry in `engine/crux-pages.yaml` with `url: null` for checkout, PLP, and PDP.
3. Run `npx tsx scripts/crux-discover.ts` to discover the missing URLs.
4. Run `npx tsx scripts/crux-sync.ts` to fetch CrUX history for the new site.
5. Commit `engine/crux-pages.yaml` and `data/crux.db`.

## Running tests

```bash
npm run test:unit          # vitest on engine + tests/unit
npm run test:integration   # playwright on tests/integration
```

## Code style

- TypeScript strict mode
- ESM imports with explicit `.js` extensions
- Functions are small (<50 lines), single-purpose
- Comments only where the code is non-obvious

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
