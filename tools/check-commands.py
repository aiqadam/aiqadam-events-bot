#!/usr/bin/env python3
"""Проверяет, что единственная команда бота — /start (ADR-0025).

Зачем. Решение владельца: вход в бота — только `/start` (и он же с payload
из диплинка), дальше карточки и Mini App. Правило хрупкое ровно там, где
удобно: «добавлю-ка ещё одну команду». Поэтому оно держится проверкой,
а не памятью: скрипт валит коммит, если в закоммиченном экспорте флоу
или в i18n появилась любая другая команда — в тексте, в разборе сообщения
или в сравнении с ним.

Как пользоваться. Скрипт НЕ ходит в сеть: читает закоммиченный экспорт
(`tools/export-flows.sh`, ADR-0018 разрешает GET всем).

    python3 tools/check-commands.py i18n/*.json flows/*.json

`flows/_manifest.json` можно не исключать — он пропускается сам.

Правило для кода — **fail-closed: разрешено только доказуемое.** Команда,
прочитанная из сообщения, не может быть ни с чем, кроме `'start'`:
- сравниваться (`===`, `==`, `!==`, `!=`, `switch/case`) — с литералом
  в одинарных, двойных кавычках или шаблоне; сравнение с переменной,
  конкатенацией или шаблоном с `${}` отвергается;
- индексироваться (`MAP[command]`) — отвергается: по таблице не докажешь,
  что ключей-команд нет;
- искаться в контейнере (`LIST.includes(command)`) — элементы обязаны быть
  литералами `'start'`; идентификаторы в массиве отвергаются;
- обрабатываться методами: `startsWith`/`endsWith`/`includes`/`indexOf`/
  `match`/`search`/`replace` — только с литералом `'start'`; `split('@')`,
  регистр/обрезка/срезы — без буквенных аргументов; любой другой метод —
  отвергается.

Плюс отдельная сеть: `/<команда>` в любой строке (тексты, код, notes) —
разрешён только `start`; URL, hash-маршруты (`#/manage`), regex-флаги (`/g`)
и пути (`/api/v1`) командами не считаются (SLASH_RE, SKIP_TOKENS).

Дополнительно требуется, чтобы вход `/start` существовал: ноль сравнений
«командной» переменной с `'start'` — ошибка (разбор мог переехать, и тогда
человек должен осознанно обновить этот скрипт).

Перед проверкой запускается встроенная самопроверка на синтетических
фикстурах (включая обходы: двойные кавычки, конкатенация, `MAP[command]`,
`endsWith`, массив через переменную): чекер, который перестал кусаться, —
это не «0 команд», а поломка. Её провал = код возврата 2, а не «всё чисто».

Выход: строка на каждое нарушение, код 1 если они есть, 2 если сломана
самопроверка, не узнана форма экспорта или нет флоу.
"""
import json
import re
import sys


ALLOWED = {"start"}

# Команда — это `/` + слово в нижнем регистре, на границе. Не команда:
# предшествующий символ слова/`:`/`/`/`#`/`.`/`)`/`]`/`\`/`-` (URL, hash-маршрут,
# путь, regex-литерал) или следующий символ слова/`/`/`-` (путь, regex).
SLASH_RE = re.compile(r"(?<![\w:/#.)\]\\-])/([a-z][a-z0-9_]{1,31})(?![\w/-])")

# Однобуквенные токены и regex-флаги (`/g`, `/gi`) командами не считаем.
SKIP_TOKENS = {"g", "i", "m", "s", "u", "y"}

# «Командные» переменные находят по трём признакам: имя, блок разбора
# сообщения, снятие суффикса `@bot`.
NAME_RE = re.compile(r"^(raw)?cmd(l)?$|^command(Raw)?$|^rawCommand$")
GUARD_RE = re.compile(
    r"charAt\(0\)\s*===?\s*'/'"
    r"|startsWith\('/'\)"
    r"|slice\(0,\s*1\)\s*===?\s*'/'"
    r"|indexOf\('/'\)\s*===?\s*0"
    r"|bot_command"
)
SPLIT_AT_RE = re.compile(r"split\('@'\)")
ASSIGN_RE = re.compile(r"([A-Za-z_$][\w$]*)\s*=(?!=)")
IDENT = r"[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*"
IDENT_RE = re.compile(IDENT)

