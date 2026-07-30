# Product: Yemek App

**Last updated:** 2026-07-19
**Method:** codebase scan + user-provided requirements (autonomous session; user pre-specified analytics tool, funnels, and crash-reporting requirement)

## Product Identity
- **One-liner:** Users film or photograph their fridge, the app recognizes the groceries inside, and an AI turns that inventory into ready-to-cook recipes, a weekly meal plan, and a shopping list with live Albert Heijn / Jumbo price comparison.
- **Category:** consumer ai-ml-tool (kitchen / meal-planning assistant)
- **Product type:** B2C — no accounts, no organizations. Entity model is user (device) only.
- **Collaboration:** single-player

## Business Model
- **Monetization:** none detected — no billing code, no paywall, no tiers. Pre-revenue MVP.
- **Pricing tiers:** none.
- **Billing integration:** none detected.

## Tech Stack
- **Primary language:** TypeScript
- **Framework:** React Native + Expo (managed workflow, SDK 54 installed; AGENTS.md instructs consulting Expo v57 docs — verify SDK-compatible package versions with `npx expo install` at implementation time), expo-router (5 tabs + full-screen routes)
- **Database:** none client-side (zustand persist → AsyncStorage); Supabase Postgres server-side, only for the RAG recipe corpus (pgvector) + `generate-recipe` edge function. No auth, no user tables.
- **Background jobs:** none — all async work is in-app (translation backfill, image queue, store matching runs)
- **HTTP client patterns:** RN `fetch` (Claude API, store APIs via `createStoreFetcher`), `@google/genai` SDK (Gemini), Supabase edge function via fetch
- **Module organization:** TS modules — `app/` (expo-router screens), `components/`, `store/` (12 zustand stores), `lib/` (Claude, RAG, recipe math), `services/` (vision, images, stores, matching), `src/i18n/`
- **i18n:** i18next EN/TR; `lib/`+`services/` must not import i18n

## Value Mapping

### Primary Value Action
**Cooking a recipe generated from the user's own inventory** — proxied by recipe generation + recipe detail engagement. If users stop generating/opening recipes from their scanned inventory, the product has failed.

### Core Features (directly deliver value)
1. **Inventory capture** (Mutfağım `/`) — photo/receipt/video → Gemini/Claude vision → editable inventory. The input that everything else feeds on.
2. **AI recipe generation** (Tarifler `/recipes`) — 6 standard (missing-count layered) + 2 fine-dining recipes via RAG edge function (active path) or two-phase Claude fallback.
3. **Weekly plan** (Plan `/plan`) — Mon–Sun agenda of chosen recipes.
4. **Shopping list / market** (Market `/market`) — missing ingredients grouped by category, AH & Jumbo price matching + comparison, store deeplinks.

### Supporting Features (enable core actions)
1. **Pantry (Temel Malzemeler)** — 20 staples chips; shapes recipe generation ("ready" layer).
2. **Cookbooks (Kayıtlı `/saved`)** — save/import recipes into notebooks; import flow (Instagram/web/photo mock-real hybrid).
3. **Şefe Sor (chef chat)** — per-recipe Q&A chat (Claude).
4. **Preferences** — 4-category diet/taste chips feeding generation.
5. **Assistant add** (`/capture/assistant`) — voice/text-style ingredient entry to inventory or pantry.
6. **Recipe images** — Gemini image generation, lazy queue + file cache.
7. **i18n EN/TR** — language pill, translation backfill.

## Entity Model

### Users
- **ID format:** none today — no auth, no user record. Telemetry identity must be a client-generated anonymous UUID persisted in AsyncStorage (device-scoped). If Supabase auth arrives later, alias/identify onto the Supabase user UUID.
- **Roles:** none (single consumer role)
- **Multi-account:** no

### Accounts
- Not applicable — B2C, no accounts/groups. No group() calls needed.

## Group Hierarchy

None. Single-level (user/device) tracking only.

**Default event level:** user (anonymous device identity)
**Admin actions at:** n/a

## Current State
- **Existing tracking:** none — no analytics SDK, no track calls, no crash reporting anywhere in the codebase. Only `console.log` diagnostics (`[rag-gen]`, `[match-llm]`, `[recipe-image]` tags) and LLM usage logging kept in-memory/console.
- **Documentation:** none (no tracking plan)
- **Known issues:** total blindness — no funnel visibility, no retention data, no crash reports. **No onboarding flow exists in the app** — the required "onboarding completion" funnel must be defined over the de-facto first-run activation path (first open → language resolved → first inventory capture) unless/until a dedicated onboarding is built.

## Integration Targets
| Destination | Purpose | Priority |
|-------------|---------|----------|
| PostHog (EU Cloud, `https://eu.i.posthog.com`) | Product analytics: funnels (onboarding, first recipe, first weekly plan, market list usage, week-2 retention), feature usage | P0 |
| Sentry (EU data residency) | Crash reporting + JS error monitoring (user asked Sentry or Crashlytics; Sentry chosen — first-class Expo support, Crashlytics needs bare/dev-build native config and no EU residency control) | P0 |

**Destination constraints flagged:**
- PostHog EU host is mandatory (GDPR requirement from user). Must be set at SDK init (`host: 'https://eu.i.posthog.com'`).
- GDPR posture: no auth/email — identity is a random device UUID (pseudonymous). Avoid sending inventory contents, chat text, photos, or any free-text user input as event properties; track counts/categories/flags only. Session replay stays off.
- Expo Go limitation: Sentry native crash capture and full PostHog autocapture need a dev build; in Expo Go only JS-level errors/events flow. Plan verification accordingly.

## Codebase Observations
- **Feature areas inferred (routes):** `/` Mutfağım (inventory + capture entry), `/recipes`, `/saved` (cookbooks + import flow), `/plan`, `/market`, full-screen `/capture/camera`, `/capture/assistant`, `/recipe/[id]` (detail + chef chat).
- **Entity/state inferred (12 zustand stores):** inventoryStore, pantryStore, recipeStore (fingerprint cache v5), cookbookStore (cookbooks + importedRecipes), planStore, cartStore, chefChatStore, matchCacheStore, storePriceStore, marketMatchStore, captureStore (camera→analysis bridge), toastStore.
- **AI surfaces (cost/latency-relevant, worth instrumenting):** vision extraction (Gemini default), RAG recipe generation (Supabase edge, `EXPO_PUBLIC_USE_RAG=true`), two-phase Claude fallback, chef chat, ingredient parsing, recipe images, store matching LLM step, translation backfill.
- **Web preview:** store APIs mock on web (CORS); native is the real path.
