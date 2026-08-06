#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

# EAS local build must run in a symlink-free directory. macOS temp dirs (/tmp,
# /var/folders) are symlinks under /private/...; in this yarn-workspaces monorepo
# the Metro "Bundle React Native code and images" phase then mismatches the entry
# path (symlink form, e.g. /tmp/...) against the Metro server root (realpath, e.g.
# /private/tmp/...) and fails: "Unable to resolve module .../apps/mobile/index.ts".
# A $HOME-based TMPDIR has no symlink so both paths match. See docs/ios-build-deploy.md.
export TMPDIR="$HOME/.eas-build-tmp"
mkdir -p "$TMPDIR"

IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile beta --local --non-interactive --output "$IPA"
bundle exec fastlane ios upload_beta ipa:"$IPA"
