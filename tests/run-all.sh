#!/bin/bash
# Lance tous les tests unitaires.
# Usage : ./tests/run-all.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FILES=""

for test_file in "$SCRIPT_DIR"/test-*.js; do
  echo ""
  echo "═══ $(basename "$test_file") ═══"
  if node "$test_file"; then
    ((TOTAL_PASS++))
  else
    ((TOTAL_FAIL++))
    FAILED_FILES="$FAILED_FILES $(basename "$test_file")"
  fi
done

echo ""
echo "════════════════════════════════"
echo "Suites : $TOTAL_PASS OK, $TOTAL_FAIL en échec"
if [ -n "$FAILED_FILES" ]; then
  echo "Échecs :$FAILED_FILES"
fi
echo "════════════════════════════════"

exit $TOTAL_FAIL
