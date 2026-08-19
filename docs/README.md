---
title: Docs Index & Conventions
type: reference
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-19
audience: internal
---

# Docs Index & Conventions

> The index of skkuverse-app's documentation, and the single source of truth for how to write it. Read this before starting a new document.

## Folder structure (Diátaxis)

Documents are filed under the four [Diátaxis](https://diataxis.fr/) categories plus three
internal ones. **The category follows the reader's need, not the subject matter.**

| Folder | Need | Contents | Examples |
| --- | --- | --- | --- |
| `tutorials/` | Learning | A guided lesson for someone with no context | Setting up a dev machine |
| `how-to/` | Doing | A runbook for one goal | Build and deploy, publishing an OTA |
| `reference/` | Looking up | Authoritative facts: contracts, specs, rules | API specs, the deep link contract, UX writing rules |
| `explanation/` | Understanding | Why something is shaped this way, and the native mechanism behind it | iOS 26 tab bar, safe area, the marker bug |
| `decisions/` | — | ADRs (Architecture Decision Records) | `NNNN-kebab-title.md` |
| `internal/` | — | Postmortems and debugging records | `YYYY-MM-topic.md` |
| `plans/` | — | Work plans, still open or already done. Mutable and draft by nature | The FCM push plan |

A document serves one need. When a procedure and its background start sharing a page, split
them and link the halves.

Knowledge that is local to one package belongs in **that workspace's `README.md`**, or in a
document inside the package such as `packages/sds/SDS.md`. This folder is for knowledge that
crosses package boundaries.

## Index

### tutorials

| Document | Summary |
| --- | --- |
| [getting-started.md](tutorials/getting-started.md) | New machine to running app: Node/JDK/SDK, secret files, native build |

### how-to

| Document | Summary |
| --- | --- |
| [ios-build-deploy.md](how-to/ios-build-deploy.md) | iOS local build (EAS `--local`), then TestFlight or the App Store |
| [android-build-deploy.md](how-to/android-build-deploy.md) | Android local build, then Google Play |
| [ota-update.md](how-to/ota-update.md) | Publishing an OTA update to the beta or production channel |
| [firestore-debugging.md](how-to/firestore-debugging.md) | Firestore debugging, from the symptom table through REST server truth to emulator checks |
| [add-notice-tab.md](how-to/add-notice-tab.md) | Cross-repo checklist for adding a notice tab (server categories.json to the tabsContract mirror) |

### reference

| Document | Summary |
| --- | --- |
| [deep-link.md](reference/deep-link.md) | The `skkuverse://` and universal link whitelist contract |
| [map-config-api-spec.md](reference/map-config-api-spec.md) | Map API contract between server and client, including `GET /map/config` |
| [sdui-campus-spec.md](reference/sdui-campus-spec.md) | Server-driven UI contract for the campus tab |
| [miniapp-notification-payload.md](reference/miniapp-notification-payload.md) | Mini-app push wire contract, from the Cloud Function request body through to the navigation a tap produces |
| [ux-writing.md](reference/ux-writing.md) | UX writing rules: six required rules and eight principles |

### explanation

| Document | Summary |
| --- | --- |
| [architecture.md](explanation/architecture.md) | The whole system, from monorepo boundaries and data flow through to the provider stack and its diagrams |
| [fcm-architecture.md](explanation/fcm-architecture.md) | Current FCM architecture: v5 SSOT, tabsContract, delivery, auth transition |
| [notices-feature.md](explanation/notices-feature.md) | Notices: server-driven tabs, markdown rendering, the onboarding gate and auto-restore |
| [app-check.md](explanation/app-check.md) | App Check: debug token injection paths, Play Integrity throttling and cache priming |
| [`ios-26-native-tabs-minimize.md`](explanation/ios-26-native-tabs-minimize.md) | The chain root rule behind NativeTabs `minimizeBehavior` and automatic contentInset |
| [ios-modal-safe-area-provider.md](explanation/ios-modal-safe-area-provider.md) | Why every modal route needs its own SafeAreaProvider |
| [android-naver-map-markers.md](explanation/android-naver-map-markers.md) | The custom view marker bitmap snapshot race, and the fix |
| [eventmap-rendering.md](explanation/eventmap-rendering.md) | Event map client, covering the server clock offset, predicate evaluation and stackKey pin rendering |
| [splash-animation.md](explanation/splash-animation.md) | The splash animation and how it hands off to InitGate |

### decisions (ADR)

Each ADR's own frontmatter carries its status. It is not repeated here, because a value
copied to a second place is a value that will disagree with the first.

| Document | Summary |
| --- | --- |
| [0001-adopt-diataxis-docs-structure.md](decisions/0001-adopt-diataxis-docs-structure.md) | Filing documents by reader need |
| [0002-no-notification-inbox.md](decisions/0002-no-notification-inbox.md) | Push without an in-app inbox, with a locally computed badge |
| [0003-local-eas-build-fastlane.md](decisions/0003-local-eas-build-fastlane.md) | Building locally with EAS `--local` and Fastlane rather than in the cloud |
| [0004-self-hosted-ota-fixed-runtime-version.md](decisions/0004-self-hosted-ota-fixed-runtime-version.md) | Self-hosted OTA with a fixed runtimeVersion instead of fingerprinting |
| [0005-user-firebase-public-mongodb.md](decisions/0005-user-firebase-public-mongodb.md) | User data in Firebase, public data in MongoDB behind the backend |
| [0006-miniapp-webview-push-architecture.md](decisions/0006-miniapp-webview-push-architecture.md) | Mini app shell, web view bridge, and how push reaches it |

### internal (postmortems and debugging)

| Document | Summary |
| --- | --- |
| [2026-07-notices-picker-ghost-state.md](internal/2026-07-notices-picker-ghost-state.md) | Postmortem: ghost preferences state in the department picker |

### plans

| Document | Summary |
| --- | --- |
| [fcm-push-notifications.md](plans/fcm-push-notifications.md) | Superseded. The current architecture lives in [fcm-architecture.md](explanation/fcm-architecture.md) |
| [miniapp-platform.md](plans/miniapp-platform.md) | Mini app platform planning: use cases and onboarding. The app-side decision is ADR 0006 |

### Workspace READMEs (co-located)

Package-local knowledge lives next to the package:

| README | Package |
| --- | --- |
| [apps/mobile](../apps/mobile/README.md) | The Expo mobile app, how to run it, and links to the build runbooks |
| [packages/shared](../packages/shared/README.md) | Data layer: API client, stores, hooks, tokens, i18n |
| [packages/bridge](../packages/bridge/README.md) | The web-to-native message contract |
| [packages/sds](../packages/sds/README.md) | Design system, plus SDS.md and TOSS_UX_GUIDE.md |
| [functions](../functions/README.md) | Cloud Functions: triggers and verify scripts |

## Writing rules

### 1. Frontmatter (required)

Every document opens with YAML frontmatter:

```yaml
---
title: <Title Case>
type: how-to | reference | explanation | tutorial | adr | plan | postmortem
status: draft | accepted | superseded | deprecated
owner: zoyoong124@gmail.com
last-updated: YYYY-MM-DD
audience: internal | public
---
```

- The `status` and `audience` values are checked by the umbrella's `lint_conventions.py`.
  The `type` list is this repo's own convention: the checker requires the key, not any
  particular value, so a typo there fails review rather than CI.
- When `status` is `superseded` or `deprecated`, open the body with a link to the current SSOT.
- Update `last-updated` whenever you change what the document says.

### 2. Skeleton

Immediately after the frontmatter:

1. `# H1`, exactly one per document
2. `> one-line summary` saying what the document is and who should read it

Then `##` sections, with no skipped levels. Start a new document by copying
[`_template.md`](_template.md).

### 3. Point at the source, do not copy the value

**Never hardcode a version, measurement, or count into a document.** When the code changes,
a copied value starts lying silently, and that was the root cause of staleness across this
repo: a `runtimeVersion` frozen into the OTA runbook, a rules-test count frozen into a plan.

- Wrong: `runtimeVersion is 3.5.0`
- Right: `runtimeVersion is defined in apps/mobile/app.config.ts`
- When an example value is genuinely needed, use a `<runtime-version>` placeholder or say
  explicitly that it was accurate at the time of writing.

### 4. File names

- **kebab-case, lowercase, `.md`**, as in `ios-build-deploy.md`
- ADRs: `NNNN-kebab-title.md`, zero-padded, preferably starting with a verb, as in
  `0001-adopt-diataxis-docs-structure.md`
- Postmortems: `YYYY-MM-topic.md`, as in `2026-07-notices-picker-ghost-state.md`
- ALL-CAPS names are reserved for the files GitHub treats specially: `README`,
  `CONTRIBUTING`, `LICENSE`

### 5. Formatting

- Every code fence declares a language: `bash`, `ts`, `tsx`, `json`, `yaml`. Use `ts`, not
  `typescript`.
- Structured facts, such as parameters, paths and options, go in tables.
- Warnings use GitHub admonitions: `> [!NOTE]` and `> [!WARNING]`.
- **Write in English.** This is a fleet-wide policy, defined in the umbrella repository's
  `CLAUDE.md` and enforced by its `lint_conventions.py`, which fails on Korean anywhere
  outside declared product copy. Korean that is itself the product, such as an i18n bundle or a
  UX copy example, stays Korean: mark the individual line with a
  `<!-- conventions:allow-korean: reason -->` comment, or declare a whole path under
  `productCopy` in `.conventions.json` when the entire file is product data.
- Lint with `yarn lint:md`, which runs markdownlint-cli2. The rule set is vendored from the
  umbrella as `.markdownlint.jsonc`; this repo's `.markdownlint-cli2.jsonc` names only which
  paths to lint.

### 6. Lifecycle

- When a plan in `plans/` ships, move the knowledge that settled into `reference/` or
  `explanation/`, or rewrite it there, and mark the plan `status: superseded`. Do not delete
  it, since the history has value.
- After a structural decision, write one ADR in `decisions/` covering Context, Decision and
  Consequences.
- When you find a document that disagrees with the code, fix it where you stand, or at
  minimum leave a `> [!WARNING]` saying it is stale.
