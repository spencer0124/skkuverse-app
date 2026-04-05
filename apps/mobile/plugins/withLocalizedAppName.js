/**
 * Expo config plugin: localized app display name.
 *
 * Creates locale-specific resources so the OS shows the correct app name
 * based on the device language.
 *
 * iOS  → <lang>.lproj/InfoPlist.strings with CFBundleDisplayName
 * Android → values-<lang>/strings.xml with app_name
 *
 * Flutter source: ios/<lang>.lproj/InfoPlist.strings,
 *                 android/app/src/main/res/values-<lang>/strings.xml
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** locale → display name (matching the Flutter project) */
const LOCALIZED_NAMES = {
  en: "SKKU BUS",
  ko: "스꾸버스",
  zh: "成均館 公交",
};

function withLocalizedAppNameIOS(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const iosRoot = path.join(config.modRequest.platformProjectRoot, "..");

      for (const [locale, name] of Object.entries(LOCALIZED_NAMES)) {
        const lprojDir = path.join(
          iosRoot,
          locale === "zh" ? "zh-Hans.lproj" : `${locale}.lproj`
        );
        fs.mkdirSync(lprojDir, { recursive: true });

        const content = `CFBundleDisplayName = "${name}";\n`;
        fs.writeFileSync(path.join(lprojDir, "InfoPlist.strings"), content);
      }

      return config;
    },
  ]);
}

function withLocalizedAppNameAndroid(config) {
  return withDangerousMod(config, [
    "android",
    (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res"
      );

      for (const [locale, name] of Object.entries(LOCALIZED_NAMES)) {
        // Default values/ is written by Expo from config.name — only add locale overrides
        if (locale === "ko") continue;

        const suffix = locale === "zh" ? "zh-rCN" : locale;
        const valuesDir = path.join(resDir, `values-${suffix}`);
        fs.mkdirSync(valuesDir, { recursive: true });

        const xml = [
          '<?xml version="1.0" encoding="utf-8"?>',
          "<resources>",
          `    <string name="app_name">${name}</string>`,
          "</resources>",
          "",
        ].join("\n");
        fs.writeFileSync(path.join(valuesDir, "strings.xml"), xml);
      }

      return config;
    },
  ]);
}

module.exports = function withLocalizedAppName(config) {
  config = withLocalizedAppNameIOS(config);
  config = withLocalizedAppNameAndroid(config);
  return config;
};
