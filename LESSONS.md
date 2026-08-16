# Lessons

Mistakes made in this repo, written down so they are not made twice. `CLAUDE.md` describes how
things work. This file records what went wrong and the non-obvious mechanism behind it. Skim the
relevant entries before touching the API host or the build/publish config, before adding a bottom
sheet that pushes a screen, before driving the simulator for a visual check, and before trusting a version
string or a document about what is live in production.

1. **A silent config fallback hid a wrong API host for months.**

   `packages/shared/src/api/config.ts` used to read `extra?.baseUrl ?? 'https://api.skkuuniverse.com'`.
   Inspecting the self-hosted OTA server's update store showed that the published updates on the
   `production/1.0.0` and `production/3.5.0` runtime channels carry no `extra.baseUrl` at all —
   `EXPO_PUBLIC_BASE_URL` was unset when they were published — so every one of those installs fell
   through to the hardcoded legacy host and has been talking to it ever since. Nobody noticed,
   because a wrong-but-reachable host looks exactly like a working app until the day the host is
   retired. The fallback is gone: the module throws at init (which fires while the bundle is still
   coming up, since `api/client.ts` imports it), and `apps/mobile/app.config.ts` refuses to build
   without the variable.

   → Takeaway: a fallback that makes a broken build look healthy is worse than no fallback. If a
   value is required, fail where the person who caused the mistake is still watching.

2. **A guard must cover every route the artifact can leave the machine by.**

   The first version of that build-time guard keyed only on `EAS_BUILD_PROFILE`. That covers native
   builds, which run inside EAS — but `apps/mobile/scripts/ota-beta.sh` and `ota-release.sh` publish
   through eoas with `RELEASE_CHANNEL=<channel>` and never set `EAS_BUILD_PROFILE`, and the publish
   path is exactly where the incident in #1 happened. `resolveBaseUrl` in `app.config.ts` now keys on
   `process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL`.

   → Takeaway: enumerate every way an artifact reaches users before writing the guard. A guard that
   misses the one route the real failure took is worse than none, because it buys false confidence.

3. **`EXPO_PUBLIC_*` is inlined at bundle time and cached.**

   Editing `apps/mobile/.env` and restarting Metro normally changes nothing: the transformer has
   already cached the substituted literal, so the previous host stays baked into the bundle.
   `npx expo start -c` is required, not superstition. The failure mode is the dangerous part —
   with the app still pointed at production, the eventmap manifest returns `activeLayerSetId: null`
   by design (`packages/shared/src/eventmap/parser.ts`), so the map shows zero pins, which is
   indistinguishable from a bug in the feature under test.

   And clearing the cache is only half of it. `-c` governs the `EXPO_PUBLIC_*` literals Metro inlines
   into **JS**; it does nothing for `Constants.expoConfig.extra`, which is what
   `packages/shared/src/api/config.ts` actually reads. This project has no `expo-dev-client`, so in a
   plain `expo run:ios` debug build that object comes from `EXConstants.bundle/app.config` **compiled
   into the `.app`** — the dev server never supplies it. A `.env` edit plus a Metro restart
   leaves the binary talking to whatever host it was built against, across relaunches.

   That cost real time twice. `DevProdHostBanner` was reported as "not rendering" when it was in fact
   entered, comparing correctly and returning `null`, because the installed binary had
   `http://localhost:3010` baked in. The API errors alongside it looked like a server problem and
   were the same cause. Check what a binary actually points at rather than what `.env` says:

   ```bash
   grep -ra "localhost" "$(xcrun simctl get_app_container booted com.example.skkumap)/EXConstants.bundle/app.config"
   ```

   → Takeaway: after a `.env` change, `-c` fixes the JS half. Changing which host a debug build talks
   to needs `npx expo run:ios`. Read the value out of the running app before trusting either.

4. **A `BottomSheetModal` is painted outside the navigator.**

   `BottomSheetModalProvider` renders `<PortalProvider>`, and `@gorhom/portal` mounts its host
   **after** `children` (`{children}{shouldAddRootHost && <PortalHost/>}`). Since that provider wraps
   the root `<Stack>` in `apps/mobile/app/_layout.tsx`, every `BottomSheetModal` is a sibling that
   *follows* the navigator in paint order — a pushed screen slides in underneath it and arrives with
   its bottom half occluded. No z-index or presentation option fixes this from the navigation side;
   the sheet has to dismiss first. `src/features/building/components/BuildingDetailSheet.tsx`
   (dismiss, then push `/map/hssc`) and `src/features/notices/NoticeDetailScreen.tsx` (hand off to
   the system browser) already knew this. `src/features/eventmap/EventMapPeekSheet.tsx` was the one
   navigating sheet that did not, and now calls `useBottomSheetModal().dismiss()` before
   `handleSduiAction`. The clinching evidence was differential: the campus tab's plain in-tree
   `<BottomSheet>` selector was correctly covered by the pushed screen, while the portaled modal
   survived on top of it.

   → Takeaway: when one overlay gets covered and another does not, the difference is the tree, not
   the styling. Any sheet that navigates must dismiss itself first.