# Литералы: одинарные, двойные кавычки, шаблон. Шаблон с `${` — динамика.
LIT = re.compile(r"'([^']*)'|\"([^\"]*)\"|`([^`]*)`")

SWITCH_RE = re.compile(r"switch\s*\(\s*(%s)\s*\)" % IDENT)
CASE_RE = re.compile(r"case\s+([^:]+):")
ARRAY_RE = re.compile(r"([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]")
CALL_RE = re.compile(r"(%s)\s*\.\s*(\w+)\s*\(([^()]*)\)" % IDENT)
SUBSCRIPT_RE = re.compile(r"(\w+)\s*\[\s*(%s)\s*\]" % IDENT)
CONTAINER_RE = re.compile(r"(\w+)\.(includes|indexOf)\(\s*(%s)\s*\)" % IDENT)
IN_OP_RE = re.compile(r"(%s)\s+in\s+" % IDENT)

# Методы на командной переменной: литеральные аргументы обязаны быть
# в allowlist; числовые аргументы (индексы/срезы) безопасны.
STRICT_LIT_METHODS = {"startsWith", "endsWith", "includes", "indexOf", "match", "search", "replace"}
NEUTRAL_METHODS = {"toLowerCase", "toUpperCase", "trim", "slice", "substring", "charAt", "codePointAt", "split", "at"}
LIT_ALLOWLIST = {"start", "@"}

EQ_OPS = ("!==", "===", "!=", "==")
# Сравнение командной переменной с этими константами — не разбор команды.
SAFE_OPERANDS = {"undefined", "null", "true", "false"}
EQ_DELIMS = ";&|,)]}\n?:"


def walk(node, out):
    """Собирает все шаги из дерева экспорта флоу."""
    while node:
        out.append(node)
        for branch in (node.get("children") or []):
            walk(branch, out)
        for branch in (node.get("branches") or []):
            walk(branch, out)
        node = node.get("nextAction")


def all_strings(value):
    """Все строки в значении, включая вложенные (inputs, sourceCode, texts)."""
    if isinstance(value, dict):
        for v in value.values():
            yield from all_strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from all_strings(v)
    elif isinstance(value, str):
        yield value


def block_after(src, pos):
    """Тело блока, если сразу за позицией открывается `{`, иначе пустая строка."""
    open_at = src.find("{", pos)
    if open_at < 0 or src.find(";", pos) < open_at:
        return ""
    depth = 0
    for i in range(open_at, len(src)):
        if src[i] == "{":
            depth += 1
        elif src[i] == "}":
            depth -= 1
            if depth == 0:
                return src[open_at:i + 1]
    return ""


def command_idents(src):
    """Имена переменных, в которых лежит введённая пользователем команда."""
    seeds = set()
    statements = []
    for m in GUARD_RE.finditer(src):
        statements.append(src[max(0, src.rfind(";", 0, m.start())) : m.end()])
        block = block_after(src, m.end())
        if block:
            statements.append(block)
    statements.extend(
        st for st in src.split(";") if SPLIT_AT_RE.search(st) or "bot_command" in st
    )
    for st in statements:
        for name in ASSIGN_RE.findall(st):
            seeds.add(name)
    for name in re.findall(r"[A-Za-z_$][\w$]*", src):
        if NAME_RE.match(name):
            seeds.add(name)
    for _ in range(4):
        grew = False
        for st in src.split(";"):
            names = ASSIGN_RE.findall(st)
            if not names:
                continue
            if any(re.search(r"\b%s\b" % re.escape(s), st) for s in seeds):
                for name in names:
                    if name not in seeds:
                        seeds.add(name)
                        grew = True
        if not grew:
            break
    return seeds


