#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .env.ota.local
RELEASE_CHANNEL=production npx eoas publish --branch production --nonInteractive --platform ios
