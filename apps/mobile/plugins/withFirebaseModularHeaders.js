/**
 * Expo config plugin: allow non-modular header includes in framework modules.
 *
 * Fixes: "include of non-modular header inside framework module 'RNFBApp'"
 * when using `useFrameworks: "static"` with @react-native-firebase.
 *
 * The build setting must be applied in the Podfile post_install hook
 * (not just the main xcodeproj) because the error originates in CocoaPods
 * targets (RNFBApp, RNFBAuth), which have their own build configurations.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      // Inject into post_install hook to set the flag on ALL pod targets
      const snippet = `
    # [withFirebaseModularHeaders] Allow non-modular includes for Firebase
    installer.pods_project.build_configurations.each do |config|
      config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
    end
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end`;

      // Insert before the closing 'end' of post_install
      if (podfile.includes("post_install do |installer|")) {
        podfile = podfile.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|${snippet}`,
        );
      }

      fs.writeFileSync(podfilePath, podfile, "utf8");
      return config;
    },
  ]);
};