def seeded(expr, seeds):
    """`command` или `inputs.command` — сверяем по последнему сегменту."""
    return expr.split(".")[-1] in seeds


def literal_of(text):
    """(значение, динамика) если текст — ровно один литерал, иначе (None, False)."""
    m = LIT.fullmatch(text.strip())
    if not m:
        return None, False
    value = next(g for g in m.groups() if g is not None)
    return value, "${" in value


def comparisons(src):
    """Пары (левый операнд, правый операнд) для всех равенств/неравенств."""
    i = 0
    while i < len(src):
        op = next((o for o in EQ_OPS if src.startswith(o, i)), None)
        if not op:
            i += 1
            continue
        j = i + len(op)
        k = j
        while k < len(src) and src[k] not in EQ_DELIMS:
            k += 1
        right = src[j:k].strip()
        m = i - 1
        while m >= 0 and src[m] not in EQ_DELIMS + "({":
            m -= 1
        left = src[m + 1:i].strip()
        yield left, right
        i = j


def check_source_code(src, where, problems):
    """Сеть «доказуемости»: операции над командной переменной — только с 'start'."""
    seeds = command_idents(src)
    if not seeds:
        return 0
    hits = 0

    def fail(reason):
        problems.append("%s: %s — по ADR-0025 допустим только 'start'" % (where, reason))

    def literal_ok(lit, dynamic, context):
        nonlocal hits
        if dynamic:
            fail("в %s литерал собирается шаблоном с ${} (недоказуемо)" % context)
            return
        if lit == "":
            return  # `command !== ''` — проверка «команды нет», не команда
        hits += 1
        if lit not in ALLOWED:
            problems.append(
                "%s: %s с %r — по ADR-0025 допустима только 'start'" % (where, context, lit)
            )

    for left, right in comparisons(src):
        left_seeded = bool(IDENT_RE.fullmatch(left)) and seeded(left, seeds)
        right_seeded = bool(IDENT_RE.fullmatch(right)) and seeded(right, seeds)
        if not left_seeded and not right_seeded:
            continue
        other = right if left_seeded else left
        if other in SAFE_OPERANDS or re.fullmatch(r"-?\d+", other):
            continue
        lit, dynamic = literal_of(other)
        if lit is None and not dynamic:
            fail("сравнение команды с не-литералом %r (недоказуемо)" % other)
            continue
        literal_ok(lit, dynamic, "сравнение команды")

    for m in SWITCH_RE.finditer(src):
        if not seeded(m.group(1), seeds):
            continue
        body = block_after(src, m.end())
        for case in CASE_RE.findall(body):
            lit, dynamic = literal_of(case)
            if lit is None and not dynamic:
                fail("case с не-литералом %r в switch по команде" % case.strip())
                continue
            literal_ok(lit, dynamic, "switch по команде")

    for container, ident in SUBSCRIPT_RE.findall(src):
        if seeded(ident, seeds):
            fail("выбор `%s[%s]` по команде (таблица ключей недоказуема)" % (container, ident))

    arrays = {}
    for name, chunk in ARRAY_RE.findall(src):
        elements = [e.strip() for e in chunk.split(",") if e.strip()]
        arrays[name] = elements

    def container_elements_ok(elements, context):
        for e in elements:
            lit, dynamic = literal_of(e)
            if lit is None and not dynamic:
                fail("%s содержит не-литерал %r (недоказуемо)" % (context, e))
                continue
            literal_ok(lit, dynamic, context)

    for container, method, ident in CONTAINER_RE.findall(src):
        if not seeded(ident, seeds):
            continue
        if container not in arrays:
            fail("`%s.%s(%s)` — контейнер не объявлен литералом рядом (недоказуемо)" % (container, method, ident))
            continue
        container_elements_ok(arrays[container], "%s.%s" % (container, method))

    for m in re.finditer(r"\[([^\]]*)\]\.(?:includes|indexOf)\(\s*(%s)\s*\)" % IDENT, src):
        chunk, ident = m.group(1), m.group(2)
        if seeded(ident, seeds):
            container_elements_ok(
                [e.strip() for e in chunk.split(",") if e.strip()], "includes команды"
            )

    for m in IN_OP_RE.finditer(src):
        if seeded(m.group(1), seeds):
            fail("оператор `in` по команде (ключи недоказуемы)")

    for m in CALL_RE.finditer(src):
        ident, method, args = m.group(1), m.group(2), m.group(3).strip()
        if not seeded(ident, seeds):
            continue
        arg_list = [a.strip() for a in args.split(",") if a.strip()] if args else []
        if method in STRICT_LIT_METHODS:
            if not arg_list:
                fail("`%s.%s()` без литерала" % (ident, method))
                continue
            for a in arg_list:
                lit, dynamic = literal_of(a)
                if lit is None and not dynamic:
                    fail("`%s.%s(%s)` — аргумент недоказуем" % (ident, method, a))
                    continue
                literal_ok(lit, dynamic, "`%s.%s`" % (ident, method))
        elif method in NEUTRAL_METHODS:
            for a in arg_list:
                if re.fullmatch(r"-?\d+", a):
                    continue
                lit, dynamic = literal_of(a)
                if lit is None and not dynamic:
                    fail("`%s.%s(%s)` — аргумент недоказуем" % (ident, method, a))
                    continue
                if dynamic:
                    fail("`%s.%s(%s)` — шаблон с ${} (недоказуемо)" % (ident, method, a))
                    continue
                if lit not in LIT_ALLOWLIST:
                    fail("`%s.%s(%s)` — литерал вне {start, @}" % (ident, method, lit))
        else:
            fail("неизвестная операция `%s.%s()` над командой" % (ident, method))
    return hits


