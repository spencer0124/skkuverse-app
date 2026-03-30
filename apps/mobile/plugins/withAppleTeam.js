/**
 * Expo config plugin: auto-set Xcode signing team on prebuild.
 *
 * Sets DEVELOPMENT_TEAM and CODE_SIGN_STYLE in every build configuration
 * of the main app target so `expo prebuild --clean` doesn't wipe the
 * signing settings.
 */
const { withXcodeProject } = require("expo/config-plugins");

const DEVELOPMENT_TEAM = "95HGXTX76L";

module.exports = function withAppleTeam(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const pbxProject = project.pbxProjectSection();

    for (const key of Object.keys(pbxProject)) {
      const entry = pbxProject[key];
      if (!entry.buildConfigurationList) continue;

      const configList = project.pbxXCConfigurationList()[entry.buildConfigurationList];
      if (!configList?.buildConfigurations) continue;

      for (const { value } of configList.buildConfigurations) {
        const buildConfig = project.pbxXCBuildConfigurationSection()[value];
        if (!buildConfig?.buildSettings) continue;

        buildConfig.buildSettings.DEVELOPMENT_TEAM = DEVELOPMENT_TEAM;
        buildConfig.buildSettings.CODE_SIGN_STYLE = "Automatic";
      }
    }

    return config;
  });
};
