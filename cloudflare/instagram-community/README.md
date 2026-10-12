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
The existing Worker DB binding initializes its own additive/idempotent schema on the
first API request; a separate D1 administration permission is not required for deployment.

The workflow tests first, publishes the existing Worker, checks `/health` for
`20261012-d1-savings-v1`, then initializes the schema and warms `/api/ranking?period=week`.
`migrations/2026-10-12-shared-cache.sql` contains the same schema for manual SQL deployments.

No new paid service or database is created. Existing Instagram tokens and webhook
configuration remain in Cloudflare. Failed deployment/API checks stop the workflow.

For a manual deployment from an authenticated environment:

```sh
npm install
npx wrangler d1 execute cff-instagram-community --remote --file=migrations/2026-10-12-shared-cache.sql
npm run deploy
```

## Story review (2026-10-12)

New Meta story mentions enter `story_reviews` as pending and create no awards, active days, daily consumption or mission progress. The admin queue is `/admin-stories.html`, linked from the main admin and rewards panels. Every read and decision requires the existing Firebase admin authentication. Story CDN previews can expire; unavailable previews must be checked in the Instagram inbox.

Approval requires the original Central post and reviewer confirmation that it appears in the story. The API first retrieves original post timestamps from the recipient account's recent media. When it cannot find metadata, an explicit manual confirmation of the permalink and exact publication date/time in BRT is required. Known Meta timestamps override manually supplied dates. A SQL guard checks that the post and the story belong to the same Monday–Sunday week in BRT and that the post is not later than the story. A unique approved-post index blocks repeat credit per person across permalink variants. The daily cap remains three awarded stories, including earlier automatic awards.

The approval and all ledger/user/monthly/day counters commit in one SQLite statement using triggers. Failures roll back the decision and all credits. Approval retries are idempotent. Weekly bonuses are evaluated only after credit. Points go to the original story date, so later review can correctly update historical snapshots. Existing automatic points are preserved and are not retroactively reviewed without evidence.

The runtime applies `STORY_REVIEW_SCHEMA` through the existing D1 binding. The SQL migration is also provided in `migrations/2026-10-12-story-reviews.sql`. No additional database secret or storage binding is required. A once-only policy marker invalidates cached ranking rule payloads on deployment. `/health` exposes `storyReviewVersion`; the deployment workflow checks this, the ranking's approval flag and unauthorized access to the admin endpoint.