def check_slash(text, where, problems):
    for m in SLASH_RE.finditer(text):
        token = m.group(1)
        if token in ALLOWED or token in SKIP_TOKENS or set(token) <= SKIP_TOKENS:
            continue
        problems.append(
            "%s: найдена команда /%s — по ADR-0025 допустима только /start" % (where, token)
        )


def check_flow(name, tree, problems):
    steps = []
    walk(tree, steps)
    hits = 0
    for value in all_strings((tree or {}).get("settings", {})):
        check_slash(value, name, problems)
    for st in steps:
        step_name = st.get("name", "?")
        settings = st.get("settings") or {}
        code = settings.get("sourceCode")
        if isinstance(code, dict):
            code = code.get("code", "")
        if isinstance(code, str) and code:
            where = "%s/%s" % (name, step_name)
            hits += check_source_code(code, where, problems)
            check_slash(code, where, problems)
        for value in all_strings(settings.get("input", {})):
            check_slash(value, "%s/%s" % (name, step_name), problems)
        for value in all_strings(settings.get("sampleData", {})):
            check_slash(value, "%s/%s[sample]" % (name, step_name), problems)
    return hits


def check_flow_fields(flow, name, problems):
    """Поля самого флоу: заметки на канвасе — тоже место для подсказки команды."""
    for key in ("notes", "displayName"):
        for value in all_strings(flow.get(key)):
            check_slash(value, "%s[%s]" % (name, key), problems)


def check_texts(ru, path, problems):
    for value in all_strings(ru):
        check_slash(value, path, problems)


def roots(data, path):
    """Достаёт (имя, дерево шагов, объект флоу) из любой известной формы экспорта."""
    if not isinstance(data, dict):
        return []
    tpl = data.get("template", data)
    if not isinstance(tpl, dict):
        return []
    if isinstance(tpl.get("flows"), list):
        return [
            (f.get("displayName", path), f.get("trigger"), f)
            for f in tpl["flows"]
            if isinstance(f, dict) and f.get("trigger")
        ]
    if isinstance(tpl.get("version"), dict):
        ver = tpl["version"]
        if ver.get("trigger"):
            return [(ver.get("displayName", path), ver["trigger"], ver)]
        return []
    if tpl.get("trigger"):
        return [(tpl.get("displayName", path), tpl["trigger"], tpl)]
    return []


