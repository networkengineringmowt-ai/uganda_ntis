# Bug Register — full-platform scan (2026-06-10)

Method: automated scans of the source — every fetched data file vs `public/data`
contents, every sidebar nav id vs App render branches, every view id vs the
Header title registry — plus a security review of the data-write boundary.

| # | Severity | Bug | Status |
|---|---|---|---|
| 1 | **CRITICAL (security)** | Public `anon` key had INSERT/UPDATE on ~40 tables with RLS disabled — anyone could extract the key from the public bundle and corrupt the DB | **FIXED** — `supabase_secure_grants.sql` revokes all anon writes (run once in SQL editor); capture form now writes server-first via the service_role data-entry server; ETL auto-uses the service key |
| 2 | **CRITICAL (data)** | 20 data files referenced by the app (`gisnetwork18062025.geojson`, `bot_results.json`, `network_links.json`, `tcs_stations.json`, ferries/rail/airports layers, …) were missing from the repo's `public/data` — the live site only worked because old deploy overlays still carried them; any fresh clone/build would 404 the road network map, bot, stations and infra layers | **FIXED** — all 20 recovered from the deploy worktree into `public/data` and committed |
| 3 | HIGH (UX) | 18 views showed their raw id as the page title ("rms", "lifecycle", "bms", …) because they were missing from the Header `VIEW_TITLES` registry — visible in user screenshots | **FIXED** — all 18 titled with proper subtitles |
| 4 | MEDIUM | Road Asset Bot fetched `deep_ml_predictions.json` which exists nowhere; the result was also never used (dead destructure) — console noise + wasted request | **FIXED** — dead fetch removed |
| 5 | MEDIUM | Generic server insert endpoint couldn't upsert, so repeated capture submissions for the same link+year would 409 | **FIXED** — `?upsert=col1,col2` support added to `/api/admin/:table` |
| 6 | LOW (degraded) | `useDashboardBundle` falls back to `data/bundle.json`, which doesn't exist anywhere — RoadAtlas dashboard renders in degraded/empty state (failure-tolerant, no crash) | **FIXED** — `scripts/export_bundle.py` generates it from the canonical G: data (region intelligence, bridge corridors, 483-asset digital twin, spatial catalog); re-run after data updates |
| 7 | LOW (security, by design) | Login credentials are hardcoded and visible in the public bundle — the login gate is an access-tier gate, not real security | **RESOLVED BY DESIGN** (2026-06-11 directive) — three-level allowed-users roster (`src/modules/Auth/allowedUsers.ts`, rms/super/admin, one password per level). Do not treat the gate as protection for confidential data |
| 8 | LOW | `bot_results.json` etc. were missing from the repo (subset of #2) | **FIXED** (with #2) |

## Outstanding actions (all user-side, one paste each in the Supabase SQL editor)
1. **Run `supabase_enable_rls.sql`** (G: root) — enables RLS on all 42 tables with a
   read-only anon policy; fully closes the write boundary (supersedes
   `supabase_secure_grants.sql`, which is also safe to run).
2. **Run `supabase_free_space.sql`** (G: root) — TRUNCATEs all tables to free the
   Supabase server now that the G: Drive repository is the canonical store.
   Delete any Dashboard → Storage buckets manually.
3. **Rotate the service_role key** (Dashboard → Settings → API) — it was shared in
   plaintext chat earlier. Only needed again if SUPABASE_MIRROR=on.
