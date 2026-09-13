#!/usr/bin/env bash
#
# Выгрузка ОПУБЛИКОВАННЫХ версий флоу проекта в flows/*.json.
#
# ADR-0018 п. 3: экспорт нужен, чтобы settings.input PIECE-шагов (URL,
# cron, timezone, format, порядок аргументов hmac-signature) был виден
# в диффе PR. ADR-0018 п. 5: экспорт обновляется ТЕМ ЖЕ коммитом, что
# и изменение флоу.
#
# Только GET. POST/PATCH/DELETE к REST запрещены никому и никогда
# (CLAUDE.md, ADR-0018 п. 2).
#
# ПОЧЕМУ НЕ /flows/:id/template. Тот эндпоинт МОЛЧА ИГНОРИРУЕТ versionId:
# ответ побайтово одинаков при versionId опубликованной версии, черновика,
# отсутствующем параметре и даже при заведомо несуществующем versionId.
# Он всегда отдаёт ПОСЛЕДНЮЮ версию. На 2026-09-14 у 14 из 22 флоу проекта
# последняя версия не совпадала с опубликованной, то есть снимок описывал
# бы то, чего пользователь не видит.
#
# /flows/:id?versionId= — уважает: отдаёт запрошенную версию и падает 404
# на несуществующей. Фиксируем state (LOCKED), что делает сам файл
# доказательством, а не наше утверждение о нём.
#
# Ключ платформы НЕ коммитится и НЕ печатается: берётся из переменной
# окружения QADAM_API_KEY, иначе из macOS Keychain. Передаётся в curl
# через --header @- по stdin, чтобы не светиться в `ps`.
#
# Использование:
#   tools/export-flows.sh            # все флоу проекта (+ манифест)
#   tools/export-flows.sh reg-start  # только названные (манифест не трогает)
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
Положить его туда — работа человека, не агента (шаг 0.7 ROADMAP).
В репозитории ключа нет и не будет.
MSG
    exit 2
  fi
fi
[[ -n "$QADAM_API_KEY" ]] || { echo "пустой ключ" >&2; exit 2; }

api_get() {
  printf 'Authorization: Bearer %s\n' "$QADAM_API_KEY" \
    | curl -sS --fail-with-body -H @- "$BASE_URL$1"
}

mkdir -p "$OUT_DIR"

# --- нормализация -----------------------------------------------------
# Выбрасываются ТОЛЬКО отметки времени, которые платформа перештамповывает
# сама, без смысловых изменений (Q39):
#   lastUpdatedDate  — публикация переписывает у ВСЕХ шагов разом;
#   lastTestDate     — меняется от прогона теста, к конфигурации не относится;
#   sampleDataFileId — ссылка на файл сэмпла, новая после каждого прогона;
#   created/updated/id/flowId/updatedBy версии — новые при каждой публикации.
# Замер: без этого публикация БЕЗ единой смысловой правки давала 22-36
# изменённых строк на флоу (checkin-api 36, fn-hmac-init-data 24,
# events-list 22) и ни одной содержательной.
# Всё остальное остаётся как есть: `state` сохранён намеренно — он и есть
# доказательство, что снят LOCKED, а не черновик.
NORMALIZE='
  .version
  | walk(if type == "object"
         then del(.lastUpdatedDate, .lastTestDate, .sampleDataFileId)
         else . end)
  | del(.created, .updated, .id, .flowId, .updatedBy)
'

# --- список флоу ------------------------------------------------------
flows_json="$(api_get "/api/v1/flows?projectId=$PROJECT_ID&limit=200")"

partial=0
if [[ $# -gt 0 ]]; then
  partial=1
  filter="$(printf '%s\n' "$@" | jq -R . | jq -s .)"
  flows_json="$(jq --argjson want "$filter" \
    '.data |= map(select(.version.displayName as $n | $want | index($n)))' <<<"$flows_json")"
fi

count="$(jq '.data | length' <<<"$flows_json")"
[[ "$count" -gt 0 ]] || { echo "флоу не найдены" >&2; exit 1; }

manifest='[]'
failed=0

while IFS=$'\t' read -r id name published_version_id; do
  # Имя флоу идёт в путь — не пускаем в него ничего, кроме безопасного
  # алфавита: `/` или `..` в displayName иначе увели бы запись из flows/.
  if [[ ! "$name" =~ ^[A-Za-z0-9._-]+$ || "$name" == *".."* ]]; then
    echo "ПРОПУЩЕН '$name': небезопасное имя для пути" >&2
    failed=1
    continue
  fi

  if [[ -z "$published_version_id" || "$published_version_id" == "null" ]]; then
    echo "ПРОПУЩЕН $name: publishedVersionId отсутствует (флоу не опубликован)" >&2
    failed=1
    continue
  fi

  resp="$(api_get "/api/v1/flows/$id?projectId=$PROJECT_ID&versionId=$published_version_id")"

  # Фактическая проверка, а не доверие параметру: версия та, что просили,
  # и она LOCKED. Иначе снимок описывает не то, что видит пользователь.
  got_id="$(jq -r '.version.id' <<<"$resp")"
  got_state="$(jq -r '.version.state' <<<"$resp")"
  if [[ "$got_id" != "$published_version_id" || "$got_state" != "LOCKED" ]]; then
    echo "ПРОПУЩЕН $name: ожидали $published_version_id/LOCKED, получили $got_id/$got_state" >&2
    failed=1
    continue
  fi

  jq -S --indent 2 "$NORMALIZE" <<<"$resp" > "$OUT_DIR/$name.json"

  manifest="$(jq --arg n "$name" --arg i "$id" --arg v "$published_version_id" \
    '. + [{flow: $n, flowId: $i, publishedVersionId: $v}]' <<<"$manifest")"
  echo "выгружен $name"
done < <(jq -r '.data[] | [.id, .version.displayName, (.publishedVersionId // "null")] | @tsv' <<<"$flows_json")

# Манифест пишется ТОЛЬКО при полной выгрузке: частичная его бы обрезала
# до одной записи и молча соврала о составе проекта.
if [[ "$partial" -eq 0 ]]; then
  jq -S --indent 2 'sort_by(.flow)' <<<"$manifest" > "$OUT_DIR/_manifest.json"
else
  echo "(частичная выгрузка: _manifest.json не тронут)"
fi

echo
echo "Готово. Перед коммитом — обязательная проверка на секреты:"
echo "  tools/check-export-secrets.sh"
[[ "$failed" -eq 0 ]] || exit 1
