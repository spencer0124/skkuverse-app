import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "스꾸버스",
  slug: "skkubus",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "skkubus",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  extra: {
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL,
    env: process.env.EXPO_PUBLIC_ENV,
  },
  ios: {
    bundleIdentifier: "com.example.skkumap",
    supportsTablet: false,
  },
  android: {
    package: "com.zoyoong.skkubus",
    adaptiveIcon: {
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      backgroundColor: "#ffffff",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