def is_telegram_trigger(tree):
    s = (tree or {}).get("settings") or {}
    return "telegram" in str(s.get("qadamName", ""))


def self_test():
    """Синтетические фикстуры: чекер обязан ловить команду и не шуметь на мелочах."""
    ok_flow = {
        "displayName": "syn-ok",
        "trigger": {
            "settings": {
                "qadamName": "@aiqadam/qadam-telegram-bot",
                "input": {"update_types": ["message"]},
            }
        },
        "nextAction": {
            "name": "step_1",
            "settings": {
                "input": {"texts": {"syn.hello": "Нажмите /start, чтобы начать"}},
                "sourceCode": (
                    "export const code = async (inputs) => {\n"
                    "  const text = String(inputs.text || '');\n"
                    "  const command = text.charAt(0) === '/' ? text.slice(1).split('@')[0] : '';\n"
                    "  let route = 'none';\n"
                    "  if (command === 'start') route = 'menu';\n"
                    "  return { route: route };\n"
                    "};"
                ),
            },
        },
    }

    def mutate(src):
        f = json.loads(json.dumps(ok_flow))
        code = f["nextAction"]["settings"]["sourceCode"]
        if src == "compare":
            code = code.replace("route = 'menu'", "route = 'events'").replace(
                "if (command === 'start')", "if (command === 'events')"
            )
        elif src == "double-quotes":
            code = code.replace("if (command === 'start')", 'if (command === "events")')
        elif src == "concat":
            code = code.replace("if (command === 'start')", "if (command === ('ev' + 'ents'))")
        elif src == "template":
            code = code.replace("if (command === 'start')", "if (command === `events`)")
        elif src == "template-dynamic":
            code = code.replace("if (command === 'start')", "if (command === `ev${x}`)")
        elif src == "ident":
            code = code.replace("if (command === 'start')", "if (command === target)")
        elif src == "subscript":
            code = code + "\nconst MAP = { events: 1 };\nconst r2 = MAP[command];"
        elif src == "includes-var":
            code = code + "\nconst BAD = 'events';\nconst L = ['start', BAD];\nif (L.includes(command)) { route = 'x'; }"
        elif src == "includes-literals":
            code = code + "\nif (['start', 'myregs'].includes(command)) { route = 'x'; }"
        elif src == "container-unknown":
            code = code + "\nif (KNOWN.includes(command)) { route = 'x'; }"
        elif src == "endsWith":
            code = code + "\nif (command.endsWith('vents')) { route = 'x'; }"
        elif src == "startsWith-ok":
            code = code + "\nif (command.startsWith('start')) { route = 'x'; }"
        elif src == "replace":
            code = code + "\nconst clean = command.replace(/x/g, '');"
        elif src == "in-op":
            code = code + "\nif (command in MAP2) { route = 'x'; }"
        elif src == "slash-text":
            f["nextAction"]["settings"]["input"]["texts"]["syn.hello"] = "Напишите /help"
        elif src == "slash-code":
            code = code + "\n// if (command.startsWith('/myregs')) {}"
        elif src == "switch":
            code = code + "\nconst t = () => { switch (command) { case 'start': return 1; case 'events': return 2; } return 0; };"
        elif src == "switch-case-ident":
            code = code + "\nconst t2 = () => { switch (command) { case 'start': return 1; case BAD2: return 2; } return 0; };"
        elif src == "no-entry":
            f["nextAction"]["settings"]["sourceCode"] = (
                "export const code = async (inputs) => ({ unhandled: true });"
            )
        else:
            raise AssertionError("неизвестная фикстура " + src)
        f["nextAction"]["settings"]["sourceCode"] = code
        return f

    bad = []
    problems = []
    hits_ok = check_flow("syn", ok_flow, problems)
    if problems or hits_ok == 0:
        bad.append("базовый флоу: %r (hits=%d)" % (problems, hits_ok))

    for label, mutation in (
        ("сравнение", "compare"),
        ("двойные кавычки", "double-quotes"),
        ("конкатенация", "concat"),
        ("шаблон", "template"),
        ("шаблон с ${}", "template-dynamic"),
        ("сравнение с переменной", "ident"),
        ("подстановка MAP[command]", "subscript"),
        ("массив через переменную", "includes-var"),
        ("массив с чужой командой", "includes-literals"),
        ("неизвестный контейнер", "container-unknown"),
        ("endsWith", "endsWith"),
        ("replace", "replace"),
        ("оператор in", "in-op"),
        ("команда в тексте", "slash-text"),
        ("команда в коде", "slash-code"),
        ("switch", "switch"),
        ("switch с не-литералом", "switch-case-ident"),
    ):
        problems = []
        check_flow("syn", mutate(mutation), problems)
        if not problems:
            bad.append("не поймано нарушение: %s" % label)

    problems = []
    check_flow("syn", mutate("startsWith-ok"), problems)
    check_flow("syn", mutate("no-entry"), problems)
    check_slash("https://app.flow.aiqadam.org/api/v1/webhooks/x/sync", "syn", problems)
    check_slash("#/manage/:id и фото/видео, 24/7, /\\+/gi", "syn", problems)
    check_source_code(
        "const hasCommand = command !== '';\nconst lower = command.toLowerCase();\n"
        "const head = command.charAt(0);\nconst parts = command.split('@');\n"
        "const cut = command.slice(1).trim();\nconst kind = 'e';\n"
        "const status = 'published';\nconst sessionScenario = 'registration';\n"
        "const action = 'staff_list';",
        "syn/step_x",
        problems,
    )
    if problems:
        bad.append("ложные срабатывания: %r" % problems)

    problems = []
    check_flow_fields({"notes": "проверка чекера: /evil"}, "syn", problems)
    if not problems:
        bad.append("не поймана команда в notes флоу")
    problems = []
    check_flow_fields(
        {"notes": "см. #/manage и https://app.flow.aiqadam.org/api/v1/x", "displayName": "syn"},
        "syn",
        problems,
    )
    if problems:
        bad.append("ложное срабатывание на notes флоу: %r" % problems)

    if bad:
        print("САМОПРОВЕРКА ЧЕКЕРА ПРОВАЛЕНА:")
        for line in bad:
            print("  " + line)
        return 2
    print("самопроверка чекера: ok (нарушения ловятся, мелочи не шумят)")
    return 0


