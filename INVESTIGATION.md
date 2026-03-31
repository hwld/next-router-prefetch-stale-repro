# Investigation

This document explains the repro from the implementation point of view.

The goal is to answer a narrow question:

- Why does the first back navigation sometimes show the old `/items` page with
  no new `/_rsc` request in `next@15.x`?

## Short Summary

In `next@15.x`, the first time a stale auto-prefetch entry is consumed, the
router does not enter the branch that clears page data and triggers a lazy
fetch. Instead, it tries to build the next navigation state from the prefetched
response. For this repro, that response does not contain full page data, so the
new navigation cache is not adopted and the previous `/items` page remains
visible.

## What The Repro Shows

Route shape:

- `/` links to `/items` with `prefetch={false}`
- `/items` is `dynamic = "force-dynamic"`
- `/items` prints `render id` and `rendered at`
- `/items/import` links back to `/items` with the default `Link` prefetch

When the issue reproduces:

- `/items/import` triggers a prefetch for `/items`
- the first click on `Back to /items` does not send a new `/_rsc` request
- `/items` shows the same `render id` and `rendered at` as the first visit
- the server does not print a new `[items] render ...` line

On the next cycle, the back navigation often does fetch and the render markers
change.

## Important Terms

This write-up uses three terms:

- `prefetch entry`
  An entry in `state.prefetchCache`. This is what `Link` prefetch stores before
  a navigation actually happens.
- `page node`
  The already-rendered `/items` node that exists inside `state.cache` after the
  page has been visited once.
- `navigation cache`
  The new `CacheNode` tree that `navigateReducer` creates while handling the
  next navigation.

The bug is not that the prefetched response already contains the old page.
The bug is that the router fails to build and adopt the next navigation cache,
then falls back to the previous page node that is still present in `state.cache`.

## Runtime Checks

### Version matrix

- `15.1.12`: reproduced
- `15.5.14`: reproduced
- `16.0.0`: did not reproduce
- `16.2.1`: did not reproduce

In the tested versions, the behavior remains in stable `15.x` and does not
reproduce starting with stable `16.0.0`.

### `staleTimes` checks

These config changes were tested:

- `prefetch={false}` on the back link: avoids the problem
- `experimental.staleTimes = { dynamic: 0 }`: does not avoid the problem
- `experimental.staleTimes = { dynamic: 0, static: 0 }`: avoids the problem

This matters because the back-link prefetch is a default `Link` prefetch, which
uses `PrefetchKind.AUTO`.

Relevant implementation points:

- `packages/next/src/server/config-shared.ts`
- `packages/next/src/client/components/router-reducer/fetch-server-response.ts`
- `packages/next/src/client/components/router-reducer/prefetch-cache-utils.ts`

In `15.x`, an `AUTO` prefetch entry is checked like this:

1. first against the `dynamic` stale-time window
2. then, if it is still an `AUTO` entry, against the `static` stale-time window
   as a `stale` entry

So with the defaults:

- `dynamic = 0s`
- `static = 300s`

an `AUTO` entry becomes stale almost immediately, then stays stale for about
five minutes before expiring.

That also explains why

- `experimental.staleTimes = { dynamic: 0, static: 0 }`

avoids the issue in this repro:

- the `AUTO` prefetch entry no longer remains available as a stale entry
- the first stale-entry consumption path is never reached
- the router falls back to fetching instead of reusing the problematic stale
  prefetch state

### `isFirstRead` patch check

On the `experiment/remove-isFirstRead-guard` branch, `next@15.1.12` was
patched with `pnpm patch` so that this condition in `navigate-reducer`:

- `prefetchValues.status === stale && !isFirstRead`

became:

- `prefetchValues.status === stale`

In this repo, that change stopped the repro:

- the first click back to `/items` sent a new `/_rsc` request
- `/items` showed a new `render id`
- the old page was not reused on the first stale read

This suggests that the repro is related to the `!isFirstRead` branch in
`next@15.x`.

## The Actual `15.x` Flow

The most relevant files are:

- `packages/next/src/client/components/router-reducer/reducers/navigate-reducer.ts`
- `packages/next/src/client/components/router-reducer/apply-flight-data.ts`
- `packages/next/src/client/components/router-reducer/handle-mutable.ts`
- `packages/next/src/client/components/layout-router.tsx`
- `packages/next/src/client/components/router-reducer/prefetch-cache-utils.ts`

