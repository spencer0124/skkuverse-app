#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
set -a
source .env.ota.local
set +a
RELEASE_CHANNEL=production npx eoas publish --branch production --nonInteractive --platform ios
RELEASE_CHANNEL=production npx eoas publish --branch production --nonInteractive --platform android
