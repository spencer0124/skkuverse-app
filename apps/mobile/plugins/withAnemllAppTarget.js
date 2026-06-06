/**
 * Expo config plugin: wire the Anemll ANE runtime into the **app target**.
 *
 * Two things, both on the app target (NOT a pod), because AnemllCore is an SPM-only
 * package whose 16-package graph (swift-transformers/nio/crypto/...) builds cleanly only
 * on the app target — CocoaPods can't build SPM products for a pod target. Verified by
 * a simulator link build under `use_frameworks! :linkage => :static`.
 *
 *   1. Link the local SwiftPM package `AnemllCore` (vendor/anemll submodule) to the app
 *      target: XCLocalSwiftPackageReference + product dependency + Frameworks build file.
 *   2. Add `native/ios/AnemllEngineImpl.swift` (imports AnemllCore) to the app target
 *      sources. It implements the `AnemllEngine` protocol from the Anemll pod and is
 *      resolved at runtime by AnemllModule (pod) via NSClassFromString — the "split
 *      bridge" that lets the Expo-registered pod reach the app-target runtime.
 *
 * `ios/` is gitignored (Expo CNG), so paths are relative to the generated ios/ dir.
 */
const { withXcodeProject } = require("expo/config-plugins");

const PACKAGE_REL_PATH = "../vendor/anemll/anemll-swift-cli";
const PRODUCT_NAME = "AnemllCore";
const IMPL_REL_PATH = "../native/ios/AnemllEngineImpl.swift";

function ensureSection(objects, name) {
  if (!objects[name]) objects[name] = {};
  return objects[name];
}

module.exports = function withAnemllAppTarget(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;
    const objects = project.hash.project.objects;
    const targetUuid = project.getFirstTarget().uuid;
    const nativeTarget = project.pbxNativeTargetSection()[targetUuid];

    // ── 1. AnemllCore local SwiftPM package on the app target ──
    const existingProd = objects["XCSwiftPackageProductDependency"] || {};
    const hasProduct = Object.keys(existingProd).some(
      (k) => !k.endsWith("_comment") && existingProd[k] && existingProd[k].productName === PRODUCT_NAME,
    );
    if (!hasProduct) {
      const pkgRefUuid = project.generateUuid();
      const prodDepUuid = project.generateUuid();
      const buildFileUuid = project.generateUuid();
      const pkgComment = `XCLocalSwiftPackageReference "${PACKAGE_REL_PATH}"`;
      const fwComment = `${PRODUCT_NAME} in Frameworks`;

      const localPkgSection = ensureSection(objects, "XCLocalSwiftPackageReference");
      localPkgSection[pkgRefUuid] = {
        isa: "XCLocalSwiftPackageReference",
        relativePath: `"${PACKAGE_REL_PATH}"`,
      };
      localPkgSection[`${pkgRefUuid}_comment`] = pkgComment;

      const prodSection = ensureSection(objects, "XCSwiftPackageProductDependency");
      prodSection[prodDepUuid] = {
        isa: "XCSwiftPackageProductDependency",
        productName: PRODUCT_NAME,
      };
      prodSection[`${prodDepUuid}_comment`] = PRODUCT_NAME;

      const pbxProject = project.pbxProjectSection()[project.getFirstProject().uuid];
      if (!pbxProject.packageReferences) pbxProject.packageReferences = [];
      pbxProject.packageReferences.push({ value: pkgRefUuid, comment: pkgComment });

      if (!nativeTarget.packageProductDependencies) nativeTarget.packageProductDependencies = [];
      nativeTarget.packageProductDependencies.push({ value: prodDepUuid, comment: PRODUCT_NAME });

      const buildFileSection = ensureSection(objects, "PBXBuildFile");
      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        productRef: prodDepUuid,
        productRef_comment: PRODUCT_NAME,
      };
      buildFileSection[`${buildFileUuid}_comment`] = fwComment;

      const fwSection = objects["PBXFrameworksBuildPhase"] || {};
      for (const bp of nativeTarget.buildPhases || []) {
        if (fwSection[bp.value]) {
          const phase = fwSection[bp.value];
          if (!phase.files) phase.files = [];
          phase.files.push({ value: buildFileUuid, comment: fwComment });
          break;
        }
      }
    }

    // ── 2. Add AnemllEngineImpl.swift to the app target sources ──
    const refSection = objects["PBXFileReference"] || {};
    const hasImpl = Object.keys(refSection).some(
      (k) => typeof refSection[k] === "object" && JSON.stringify(refSection[k]).includes("AnemllEngineImpl.swift"),
    );
    if (!hasImpl) {
      const mainGroupKey = project.getFirstProject().firstProject.mainGroup;
      project.addSourceFile(
        IMPL_REL_PATH,
        { target: targetUuid, sourceTree: "SOURCE_ROOT" },
        mainGroupKey,
      );
    }

    return config;
  });
};
