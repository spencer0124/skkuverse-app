---
title: App Architecture — MVVM and Repository in Feature Folders, Enforced by Lint and Tests
type: adr
status: accepted
owner: team@skkuverse.com
last-updated: 2026-10-28
audience: internal
---

# 0020. App architecture: MVVM and Repository in feature folders, enforced by lint and tests

> The one shape every module of the mobile app converges on: layers, folders, file names, the cross-feature door, ViewModels, data and state, response parsing, caching, comments and tests. It also names the lint rules and architecture tests that reject code which breaks that shape. Read it before adding a file under `apps/mobile/src/`.

## Status

Accepted on 2026-10-20, when every module had migrated and `apps/mobile/src/` held only `bootstrap`, `components`, `dev`, `features` and `platform`. [ADR 0026](0026-comments-say-only-what-the-code-cannot.md) amends D8 (2026-10-27). What the records still hold is under [Remaining records](#remaining-records).

## Quick reference

| Role | File | Holds | May import |
| --- | --- | --- | --- |
| Route | `app/**/x.tsx` | Params, then one screen | Public files of any feature |
| Screen, section | `XScreen.tsx`, root `X.tsx` | Rendering | Its own `use*`, `components/`, other features' public files |
| Component | `components/X.tsx` | Rendering, private | Its own feature's hooks, SDS |
| ViewModel | `useX.ts` (root public, `components/` private) | Screen state, handlers, refs; always an object | Everything below, and other features' data hooks |
| Data hook | root `use<Resource>.ts` | A query result or a store selector, the door another feature reads this feature's data through | Its own feature's data files |
| Service | `x.service.ts` | The feature's entry points outside React: combines data sources, or runs ordered steps (navigation, submit) | Client, repository, store, pure |
| Client | `x.client.ts` | Calls to one backend domain or external system, parsed; its `queryOptions` | Transport, schema, pure |
| Repository | `x.repository.ts` | Data the app owns: Firestore, Functions, user-owned MMKV. Reads, writes, `subscribe` | SDKs, schema, pure |
| Store | `x.store.ts` | Zustand client state | Pure |
| Pure | `.schema`, `.rules`, `.types`, `.constants` | Parsing, every decision and reshape, types, constants | Other pure files, never I/O. The clock is an argument |
| Native | `src/platform/<resource>.ts` | One native SDK, or the device clock | The SDK |

- A feature that only renders needs only a screen (or a section) and maybe `components/`.
- Another feature reaches you only through your root, or a sub-feature's root: `*.tsx`, `use*.ts`, `.service.ts`, `.constants.ts`. It reads your data through a `use<Resource>.ts` data hook, never by repeating your fetch.
- A copy of a server response goes through `cachedQueryOptions` from `@skkuverse/shared`, never a repository (D7).
- `components/` is private at any depth. There are no barrels and no cycles.
- The minimal feature is in the [appendix](#appendix-a-minimal-feature).

## Context

The app does the same job several ways:

- **Logic has no fixed home.** It sits in route files, in components (some call Firestore directly), in hooks, in `apps/mobile/src/services/` and in `packages/shared`.
- **Role names have no fixed meaning.** `repository`, `service`, `schema` and `domain` mean different things in different files.
- **Features are split across packages.** A feature often lives half in `packages/shared/src/<domain>` and half in `apps/mobile/src/features/<x>`, though nothing outside the app imports the shared domain code.
- **Feature boundaries are not enforced.** Features import each other's internals, and some pairs import each other.
- **Parsers have holes.** The hand-written response parsers check types with `typeof`, and some crash or return an empty result on inputs they should tolerate.

Agents write most of this code by imitating the file next to it. With no single pattern to imitate, new code drifts further, and a rule written only in prose holds only if it is read. skkuverse-server settled the same problem in its ADR 0010, "one module shape, enforced by tests". This decision is the app's counterpart, and it keeps the server's vocabulary and definitions wherever the role is the same.

## Decision

### D1. MVVM with hooks as ViewModels, plus Repository

| Layer | Files | Does |
| --- | --- | --- |
| View | `app/**` route file | Reads params and renders one screen |
| View | `*Screen.tsx`, root sections, components | Renders. Calls only its own feature's hooks |
| ViewModel | `use*.ts` | Composes queries, stores and actions into screen state and handlers (D11) |
| Domain (optional) | `*.service.ts` | The feature's entry points outside React. It combines data sources or runs ordered steps (navigation, an auth transition, a score submit). No React |
| Data | `*.client.ts` | The feature's calls to one backend domain or external system, several functions if needed. Each one calls the backend and parses the response, then returns app data or throws. Never imports a repository |
| Data | `*.repository.ts` | Data the app owns: Firestore, Cloud Functions, user-owned MMKV. Reads, writes and subscriptions |
| Data | `*.store.ts` | Client state in Zustand (D12) |
| Pure | `*.schema.ts`, `*.rules.ts`, `*.types.ts`, `*.constants.ts` | Parsing, decisions and reshaping, types and constants. No I/O, and the clock is passed in |
| Native | `src/platform/<resource>` | Wraps one native SDK, named by the resource it wraps. `platform/clock.ts` holds the device clock. Its pure half may sit beside it as a companion, such as `analytics.rules.ts` |

Dependencies point down the table only.

- **A `.client` is defined by what it talks to, not by endpoint**, exactly as server ADR 0010 defines a client: every call the feature makes to one backend domain (a server module such as `/bus` or `/notices`) or one external system, plus the translation of its payload. WHY: one file per HTTP resource would split one domain's error handling and transport settings across folders.
- **A `.service` has one definition:** the feature's entry points outside React. It combines data sources, or runs steps in order, such as opening a mini app from a deep link or submitting a score. One that would only forward one call is not written. WHY: the first pilot pass used the word for three different things, and an agent copies whichever it reads first.
- **A `.repository` holds data the app owns.** A copy of a server response is not that, and goes through `cachedQueryOptions` (D7). WHY: a repository that caches a server response becomes a second client for the same data, with its own idea of freshness.

The server mapping is one to one: controller is route + screen, service, client and repository keep their names, and the server's `.rules` and `.mapper` are the app's `.rules` (D4).

The Android "Guide to app architecture" uses other words for the same layers. Its RemoteDataSource is the `.client`, and its LocalDataSource is the `.repository`. Its Repository, which combines sources, is the `.service`, or the single client or repository itself when a feature has one source.

Rejected:

| Alternative | Why not |
| --- | --- |
| Class-based MVVM (MobX) | Hooks already are the React ViewModel; Ignite dropped MobX-State-Tree |
| Full Clean Architecture (ports, entities, an interface paired with each concrete module) | Every role has only one concrete module; the server rejected such pairs for the same reason |
| Redux or another Flux store | React Query owns server state and Zustand owns client state |
| Feature-Sliced Design | Its layers scatter one domain across folders. Its `app` layer collides with Expo Router's `src/app`, and its linter is beta |
| A `.repository` that combines remote and local, as in Android | Bus, map and search have no local source, so every one would gain a file that only forwards |
| Renaming `.client` to `.api` and `.repository` to `.storage` | `api` is a banned folder name, `.storage` misdescribes Firestore listeners and Functions calls, and both break the server mapping |
| One `.client` per HTTP resource | It turns endpoints into sub-features; the server defines a client by the system it talks to |

### D2. Feature folders: role files flat, `components/` the only subfolder

- **A folder holds at most one file of each data, service and store role:** `.client`, `.repository`, `.service`, `.store`. When a flow needs a second one, it becomes a sub-feature folder with its own role files (`transit/realtime/`, `transit/schedule/`), one level deep.
- **Sub-features follow user flows, not endpoints.** A second call to the same backend domain is a second function in the folder's `.client`, not a second folder. WHY: a folder per endpoint would leave each with a client and nothing else.
- **Sibling sub-features never import each other. What two of them share lives at their parent.** It goes to the parent's root if another feature needs it, to the parent's `components/` if not: `web/shell/` and `web/browser/` both read `capabilities.rules.ts` and `web.service.ts` from `web/`, and transit's three sub-features share `transit/components/`. `arch/sibling-import` enforces it. WHY: a sibling door would let sub-features grow a dependency graph inside one feature that no rule orders, and a sub-feature stays removable alone.
- **Pure roles may repeat by topic:** `.schema`, `.rules`, `.types` and `.constants`, as in `chips.rules.ts` beside `layers.rules.ts`. A pure file is split by subject, not by size.
- **`components/` holds the components and the private hooks** (D11). A pure helper that only components use may also live there as a topic-named `.rules.ts` or `.constants.ts`. It is private like the rest of the folder. WHY: lifting it to the root would make it look like part of the feature's data model. A folder named after a code type (`hooks`, `utils`, `helpers`, `store`, `stores`, `services`, `lib`, `types`, `api`, `data`) is not allowed.
- **Outside `features/`, `apps/mobile/src/` holds only four folders:** `components/` (cross-feature UI, prop-driven, no copy), `platform/`, `bootstrap/` (providers, init, deep links) and `dev/` (dev-only screens).
- **`bootstrap/` holds what runs the app rather than a feature.** Its root holds the providers and the launch, OTA and tab-focus code, and the push delivery path has the one sub-folder, `bootstrap/notifications/`. No feature imports `bootstrap/`. The FCM background handler is its own `bootstrap/background-message.service.ts`, which `index.ts` registers through `platform/notifications.ts`. WHY: `index.ts` also runs as Android's headless background task, so its import graph stays as small as it was. The delivery service would pull in `expo-router` and two features.
- **A deep-link queue belongs to the feature that drains it.** The pending notice link sits in `notices.store`, the mini-app link and SDUI action in `web.store`, the map place link in `map.store`, each written and drained through that feature's `.service`. Where draining needs another feature, the dependency is registered at load time instead of imported: `app/_layout.tsx` registers map's `openMapAtPlace` with `web.service`. WHY: queues in `bootstrap/` would make features import it, and an import from web to map would close a cycle that `feature-cycles.test.mjs` rejects.
- **`dev/` holds dev and pre-release-only screens, one folder per screen, each shaped like a feature:** the screen is at the folder's root and its private parts are in `components/` (`dev/sds-states/`, `dev/debug-logs/`), and the file-name rules apply as they do under `features/`. WHY: two dev screens in one flat folder would share a root and each other's private parts, and the shape is the one every agent already copies.
- **`platform/` holds one wrapper per resource, `<resource>.ts`, and its pure companions, `<resource>.<pure role>.ts`.** A companion takes the decisions and vocabulary out of the wrapper, as `handoff.rules.ts` holds the hand-off window beside `handoff.ts`. It is a pure file under `arch/pure-files`, so a pure file anywhere may import it, while importing the wrapper stays I/O. WHY: a test can then check the decisions without the SDK. A name such as `analytics-params.ts` names a part of a resource, so it does not invite a second wrapper for the same SDK.
- **A load-time side effect is its own platform module, imported where it has to run.** `platform/ota-init.ts` holds only `HotUpdater.init`, which `app/_layout.tsx` imports first. WHY: a wrapper loads wherever its first caller loads. `index.ts` loads crashlytics, which reads `ota.ts`, so an init inside `ota.ts` would run earlier than hot-updater's rollback detection was verified with.
- **A registry holds data, never a component.** A game's page, score spec and flags sit in a pure `registry.rules.ts` keyed by id, and the view a game supplies is mapped by id in a root component, `GameOverlay.tsx`. WHY: the board rules and the analytics types read the registry, and a pure file can't import a `.tsx`.
- **Domain code moves out of `packages/shared` into the feature that owns it.** The shared package keeps transport, i18n, tokens, cross-feature pure helpers (time, URL, colour, the schema helpers and the schema of a wire shape two features read), `cachedQueryOptions` and app-wide state. Shared domain folders accept no new file. A file added to a shared folder takes the role suffixes, as `time/kst.rules.ts`, `time/clock.rules.ts` and `schema/*.schema.ts` do.
- **The app has thirteen features**, each named by what it owns: map, hssc, notices, notifications, transit, web, home, games, profile, tour, feedback, settings and auth. The smaller ads, campus-routes, meals, search and video sit beside them.
  - Map holds three sub-features: `eventmap` (event places and their sheet), `building` (the building detail sheet) and `campus-sheet` (the campus sheet's server feed). `hssc`, the indoor map, is its own feature, because the building sheet reads its names through `hssc`'s constants rather than through map.
  - The first-launch intro is `tour`. The notices onboarding wizard is a notices sub-feature, `notices/onboarding`, since what it sets up is the notices tab. Its `DeptRow` and `UnsupportedDeptSheet` sit at that sub-feature's root because the picker route renders them.

Rejected: typed subfolders inside a feature (`api/`, `hooks/`, `stores/`, `utils/`). The server measured them on its own history and rejected them. Nothing checkable keeps them from becoming catch-alls, and Obytes, the most-copied Expo starter, keeps this flat shape.

### D3. A feature's public surface is its root and its sub-features' roots

| From another feature or a route | Allowed |
| --- | --- |
| A root-level `*.tsx` (a screen or an embeddable section) | yes |
| A root-level `use*.ts` (a section's ViewModel or a data hook) | yes |
| The root `*.service.ts` | yes |
| A root-level `*.constants.ts` | yes |
| The same four kinds at a sub-feature's root (`games/leaderboard/HomeHallOfFame.tsx`) | yes |
| `import type` of anything | yes |
| Anything under a `components/` folder, at any depth | no |
| `.client`, `.repository`, `.store`, `.schema`, `.rules`, `.types` (at runtime) | no |

- **Placing a file at a root declares it public.** A feature such as home composes other features' sections, so an embeddable section has to be importable.
- **A sub-feature imports its parent feature's root files, its `.client` included.** The door governs imports between features, and a sub-feature is part of its parent: `web/feed/useMiniAppFeed.ts` reads `miniAppFeedQueryOptions` from `web.client.ts`. WHY: a second `.client` in the sub-feature for the same backend domain would split one domain's calls in two (D1).
- **The door matches what the caller needs.**
  - **Data another feature reads** goes through a root `use<Resource>.ts` data hook that returns a query result or a store selector. WHY: the owner keeps one query key and one fetch, so two features never cache the same data twice or disagree on it.
  - **A section another screen hosts** is a root `<Name>.tsx` with its `use<Name>.ts` ViewModel beside it. Home mounts `web/feed`'s `MiniAppFeedSection` this way.
  - **An action that runs outside React**, such as opening a mini app from a deep link or an SDUI action, goes through a `.service`.
  - **Static data**, such as the bundled game ids, goes through `.constants`.
  - A hook that only returns a constant is not a door.
- No cycle between features is allowed, and there are no barrel files. `scripts/architecture/feature-cycles.test.mjs` enforces the first: it builds the runtime import graph between features and reports every feature in a cycle with the import that closes it.
- **A feature that knows another only through `import type` never names that feature's kinds at run time.** Such a feature cannot ask the owner, so it must not decide the owner's cases: what it needs travels on the request (its key, a table row keyed by kind) or comes from the view table the owner supplies. `scripts/architecture/type-seams.test.mjs` enforces it. For every pair where all imports are type-only, the type checker resolves each `kind` literal of an imported type, and one in a value position of the importer fails unless the importer's own types declare that kind too. A type it cannot resolve fails the test rather than passing it. WHY: the map's task reducer branched on transit's `line`, `bus_stop` and `subway_station`, so a new place kind from a third feature needed edits in four of map's switches.

Rejected:

- **No cross-feature imports, with composition in routes (bulletproof-react).** Home is itself a composition of other features, so every section would move into route files.
- **An `index.ts` public API per feature.** Obytes, Ignite and bulletproof-react dropped barrels over Fast Refresh, tree-shaking and cycles, and Metro does not tree-shake.

### D4. File names: a closed vocabulary

- **React files are named after their main export:** `HomeScreen.tsx`, `useHome.ts`.
- **Every other file is kebab-case with a role suffix,** `<base>.<role>.ts`, from this list: `.service`, `.client`, `.repository`, `.store`, `.schema`, `.rules`, `.types`, `.constants`, `.test`, `.generated`.
- **The base of a data, service or store file is its folder's name** (`home.client.ts`, `schedule.repository.ts`). A pure file's base is its folder's name or its topic (`chips.rules.ts`).
- **`.rules` holds all pure logic:** decisions, reshaping and reducers. The bus, notices, map and games code showed that the line between a rule and a mapper is a judgement call on most functions, so the app keeps one role where the server keeps two.
- **The prefix of a type or a query-options function, and the first element of a query key, is the feature's domain noun** (`<Domain>` below). For most features that is the folder's name: `HomeLayout`, `homeLayoutQueryOptions`, `['home', 'layout']`. When the folder names a surface rather than a domain, as `web/` does, it is the resource's domain noun: `MiniAppIndexEntry`, `miniAppIndexQueryOptions`, `['miniapp', 'index']`. WHY: the name says what the data is, and a surface hosts more than one kind of it.

**Type names.** WHY for all: a reader tells the wire layer from the screen layer by the name alone, and the compiler catches a value crossing between them.

| Kind | Name | Discriminant |
| --- | --- | --- |
| Server-shaped (what a schema outputs) | `<Domain><Resource>…`, as in `HomeLayout`, `HomeLayoutSection`, `HomeLayoutTile` | The server's own field and values (`type: 'tile_grid'`), unchanged |
| Screen-shaped (what `.rules` returns for a view) | `<Domain>Screen<Thing>`, as in `HomeScreenSection`, `HomeScreenTile` | `kind` |
| Component | `…View` | — the suffix is reserved for components |
| A bag of arguments | `<Function>Inputs`, as in `ToHomeSectionsInputs` | — never `Context`, which reads as React context |

- **A `.types.ts` never imports from a `.tsx`, even type-only.** WHY: a type that names a component's props ties the data layer to one rendering; the view adapts to the type, not the reverse.

**Function names.** WHY for all: each verb has a return contract (server ADR 0010 D4 sets the same for its roles), so a call site reads without opening the file.

| File | Verb | Returns |
| --- | --- | --- |
| `.client` | `fetch<Noun>`, `post<Noun>`, `send<Noun>` | App data, or throws |
| `.repository` | `read<Noun>`, `write<Noun>`, `subscribe<Noun>`, `clear<Noun>` | `subscribe` returns its unsubscribe. The app's repositories hold documents and keys, not queried collections, so the server's `find`/`list` set does not fit |
| `.rules` | `to<Target>` | A reshape |
| `.rules` | `is<X>`, `has<X>`, `can<X>` | A boolean, and only those do |
| `.rules` | `decide<X>` | A decision, one of a closed union of outcomes |
| `.schema` | `<name>Schema` (plural for a list, `homeSectionsSchema`) | A zod schema |
| `.schema` | `parse<X>` | The value or `null`, for a reader with its own fallback. A client that returns a parsed value, or hands `cachedQueryOptions` its `parse`, calls `parseOrThrow` instead, which throws with zod's reason |
| `.client`, `.service` | `<domain><Resource>QueryOptions`, as in `homeLayoutQueryOptions` | Query options keyed `[domain, resource]`, as in `['home', 'layout']` |
| ViewModel | `on<Event>`, `open<Target>` | A bound handler |

### D5. Enforcement: lint rules on ADR 0016's ratchet, structure tests on allowlists

- **Import and purity rules live in the local ESLint plugin `arch`** (`scripts/eslint/plugin-arch.cjs`):
  - `arch/feature-door`: D3. It also applies to importers under `apps/mobile/src/components/`, so cross-feature UI never reaches a feature's private file.
  - `arch/banned-folder-door`: D2 with D3. A folder named after a code type (`hooks/`, `utils/`, …) is no sub-feature, so a component, hook, `.service` or `.constants` inside it is private too, from another feature, a shared component or a route. WHY its own ID: its record stays apart from `arch/feature-door`'s.
  - `arch/layer-imports`: D1's direction.
    - A route, screen or component never reaches data access: a `.client`, `.repository` or `.store` file, Firestore, Functions, MMKV or axios.
    - A route never imports a feature's private file.
    - A data or pure file never imports a `.tsx` at runtime. A `.types.ts` also never imports a `.tsx` type (D4).
    - A platform wrapper such as analytics stays callable from a view, since a side effect a view triggers on tap gains nothing from a ViewModel hop.
  - `arch/data-direction`: imports between non-UI role files only go down (pure < store < client and repository < service). A client and a repository never import each other.
  - `arch/store-access`: a route, screen or component never reads a store hook from `@skkuverse/shared` (`use*Store`). A ViewModel reads it (D12).
  - `arch/shared-io`: a view or a pure file never imports I/O from the `@skkuverse/shared` barrel: `safeGet*`, `getApiClient`, `readCache`, `writeCache`, `clearCache`, or a `*Store` store object.
  - `arch/view-data`: a route, screen or component never imports `@tanstack/react-query`. Queries belong to ViewModels.
  - `arch/pure-files`: no network, storage, Firebase or native import, and no argumentless `Date.now()` / `new Date()`.
  - `arch/platform-sdk`: D2's platform layer. Analytics, Crashlytics, App Check, Messaging, hot-updater, haptics (`expo-haptics`), store review (`expo-store-review`), location (`expo-location`) and notifications (`expo-notifications`) are imported at runtime only by their wrapper under `platform/`, from a feature, a route or `index.ts` alike. AdMob stays off the list because its banners are native views beyond what a `.ts` wrapper can render. Its home is the ads feature's components plus `platform/ads.ts`. WHY: with one importer per SDK, the wrapper's guarantees hold everywhere. The wrapper never throws, sends nothing from a dev build and uses one release context.
  - `arch/sibling-import`: D2's sibling rule. A file in one sub-feature never imports, at runtime, a file in a sibling sub-feature of the same feature. `components/` and code-type folders are no sub-features. WHY its own ID: its record stays apart from `arch/feature-door`'s.
  - `arch/zod-usage`: D6's bans.
  - `arch/tolerant-schema`: an app `.schema.ts` builds lists with `tolerantArray` or `openUnionArray` and enums with `openEnum`, never bare `z.array` or a closed `z.enum` (D6).
  - `arch/schema-cast`: a `.schema.ts` never casts with `as` (except `as const`) or `<T>`, asserts non-null (`!`) or writes `any`. WHY: a cast asserts what the server sent instead of checking it, so `raw.label as string` let a missing label through as typed.
  - `arch/file-size`: every `use*` hook, view, route, service, data file and platform wrapper stays within a budget of lines of code, reported once per step past it. Pure files have none (D2). The budgets, the step and why size is ratcheted rather than capped are [ADR 0025](0025-ratchet-file-size.md). WHY: every rule above checks a file's shape, and `useMapHost.ts` grew to 842 lines of code while passing all of them.

  Each is its own rule ID at `error`. A rule's existing violations are recorded in `eslint-suppressions.json` and held there by the guard, exactly as ADR 0016 prescribes for any rule switched on over a backlog.
- **Folder and naming rules are `node:test` suites in `scripts/architecture/`.** The suites cover file names, one data, service or store file per folder, sub-features at most one level deep, banned folder names, the top-level folders, the closed shared domain folders, import cycles between features (`feature-cycles`), and the kinds a type-only seam may not name (`type-seams`, D3).
  - Each reads an allowlist at `scripts/architecture/allowlists/<rule>.json`.
  - A check fails on an unlisted violation and on a listed path that no longer violates. It prints why each path violates and the regenerated list.
  - An entry for a file the same change adds fails, so a new file is never on a list.
- **A judgement call stays in this document**, not in a heuristic test. Examples are where a join goes, how to split a pure file by topic and how to name.
- **Every file under `apps/mobile/src/` goes through the door,** `bootstrap/`, `dev/` and `platform/` included. Those folders stay (D2), so nothing empties them into a feature. The shell reaches the map's sheet stack through `map.service.ts` (`backOnMapTab`, `popMapTaskToRoot`) and the map tab of a route through `map-tabs.constants.ts`.

Rejected:

- eslint-plugin-boundaries and dependency-cruiser are new dependencies for what a local rule and a test already do.
- The built-in `no-restricted-imports` shares one rule ID with the existing bans, so its record could not be kept per concern.
- A `max-lines` cap at the largest file blocks nothing that a review would let through, and costs a test to keep it in step. A budget below the largest file, held by the ratchet, is `arch/file-size` ([ADR 0025](0025-ratchet-file-size.md)).

### D6. Server responses are parsed with zod, tolerantly

- **Objects use `z.object`, which strips unknown keys.** Old OTA bundles stay installed for months, so a new server field must never fail a parse. `z.strictObject` is banned.
- **Lists and enums use the shared helpers** in `packages/shared/src/schema/`, which `arch/tolerant-schema` requires:
  - `tolerantArray` drops and logs a malformed item alone;
  - `openUnionArray` skips an unknown discriminant silently, and drops and logs a malformed known member;
  - `openEnum` maps an unknown value to its declared fallback;
  - `text` is a non-empty string, and `optionalText` reads an empty, missing or non-string value as absent;
  - `parsedBy` reads one field through a hand parser, and a `null` from it fails the field, so in a list it drops that item alone;
  - `opt` reads a server `null` as absent;
  - `finiteNumber` accepts a number or a non-blank numeric string, never `null` as zero;
  - `parseOrThrow` makes a response that cannot be used throw, with zod's reason in the message, so the hook's `dataOrFallback` applies.
- **A malformed part drops alone, and a response fails only when the screen cannot use it.**
  - A malformed section reads as unknown, a malformed list item drops, and a value where a list belongs reads as an empty list.
  - A list whose failure keeps the last good copy on screen (D7), such as the live bus positions, fails the response instead. That happens when the value is not a list, or when the list was served with items and none of them reads.
  - A required string is `text`, never `z.string()`, so a blank one drops its part.
- **A dropped item leaves a trace.** The helpers hand every drop to the reporter `setDropReporter` installs. `useAppInit.ts` installs `logSchemaDrop` (`apps/mobile/src/platform/crashlytics.ts`). It logs a console warning in a dev build and a Crashlytics breadcrumb in a release build, once per list per process. WHY: a breadcrumb rides on the next report, while a non-fatal per drop would turn one server change into a report per fetch on every device.
- **Banned by `arch/zod-usage`:** `z.strictObject` and `.strict()`, `z.coerce`, and `z.discriminatedUnion`. Building a schema inside a transform is banned too, and left to review: it recompiles on every parse.
- **Domain types stay hand-written in `.types.ts`,** and each schema's output is checked against them with `satisfies`. A transform's `z.output` is a union of its branches, and it would lose the documentation the types carry.
- **A Firestore document is parsed by a `.schema` too**, read by its repository.
- **A schema checks a value and never casts it** (`arch/schema-cast`), a hand parser that `parsedBy` wraps included.
- **The server's `.wire.ts` schemas are not reused.** Their enums are closed, which would reject a new member on an old client. The server's published fixtures are what each parser is tested against.
- **Library choice.** zod classic, pinned exactly at one version in every workspace that imports it. It is not on the `scripts/check-singletons.mjs` list because it holds no React context or app state. Build tools such as `@expo/cli` carry their own copies, which never reach the bundle. `zod/mini` saves nothing without tree-shaking, which Metro does not do, and valibot is a different dialect from the server's zod.

### D7. A cache stores what the server sent, and a failed fetch is a failure

- **A last-known-good copy of a server response goes through one shared helper,** `cachedQueryOptions` in `packages/shared/src/store/cached-query-options.ts`, exported from `@skkuverse/shared`. WHY: every feature that keeps such a copy would otherwise rebuild the seed, the write and the fallback. Each copy of that code is a chance to answer a failure with the cache.

  Its inputs (`CachedQueryOptionsInputs<T>`) are the `queryKey` (`[domain, resource]`, D4), the MMKV `cacheKey` of the copy, which changes when the stored format does, a `fetch` that returns the raw payload or throws, a `parse` that returns the value or `null` or throws (the query's error keeps a thrown reason, such as the one `parseOrThrow` gives), a `staleTime` of at most the server's `max-age`, and optional `retiredCacheKeys`, older keys removed on the first successful write.

- **It stores the raw payload, and parses it when read.**
  - A cache of parsed values has to be valid parser input, which a transform breaks: home's cache lost every link tile on a round trip.
  - Parsing on read also lets a newer bundle read fields an older one cached.
- **The cache seeds the query and is never the answer to a failed fetch.**
  - The helper reads the cache into `initialData` with `initialDataUpdatedAt: 0`, so it revalidates at once.
  - Its `queryFn` writes the cache on success and throws on failure, including a payload `parse` rejects. That error names the cache key and keeps the parser's reason.
  - A cache read answers `null` to a `parse` that throws, so a copy this build cannot read seeds nothing.
  - React Query keeps the data it already has. Returning the cached copy from a failed `queryFn` would record the failure as a fresh success, and no refetch would follow for the whole stale time.
- **A feature's `.repository` is for data the app owns** (Firestore, Functions, user-owned MMKV), never for a copy of a server response.
- **Query options built with it live in the `.client`**, the lowest file that has everything the `queryFn` needs (D12). So home has no repository and no service: `homeLayoutQueryOptions` is in `home.client.ts`.
- **A source that must not be cached** is never given one. Realtime bus positions are one such source: a stale position misleads.

### D8. Comments say only what the code cannot

A comment opens with a tag (`WHY:`, `QUIRK(<system>):`, `CONTRACT(<repo>):`, `EVIDENCE:` or `SEE: docs/<path>`) and runs at most three lines. It never narrates history, restates the code or marks a section, except for a test's step markers (D9). A longer rationale goes to `docs/`, and the comment points at it. [ADR 0026](0026-comments-say-only-what-the-code-cannot.md) holds the full rule and its checks, and amends this decision: the rule covers every file in scope, and a JSDoc on an export needs a tag like any other comment. This follows server ADR 0010 D10.

### D9. Tests

- **A pure file gets a table-driven test.** A schema is tested against the server's published fixtures and the tolerance cases. A client, repository or service is tested at its edge: the HTTP client and MMKV are replaced, and the real files run.
- **Each test body marks its steps** with one-line comments, exactly `// Arrange`, `// Act` and `// Assert`, in that order, as skkuverse-server ADR 0011 and its `.claude/rules/tests.md` set. `// Arrange` is left out when there is nothing to set up, and `// Act` when the act ran in a shared setup. `// Act & Assert` covers a call made inside the `expect`. Any other comment goes on its own line below a marker. WHY: one convention across the fleet, so a test reads the same in either repository. No checker exists yet.
- **New tests in `apps/mobile` run under vitest.** The `*.test.mts` suites left run on `node:test`, whose strip-types runner cannot load a file with a relative runtime import, which D1's pure files need.
- **Server fixtures** are committed trimmed in the module's `__fixtures__/` folder, each with an `_about` naming its source and capture date, until the umbrella copies the server's published contracts into this repository.
- **Migration scaffolding leaves with the migration.** A characterization test or a parity test against the old parser proves a move in the commits that make it, and is deleted once the old code is gone.

### D10. Order

A guardrail switches on green over the tree, with its existing violations recorded, and a change that fixes a recorded entry removes it in the same commit. The migration ran that way, one module at a time after the home pilot, smallest first and map last.

### D11. ViewModels

- **A screen or section gets a ViewModel when it uses a query, a store, a data file or an async action.** One that holds only local UI state, logs analytics or navigates does not.
- **One ViewModel per screen and per public section.** A section embedded elsewhere, such as the hall of fame on home, fetches its own data. The host's ViewModel never holds another feature's query.
- **A ViewModel may call another feature's public data hook** (D3). It never repeats another feature's fetch. WHY: a second fetch of the same resource is a second cache entry that can disagree with the first.
- **A ViewModel always returns an object** of render-ready data, handlers and refs. It never returns JSX, and never a bare array. WHY: adding a field later then changes no call site.
  - Turning data into other data is a `.rules` function that takes `t` and `now` as arguments.
  - The ViewModel binds handlers and imperative parts: `fetchNextPage`, `onPress`, a scroll target.
- **The object carries a `status` union when the view branches on loading or error** (`{ status: 'loading' | 'error' | 'ready', … }`), so a screen branches inside one list's empty state instead of swapping its root, as the iOS 26 tab rule requires. A view that never branches has no `status`. Home always has a layout (its default one at worst) and returns `{ sections }`.
- **A private hook lives in `components/`.** That covers a screen's internal ViewModels, such as the map's camera, and view-only imperative hooks, such as scroll landing. Any `use*.ts` is a ViewModel for D5's layer rules. Its folder decides only who may import it.
- **An imperative native helper goes where its kind says.**
  - A decision is a pure `.rules` file: `camera-move.rules.ts` chooses between an animation and a command, and `pinch-lock.rules.ts` and `sheet-handoff.rules.ts` decide their steps.
  - A call on a mounted view's ref (the map camera, a sheet) runs in the ViewModel that owns the ref, or in a private hook in `components/` beside it. `useMapHost` composes the private hooks in `components/host/`, where `useCameraDriver` holds the camera calls and the camera prop, and the private `components/useSheetStack.ts` holds the sheet hand-off.
  - A native SDK the app calls is a `platform/` wrapper, such as `platform/location.ts` for `expo-location`.
  - WHY: a ref belongs to one mounted view rather than to an SDK singleton. A module wrapper would need that ref passed in on every call. Only a pure decision can be tested without a device.

### D12. Data and state patterns

- **`queryOptions` live in the lowest file that has everything the `queryFn` needs.** For a server resource that is the `.client`, also when `cachedQueryOptions` keeps a copy of it. For a Firestore read it is the `.repository`, and when sources combine it is the `.service`. Infinite lists use `infiniteQueryOptions` the same way.
- **Where state lives.** WHY: each kind has exactly one home, so a reader never has to ask which of two copies is current.

  | State | Lives in | Fed by |
  | --- | --- | --- |
  | A Firestore document the app listens to | A `.store` | A repository `subscribe<Noun>`, attached by a service that bootstrap calls |
  | A one-shot Firestore read | A query | Its repository `read<Noun>` |
  | An MMKV value that is user intent | A persisted `.store` | The user's actions, through a ViewModel or a service |
  | A copy of server data | `cachedQueryOptions` (D7) | The `.client` |
  | Server data | React Query | The `.client` |

- **Firestore.**
  - A repository exposes reads, writes and `subscribe<Noun>(…) → unsubscribe`.
  - A service attaches and detaches subscriptions as the user changes, and bootstrap calls it.
  - A mutation is a repository write that a ViewModel calls through `useMutation`.
  - The notifications rules (each intent is one dot-path `updateDoc`, written outside a transaction) are repository contracts.
- **A store is the data layer for client state.**
  - Only ViewModels and services read it, and only they write it.
  - It holds user intent and session state; derived values come from `.rules`, and server data stays in React Query.
  - One file may create several stores.
  - A feature's own state moves into its feature with an MMKV key migration; app-wide state (auth, settings) stays in `packages/shared`.
- **Time.** Pure functions take `now` as an argument, and KST is derived from the epoch, never from `Date.getHours()`. A ViewModel or view reads `now` from `platform/clock.ts`: `useNow(everyMs)` for a label that moves on a period, `useClock(nextEdge)` for one that changes at a moment its caller computes, such as the end of a window. Both re-render when the app returns to the foreground. A handler or an effect reads `readNow()` from the same file. The scheduling is pure, in `packages/shared/src/time/clock.rules.ts`.
  - Transit's timetable reads one `useNow(30_000)` and passes `now` down.
  - Map's private `useWindowEdgeClock(items, dailyWindows)` in `features/map/components/canvas/` computes its next edge (`window-edge.rules.ts`) and calls `useClock`, so the map moves on a return to the foreground too.
  - WHY one primitive: a time label goes stale at the edge its caller names, and three of the four clocks that existed already held time in state and armed one timer for it.

## Remaining records

What the ratchets still hold once every module has migrated, and why:

| Record | Entry | Reason |
| --- | --- | --- |
| `eslint-suppressions.json`, `arch/feature-door` | `features/games/host/components/useAutoSubmit.ts` imports `getProfile` from `profile.repository` | A public `profile.service` function that only forwards the read is what D1 forbids, so the one import stays recorded |

This is the one entry left, and it stays on purpose.

Every other record is empty: `file-names`, `top-level`, `folder-names`, `folder-roles`, `feature-depth`, `feature-cycles`, `type-seams`, `shared-domains`, `arch/sibling-import`, `arch/store-access`, `arch/layer-imports`, `arch/schema-cast` and `arch/file-size`. `shared-domains` reads the package entry from `packages/shared/package.json`'s `main`. The bootstrap imports that once reached a feature's private files now go through each feature's door, so `arch/feature-door` names no exception in its own code.

## Consequences

What gets easier:

- **Placement is decidable from the rules.** A server call goes in a client, a copy of its response through `cachedQueryOptions`, a Firestore read in a repository, a combination or an ordered flow in a service, a decision or a reshape in `.rules`.
- **Mistakes fail lint or tests**, not a review.
- **One feature is one folder**, so an agent reads one place for one task.
- **Old bundles survive server changes.** New fields, new enum members and one malformed item no longer break a screen on an installed build.

What gets harder:

- **zod adds a dependency**, a bundle cost and a smoke test on every bump. That smoke test exists because zod has broken on React Native and Metro before.
- **The app's `.rules` covers what the server splits into `.rules` and `.mapper`**, so a server engineer reads one more role into the app's file.

## Appendix: a minimal feature

A feature that lists one server resource and keeps a last-known-good copy:

```text
features/cafeteria/
  CafeteriaScreen.tsx       renders; root is a SectionList
  useCafeteria.ts           { status, sections, openMenu }
  useCafeteriaMenus.ts      data hook: what another feature reads
  cafeteria.client.ts       fetchCafeteriaMenus (raw payload); cafeteriaMenusQueryOptions via cachedQueryOptions,
                            key ['cafeteria', 'menus'], cacheKey 'cafeteria:menus:v1',
                            parse with parseOrThrow(cafeteriaMenusSchema, …)
  cafeteria.schema.ts       cafeteriaMenusSchema; output satisfies the types
  cafeteria.rules.ts        toCafeteriaScreenSections(menus, inputs), takes t and now
  cafeteria.types.ts        CafeteriaMenu (server-shaped), CafeteriaScreenSection (screen-shaped)
  cafeteria.schema.test.ts  fixtures and tolerance cases
  __fixtures__/
  components/MenuRow.tsx
app/cafeteria.tsx           export { CafeteriaScreen as default }
```

A Firestore source adds a `.repository`. A `.service` comes with a second source that must be combined with the first, or with a flow that runs outside React. A second flow with its own data becomes a sub-feature folder of the same shape. The data hook exists only once another feature reads the menus.

## Related

- skkuverse-server `docs/decisions/0010-server-architecture.md`
- skkuverse-server `docs/decisions/0011-test-strategy.md`
- [0016-ratchet-lint-debt-with-bulk-suppressions.md](0016-ratchet-lint-debt-with-bulk-suppressions.md)
