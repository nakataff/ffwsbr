# Instagram Community Worker

The existing `cff-instagram-community` Worker handles community rankings, Instagram
interactions, check-ins and predictions. Its D1 binding and stored Cloudflare variables
are preserved by `wrangler.jsonc` (`keep_vars: true`).

## Read savings

- Public rankings share a five-minute JSON cache in the existing D1 database, including
  across Worker instances and `workers.dev` requests. Query-string timestamps do not
  create different cache entries. In-process caching rechecks durable entries at least
  once a minute. New interactions can take up to five minutes to appear in the public
  ranking; points are still written immediately.
- Closed-week rankings are computed once and saved with their participant count and
  winner. History responses reuse these snapshots for 15 minutes. Closed-week lists
  are stored for a day and reset by backdated writes.
- Month discovery and coverage use `ranking_month_catalog`: one saved row per
  recorded month, maintained by SQLite triggers on award inserts, date moves and
  deletes. The first deployment backfills existing months once in the same atomic
  batch as its migration marker. Later visits never scan awards to discover months
  or their first/last dates. Boundary repairs use the `(month_key, day_key)` index.
- Closed monthly rankings reuse their durable snapshots. Monthly history and
  monthly-win badges share one compact saved summary for up to a day, across
  profiles and Worker instances. A month rollover selects a new summary key;
  backdated award/activity changes invalidate the affected snapshots and history.
- SQLite triggers invalidate the affected weekly/monthly snapshots when old awards or
  active days are inserted, updated or deleted. Source revisions stop a concurrent
  rebuild from saving an outdated snapshot. Cached responses in an existing instance
  can remain visible for up to a minute after durable invalidation.
- Monthly calculations retain the authoritative `awards` SQL and gain shared caching.
  Existing `monthly_users` counters are not substituted without validating their
  consistency against production data.
- Closed public vote lists share a five-minute cache. Session-specific votes, balances
  and linked-account data are never put into the public cache.
- Prediction settlements use a persistent completion record and a renewable-by-retry
  two-minute lease. The same result does not replay all voters on another instance.
  Changed result inputs or late votes permit another pass. The existing unique award
  keys still prevent duplicate points. Failed/incomplete work is retryable. Voter
  scans use keyset pagination so settlements do not silently skip voters past 1500/2000.

The first history request builds missing snapshots; later requests avoid rescanning
each week's awards. Monetary savings depend on the plan and actual traffic. Compare
D1 `rows_read` and `rows_written` before and after deployment over equal periods.

## Validation

```sh
npm test
```

Tests run the production SQL against SQLite through a small D1 API adapter. They cover
scores/tiebreaks, shared cache hits, concurrent reads, retries, late corrections, snapshot
publish races, monthly snapshots, persistent settlement locking, payouts and pagination.

## Deployment

The `Deploy Instagram Community (Cloudflare)` GitHub Actions workflow runs on changes
to this directory. It uses the existing repository secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`. The token needs access to this account's Workers scripts.
The existing Worker DB binding initializes its own additive/idempotent schema once per
release, atomically with a durable schema marker. Cold instances check that single
marker instead of replaying bootstrap/cache cleanup queries. A separate D1
administration permission is not required for deployment.

The workflow tests first, publishes the existing Worker, checks `/health` for
`20261016-saved-months-v1`, then initializes the schema and warms `/api/ranking?period=week`.
`migrations/2026-10-12-shared-cache.sql` and
`migrations/2026-10-16-month-catalog.sql` provide the cache and month catalog for
manual SQL deployments. `schema.sql` includes both for a fresh database.

No new paid service or database is created. Existing Instagram tokens and webhook
configuration remain in Cloudflare. Failed deployment/API checks stop the workflow.

For a manual deployment from an authenticated environment:

```sh
npm install
npx wrangler d1 execute cff-instagram-community --remote --file=migrations/2026-10-12-shared-cache.sql
npx wrangler d1 execute cff-instagram-community --remote --file=migrations/2026-10-16-month-catalog.sql
npm run deploy
```

## Story review

A signed Meta webhook credits each eligible story mention with 5 points on its
original Brasília date. The webhook confirms the mention. The original post
can be checked in the administrative panel. The same story only scores once,
with daily ceilings of 3 stories and 25 base story and comment points combined.

Administrators can reject credited stories at `/admin-stories.html` to reverse
the award and its dependent bonuses. Pending stories with a confirmed original
post can still be approved for 5, 2 or 1 point based on its age in the same
Brasília week. Credits and reversals update the ledger and counters atomically.
Deployment and the existing daily job recover eligible pending mentions from
the current week, in batches up to 100. The webhook can retry a saved pending
mention after a storage failure. Story previews use the existing Images binding.

### Community profiles (2026-10-12)

`GET /api/community/profile?username=...` supplies activity (365 calendar days,
all-time streaks), lifetime points, prediction choice accuracy, and personal
records in closed weeks from the last 104 weeks. Weekly records use the complete
ledger, including positions beyond the public Top 500. Rankings of followed
profiles use `GET /api/community/peers?period=week|month|all&usernames=...` (1–100
names). Both are public, cached for five minutes and contain no account UID,
Google e-mail, session, direct message or submitted open prediction choice.

Closed prediction outcomes are archived in `community_prediction_outcomes` by
the existing settlement flow and bootstrap for currently available rounds. This
archive does not award points. Unknown historical outcomes and open predictions
are excluded from accuracy; unknown outcomes interrupt a prediction streak.
The existing score and proximity prizes remain unchanged.

The browser stores up to 99 followed targets in private
`userAccounts/{uid}/following/f0..f98`. Only the account owner can read/write this
list. It is removed by the existing account deletion and included in its export.
Level visuals are cosmetic (`communityStyle`) and rendered only when the
server's lifetime score meets the threshold. Levels: Novato 0, Participante 100,
Veterano 500, Elite 1500, Lenda 5000. The 1080×1920 story card is generated
locally and downloaded/shared only at the user's request.


### Batch review (2026-10-19)

The story queue now offers compact thumbnails, image zoom, local handle/week filters over the loaded page, selection of up to 20 stories from the same account/week, and a shared confirmation dialog. The reviewer chooses the original post once for stories showing the same publication. Approval is never inferred from an image. Unavailable previews still require checking the Instagram conversation. Batch rejection has a shared reason and explicit confirmation.

`POST /api/admin/stories/review-batch` verifies the admin once and accepts 1–20 distinct keys. It returns an individual result per story, including conflicts and already-completed decisions. Each approval still goes through the existing atomic SQL triggers for original publication dates, weekly eligibility, daily caps and duplicate credit. Credit failures roll back that story while other valid decisions proceed. A retry cannot award the same story again.

Successful decisions update the current UI queue without fetching it again or discarding unresolved selections. There is no polling. Queue pages stay limited to 50; search/week filters do not trigger extra reads. The original-post selector shares the account/week catalog within the page. The Worker reuses at most 100 recent Meta posts per account for 2 minutes, with at most 8 accounts per database binding and concurrent request coalescing; failed lookups retry after 10 seconds. Timestamp eligibility is still checked separately for every story. Batch processing evaluates bonuses once per affected person/week and invalidates public ranking caches once per group, not once per card. Existing scores and review history are unchanged.
