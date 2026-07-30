# Delta: Current → Target

**Current state:** greenfield — zero tracking, zero crash reporting (audit 2026-07-19).
**Target:** tracking-plan.yaml v1 — 23 events, 9 user traits, PostHog EU + Sentry.

Everything is ADD. There is nothing to remove, rename, keep, or change.
ADD (23) + RENAME (0) + KEEP (0) = 23 = total target event count. ✓

## Add — infrastructure (prerequisite for all events)

| Item | Notes |
|------|-------|
| PostHog SDK (`posthog-react-native` + peers) | Host `https://eu.i.posthog.com` (GDPR — EU cloud, mandatory). Autocapture/session replay OFF. Anonymous device UUID identity, no identify() until auth exists. Opt-out in `__DEV__` unless `EXPO_PUBLIC_ANALYTICS_DEBUG=true`. |
| Sentry (`@sentry/react-native`) | EU-region org/DSN. Crashes + unhandled JS errors. `sendDefaultPii: false`. Native crash capture requires a dev build (Expo Go = JS errors only). |
| `tracking/` module | Typed wrapper: one function per event, `$set_once` milestone traits, no raw `posthog.capture` calls in screens. |

## Add — events (by priority)

### P0 — required funnels
| Event | Category | Funnel(s) |
|-------|----------|-----------|
| `app.opened` | lifecycle | onboarding, week-2 return |
| `inventory.capture_started` | core_value | onboarding |
| `inventory.capture_completed` | core_value | onboarding |
| `recipe.imported` | core_value | first recipe added |
| `recipe.saved` | core_value | first recipe added |
| `recipes.generation_completed` | core_value | first weekly plan |
| `recipe.viewed` | core_value | first weekly plan |
| `plan.recipe_added` | core_value | first weekly plan |
| `cart.ingredients_added` | core_value | market list usage |
| `market.viewed` | navigation | market list usage |
| `market.item_checked` | core_value | market list usage |
| `market.store_link_opened` | core_value | market list usage |

### P1 — core-value health
| Event | Category | Why |
|-------|----------|-----|
| `inventory.capture_failed` | core_value | Capture success rate — the funnel's leak point |
| `recipes.generation_started` | core_value | Generation success rate + duration |
| `recipes.generation_failed` | core_value | Same |
| `market.match_run_completed` | core_value | Price-match reliability |
| `chef_chat.message_sent` | core_value | Chat adoption |

### P2 — quality & configuration signals
| Event | Category | Why |
|-------|----------|-----|
| `inventory.uncertain_item_resolved` | core_value | Vision-threshold quality |
| `market.match_corrected` | core_value | Matching quality |
| `preferences.updated` | configuration | Generation input |
| `pantry.item_toggled` | configuration | Generation input |
| `language.changed` | configuration | i18n adoption |
| `cookbook.created` | configuration | Organization behavior |

## Add — user traits
`language`, `first_seen_at` + five `$set_once` activation milestones (`first_capture_completed_at`, `first_recipe_generated_at`, `first_recipe_added_at`, `first_plan_entry_at`, `first_market_use_at`), `inventory_item_count` (on-change snapshot).

## Notes
- **Onboarding funnel caveat:** no onboarding UI exists; the funnel is the de-facto first-run activation path (documented in tracking-plan.yaml `funnels:`). If real onboarding ships, run instrument-new-feature.
- **Week-2 return** needs no event — PostHog retention insight over `app.opened`.
- **Billing:** none exists (pre-revenue) — no billing events by design.
- **Groups:** B2C single-player — no group hierarchy, user-level only.
