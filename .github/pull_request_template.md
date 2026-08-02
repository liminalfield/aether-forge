<!--
The PR title must be a conventional commit. It becomes the squashed commit
message and release-please derives the version and changelog from it.
  feat: …   fix: …   deps: …   docs: …   refactor: …   test: …   ci: …
Breaking: feat!: … or a BREAKING CHANGE: footer.
-->

## What and why

<!-- What changes, and what problem it solves. Link the issue if there is one. -->

## Checklist

- [ ] `pnpm build && pnpm test && pnpm check:all` passes locally
- [ ] Dependency direction is unchanged (or the change is explained below)
- [ ] No rulebook vocabulary added to `packages/core` or `packages/ui`
- [ ] Any new event payload schema is versioned, with an upcaster if it changed
- [ ] No suggestion was turned into enforcement
- [ ] No game content committed beyond CC-BY / MIT / ORC

## Dependencies

<!--
Delete if none. Otherwise: what was added, why, its license, and, if it needed
an entry in allowBuilds, what its install script does.
-->

## Notes for the reviewer

<!-- Anything worth knowing: trade-offs taken, things deliberately left out. -->
