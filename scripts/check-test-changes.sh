#!/usr/bin/env bash
# Fails when a branch removes or rewrites lines in existing tests.
#
#   scripts/check-test-changes.sh [base]      (default base: origin/main)
#
# Compares the branch with where it left base (git diff base...HEAD). Adding is
# fine: new test files, new tests, new checks in a test. Any removed line in a
# test file (a rewritten line counts as removed + added, a deleted file as all
# lines removed) is listed and the script exits 1.
set -euo pipefail

base="${1:-origin/main}"

test_files=(
  ':(glob)**/*.spec.ts'
  ':(glob)**/*.int-spec.ts'
  ':(glob)**/*.test.tsx'
  'apps/frontend/e2e'
)

numstat="$(git diff --numstat "$base"...HEAD -- "${test_files[@]}")"

if [ -z "$numstat" ]; then
  echo "No test files changed compared with $base."
  exit 0
fi

echo "Test files changed compared with $base (added / removed lines):"
changed=()
while IFS=$'\t' read -r added removed path; do
  printf '  +%-5s -%-5s %s\n' "$added" "$removed" "$path"
  # "-" means a binary file; treat it as changed.
  if [ "$removed" != "0" ]; then
    changed+=("$path")
  fi
done <<< "$numstat"

if [ "${#changed[@]}" -eq 0 ]; then
  echo "OK: lines were only added."
  exit 0
fi

echo
echo "These test files have removed or rewritten lines:"
for path in "${changed[@]}"; do
  echo "  $path"
  echo "::error file=$path::Existing test lines were removed or rewritten"
done
echo
echo "Existing tests are the quality gate: change the code, not the test."
echo "If the change is intended, explain it in the PR; this check doesn't block the merge."
exit 1
