import { ExpoConfig, ConfigContext } from "expo/config";
import { NAVER_MAP_CLIENT_ID, PROD_API_URL } from "./config/constants";

// Substrings that only ever appear in a host living on a developer's machine.
// `localhost` and `127.0.0.1` resolve to the phone itself once the bundle is on
// a device, and `10.0.2.2` is the Android emulator's alias for the host
// loopback, so all three are unreachable from a real install. `http://` is here
// too: every deployed API host is https, so a plaintext scheme is a dev-server
// tell no matter what follows it.
const LOCAL_HOST_MARKERS = ["localhost", "127.0.0.1", "10.0.2.2", "http://"];

// The EAS profiles whose artifacts leave this machine — `beta` to TestFlight
// and Play internal testing, `production` to the App Store and Play production.
// `development`, and the unset value a plain `expo start` / `expo run:ios`
// carries, both stay on the developer's own device and are exempt below.
const SHIPPING_PROFILES = ["beta", "production"];

/**
 * Resolves the value that goes into `extra.baseUrl`.
 *
 * This used to be a *detector*: read EXPO_PUBLIC_BASE_URL, throw if it was
 * missing, throw again if it looked like localhost on a shipping profile. The
 * detector was answering the right question with the wrong shape — it could
 * only ever catch the mistake after somebody had already made it, and it caught
 * it late (see C13 in the investigation: EAS_BUILD_PROFILE is set by the build
 * worker *inside* the sandbox, so the localhost check fired only after prebuild
 * and pod install). Worse, the unconditional throw for a missing value broke
 * every eas-cli command outright, because eas-cli evaluates this file with
 * `EXPO_NO_DOTENV=1` — `.env` is invisible at that stage by design.
 *
 * The shape now is default-deny, and the rule is one sentence: **on a shipping
 * profile the environment variable is not consulted at all.** Not defaulted,
 * not validated — ignored. A default still lets a stray EXPO_PUBLIC_BASE_URL
 * win, whether it came from `.env`, from an `export` in somebody's shell
 * profile (which outranks `.env` on every path — @expo/env never overwrites an
 * already-defined variable), or from a hand-run `eas build` / `eoas publish`
 * outside the scripts. Ignoring it makes a dev host *unrepresentable* in a
 * release artifact, which is the actual requirement.
 *
 * Off a shipping profile the variable is exactly what it should have been all
 * along: an optional local override. Unset means the committed production host,
 * matching the skkumap precedent — forgetting the override costs you a dev
 * session against production, never a release pointed at localhost.
 *
 * That inversion has its own failure mode, and it is deliberate that it is a
 * visible one: `src/components/DevProdHostBanner.tsx` renders a persistent
 * indicator whenever a `__DEV__` session is talking to PROD_API_URL.
 *
 * Two variables decide "is this shipping", not one, because the two ways an
 * artifact leaves this machine announce themselves differently. A native build
 * runs inside EAS, which sets EAS_BUILD_PROFILE. An OTA publish does not go
 * through EAS at all — `scripts/ota-{beta,release}.sh` invoke eoas with
 * `RELEASE_CHANNEL=<channel>` and EAS_BUILD_PROFILE never gets set. Keying on
 * the build variable alone would leave the publish path unguarded, and the
 * publish path is exactly where the 1.0.0 / 3.5.0 incident happened. Same
 * signal as the App Check strip below; when a new way to ship appears, both
 * need teaching about it.
 */
