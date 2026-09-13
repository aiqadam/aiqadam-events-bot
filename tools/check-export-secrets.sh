#!/usr/bin/env bash
#
# ОБЯЗАТЕЛЬНАЯ проверка перед каждым коммитом flows/*.json.
#
# Q38 (OPEN-QUESTIONS) закрыт исходом «платформа отдаёт {{variables[...]}}
# и {{connections[...]}} строками». Но это проверенное ПОВЕДЕНИЕ текущего
# образа, а не гарантия: сериализация шаблона может измениться с версией.
# Секрет, уехавший в историю git, не откатывается удалением файла — поэтому
# проверка повторяемая, а не сделанная один раз.
#
# Ненулевой код возврата = коммитить нельзя.
#
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-$REPO_ROOT/flows}"

[[ -e "$TARGET" ]] || { echo "нет $TARGET — нечего проверять"; exit 0; }

# Пустой каталог экспорта — не провал, а «ещё не выгружали».
if [[ -d "$TARGET" ]] && ! compgen -G "$TARGET/*.json" >/dev/null; then
  echo "в $TARGET нет ни одного *.json — нечего проверять"; exit 0
fi

fail=0

report() {  # <название> <regex>
  local title="$1" re="$2" hits
  hits="$(grep -rEoh "$re" "$TARGET" 2>/dev/null | sort -u)"
  if [[ -n "$hits" ]]; then
    echo "ПРОВАЛ: $title — есть совпадения:"
    # Печатается только ПРЕФИКС совпадения: сам факт важнее значения,
    # а печатать секрет целиком в лог CI/терминала нельзя.
    while IFS= read -r h; do echo "    ${h:0:8}… (${#h} симв.)"; done <<<"$hits"
    fail=1
  else
    echo "ok: $title — 0 совпадений"
  fi
}

# 1. Токен бота Telegram: <id 8-10 цифр>:<35 символов base64url>
report "паттерн токена Telegram" '[0-9]{8,10}:[A-Za-z0-9_-]{35}'

# 2. Кандидат в QR_SIGNING_KEY: hex-строка длиной 32 и больше.
report "hex-строки >=32 символов" '\b[0-9a-fA-F]{32,}\b'

# 3. Позитивный контроль: секреты обязаны присутствовать ССЫЛКОЙ.
#    Если ссылок вдруг не стало — значит форма экспорта изменилась,
#    и пункты 1-2 «ноль совпадений» больше ничего не доказывают.
if grep -rqE "\{\{variables\['(BOT_TOKEN|QR_SIGNING_KEY)'\]\}\}" "$TARGET" 2>/dev/null \
   && grep -rq "{{connections\[" "$TARGET" 2>/dev/null; then
  echo "ok: секреты присутствуют ссылкой ({{variables[...]}}, {{connections[...]}})"
else
  echo "ПРОВАЛ: в экспорте нет ни одной ссылки {{variables['BOT_TOKEN'|'QR_SIGNING_KEY']}}"
  echo "        или {{connections[...]}} — форма экспорта изменилась, проверка"
  echo "        пунктов 1-2 больше не доказывает отсутствие секретов. Разобраться руками."
  fail=1
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Экспорт чист — коммитить можно."
else
  echo "КОММИТИТЬ НЕЛЬЗЯ. Секрет в git не откатывается удалением файла:"
  echo "потребуется ротация BOT_TOKEN и QR_SIGNING_KEY и чистка истории."
fi
exit "$fail"
