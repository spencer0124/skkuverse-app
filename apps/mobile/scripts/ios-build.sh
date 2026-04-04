#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
IPA="./build.ipa"
rm -f "$IPA"
eas build --platform ios --profile production --local --non-interactive --output "$IPA"
echo "Build: $IPA"
