/**
 * Committed build constants — values that are already public because every
 * shipped bundle contains them.
 *
 * ## What belongs here vs. in `.env`
 *
 * The test is **not** "is this a secret?" but two separate questions asked in
 * order:
 *
 * 1. **Does it vary between a developer's machine and a release?** If no, it is
 *    not an environment variable — it is a constant that grew env-var plumbing
 *    by habit. It belongs here.
 * 2. **Is it extractable from a released artifact anyway?** Everything Metro
 *    inlines (`EXPO_PUBLIC_*`) and everything written into `extra` ships inside
 *    the `.ipa`/`.aab` and inside the public OTA manifest at
 *    `ota.skkuverse.com`. Committing such a value to a public repo leaks
 *    nothing that a released app does not already hand out.
 *
 * A value that answers "yes" to (1) or "no" to (2) does **not** belong here:
 *
 * - `EXPO_PUBLIC_BASE_URL` — the one genuine variable. It stays an env var, but
 *   only as a *local override*: `app.config.ts` ignores it outright on a
 *   shipping profile so a dev host cannot reach a release artifact.
 * - `FIREBASE_APP_CHECK_DEBUG_TOKEN_{IOS,ANDROID}` — real secrets. A registered
 *   App Check debug token mints valid attestation tokens and bypasses App
 *   Attest / Play Integrity outright. They stay in the gitignored `.env`, and
 *   `app.config.ts` default-denies them out of anything that ships.
 * - `APP_ENV` — a build-time switch, not a value to store. See `.env.example`.
 *
 * Why a committed constant rather than a committed env file: the guarantee then
 * lives in the code that produces the artifact, which is the one thing all four
 * release paths share. Both eas-cli and eoas evaluate this project with
 * `EXPO_NO_DOTENV=1`, so *no* dotenv file is read on a release path — a file
 * only survives there because somebody remembered a `source` line, and
 * forgetting exactly that line is what shipped two OTA updates with no API host
 * at all. Changing one of these values is now a reviewed code change with git
 * history, which is what `.env` never had.
 *
 * ## Why this file is `.js` and not `.ts`
 *
 * `app.config.ts` has to read it, and `@expo/config`'s `evalConfig` sucrase-
 * transpiles *only* `app.config.ts` itself before handing the string to
 * `require-from-string` — every `require()` inside then goes through plain Node
 * CJS resolution, whose extension search is `.js` / `.json` / `.node`. A
 * `./config/constants` written in TypeScript therefore fails with "Cannot find
 * module", and the explicit-extension spelling that does resolve leans on Node
 * 22.18+ type stripping plus `allowImportingTsExtensions` — an experimental
 * feature in the one code path that must never be fragile. CommonJS resolves
 * everywhere, unconditionally.
 *
 * TypeScript still types this file for the app-side consumers: `allowJs` is on
 * (`expo/tsconfig.base`) and TS infers the export shape from the CJS
 * assignments below, so `src/services/google-auth.ts` gets a checked `string`.
 *
 * Every value below is public. Do not add anything that is not.
 */

/**
 * Production API host — what `extra.baseUrl` carries on every shipping build,
 * and the fallback when no local override is set.
 *
 * Safe in a public repo: this is an address, not a credential. It is in every
 * shipped bundle, in the published OTA manifest, and in the network traffic of
 * any installed copy of the app. Authorisation is Firebase ID tokens plus App
 * Check on the server side; knowing the hostname grants nothing.
 *
 * @type {string}
 */
exports.PROD_API_URL = 'https://api.skkuverse.com';

/**
 * Naver Dynamic Map client ID — consumed by the
 * `@mj-studio/react-native-naver-map` config plugin in `app.config.ts`, which
 * writes it into the native project.
 *
 * Safe in a public repo: Naver binds the key to the registered bundle ID
 * (`com.example.skkumap`) and package name (`com.zoyoong.skkubus`). A copy of
 * the key used from any other app is rejected with 401, so it cannot be spent
 * against this project's quota. It is also already in the native binary of
 * every release, so it is extractable with `unzip` regardless.
 *
 * That binding is the entire basis for committing it — if the bundle-ID
 * restriction is ever removed in the Naver console, this value has to move back
 * out of source.
 *
 * @type {string}
 */
exports.NAVER_MAP_CLIENT_ID = 'q0ipc5nxg4';

/**
 * Google OAuth **web** client ID — passed to `GoogleSignin.configure()` in
 * `src/services/google-auth.ts`.
 *
 * Safe in a public repo: an OAuth client ID is public by design. It travels in
 * the authorisation request itself, so every user's browser and every network
 * hop already sees it, and Google's own setup docs print it into client source.
 * Only the client *secret* is sensitive, and a native app has none — the flow
 * here is authorisation-code/ID-token with no secret involved. Sign-in is
 * further constrained by `hostedDomain: 'g.skku.edu'` and by the Firebase
 * project's authorised-domain list, neither of which this string unlocks.
 *
 * @type {string}
 */
exports.GOOGLE_WEB_CLIENT_ID =
  '1043119106953-ku3okmn48ovdp6v475nv5p7m0gcdq7qm.apps.googleusercontent.com';
