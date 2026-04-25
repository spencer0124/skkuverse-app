/**
 * Expo config plugin: add Push Notifications system capability to Xcode project.
 *
 * Without SystemCapabilities, Xcode may not include push entitlements in the
 * provisioning profile, causing `aps-environment` to be stripped from the build.
 *
 * The @react-native-firebase/messaging plugin does nothing for iOS,
 * and expo-notifications (which normally adds this) is not installed.
 *
 * NOTE: DevelopmentTeam is NOT set here — EAS build manages signing separately
 * via credentials.json. Setting it here would conflict with EAS code signing.
 */
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withPushNotificationsCapability(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const projectSection = xcodeProject.pbxProjectSection();
    const projectUuid = xcodeProject.getFirstProject().uuid;
    const targetUuid = xcodeProject.getFirstTarget()?.uuid;

    if (!targetUuid || !projectSection[projectUuid]) return config;

    const attributes = projectSection[projectUuid].attributes;
    if (!attributes.TargetAttributes) {
      attributes.TargetAttributes = {};
    }
    if (!attributes.TargetAttributes[targetUuid]) {
      attributes.TargetAttributes[targetUuid] = {};
    }

    // Add Push Notifications capability
    attributes.TargetAttributes[targetUuid].SystemCapabilities = {
      "com.apple.Push": { enabled: 1 },
    };

    return config;
  });
};
