# @cpeople/db

The Prisma schema, the migrations, the row-level-security policies and the demo
seed. The two database connections it is used with — the runtime pool and the
owner — are described in the repository's `CLAUDE.md`, and they are never
interchangeable.

## Why `typecheck` and `test` do not run `prisma generate`

`build` does, and it is now the only script that does.

All three used to, and turbo is free to run them at the same time: two
`prisma generate` processes writing into `src/generated/prisma` race, and one
dies with `ENOTEMPTY: directory not empty`. It happens perhaps one run in
several, so it reads as a flaky CI job rather than as the configuration mistake
it is — it failed a pull request that had nothing to do with it.

So `typecheck` and `test` depend on `build` in `turbo.json` and use what it
generated. Run them through the root scripts (`pnpm typecheck`, `pnpm test`),
which go through turbo. `pnpm --filter @cpeople/db test` on a checkout that has
never been built will not find a client to import.
