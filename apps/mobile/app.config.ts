import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  version: "3.5.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "skkubus",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  runtimeVersion: "1.0.0",
  updates: {
    url: "https://ota.skkuuniverse.com/manifest",
    enabled: true,
    fallbackToCacheTimeout: 30000,
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
      "@mj-studio/react-native-naver-map",
      {
        client_id: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? "",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
