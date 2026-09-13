#!/usr/bin/env bash
#
# Выгрузка шаблонов ОПУБЛИКОВАННЫХ флоу проекта в flows/*.json.
#
# ADR-0018 п. 3: экспорт нужен, чтобы settings.input PIECE-шагов (URL,
# cron, timezone, format, порядок аргументов hmac-signature) был виден
# в диффе PR. ADR-0018 п. 5: экспорт обновляется ТЕМ ЖЕ коммитом, что
# и изменение флоу.
#
# Только GET. POST/PATCH/DELETE к REST запрещены никому и никогда
# (CLAUDE.md, ADR-0018 п. 2).
#
# Ключ платформы НЕ коммитится и НЕ печатается: берётся из переменной
# окружения QADAM_API_KEY, иначе из macOS Keychain
# (сервис aiqadam-events-bot:qadam-flow-api). Передаётся в curl через
# --header @- по stdin, чтобы не светиться в `ps` и в истории оболочки.
#
# Использование:
#   tools/export-flows.sh            # выгрузить все флоу проекта
#   tools/export-flows.sh reg-start  # выгрузить только названные флоу
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$REPO_ROOT/flows"

BASE_URL="${QADAM_BASE_URL:-https://app.flow.aiqadam.org}"
PROJECT_ID="${QADAM_PROJECT_ID:-vZXlkfz60dx6kX97yICx7}"   # dev, catalog/project.md
# Имя записи в Keychain владельца. Разрешение агента выдано ТОЧЕЧНО на неё
# и ровно на форму `find-generic-password -w -s <это имя>` — порядок флагов
# менять нельзя, иначе вызов перестанет проходить.
KEYCHAIN_SERVICE="aiqadam-events-bot:qadam-flow-api"

command -v jq >/dev/null || { echo "нужен jq" >&2; exit 1; }

# --- ключ -------------------------------------------------------------
# Ни echo, ни set -x: значение не должно попасть ни в вывод, ни в лог.
# Приоритет — переменная окружения; Keychain остаётся фолбэком.
if [[ -z "${QADAM_API_KEY:-}" ]]; then
  if ! QADAM_API_KEY="$(security find-generic-password -w -s aiqadam-events-bot:qadam-flow-api 2>/dev/null)"; then
    cat >&2 <<MSG
Ключа платформы нет ни в QADAM_API_KEY, ни в Keychain
(сервис: $KEYCHAIN_SERVICE).
Положить его туда — работа человека, не агента (шаг 0.7 ROADMAP):
  security add-generic-password -s '$KEYCHAIN_SERVICE' -a "\$USER" -w
В репозитории ключа нет и не будет.
MSG
    exit 2
  fi
fi
[[ -n "$QADAM_API_KEY" ]] || { echo "пустой ключ" >&2; exit 2; }

# curl, которому ключ приходит по stdin: не виден в `ps` и в истории.
api_get() {
  printf 'Authorization: Bearer %s\n' "$QADAM_API_KEY" \
    | curl -sS --fail-with-body -H @- "$BASE_URL$1"
}

mkdir -p "$OUT_DIR"

# --- список флоу ------------------------------------------------------
flows_json="$(api_get "/api/v1/flows?projectId=$PROJECT_ID&limit=200")"

if [[ $# -gt 0 ]]; then
  filter="$(printf '%s\n' "$@" | jq -R . | jq -s .)"
  flows_json="$(jq --argjson want "$filter" \
    '.data |= map(select(.version.displayName as $n | $want | index($n)))' <<<"$flows_json")"
fi

count="$(jq '.data | length' <<<"$flows_json")"
[[ "$count" -gt 0 ]] || { echo "флоу не найдены" >&2; exit 1; }

manifest='[]'
failed=0

while IFS=$'\t' read -r id name published_version_id; do
  # ОПУБЛИКОВАННАЯ версия, не draft: иначе снимок описывает то, чего
  # пользователь не видит (BACKLOG W29, REVIEW-CHECKLIST блок 1a).
  if [[ -z "$published_version_id" || "$published_version_id" == "null" ]]; then
    echo "ПРОПУЩЕН $name: publishedVersionId отсутствует (флоу не опубликован)" >&2
    failed=1
    continue
  fi

  tpl="$(api_get "/api/v1/flows/$id/template?projectId=$PROJECT_ID&versionId=$published_version_id")"

  # Детерминированная сериализация: стабильный порядок ключей и отступ.
  # Без неё дифф шумит на ровном месте и измерить шум (Q39) нельзя.
  jq -S --indent 2 . <<<"$tpl" > "$OUT_DIR/$name.json"

  manifest="$(jq --arg n "$name" --arg i "$id" --arg v "$published_version_id" \
    '. + [{flow: $n, flowId: $i, publishedVersionId: $v}]' <<<"$manifest")"
  echo "выгружен $name"
done < <(jq -r '.data[] | [.id, .version.displayName, (.publishedVersionId // "null")] | @tsv' <<<"$flows_json")

# Манифест: по нему видно в диффе, что снимок снят с новой публикации,
# а не пересохранён без изменений.
jq -S --indent 2 'sort_by(.flow)' <<<"$manifest" > "$OUT_DIR/_manifest.json"

echo
echo "Готово. Перед коммитом — обязательная проверка на секреты:"
echo "  tools/check-export-secrets.sh"
[[ "$failed" -eq 0 ]] || exit 1