### Step 1: a prefetch entry exists

While the user is on `/items/import`, the visible `Link` back to `/items`
creates a prefetch entry in `state.prefetchCache`.

This entry is an `AUTO` prefetch entry.

### Step 2: the router creates a new navigation cache

When the user clicks `Back to /items`, `navigateReducer` reads the prefetch
entry and prepares to construct the next navigation result.

In the non-PPR path it explicitly creates a fresh cache tree:

- `const cache: CacheNode = createEmptyCacheNode()`

This `cache` variable is the navigation cache for the new transition.
It is separate from the existing `state.cache`.

### Step 3: the first stale read does not enter the lazy-fetch branch

`navigateReducer` marks the first consumption of a prefetch entry with
`isFirstRead`.

For stale prefetch entries, the branch that clears page data and lets render
trigger a fetch is only used when `!isFirstRead`.

That branch is:

- `triggerLazyFetchForLeafSegments(...)`

This function does not fetch by itself. It copies the current cache structure,
keeps `loading`, removes leaf page data, and leaves the next render to trigger
`fetchServerResponse(...)` inside `layout-router`.

So the important part is:

- if the router goes through `triggerLazyFetchForLeafSegments(...)`, the old
  page data is removed before render
- if it does not, the router tries a different path

### Step 4: the first stale read falls through to `applyFlightData(...)`

Because this repro hits the first stale read, the router falls through to:

- `applyFlightData(currentCache, cache, normalizedFlightData, prefetchValues)`

This is where the router tries to populate the new navigation cache from the
prefetched response.

### Step 5: the prefetched response is not enough to build the next page

For this repro, the prefetched response does not contain full page seed data.

In `apply-flight-data.ts`, this shows up as:

- `seedData === null`

and the function immediately returns `false`.

That is the key failure point.

This is not a thrown error. It means:

- the router did receive a prefetched response
- but it cannot use that response to fill the new navigation cache with actual
  page data

### Step 6: the new navigation cache is not adopted

Back in `navigateReducer`, the new cache is only adopted if `applied` is true:

- `mutable.cache = cache`

If `applyFlightData(...)` returned `false`, that assignment never happens.

So the new navigation cache exists only as a local variable and is discarded.

### Step 7: the old page node remains

At the end of the reducer, `handleMutable(...)` does:

- use `mutable.cache` if it exists
- otherwise keep `state.cache`

Because `mutable.cache` was never set, the router keeps the existing
`state.cache`.

That existing cache still contains the already-rendered `/items` page node from
the first visit.

### Step 8: render sees existing page data and does not fetch

Later, `layout-router.tsx` only fetches if the segment has no resolved RSC
data.

In this repro, the previous `/items` page node is still present, so render sees
existing data and does not trigger a fresh request.

That is why:

- there is no new `/_rsc` request
- the old `/items` render is shown again

## What `triggerLazyFetchForLeafSegments(...)` Is Supposed To Do

This was a major source of confusion during the investigation, so it is worth
stating directly.

`triggerLazyFetchForLeafSegments(...)` does not:

- fetch data immediately
- render `loading.tsx` by itself

It only rewrites the next navigation cache so that:

- old page data is removed
- any reusable `loading` state is preserved
- the next render is forced to fetch missing page data

So if the first stale read had gone through this branch, the old page data would
have been cleared before the next render. The bug is that this branch is skipped
on the first stale read.

## Why `16.x` Looks Different

In `16.x`, navigation no longer primarily flows through the old `15.x`
prefetch-cache path.

Relevant files:

- `packages/next/src/client/components/router-reducer/reducers/navigate-reducer.ts`
- `packages/next/src/client/components/segment-cache/navigation.ts`
- `packages/next/src/client/components/router-reducer/ppr-navigations.ts`

The exact fix point was not isolated, but the tested `16.x` versions no longer
reproduce the old `isFirstRead` behavior seen in this repro.

## Final Takeaway

The clearest implementation-level description is:

- on the first stale consumption of an auto-prefetched dynamic route,
  `next@15.x` does not go through the branch that clears page data and forces a
  lazy fetch
- it instead tries to build the next navigation cache from the prefetched
  response
- that response does not contain enough page data for this repro
- the new navigation cache is therefore not adopted
- the previous `/items` page node remains in `state.cache`
- render sees that old page node and no new `/_rsc` request is sent
