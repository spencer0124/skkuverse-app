import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  owner: "seungyongcho",
  version: "3.5.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "skkuverse",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  runtimeVersion: "3.5.0",
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
    eas: {
      projectId: "43e326a2-2f25-4317-a341-a107a52c5405",
    },
  },
  ios: {
    bundleIdentifier: "com.example.skkumap",
    supportsTablet: true,
    buildNumber: "69",
    googleServicesFile: "./GoogleService-Info.plist",
    associatedDomains: ["applinks:skkuverse.com"],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.zoyoong.skkubus",
    googleServicesFile: "./google-services.json",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      backgroundColor: "#ffffff",
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
