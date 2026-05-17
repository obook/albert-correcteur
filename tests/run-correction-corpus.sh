#!/usr/bin/env bash
# run-correction-corpus.sh - Mesure le taux de détection des fautes par modèle.
#
# Envoie chaque phrase du corpus correction-samples.json à plusieurs
# modèles Albert et compare les mots détectés à la liste attendue. Permet
# d'objectiver la qualité d'un prompt système ou de comparer les modèles.
#
# Usage :
#   ALBERT_API_KEY=sk-xxx ./tests/run-correction-corpus.sh
#   ALBERT_API_KEY=sk-xxx ./tests/run-correction-corpus.sh openweight-medium
#
# La clé API se passe UNIQUEMENT via la variable d'environnement (cela
# évite les conflits avec l'argument positionnel et l'apparition de la
# clé dans l'historique du shell). L'argument positionnel optionnel
# limite le test à un seul modèle (sinon, les 3 alias chat sont
# parcourus).

set -euo pipefail

API_KEY="${ALBERT_API_KEY:-}"
# Trim espaces, tabulations, retours chariot que le copier-coller introduit.
API_KEY="$(printf '%s' "$API_KEY" | tr -d '[:space:]')"
if [ -z "$API_KEY" ]; then
    echo "Erreur : variable d'environnement ALBERT_API_KEY non définie." >&2
    echo "Usage : ALBERT_API_KEY=sk-xxx $0 [modèle]" >&2
    exit 1
fi

# Modèle à tester (premier argument positionnel), ou tous par défaut.
SINGLE_MODEL="${1:-}"
DEFAULT_MODELS=("openweight-large" "openweight-medium" "openweight-small")
if [ -n "$SINGLE_MODEL" ]; then
    MODELS=("$SINGLE_MODEL")
else
    MODELS=("${DEFAULT_MODELS[@]}")
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CORPUS_FILE="$SCRIPT_DIR/corpus/correction-samples.json"
PROMPT_FULL="$PROJECT_DIR/sources-commun/prompts/correction.txt"
PROMPT_LARGE="$PROJECT_DIR/sources-commun/prompts/correction-large.txt"
API_URL="https://albert.api.etalab.gouv.fr/v1/chat/completions"

# Limites rpm documentées sur le palier EXP d'Albert (source :
# sources-commun/popup-configuration/popup-limits.js). On respecte la
# valeur la plus basse pour ne pas faire sauter le quota pendant la
# campagne de mesure, même si le compte est en PROD avec un rpm plus
# élevé : c'est cher en temps d'attente mais robuste à 100 %.
rpm_for_model() {
    case "$1" in
        openweight-large)  echo 10 ;;
        openweight-medium) echo 50 ;;
        openweight-small)  echo 50 ;;
        *)                 echo 10 ;;
    esac
}

for dep in jq curl; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        echo "Erreur : '$dep' est requis." >&2
        exit 1
    fi
done

# Le prompt utilisé pour un modèle donné, conformément à
# service-prompts.js correctionPromptName().
prompt_for_model() {
    local model="$1"
    if [ "$model" = "openweight-large" ]; then
        cat "$PROMPT_LARGE"
    else
        cat "$PROMPT_FULL"
    fi
}

# Remplace {{LANG}} par "français" puis encode en JSON pour le body.
build_system_prompt() {
    local model="$1"
    prompt_for_model "$model" | sed 's/{{LANG}}/français/g'
}