def main(argv):
    if "--self-test" in argv:
        return self_test()
    if len(argv) < 3:
        print(__doc__)
        return 2
    broken = self_test()
    if broken:
        return broken

    problems = []
    flows = []
    skipped = []
    texts_files = 0
    for path in argv[1:]:
        data = json.load(open(path, encoding="utf-8"))
        found = roots(data, path)
        if found:
            flows.extend(found)
            continue
        if isinstance(data, dict) and path.startswith("flows/"):
            skipped.append(path)
            continue
        texts_files += 1
        check_texts(data, path, problems)

    if not flows:
        print("НЕ НАЙДЕНО НИ ОДНОГО ФЛОУ в аргументах — форма экспорта не распознана.")
        return 2

    hits = 0
    telegram_flows = 0
    for name, tree, flow in flows:
        hits += check_flow(name, tree, problems)
        check_flow_fields(flow, name, problems)
        if is_telegram_trigger(tree):
            telegram_flows += 1
    if telegram_flows == 0:
        problems.append("нет ни одного флоу с telegram-триггером — вход бота сломан")
    if hits == 0:
        problems.append(
            "не найдено ни одного сравнения командной переменной со 'start' — "
            "вход /start не подтверждён (если разбор переехал, обновите tools/check-commands.py)"
        )

    for p in problems:
        print(p)
    print(
        "флоу: %d (из них telegram: %d), файлов строк: %d, нарушений: %d"
        % (len(flows), telegram_flows, texts_files, len(problems))
    )
    if skipped:
        print("пропущено (не флоу): %s" % ", ".join(skipped))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
