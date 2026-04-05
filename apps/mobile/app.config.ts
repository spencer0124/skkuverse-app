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
  // runtimeVersion is set per-platform below (ios/android) to ensure
  // EAS build and eoas publish use matching platform-specific fingerprints
  updates: {
    url: "https://ota.skkuverse.com/manifest",
    enabled: true,
    fallbackToCacheTimeout: 0,
    requestHeaders: {
      "expo-channel-name": "production",
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
    runtimeVersion: { policy: "fingerprint" },
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
    runtimeVersion: { policy: "fingerprint" },
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
        },
        android: {
          extraMavenRepos: ["https://repository.map.naver.com/archive/maven"],
        },
      },
    ],
    "./plugins/withFirebaseModularHeaders",
    "./plugins/withLocalizedAppName",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
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
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