# Interroge l'API pour une phrase et un modèle, renvoie la liste des
# mots détectés (un par ligne) ou rien en cas d'erreur. Sur erreur
# d'authentification (clé invalide), termine immédiatement le script.
query_model() {
    local model="$1"
    local text="$2"
    local system
    system="$(build_system_prompt "$model")"

    local body
    body=$(jq -n \
        --arg model "$model" \
        --arg sys "$system" \
        --arg user "$text" \
        '{
            model: $model,
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: $sys },
                { role: "user", content: $user }
            ]
        }')

    local response
    response=$(curl -sS \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$body" \
        "$API_URL" 2>/dev/null || true)

    # En cas d'erreur HTTP/réseau, on signale et on renvoie vide.
    if echo "$response" | jq -e '.error // .detail' >/dev/null 2>&1; then
        local err_msg
        err_msg=$(echo "$response" | jq -r '.error // .detail | tostring')
        echo "" >&2
        echo "[ERREUR] $model : $err_msg" >&2
        # Auth invalide : inutile de continuer, on arrête tout.
        case "$err_msg" in
            *"Invalid API key"*|*"invalid_api_key"*|*"Unauthorized"*|*"401"*)
                echo "Clé API rejetée par Albert. Arrêt." >&2
                exit 1
                ;;
        esac
        return
    fi

    echo "$response" | jq -r '
        try (.choices[0].message.content
            | fromjson
            | .corrections[]?.word) catch empty
    '
}

# Compare deux ensembles de mots (attendus vs détectés) en
# insensible-à-la-casse, et imprime "<détectés>/<attendus>".
score() {
    local expected="$1"
    local detected="$2"

    if [ -z "$expected" ]; then
        # Aucune erreur attendue : score = 1 si rien détecté, 0 sinon
        if [ -z "$detected" ]; then
            echo "OK (aucune faute attendue, aucune détectée)"
        else
            local n_detected
            n_detected=$(echo "$detected" | wc -l)
            echo "FAUX POSITIFS : $n_detected mot(s) détecté(s) à tort ($(echo "$detected" | tr '\n' ',' | sed 's/,$//'))"
        fi
        return
    fi

    local n_expected found=0
    n_expected=$(echo "$expected" | wc -l)

    while IFS= read -r word; do
        if echo "$detected" | grep -iqxF "$word"; then
            ((found++))
        fi
    done <<< "$expected"

    echo "$found/$n_expected"
}

# Boucle principale
total_samples=$(jq '.samples | length' "$CORPUS_FILE")
echo "Corpus : $total_samples phrases"
echo "Modèles : ${MODELS[*]}"
echo "════════════════════════════════════════════════════════════════"

for model in "${MODELS[@]}"; do
    echo ""
    echo "─── $model ───"
    total_expected=0
    total_found=0
    fp_count=0

    # Délai entre deux requêtes pour respecter le rpm du modèle.
    # +1s de marge sur le slot théorique (60/rpm) pour absorber un
    # éventuel décalage d'horloge côté serveur.
    rpm=$(rpm_for_model "$model")
    sleep_seconds=$(awk -v r="$rpm" 'BEGIN { printf "%d", (60.0 / r) + 1 }')
    echo "  (rpm=$rpm -> pause de ${sleep_seconds}s entre chaque requête)"

    for i in $(seq 0 $((total_samples - 1))); do
        sample=$(jq -c ".samples[$i]" "$CORPUS_FILE")
        id=$(echo "$sample" | jq -r '.id')
        text=$(echo "$sample" | jq -r '.text')
        expected_words=$(echo "$sample" | jq -r '.expected[]?.word')

        # Pause avant chaque requête sauf la première du modèle.
        if [ "$i" -gt 0 ]; then
            sleep "$sleep_seconds"
        fi

        detected_words=$(query_model "$model" "$text")
        result=$(score "$expected_words" "$detected_words")

        printf "  %-30s %s\n" "$id" "$result"

        # Stats agrégées : on ignore les phrases sans faute pour le ratio.
        if [ -n "$expected_words" ]; then
            n_expected=$(echo "$expected_words" | wc -l)
            n_found=$(echo "$result" | cut -d/ -f1 || echo 0)
            total_expected=$((total_expected + n_expected))
            total_found=$((total_found + n_found))
        elif echo "$result" | grep -q FAUX; then
            ((fp_count++))
        fi
    done

    if [ "$total_expected" -gt 0 ]; then
        pct=$(( total_found * 100 / total_expected ))
        echo "  --------------------------------"
        echo "  Détection : $total_found / $total_expected ($pct %)"
    fi
    if [ "$fp_count" -gt 0 ]; then
        echo "  Phrases avec faux positifs : $fp_count"
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
