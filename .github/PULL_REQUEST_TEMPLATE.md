## What

<!-- What does this PR change? Link the OpenSpec change (openspec/changes/<name>/) if it alters behavior. -->

## Why

<!-- Motivation and context. Link related issues. -->

## Checklist

- [ ] OpenSpec change created and `openspec validate <change> --strict` passes (for behavior/feature changes)
- [ ] `npm run test:unit` passes
- [ ] `npm run typecheck` passes (run `npm run build` first — the CLI typechecks against `engine/dist`)
- [ ] Docs updated (README index / `docs/`) if a documented feature changed
- [ ] No generated artifacts committed (`runs/`, `reports/`) unless the task requires it
