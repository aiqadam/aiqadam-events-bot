#!/usr/bin/env bash
#
# ОБЯЗАТЕЛЬНАЯ проверка перед каждым коммитом flows/*.json.
#
# Q38 (OPEN-QUESTIONS) закрыт исходом «платформа отдаёт {{variables[...]}}
# и {{connections[...]}} ссылками». Но это проверенное ПОВЕДЕНИЕ образа,
# а не гарантия: сериализация шаблона уже менялась однажды за сутки.
# Секрет, уехавший в историю git, не откатывается удалением файла —
# поэтому проверка повторяемая, а не сделанная один раз.
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

# Сканируем ТОЛЬКО *.json. Каталог экспорта содержит ещё и README.md, где
# формы ссылок приведены как текст документации — на нём позитивный контроль
# один раз прошёл ложно, и «ok» ничего не значил.
if [[ -d "$TARGET" ]]; then
  FILES=("$TARGET"/*.json)
else
  FILES=("$TARGET")
fi

report() {  # <название> <regex>
  local title="$1" re="$2" hits n
  hits="$(grep -Eoh "$re" "${FILES[@]}" 2>/dev/null | sort -u)"
  if [[ -n "$hits" ]]; then
    n="$(wc -l <<<"$hits" | tr -d ' ')"
    # Совпадение НЕ печатается даже частично: если это действительно
    # секрет, любой его кусок в логе терминала — уже утечка.
    echo "ПРОВАЛ: $title — совпадений: $n. Файлы:"
    grep -lE "$re" "${FILES[@]}" 2>/dev/null | sed 's|^|    |'
    fail=1
  else
    echo "ok: $title — 0 совпадений"
  fi
}

# 1. Токен бота Telegram. Диапазоны намеренно шире фактических (id 8-10 цифр,
#    хвост 35 символов): точный счётчик сломается от смены формата у Telegram,
#    а нам нужна ловушка, а не валидатор.
report "паттерн токена Telegram" '[0-9]{6,12}:[A-Za-z0-9_-]{30,}'

# 2. Кандидат в QR_SIGNING_KEY: hex-строка длиной 32 и больше.
#    Ловит только hex-ключ. Ключ произвольного вида паттерном не поймать —
#    от него защищает пункт 3, а не этот.
report "hex-строки >=32 символов" '\b[0-9a-fA-F]{32,}\b'

# 3. Позитивный контроль: ссылка на КАЖДОЕ ожидаемое имя переменной.
#    Раньше здесь стояла альтернатива (BOT_TOKEN|QR_SIGNING_KEY), и хватало
#    одной ссылки любого из двух: QR_SIGNING_KEY можно было подставить
#    значением (32 символа, не hex — пункт 2 его не видит), а проверка
#    рапортовала «чисто». Поэтому имена проверяются поимённо и по счёту.
#
#    EXPECTED_* — сколько ссылок ожидается сейчас. Меньше ожидаемого =
#    ПРОВАЛ: ссылка пропала, и неважно, на что её заменили. Больше — норма
#    (в проекте прибавилось шагов), печатается для сведения.
EXPECTED_BOT_TOKEN=3
EXPECTED_QR_SIGNING_KEY=2

for var in BOT_TOKEN QR_SIGNING_KEY; do
  eval "want=\$EXPECTED_$var"
  got="$(grep -oh "{{variables\['$var'\]}}" "${FILES[@]}" 2>/dev/null | wc -l | tr -d ' ')"
  if [[ "$got" -lt "$want" ]]; then
    echo "ПРОВАЛ: ссылок {{variables['$var']}} — $got, ожидалось не меньше $want."
    echo "        Ссылка пропала. Это может значить, что вместо неё подставлено"
    echo "        ЗНАЧЕНИЕ, которого пункты 1-2 не описывают. Разобраться руками."
    fail=1
  elif [[ "$got" -gt "$want" ]]; then
    echo "ok: ссылок {{variables['$var']}} — $got (ожидалось $want; больше — норма,"
    echo "    но обновите EXPECTED_$var, чтобы проверка снова ловила пропажу)"
  else
    echo "ok: ссылок {{variables['$var']}} — $got, как ожидалось"
  fi
done

# 4. Connections. Эндпоинт /flows/:id?versionId= отдаёт их ССЫЛКОЙ
#    {{connections['<externalId>']}} — это норма и то, что Q38 признал
#    безопасным: externalId connection'а публичен и уже лежит в catalog/.
#    Блокер — любая ДРУГАЯ форма значения `auth`.
#
#    Проверяется через jq, а не grep: резолвнутый connection приезжает
#    ОБЪЕКТОМ ({"access_token": ...}), а регулярка описывала только строку
#    и молчала ровно в том сценарии, ради которого поставлена.
# Regex записан через классы символов, а не обратные слэши: при передаче
# из bash в jq экранирование съедалось, и проверка ложно валилась на всём.
AUTH_RE="^[{][{]connections[[]'[A-Za-z0-9_-]+'[]][}][}]$"
auth_total=0
auth_bad=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  if ! out="$(jq -r --arg re "$AUTH_RE" '
        [ .. | objects | select(has("auth")) | .auth ] as $a
        | [ ($a | length),
            ([ $a[] | select((type != "string") or (test($re) | not)) ] | length) ]
        | @tsv' "$f" 2>/dev/null)"; then
    echo "ПРОВАЛ: $f — не разбирается как JSON, проверить auth невозможно"
    fail=1
    continue
  fi
  auth_total=$(( auth_total + $(cut -f1 <<<"$out") ))
  n_bad=$(cut -f2 <<<"$out")
  if [[ "$n_bad" -gt 0 ]]; then
    echo "ПРОВАЛ: $f — полей auth не в форме {{connections['...']}}: $n_bad"
    echo "        (объект, массив, null или строка иного вида = возможно ЗНАЧЕНИЕ)"
    auth_bad=$(( auth_bad + n_bad ))
    fail=1
  fi
done
if [[ "$auth_bad" -eq 0 ]]; then
  echo "ok: все $auth_total полей auth — строки {{connections['...']}}, значений нет"
fi

echo
if [[ "$fail" -eq 0 ]]; then
  echo "Экспорт чист — коммитить можно."
else
  echo "КОММИТИТЬ НЕЛЬЗЯ. Секрет в git не откатывается удалением файла:"
  echo "потребуется ротация BOT_TOKEN и QR_SIGNING_KEY и чистка истории."
fi
exit "$fail"
