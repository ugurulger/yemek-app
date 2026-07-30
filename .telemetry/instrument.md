# Instrumentation Guide — Yemek App

**Target:** PostHog EU Cloud (`posthog-react-native`) + Sentry (`@sentry/react-native`)
**Stack:** React Native 0.81 + Expo SDK 54 (managed), expo-router, TypeScript, zustand
**Plan:** `.telemetry/tracking-plan.yaml` v1 · **Delta:** `.telemetry/delta.md` (greenfield — everything is ADD)
**Current implementation:** none (`.telemetry/current-state.yaml` is greenfield; no current-implementation.md exists)

> **Coverage note:** the skill's PostHog reference documents `posthog-js` / `posthog-node`.
> This app is React Native (Expo), so this guide uses the official
> `posthog-react-native` API, which differs: instance-based (`new PostHog(...)`),
> `capture(event, properties)`, no browser autocapture, persistence via
> AsyncStorage. Sentry likewise uses `@sentry/react-native` with the Expo
> config plugin. Verify package versions with `npx expo install` (AGENTS.md:
> consult the versioned Expo docs before writing code).

---

## 1. Architecture

```
screens / stores ──▶ tracking/events.ts   (typed wrapper, one function per event)
                          │
                          ├──▶ tracking/analytics.ts  (PostHog singleton, EU host, guards)
                          │         └── posthog-react-native → https://eu.i.posthog.com
                          └──▶ tracking/crash.ts      (Sentry init + helpers)
                                    └── @sentry/react-native → EU-region DSN
```

Rules:
- **No raw `posthog.capture()` calls in screens.** Screens import typed functions
  from `tracking/events.ts` only. Event names live in one file.
- **`lib/` and `services/` never import the tracking module directly** (same rule
  as i18n — Node eval/test scripts must keep running). Screens/stores translate
  outcomes into events at the UI boundary. Where a deep hook is unavoidable
  (e.g., generation duration), pass an optional callback in, or emit from the
  orchestrating screen.
- **Fire-and-forget.** Every tracking call is non-blocking and wrapped so a
  failure can never break an app flow.
- **Sentry owns errors.** No error events to PostHog; no product events to Sentry
  (breadcrumbs only, as debugging context).

## 2. Install

```bash
npx expo install posthog-react-native expo-application expo-device
npx expo install @sentry/react-native
```

Notes:
- `posthog-react-native` uses `@react-native-async-storage/async-storage`
  (already installed) for the anonymous ID + queue persistence.
  `expo-file-system`, `expo-application`, `expo-device`, `expo-localization`
  enrich device context; localization + file-system are already present.
- Sentry Expo integration needs the config plugin in `app.json`:

```json
"plugins": [["@sentry/react-native/expo", { "organization": "<org>", "project": "yemek-app" }]]
```

- **Expo Go limits:** Sentry native crash capture requires a dev build
  (`npx expo run:ios` / EAS). In Expo Go only JS errors are captured. PostHog
  works fully in Expo Go.

## 3. Environment variables (`.env`, `.env.example`)

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...           # PostHog EU project API key
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com   # GDPR: EU cloud, do not change
EXPO_PUBLIC_SENTRY_DSN=https://...@o....ingest.de.sentry.io/...  # EU-region DSN
EXPO_PUBLIC_ANALYTICS_DEBUG=                  # "true" → send events from __DEV__ builds
```

Keys are public client keys (write-only ingest) — safe in `EXPO_PUBLIC_*`.

## 4. PostHog init — `tracking/analytics.ts`

```typescript
import PostHog from 'posthog-react-native';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const DEBUG_ENABLED = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true';

// Internal-user policy (tracking-plan meta): dev builds don't send events
// unless EXPO_PUBLIC_ANALYTICS_DEBUG=true.
const trackingDisabled = (__DEV__ && !DEBUG_ENABLED) || !API_KEY;

export const posthog = new PostHog(API_KEY || 'disabled', {
  host: HOST,                      // EU cloud — GDPR requirement
  flushAt: 20,
  flushInterval: 10000,
  captureAppLifecycleEvents: false, // we emit app.opened ourselves (needs is_first_open)
  defaultOptIn: !trackingDisabled,
  disabled: trackingDisabled,
});

// Identity: PostHog RN generates and persists an anonymous UUID distinct_id
// in AsyncStorage automatically. NO identify() call is made anywhere —
// there is no auth. If Supabase auth ships later:
//   posthog.identify(supabaseUserId)  // links the anonymous history
```

**Why no `identify()`:** pseudonymous device UUID is the whole identity model
(pii_policy: none). Calling `identify()` with anything derived from the device
would add risk without analytical gain.

## 5. Typed events — `tracking/events.ts` (pattern, not catalog)

One exported function per plan event; property types mirror the plan enums.
Two representative examples — implementation applies this to all 23 events:

```typescript
import { posthog } from './analytics';

type CaptureMethod = 'photo' | 'receipt' | 'video' | 'assistant';
type VisionProvider = 'gemini' | 'claude';