5. **Two items at an identical coordinate: the higher `pinPriority` silently buries the other.**

   In the eventmap demo data, 부스전 운영본부 (`pinPriority` 20, and the only item carrying action buttons) sat at exactly the same lat/lng as 야간주점 2번 (`pinPriority` 30, no actions). <!-- conventions:allow-korean: the booth names are the demo data -->
   `src/features/eventmap/EventMapPinLayer.tsx` passes `zIndex={item.pinPriority}` to the marker, so
   the bar drew on top and took every tap — the booth was unreachable at any zoom, because zooming
   never separates identical coordinates. The `stackKey` dedup that produces the `+N` caption does
   not catch this: distinct places carry distinct keys, so they are two stacks that happen to
   coincide rather than one stack. The only way in was the deep link `skkuverse://map?place=<placeId>`.

   → Takeaway: "there is no pin for it" can mean "a pin is exactly on top of it". Check the data for
   coordinate collisions before debugging the renderer.

6. **Verify the thing under test is actually on screen before believing the result.**

   The first attempt to prove live pin dimming produced a 0.000% pixel diff between the before and
   after screenshots and looked like a clean failure of the feature. It was not a failure: the single
   item that crossed a status boundary in that window sat about 83 m south of the camera target,
   behind the bottom sheet. The test was invalid, not the feature. Reframing the camera and
   re-running showed the pin change plainly.

   → Takeaway: a null result is evidence only if the thing being measured was inside the frame.
   Confirm presence first, then measure.

7. **The app's map pins and peek sheet are absent from the accessibility tree.**

   `axe describe-ui` returns only generic `Bottom Sheet` frames for these screens; pin captions and
   sheet buttons never appear as elements. Selector- or elementRef-based UI automation therefore
   cannot drive them at all — coordinate taps are the only option. Useful constant for the
   conversion: the iPhone 17 Pro is 402×874 points against a 1206×2622 px screenshot, so screenshot
   pixels ÷ 3 give tap points.

   → Takeaway: check the accessibility tree before planning selector-driven automation, and for
   native map surfaces plan on coordinates from the start.

8. **CoreSimulator wedged on `simdiskimaged`, not `CoreSimulatorService`.**

   Every `xcrun simctl` subcommand hung indefinitely at 0% CPU. `sample`-ing the blocked process
   named the culprit outright: `+[SimServiceContext sharedServiceContextForDeveloperDir:error:]` →
   `initWithDeveloperDir:` → `+[SimDiskImageManager kickstartServiceWithError:]` →
   `simservice_send_request_sync` → `xpc_connection_send_message_with_reply_sync` → `mach_msg2_trap`.
   `SimServiceContext` init kickstarts the disk-image service *unconditionally*, which is why `list`
   hung exactly as much as `install` — an earlier report that "list works but install hangs" was a
   timing artifact, not a real distinction. What did NOT fix it: killing `CoreSimulatorService`;
   wiping `~/Library/Developer/CoreSimulator/Devices`; the theory that a long-running stale
   `simdiskimaged` was to blame (a freshly spawned one re-wedged identically). What DID: a full
   teardown that forced the runtime disk images to unmount and remount. One more trap along the way:
   `Unable to discover any Simulator runtimes` in `CoreSimulator.log` reads like the smoking gun and
   is **benign** on Xcode 15+, where runtimes live in mounted disk images rather than in the
   developer directory.

   → Takeaway: `sample` the blocked process instead of guessing which daemon is at fault, and never
   promote a log line to a diagnosis just because it looks damning.

9. **Release truth lives in `gh release list` and the OTA server, not in version strings.**

   `apps/mobile/app.config.ts` carries both a store `version` and a `runtimeVersion`, and the two are
   deliberately different numbers, so neither answers "what is actually out there". A "3.4.x"
   sighting during the audit turned out to be the retired Flutter predecessor, not a missing React
   Native release. The decisive numbers came from the release tags and from the self-hosted OTA
   server's own update store and request logs.

   → Takeaway: to find out what shipped, read the release tags and the server. Config files describe
   intent, not deployment.

10. **Documentation can be wrong in the dangerous direction.**

    `skkuverse-server/docs/cicd-and-branch-protection.md` stated that the legacy
    `api.skkuuniverse.com` nginx config was copied but not symlinked, and therefore inactive. It was
    symlinked by hand and actively serving; the document has since been corrected to say so. Acting
    on the original claim would have meant retiring a host that real installs — the ones in #1 — were
    still talking to.

    → Takeaway: a doc that understates what is live is worse than a missing doc, because it licenses
    a destructive action. Confirm against the running system before removing anything.
