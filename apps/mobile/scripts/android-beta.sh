#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
AAB="./build.aab"
rm -f "$AAB"
eas build --platform android --profile production --local --non-interactive --output "$AAB"
bundle exec fastlane android upload_beta aab:"$AAB"
