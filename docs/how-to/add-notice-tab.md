---
title: Add a Notice Tab (Cross-Repo Runbook)
type: how-to
status: accepted
owner: zoyoong124@gmail.com
last-updated: 2026-08-10
audience: internal
---

# Add a Notice Tab (Cross-Repo Runbook)

> What to change, and in what order, across the server, Cloud Functions and the app when adding a notice tab, fixed or picker. Read this before adding, removing or renaming a tab.

> [!NOTE]
> This work crosses **three repositories**: skkuverse-crawler, then skkuverse-server, then
> skkuverse-app. Changing only one breaks the feature silently. A missing functions mirror in
> particular produces no runtime error at all, only "zero notifications sent".

## The contract chain

Source of truth, upstream to downstream:

| Location | Role |
| --- | --- |
| `skkuverse-crawler/categories.json` | The SSOT. Per the header comment in `tabConfig.ts`, the crawler owns categories.json and sources.json |
| `skkuverse-server/src/notices/categories.json` | The copy the server actually reads. `tabConfig.ts` loads and validates it at boot, and it backs both the `GET /notices/tabs` response and the FCM topic computation |
| `skkuverse-app/functions/src/notifications/tabsContract.ts` | **A hardcoded mirror**, holding `FIXED_TAB_KEYS` and `KNOWN_PICKER_KEYS`. `derive.ts` uses it to derive subscribedTopics |
| The skkuverse-app client | The tab UI is server-driven through `GET /notices/tabs`, so it updates by itself. The one exception is the `TAB_EMOJI` map in `TabToggleRow.tsx`, which is hardcoded with a 📌 fallback, so a miss is cosmetic |

> [!WARNING]
> The header comment in `tabsContract.ts` and `CLAUDE.md` both give the source path as
> `skkuverse-server/features/notices/categories.json`. After the server repo was
> restructured, **the real path is `skkuverse-server/src/notices/categories.json`**, confirmed
> on 2026-07-21.

### What an entry in categories.json looks like

```jsonc
{ "id": "academic", "label": { "ko": "학사", "en": "Academic" }, // conventions:allow-korean: live server payload
  "tabMode": "fixed", "sourceId": "skku-notice02" }
```

```jsonc
{ "id": "library", "label": { "ko": "도서관", "en": "Library" }, // conventions:allow-korean: live server payload
  "tabMode": "picker", "sourceIds": ["lib-hssc", "lib-nsc", "lib-all"],
  "maxSelection": 3, "defaultIds": ["lib-all"],
  "campusDefaultIds": { "hssc": ["lib-hssc"], "nsc": ["lib-nsc"] } }
```

- **fixed** takes one `sourceId`. Every `sourceId` has to exist in the `sources.json` beside
  it, and the server fail-fasts at boot with `process.exit(1)` when one does not.
- **picker** requires `sourceIds[]` and `maxSelection`. `defaultIds` and `campusDefaultIds`,
  whose keys may only be `hssc` and `nsc`, are optional. Validation fails when the per-campus
  seed, meaning the shared defaults combined with the campus defaults, exceeds
  `maxSelection`.

### The FCM topic convention

The server's `buildTopics()` in `notices.topics.ts` and the functions' `derive.ts` produce
**the same format** independently, with no translation layer between them:

| tabMode | Topic format | Example |
| --- | --- | --- |
| fixed | `category:<tab.id>` | `category:academic` |
| picker | `<tab.id>:<sourceId>` | `library:lib-hssc` |

**The convention is that a picker tab key is its topic prefix, an identity mapping.**
`KNOWN_PICKER_KEYS` is itself the set of prefixes, and the separate prefix-mapping constant
that used to exist has been removed. A new picker tab's `id` becomes its topic prefix, so it
cannot be named anything else.

## Step checklist

1. **Upstream: define the source and category in the crawler.** Update
   `skkuverse-crawler/categories.json`, and register the crawl source in `sources.json` when
   the sourceId is new. How the crawler copy reaches the server, by hand or by script,
   **still needs confirming**.

2. **Add the tab to the server's `src/notices/categories.json`**, in the shape above. Check
   first that the sourceId exists in `sources.json`. The server validates at boot, so this
   **needs a redeploy** to take effect.

3. **Update the functions mirror in the same release**, in
   `functions/src/notifications/tabsContract.ts`:
   - a fixed tab goes into `FIXED_TAB_KEYS`
   - a picker tab goes into `KNOWN_PICKER_KEYS`
   - update the expected list and the total-count assertion in the snapshot test
     `functions/test/tabsContract.test.ts` **deliberately**, since that test is the drift net

4. **If needed, the Android notification channel.** `mapCategoryToChannel()` in
   `functions/src/channels.ts` maps only some categories to a dedicated channel and falls
   back to `notice_general` for the rest. Giving a new fixed tab its own channel means
   updating that **and its app-side mirror**,
   `apps/mobile/src/services/notification-channels.ts`, where notifee registers channels in
   advance, **with byte-identical strings**. A channel id mismatch makes Android fall back to
   the default channel silently.

5. **Verify**

   ```bash
   cd functions
   npm test                # derive, the tabsContract snapshot, and equality tests
   npm run verify:trigger  # firebase emulators:exec integration scenarios
   ```

6. **Deploy order: functions first, then the server.** This is inferred from the code rather
   than written down anywhere else.
   - `derive.ts` treats `noticeTabEnabled[key] !== false` as on by default, so deploying the
     mirror first means the new topic joins a user's subscription on their next preferences
     write. That is harmless, because the server is not sending to it yet.
   - The other order has the server sending to a topic no device subscribes to, which is a
     **silent non-delivery**.
   - Note that the `onPreferencesWrite` trigger re-derives **only on a preferences write**, so
     existing users' `subscribedTopics` do not update immediately. Whether a backfill
     procedure exists for all users **needs confirming**. Without one, notifications for a new
     tab reach active users gradually.

## Footguns

| Footgun | Symptom | How it is caught |
| --- | --- | --- |
| A new **fixed** key missing from the mirror | The topic is never subscribed, so that tab sends zero notifications | **Nothing catches it.** derive simply iterates the fixed key list. Coordination plus the `tabsContract.test.ts` update is the only defense |
| A new **picker** key missing from the mirror | That picker selection never becomes a topic | `derive.ts` logs `notifications.derive.unknown_picker_key` at warn level, so Cloud Logging shows it early, though nothing fails |
| A sourceId absent from `sources.json` | The server fails to boot | fail-fast `exit(1)`, visible at deploy time, which is a good failure |
| The channel mapping not updated | Android falls back to `notice_general` silently | Only by looking |
| A picker id named differently from its topic prefix | The topic contract breaks | A convention violation, since the mapping is identity |
| `pickerSelections.dept[0] === ''` sentinel | Existing behaviour, marking "my department is not listed". derive's falsy filter stops an invalid `dept:` topic leaking | Only matters when touching the filter logic |
| The 'dept' key hardcoded in three places | Renaming the dept tab needs a coordinated rename across the `notices/index.tsx` handler, `useAppInit.ts` and `tabsContract.ts` | Coordination |

## Related

- [../explanation/fcm-architecture.md](../explanation/fcm-architecture.md) — why the derive,
  trigger and delivery pipeline is shaped this way
- [../explanation/notices-feature.md](../explanation/notices-feature.md) — background on the
  notice tab UI and the onboarding gate
- `functions/README.md` — the verify scripts in detail
