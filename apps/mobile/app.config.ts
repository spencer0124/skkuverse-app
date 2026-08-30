import { ExpoConfig, ConfigContext } from "expo/config";
import { NAVER_MAP_CLIENT_ID, PROD_API_URL } from "./config/constants";

// Substrings that only ever appear in a host living on a developer's machine.
// `localhost` and `127.0.0.1` resolve to the phone itself once the bundle is on
// a device, and `10.0.2.2` is the Android emulator's alias for the host
// loopback, so all three are unreachable from a real install. `http://` is here
// too: every deployed API host is https, so a plaintext scheme is a dev-server
// tell no matter what follows it.
const LOCAL_HOST_MARKERS = ["localhost", "127.0.0.1", "10.0.2.2", "http://"];

// The profiles whose artifacts leave this machine. A native build announces
// itself through EAS_BUILD_PROFILE; an OTA publish never touches EAS, so
// `scripts/ota-{beta,release}.sh` announce themselves through RELEASE_CHANNEL.
// Checking only the first is what let two OTA publishes ship with no API host
// at all — see resolveBaseUrl below.
const SHIPPING_PROFILES = ["beta", "production"];

/** The profile this evaluation is shipping under, from either signal. */
function shippingProfile(): string | undefined {
  const profile = process.env.EAS_BUILD_PROFILE ?? process.env.RELEASE_CHANNEL;
  return profile !== undefined && SHIPPING_PROFILES.includes(profile)
    ? profile
    : undefined;
}

/**
 * Resolves the value that goes into `extra.baseUrl`.
 *
 * **On a shipping profile the environment variable is not consulted at all** —
 * not defaulted, not validated, ignored. This tree used to read
 * `process.env.EXPO_PUBLIC_BASE_URL` bare, and `packages/shared/src/api/config.ts`
 * falls back to the retired `api.skkuuniverse.com` when `extra.baseUrl` is
 * missing. So an OTA published with the variable unset silently pointed every
 * install at a dead host. That has already happened twice, on the 1.0.0 and
 * 3.5.0 runtime channels.
 *
 * Off a shipping profile the variable is an optional local override.
 */
function resolveBaseUrl(): string {
  const profile = shippingProfile();

  if (profile !== undefined) {
    // Unreachable by construction while PROD_API_URL is a real https host, and
    // kept precisely for that reason: if it ever fires, the committed constant
    // has been edited into something that must not ship.
    const localMarker = LOCAL_HOST_MARKERS.find((marker) =>
      PROD_API_URL.toLowerCase().includes(marker),
    );
    if (localMarker !== undefined) {
      throw new Error(
        `PROD_API_URL is "${PROD_API_URL}", which points at a local ` +
          `development host (matched on "${localMarker}"), but the build ` +
          `profile is "${profile}" — an artifact from that profile goes to ` +
          "real users, whose phones cannot reach it. Fix the constant in " +
          "apps/mobile/config/constants.js.",
      );
    }
    return PROD_API_URL;
  }

  // Trimmed, because `''` and `'  '` both mean the substitution never happened.
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
    baseUrl: resolveBaseUrl(),
    env: process.env.EXPO_PUBLIC_ENV,
    // Debug-only. Surfaced so app-check.ts can pass it into
    // provider.configure({ debugToken }) — RN Firebase then setenv()'s
    // FIRAAppCheckDebugToken, which is the only App Check debug-token
    // injection path that reliably works on iOS Simulator (UserDefaults
    // fallback is silently ignored for unclear reasons — likely GULUserDefaults
    // caching interaction).
    //
    // Guard: stripped from beta / production bundles so the debug token
    // does NOT end up shipped to TestFlight or App Store builds of a
    // public repo. In those builds __DEV__ is false and the provider is
    // App Attest / Play Integrity anyway, so the debug token would be
    // dead weight even if present — but defense in depth.
    //
    // DEFAULT-DENY, and read why before loosening it. This used to test
    // EAS_BUILD_PROFILE alone, i.e. it INCLUDED the tokens whenever that
    // variable was unset — and an OTA publish never sets it, because eoas does
    // not go through EAS. `scripts/ota-{beta,release}.sh` export
    // RELEASE_CHANNEL instead and `source .env`, so both debug tokens would
    // have been written into the manifest at ota.skkuverse.com, which is
    // public. A registered debug token mints valid App Check tokens and
    // bypasses App Attest / Play Integrity outright.
    ...(shippingProfile() !== undefined
      ? {}
      : {
          firebaseAppCheckDebugTokenIos:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_IOS,
          firebaseAppCheckDebugTokenAndroid:
            process.env.FIREBASE_APP_CHECK_DEBUG_TOKEN_ANDROID,
        }),
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
        data: [{ scheme: "https", host: "skkuverse.com" }],
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
        // Committed constant, not an env var. It never varied between dev
        // and release, and reading it from `.env` meant an empty string
        // whenever the file did not carry it — which is now always, since the
        // value moved into config/constants.js on the current tree.
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
