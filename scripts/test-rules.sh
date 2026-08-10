#!/usr/bin/env bash
# Firestore security rules tests — one command on macOS and on a Linux runner.
#
# ADR 0005 makes these rules the only enforcement boundary for user data, so
# the suite has to be runnable by CI rather than by one laptop. It used to
# carry a literal /opt/homebrew/opt/openjdk@25/... path in package.json, which
# named both a Homebrew Cellar layout and a major version that `brew upgrade`
# moves — and which no Linux runner has at all.
#
# firebase-tools refuses to start the emulator on anything below Java 21. Two
# things on a normal macOS box make "just find a JDK" wrong, and both were
# observed here rather than guessed:
#
#   1. JAVA_HOME is often already exported and pointing at JDK 17, because the
#      Android toolchain needs 17. Honouring it unconditionally picks the one
#      JDK that cannot run the emulator.
#   2. `/usr/libexec/java_home -v 21+` returns JDK 17 on a machine whose newest
#      registered JVM is 17. The `+` is not the filter it looks like, so the
#      locator's answer cannot be trusted without checking it.
#
# So every candidate is probed for its real major version and the first one
# that is actually >= 21 wins. Homebrew's `openjdk` is asked for by name rather
# than spelled out, so a version bump moves the answer instead of breaking it;
# note it is keg-only, which is why /usr/libexec/java_home never lists it.
#
# Failure is a sentence naming what was found, not a Java stack trace.
set -euo pipefail

readonly REQUIRED_MAJOR=21

# Prints the major version of the JDK at $1, or nothing if it is not a JDK.
# Handles every format in the wild: "25", "17.0.15", and "1.8.0_372".
java_major() {
  local home="$1" line ver major rest
  [ -n "$home" ] && [ -x "$home/bin/java" ] || return 0
  line=$("$home/bin/java" -version 2>&1 | head -1) || return 0
  ver=$(printf '%s' "$line" | sed -n 's/.*version "\([^"]*\)".*/\1/p')
  [ -n "$ver" ] || return 0
  major=${ver%%.*}
  if [ "$major" = "1" ]; then
    rest=${ver#1.}
    major=${rest%%.*}
  fi
  printf '%s' "$major"
}

candidates=(
  "${JAVA_HOME:-}"
  "$(/usr/libexec/java_home -v "$REQUIRED_MAJOR+" 2>/dev/null || true)"
  "$(brew --prefix openjdk 2>/dev/null || true)/libexec/openjdk.jdk/Contents/Home"
  "$(brew --prefix "openjdk@$REQUIRED_MAJOR" 2>/dev/null || true)/libexec/openjdk.jdk/Contents/Home"
)
if command -v java >/dev/null 2>&1; then
  candidates+=("$(dirname "$(dirname "$(command -v java)")")")
fi

found=""
rejected=""
for candidate in "${candidates[@]}"; do
  major=$(java_major "$candidate")
  [ -n "$major" ] || continue
  if [ "$major" -ge "$REQUIRED_MAJOR" ]; then
    found="$candidate"
    break
  fi
  rejected="$rejected  Java $major at $candidate"$'\n'
done

if [ -z "$found" ]; then
  echo "error: the Firestore emulator needs Java $REQUIRED_MAJOR or newer and none was found." >&2
  if [ -n "$rejected" ]; then
    printf 'Rejected:\n%s' "$rejected" >&2
  fi
  echo "  macOS: brew install openjdk" >&2
  echo "  CI:    actions/setup-java@v4" >&2
  exit 1
fi

export JAVA_HOME="$found"
export PATH="$JAVA_HOME/bin:$PATH"

exec firebase emulators:exec --only firestore \
  "node --test apps/mobile/firestore.rules.test.mjs"