function capture(event: string, properties?: Record<string, unknown>) {
  try {
    posthog.capture(event, properties);
  } catch {
    // analytics must never break the app; PostHog RN queues internally
  }
}

export function trackInventoryCaptureCompleted(p: {
  method: CaptureMethod;
  provider: VisionProvider;
  item_count: number;
  uncertain_item_count: number;
  write_mode: 'replace' | 'add';
  duration_ms: number;
  is_first: boolean;
}) {
  capture('inventory.capture_completed', {
    ...p,
    // Activation milestone (person property, set-once semantics)
    $set_once: { first_capture_completed_at: new Date().toISOString() },
  });
}

export function trackLanguageChanged(language: 'tr' | 'en') {
  capture('language.changed', {
    language,
    $set: { language },   // keep person trait in sync
  });
}
```

Conventions:
- `$set_once` rides on the event that marks a milestone (`first_*_at` traits) —
  no separate person-property call needed.
- `$set` rides on events that change a trait (`language`, `inventory_item_count`).
- `is_first` is computed by the caller from persisted store state (e.g.,
  a `hasCompletedFirstCapture` flag in a small `trackingStore`, or derived from
  existing store contents), not by the tracking module.

## 6. group() — not used

B2C, single-player: the plan defines no groups. Do not call `posthog.group()`.
(If accounts/households ever ship, PostHog RN supports
`posthog.group('household', id, traits)` — revisit via instrument-new-feature.)

## 7. Sentry init — `tracking/crash.ts`

```typescript
import * as Sentry from '@sentry/react-native';

export function initCrashReporting() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return; // crash reporting simply off if unset

  Sentry.init({
    dsn,                       // EU-region DSN (…ingest.de.sentry.io)
    enabled: !__DEV__,
    sendDefaultPii: false,     // GDPR: no IP inference
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Console breadcrumbs can contain inventory names / LLM output —
      // strip messages, keep category+level for the trail.
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) =>
          b.category === 'console' ? { ...b, message: '[redacted]', data: undefined } : b
        );
      }
      return event;
    },
  });
}

// Identity bridge: same pseudonymous ID in both tools so a crash can be
// cross-referenced with the PostHog journey. Call once at startup after
// PostHog is ready:
export async function bindCrashIdentity(distinctId: string) {
  Sentry.setUser({ id: distinctId }); // id only — no email/name exist
}
```

Wiring in `app/_layout.tsx`: call `initCrashReporting()` at module top (before
component render), wrap the root component with `Sentry.wrap(RootLayout)`, and
after PostHog init call `bindCrashIdentity(await posthog.getDistinctId())`.

## 8. Call-site map (where events fire)

| Surface | File(s) | Events |
|---|---|---|
| Root layout | `app/_layout.tsx` | `app.opened` (cold start; `is_first_open` via `$set_once`-style persisted flag) |
| Mutfağım | `app/(tabs)/index.tsx` | `inventory.capture_started/_completed/_failed`, `inventory.uncertain_item_resolved` |
| Assistant | `app/capture/assistant.tsx` | capture events with `method: 'assistant'` |
| Tarifler | `app/(tabs)/recipes.tsx` | `recipes.generation_started/_completed/_failed`, `preferences.updated`, `pantry.item_toggled` |
| Recipe detail | `app/recipe/[id].tsx` | `recipe.viewed`, `recipe.saved`, `plan.recipe_added`, `cart.ingredients_added`, `chef_chat.message_sent` |
| Saved / import | `app/(tabs)/saved.tsx`, `components/import/` | `recipe.imported`, `cookbook.created` |
| Market | `app/(tabs)/market.tsx` + market components | `market.viewed`, `market.item_checked`, `market.match_run_completed`, `market.match_corrected`, `market.store_link_opened` |
| Language pill | Mutfağım header | `language.changed` |

Generation/matching duration + result counts are read from what the screens
already receive (`onDetailSettled`, RAG `generation` field, match-run results) —
no new plumbing inside `lib/`/`services/`.

## 9. Verification

1. **Dev:** set `EXPO_PUBLIC_ANALYTICS_DEBUG=true`, run the app, exercise a flow.
   PostHog RN logs queued/flushed events in Metro console when `debug` is on
   (`posthog.debug()`); events appear in PostHog → Activity → Live Events
   (EU project) within seconds of a flush (20 events or 10 s).
2. **Shape check:** in Live Events, confirm property names match the plan
   (snake_case, enums) and that no free-text/PII properties appear.
3. **Sentry:** `Sentry.captureException(new Error('sentry test'))` from a debug
   button; confirm in Sentry Issues. Native crash test requires a dev build.
4. **Prod watch (first week):** PostHog volume by event (any unexpected spike =
   a call site in a render loop), Sentry new-issue rate after release.

Failed delivery: PostHog RN retries queued batches automatically; events are
persisted across restarts. Nothing blocks the UI either way.

## 10. Rollout

Single release, all 23 events at once (user directive; volume is tiny at MVP
scale). Use the verification list above post-release. No staging environment
exists — `__DEV__` opt-out is the pollution guard, and
`EXPO_PUBLIC_ANALYTICS_DEBUG=true` is the explicit dev-testing switch.
