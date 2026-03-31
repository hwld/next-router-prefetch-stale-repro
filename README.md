# next-router-prefetch-stale-repro

Minimal `create-next-app` repro for a Next.js App Router issue in `15.1.12`.

This repro demonstrates a case where navigating back to a dynamic page reuses
the previous render without sending a new RSC request.

## Versions

- `next@15.1.12`
- `react@19.0.0`
- `react-dom@19.0.0`
- TypeScript
- Tailwind CSS

## How to run

```bash
git clone https://github.com/hwld/next-router-prefetch-stale-repro.git
cd next-router-prefetch-stale-repro
pnpm install
pnpm build
pnpm start
```

Open `http://localhost:3000/`.

## What The App Does

- `/items` is `dynamic = "force-dynamic"`.
- `/items` prints a per-render `render id` and `rendered at` timestamp.
- `/items/import` has a normal `Link` back to `/items`, so Next.js auto
  prefetch can run there.

## Repro

1. Open `/`.
2. Click `Open /items with Link prefetch=false`.
3. Confirm `/items` shows a `render id` and `rendered at` value.
4. Click `Go to /items/import`.
5. Click `Back to /items`.

## Expected

- Back to `/items` sends a new `/_rsc` request.
- `/items` shows a different `render id`.
- `/items` shows a different `rendered at`.
- The server prints a new `[items] render ...` line.

## Actual when the bug hits

- No new `/_rsc` request is sent on the first click back.
- `/items` renders immediately with the same `render id` and `rendered at` as
  the first visit.
- There is no new `[items] render ...` log.

## Second cycle

1. From `/items`, click `Go to /items/import` again.
2. Click `Back to /items` again.

On this second cycle, the navigation often does fetch and `/items` updates to a
new `render id`.

## Why The Repro Looks Like This

- The first `/ -> /items` navigation uses `prefetch={false}` to keep the
  starting cache state simple.
- The suspected problem is the back navigation from `/items/import` to
  `/items`, not the initial `prefetch={false}` itself.

## Investigation

See [INVESTIGATION.md](./INVESTIGATION.md) for:

- version checks across `15.x` and `16.x`
- `staleTimes` experiments
- a local `pnpm patch` experiment that removes the `!isFirstRead` guard
- the suspected `15.x` implementation path
