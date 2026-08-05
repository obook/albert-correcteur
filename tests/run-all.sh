#!/bin/bash
#
# Nom : run-all.sh
# Description : lance toutes les suites de tests unitaires et
#               rapporte le total, sans s'arrêter au premier échec.
# Auteur : O. Booklage
# Date : avril 2026
# Licence : MIT
#
# Usage : ./tests/run-all.sh
#
# set -e est volontairement absent de la boucle : un test en échec doit
# être compté puis la boucle continuer. Les incréments passent par
# $((...)) plutôt que ((...)), qui renvoie un code de sortie non nul
# quand le compteur vaut encore zéro.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOTAL_PASS=0
TOTAL_FAIL=0
FAILED_FILES=""

for test_file in "$SCRIPT_DIR"/test-*.js; do
  echo ""
  echo "═══ $(basename "$test_file") ═══"
  if node "$test_file"; then
    TOTAL_PASS=$((TOTAL_PASS + 1))
  else
    TOTAL_FAIL=$((TOTAL_FAIL + 1))
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
