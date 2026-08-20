#!/usr/bin/env bash
# Firestore security rules tests — one command on macOS and on a Linux runner.
#
# ADR 0005 makes these rules the only enforcement boundary for user data, so
# the suite has to be runnable by CI rather than by one laptop. It used to
# carry a literal /opt/homebrew/opt/openjdk@25/... path in package.json, which
# named both a Homebrew Cellar layout and a major version that `brew upgrade`
# moves — and which no Linux runner has at all.
#
# The JDK probe that makes that portable lives in scripts/find-jdk.sh, because
# the functions emulator verifier needs exactly the same thing.
set -euo pipefail

# shellcheck source=scripts/find-jdk.sh
source "$(dirname "${BASH_SOURCE[0]}")/find-jdk.sh"

exec firebase emulators:exec --only firestore \
  "node --test apps/mobile/firestore.rules.test.mjs"
