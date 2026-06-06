import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  owner: "seungyongcho",
  version: "3.6.0",
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
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL,
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
    ...(process.env.EAS_BUILD_PROFILE === "beta" ||
    process.env.EAS_BUILD_PROFILE === "production"
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
      // Required for 1.5GB GGUF model resident in memory (prevents jetsam OOM-kill).
      // Both enabled on App ID "Additional Capabilities" + carried by the
      // "skkuverse 2" distribution provisioning profile (./certs/dist.mobileprovision).
      // TODO: remove if GGUF eval experiment is dropped.
      "com.apple.developer.kernel.increased-memory-limit": true,
      "com.apple.developer.kernel.extended-virtual-addressing": true,
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
          // Bumped 15.1 -> 18.0: AnemllCore (ANE LLM runtime) declares .iOS(.v18),
          // so SwiftPM refuses to link it into a lower-deployment target.
          // Eval-branch tradeoff (drops iOS 15-17); revisit before shipping.
          deploymentTarget: "18.0",
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
    // Wires the Anemll ANE runtime into the app target: AnemllCore SwiftPM (vendor/anemll
    // submodule) + AnemllEngineImpl.swift. The Anemll Expo-module pod reaches it at runtime
    // (split bridge). See plugin header for the SPM-only/static-frameworks rationale.
    "./plugins/withAnemllAppTarget",
    [
      "llama.rn",
      {
        // forceCxx20: C++20 required by llama.cpp (llama.rn ≥ 0.10.1)
        forceCxx20: true,
        // enableEntitlements: adds com.apple.developer.kernel.increased-memory-limit
        // — critical for 1.5 GB resident model on iOS (prevents jetsam OOM-kill).
        // Verify generated ios/*.entitlements after prebuild.
        // TODO: revisit if we drop the GGUF eval experiment.
        enableEntitlements: true,
        // enableOpenCL: Android GPU acceleration — deferred until Android eval phase
        // enableOpenCL: true,
      },
    ],
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
        client_id: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? "",
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