function resolveBaseUrl(): string {
  const profile = process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL;
  const isShipping = profile !== undefined && SHIPPING_PROFILES.includes(profile);

  if (isShipping) {
    // Redundant assertion, kept deliberately. PROD_API_URL is a committed
    // constant a few lines away in `config/constants.js`, so this branch cannot
    // fire as long as that constant is a real https host — it is unreachable by
    // construction, not by luck. It stays because it costs nothing and because
    // its unreachability is exactly what makes it worth having: if it ever does
    // fire, the constant itself has been edited into something that must not
    // ship, and the build must still die here rather than reach a user's phone.
    // A tripwire behind the structure, not the structure.
    const localMarker = LOCAL_HOST_MARKERS.find((marker) =>
      PROD_API_URL.toLowerCase().includes(marker),
    );
    if (localMarker !== undefined) {
      const source =
        process.env.EAS_BUILD_PROFILE !== undefined
          ? "EAS_BUILD_PROFILE"
          : "RELEASE_CHANNEL";
      throw new Error(
        `PROD_API_URL is "${PROD_API_URL}", which points at a local ` +
          `development host (matched on "${localMarker}"), but ` +
          `${source} is "${profile}" — an artifact from that profile goes to ` +
          "real users, whose phones cannot reach it. This should be " +
          "impossible: PROD_API_URL is a committed constant in " +
          "apps/mobile/config/constants.js and EXPO_PUBLIC_BASE_URL is not " +
          "read on a shipping profile at all. Something upstream edited that " +
          "constant — fix it there, not here.",
      );
    }
    return PROD_API_URL;
  }

  // Not shipping: local development, where the override is the whole point.
  // Trimmed, because `''` and `'  '` both mean the substitution never happened
  // — the same reasoning `packages/shared/src/api/config.ts` trims on.
  return process.env.EXPO_PUBLIC_BASE_URL?.trim() || PROD_API_URL;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  owner: "seungyongcho",
  version: "3.5.1",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "skkuverse",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  runtimeVersion: "3.5.4",
  updates: {
    url: "https://ota.skkuverse.com/manifest",
    enabled: true,
    fallbackToCacheTimeout: 0,
    requestHeaders: {
      "expo-channel-name":
        process.env.EAS_BUILD_PROFILE === "beta" ? "beta" : "production",
    },
    codeSigningCertificate: "./certs/certificate.pem",
    codeSigningMetadata: {
      keyid: "main",
      alg: "rsa-v1_5-sha256",
    },
  },
  extra: {
    // Always present, and on a shipping profile always PROD_API_URL — see
    // resolveBaseUrl above for why the environment variable is ignored rather
    // than merely defaulted there. `packages/shared/src/api/config.ts` still
    // throws on a missing value at module init, covering the runtime path this
    // file never sees; it is now a genuinely unreachable assertion rather than
    // the thing standing between a release and a wrong host.
    baseUrl: resolveBaseUrl(),
    // Debug-only. Surfaced so app-check.ts can pass it into
    // provider.configure({ debugToken }) — RN Firebase then setenv()'s
    // FIRAAppCheckDebugToken, which is the only App Check debug-token
    // injection path that reliably works on iOS Simulator (UserDefaults
    // fallback is silently ignored for unclear reasons — likely GULUserDefaults
    // caching interaction).
    //
    // Guard: these must never reach an artifact that leaves this machine. A
    // registered debug token mints valid App Check tokens, so it bypasses App
    // Attest / Play Integrity outright — and every skkuverse repo is public.
    //
    // DEFAULT-DENY, and read why before loosening it. This used to exclude the
    // tokens when EAS_BUILD_PROFILE was beta/production, i.e. it defaulted to
    // INCLUDING them and relied on recognising a shipping build. That failed
    // open on the OTA path: `scripts/ota-{beta,release}.sh` publish through eoas
    // with RELEASE_CHANNEL=<channel> and never set EAS_BUILD_PROFILE, so the
    // strip did not fire and both tokens went out in the published production
    // manifest, fetchable from ota.skkuverse.com with no authentication.
    //
    // Inverted: include them only when NEITHER shipping signal is present, so
    // an unrecognised future release path omits the secret rather than leaking
    // it. Same two-variable signal as resolveBaseUrl above — when a new way to
    // ship appears, both need teaching about it, and both fail safe until then.
    ...(process.env.EAS_BUILD_PROFILE === undefined &&
    process.env.RELEASE_CHANNEL === undefined
      ? {
          firebaseAppCheckDebugTokenIos:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS,
          firebaseAppCheckDebugTokenAndroid:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID,
        }
      : {}),
    eas: {
      projectId: "43e326a2-2f25-4317-a341-a107a52c5405",
    },
  },
  ios: {
    bundleIdentifier: "com.example.skkumap",
    supportsTablet: true,
    buildNumber: "69",
    icon: "./assets/skkuverse-logo.icon",
    googleServicesFile: "./GoogleService-Info.plist",
    associatedDomains: ["applinks:skkuverse.com"],
    entitlements: {
      "aps-environment":
        process.env.APP_ENV === "development" ? "development" : "production",
    },
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: "com.zoyoong.skkubus",
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundColor: "#1f3d2e",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        // `pathPrefix` scopes this to the universal-link namespace. Without it the
        // app claimed EVERY https://skkuverse.com URL — so tapping a link to the
        // privacy policy opened the app, which then whitelist-rejected the path
        // and dropped the user on the home tab. The policy and terms pages were
        // unreachable from a link tap on Android, while iOS excluded them all
        // along via the AASA's `NOT /privacy` / `NOT /terms` rules. This restores
        // the symmetry.
        //
        // The trailing slash is load-bearing: `pathPrefix` is a plain string
        // prefix, so "/p" would still match "/privacy" and change nothing.
        data: [{ scheme: "https", host: "skkuverse.com", pathPrefix: "/p/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "@react-native-firebase/app",
    "@react-native-firebase/auth",
    "@react-native-firebase/crashlytics",
    "@react-native-firebase/app-check",
    "@react-native-firebase/messaging",
    "@react-native-google-signin/google-signin",
    "expo-router",
    "expo-secure-store",
    [
      "expo-build-properties",
      {
        ios: {
          useFrameworks: "static",
          extraPods: [
            { name: "GoogleMobileAdsMediationFacebook" },
          ],
        },
        android: {
          extraMavenRepos: ["https://repository.map.naver.com/archive/maven"],
          dependencies: [
            "com.google.ads.mediation:facebook:6.21.0.1",
          ],
        },
      },
    ],
    "./plugins/withFirebaseModularHeaders",
    "./plugins/withPushNotificationsCapability",
    "./plugins/withLocalizedAppName",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#ffffff",
        image: "./assets/images/transparent_1x1.png",
      },
    ],
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/WantedSans-Regular.otf",
          "./assets/fonts/WantedSans-Medium.otf",
          "./assets/fonts/WantedSans-Bold.otf",
          "./assets/fonts/TossFaceFontMac.ttf",
          "./assets/fonts/IBMPlexSansKR-Bold.ttf",
          "./assets/fonts/IBMPlexSansKR-SemiBold.ttf",
        ],
      },
    ],
    [
      "expo-localization",
      {
        supportedLocales: ["en", "ko", "zh"],
      },
    ],
    [
      "@mj-studio/react-native-naver-map",
      {
        // Committed constant, not an env var. It never varied between dev and
        // release, and reading it from `.env` meant an empty string whenever
        // the file was not present — which on the release paths is *always*,
        // since eas-cli and eoas both evaluate this config with
        // EXPO_NO_DOTENV=1. See `config/constants.js` for why the value is
        // safe in a public repo (Naver binds it to the bundle ID / package).
        client_id: NAVER_MAP_CLIENT_ID,
      },
    ],
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: "ca-app-pub-5619947536545679~7806829793",
        iosAppId: "ca-app-pub-5619947536545679~7068085893",
        skAdNetworkItems: [
          "cstr6suwn9.skadnetwork",
          "22mmun2rn5.skadnetwork",
          "2fnua5tdw4.skadnetwork",
          "2u9pt9hc89.skadnetwork",
          "3qcr597p9d.skadnetwork",
          "3qy4746246.skadnetwork",
          "3rd42ekr43.skadnetwork",
          "3sh42y64q3.skadnetwork",
          "4468km3ulz.skadnetwork",
          "44jx6755aq.skadnetwork",
          "47vhws6wlr.skadnetwork",
          "4dzt52r2t5.skadnetwork",
          "4fzdc2evr5.skadnetwork",
          "578prtvx9j.skadnetwork",
          "7ug5zh24hu.skadnetwork",
          "8c4e2ghe7u.skadnetwork",
          "8s468mfl3y.skadnetwork",
          "97r2b46745.skadnetwork",
          "9t245vhmpl.skadnetwork",
          "a2p9lx4jpn.skadnetwork",
          "c3frkrj4fj.skadnetwork",
          "c6k4g5qg8m.skadnetwork",
          "cp8zw746q7.skadnetwork",
          "e5fvkxwrpn.skadnetwork",
          "f38h382jlk.skadnetwork",
          "gta9lk7p23.skadnetwork",
          "hs6bdukanm.skadnetwork",
          "k674qkevps.skadnetwork",
          "kbd757ywx3.skadnetwork",
          "kbmxgpxpgc.skadnetwork",
          "klf5c3l5u5.skadnetwork",
          "ludvb6z3bs.skadnetwork",
          "mlmmfzh3r3.skadnetwork",
          "n38lu8286q.skadnetwork",
          "p78axxw29g.skadnetwork",
          "ppxm28t8ap.skadnetwork",
          "s39g8k73mm.skadnetwork",
          "su67r6k2v3.skadnetwork",
          "t38b2kh725.skadnetwork",
          "tl55sbb4fm.skadnetwork",
          "uw77j35x4d.skadnetwork",
          "v4nxqhlyqp.skadnetwork",
          "v72qych5uu.skadnetwork",
          "v9wttpbfk9.skadnetwork",
          "vutu7akeur.skadnetwork",
          "wg4vff78zm.skadnetwork",
          "wzmmz9fp6w.skadnetwork",
          "y5ghdn5j9k.skadnetwork",
          "yclnxrl5pm.skadnetwork",
          "ydx93a7ass.skadnetwork",
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
