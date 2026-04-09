#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile beta --local --non-interactive --output "$IPA"
bundle exec fastlane ios upload_beta ipa:"$IPA"
