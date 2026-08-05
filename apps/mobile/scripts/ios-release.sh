#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# EAS local build must run in a symlink-free dir (see ios-beta.sh / docs for why).
export TMPDIR="$HOME/.eas-build-tmp"
mkdir -p "$TMPDIR"
IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile production --local --non-interactive --output "$IPA"
bundle exec fastlane ios upload_release ipa:"$IPA"
