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
# ALBERT_PROMPT remplace ce prompt pour comparer deux versions (ex. correction-complet.txt).
PROMPT_FULL="${ALBERT_PROMPT:-$PROJECT_DIR/sources-commun/prompts/correction.txt}"
PROMPT_LARGE="$PROJECT_DIR/sources-commun/prompts/correction-large.txt"
# URL paramétrable via ALBERT_API_BASE pour tester contre une instance
# alternative (mirroring, dev). Par défaut : l'API publique de l'État.
API_BASE="${ALBERT_API_BASE:-https://albert.api.etalab.gouv.fr}"
API_URL="${API_BASE%/}/v1/chat/completions"

# Limites rpm et tpm documentées sur le palier EXP d'Albert (source :
# sources-commun/popup-configuration/popup-limits.js). On respecte la
# valeur la plus basse pour ne pas faire sauter le quota pendant la
# campagne de mesure, même si le compte est en PROD avec des limites
# plus élevées : c'est cher en temps d'attente mais robuste à 100 %.
rpm_for_model() {
    case "$1" in
        openweight-large)  echo 10 ;;
        openweight-medium) echo 50 ;;
        openweight-small)  echo 50 ;;
        *)                 echo 10 ;;
    esac
}

tpm_for_model() {
    case "$1" in
        openweight-large)  echo 128000 ;;
        openweight-medium) echo 128000 ;;
        openweight-small)  echo 128000 ;;
        *)                 echo 128000 ;;
    esac
}

# Estimation grossière de la taille d'une requête en tokens (prompt
# système enrichi + texte utilisateur + réponse). Le prompt de
# correction étoffé fait ~5500 tokens à lui seul. Surévalué exprès pour
# garder une marge contre le 429 tpm.
TOKENS_PER_REQUEST_EST=6500

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
# mots détectés (un par ligne) ou rien en cas d'erreur. Sur 429 (rate
# limit), retente jusqu'à MAX_RETRIES fois en respectant un délai
# adaptatif. Sur erreur d'authentification, termine le script.
MAX_RETRIES=3

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

    local attempt=0
    while [ "$attempt" -lt "$MAX_RETRIES" ]; do
        attempt=$((attempt + 1))
        local response
        response=$(curl -sS \
            -H "Authorization: Bearer $API_KEY" \
            -H "Content-Type: application/json" \
            -d "$body" \
            "$API_URL" 2>/dev/null || true)

        # Pas d'erreur : on extrait les corrections et on sort.
        if ! echo "$response" | jq -e '.error // .detail' >/dev/null 2>&1; then
            echo "$response" | jq -r '
                try (.choices[0].message.content
                    | fromjson
                    | .corrections[]?.word) catch empty
            '
            return
        fi

        local err_msg
        err_msg=$(echo "$response" | jq -r '.error // .detail | tostring')

        # Auth invalide : on arrête tout.
        case "$err_msg" in
            *"Invalid API key"*|*"invalid_api_key"*|*"Unauthorized"*|*"401"*)
                echo "" >&2
                echo "[ERREUR] $model : $err_msg" >&2
                echo "Clé API rejetée par Albert. Arrêt." >&2
                exit 1
                ;;
        esac

        # Rate limit : on temporise puis on retente.
        case "$err_msg" in
            *"rate"*|*"limit"*|*"per minute"*|*"per day"*|*"429"*|*"tokens"*|*"requests"*)
                local backoff=$((10 * attempt))
                echo "" >&2
                echo "[RATE LIMIT $attempt/$MAX_RETRIES] $model : $err_msg" >&2
                echo "[ATTENTE] ${backoff}s puis nouvelle tentative" >&2
                sleep "$backoff"
                continue
                ;;
        esac

        # Autre erreur : on abandonne cette phrase.
        echo "" >&2
        echo "[ERREUR] $model : $err_msg" >&2
        return
    done

    echo "" >&2
    echo "[ABANDON] $model : $MAX_RETRIES tentatives échouées" >&2
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
            # Forme arithmétique plutôt que ((found++)) : ce dernier
            # renvoie le code de sortie 1 quand found=0 (post-incrément
            # qui retourne l'ancienne valeur), ce qui termine le script
            # via set -e.
            found=$((found + 1))
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

    # Délai entre deux requêtes : on respecte rpm ET tpm, en prenant
    # le plus contraignant des deux + 1 s de marge. Le prompt
    # actuel est suffisamment gros (~5500 tokens) pour que tpm soit
    # généralement la contrainte limitante avant rpm.
    rpm=$(rpm_for_model "$model")
    tpm=$(tpm_for_model "$model")
    sleep_seconds=$(awk \
        -v r="$rpm" -v t="$tpm" -v tpr="$TOKENS_PER_REQUEST_EST" \
        'BEGIN {
            from_rpm = 60.0 / r;
            from_tpm = (60.0 * tpr) / t;
            slot = (from_rpm > from_tpm) ? from_rpm : from_tpm;
            printf "%d", slot + 1;
         }')
    echo "  (rpm=$rpm, tpm=$tpm -> pause de ${sleep_seconds}s entre chaque requête)"

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
        # On ne décompose le score que s'il a bien la forme "N/M", ce qui
        # exclut tout cas ambigu (OK ..., FAUX POSITIFS ...) et évite une
        # erreur arithmétique Bash silencieuse.
        if [[ "$result" =~ ^([0-9]+)/([0-9]+)$ ]]; then
            n_found=${BASH_REMATCH[1]}
            n_expected=${BASH_REMATCH[2]}
            total_expected=$((total_expected + n_expected))
            total_found=$((total_found + n_found))
        elif echo "$result" | grep -q FAUX; then
            fp_count=$((fp_count + 1))
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
