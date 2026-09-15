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

Две сети, обе детерминированные:

1. `/<команда>` в любой строке (тексты, код): разрешён только `start`.
   URL, hash-маршруты Mini App (`#/manage`), regex-флаги (`/g`) и пути
   вида `/api/v1` командами не считаются — см. SLASH_RE и SKIP_TOKENS.
2. Сравнение команды с литералом: собираются «командные» переменные
   (имя `command`/`cmd`, присваивание рядом с проверкой `'/'`, `split('@')`,
   `bot_command`) и любой литерал, с которым такая переменная сравнивается
   (`===`, `switch`, `includes`, `indexOf`), обязан быть `start`.
   Это ловит и подфлоу, которому `command` передали через пропы.

Дополнительно требуется, чтобы вход `/start` существовал: ноль сравнений
`<командная переменная> === 'start'` — ошибка (разбор мог переехать, и тогда
человек должен осознанно обновить этот скрипт).

Перед проверкой запускается встроенная самопроверка на синтетических
фикстурах: чекер, который перестал кусаться, — это не «0 команд», а поломка.
Её провал = код возврата 2, а не «всё чисто».

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
COMPARE_RE = re.compile(
    r"(%s)\s*(?:===|==|!==|!=)\s*'([^']*)'"
    r"|'([^']*)'\s*(?:===|==|!==|!=)\s*(%s)" % (IDENT, IDENT)
)
SWITCH_RE = re.compile(r"switch\s*\(\s*(%s)\s*\)" % IDENT)
CASE_RE = re.compile(r"case\s+'([^']*)'")
ARRAY_RE = re.compile(r"([A-Za-z_$][\w$]*)\s*=\s*\[([^\]]*)\]")
INLINE_ARRAY_RE = re.compile(r"\[([^\]]*)\]\.(?:includes|indexOf)\(\s*(%s)\s*\)" % IDENT)
ARR_USE_RE = re.compile(
    r"([A-Za-z_$][\w$]*)\.(?:includes|indexOf)\(\s*(%s)\s*\)" % IDENT
)


def seeded(expr, seeds):
    """`command` или `inputs.command` — сверяем по последнему сегменту."""
    return expr.split(".")[-1] in seeds
QUOTED_RE = re.compile(r"'([^']*)'|\"([^\"]*)\"")


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


def check_source_code(src, where, problems):
    """Сети 2: сравнения «командной» переменной с литералами."""
    seeds = command_idents(src)
    if not seeds:
        return 0
    hits = 0

    def literal_ok(lit, ident):
        nonlocal hits
        if lit == "":
            return  # `command !== ''` — проверка «команды нет», не команда
        hits += 1
        if lit not in ALLOWED:
            problems.append(
                "%s: сравнение команды `%s` с %r — по ADR-0025 допустима только 'start'"
                % (where, ident, lit)
            )

    for m in COMPARE_RE.finditer(src):
        ident = m.group(1) or m.group(4)
        lit = m.group(2) if m.group(2) is not None else m.group(3)
        if seeded(ident, seeds):
            literal_ok(lit, ident)
    for m in SWITCH_RE.finditer(src):
        if not seeded(m.group(1), seeds):
            continue
        body = block_after(src, m.end())
        for lit in CASE_RE.findall(body):
            literal_ok(lit, m.group(1))
    arrays = {name: QUOTED_RE.findall(chunk) for name, chunk in ARRAY_RE.findall(src)}

    def elements_ok(chunk, ident):
        for pair in QUOTED_RE.findall(chunk):
            literal_ok(pair[0] if pair[0] != "" else pair[1], ident)

    for chunk, ident in INLINE_ARRAY_RE.findall(src):
        if seeded(ident, seeds):
            elements_ok(chunk, ident)
    for arr, ident in ARR_USE_RE.findall(src):
        if seeded(ident, seeds) and arr in arrays:
            for pair in arrays[arr]:
                literal_ok(pair[0] if pair[0] != "" else pair[1], arr + ".includes")
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


def check_texts(ru, path, problems):
    for value in all_strings(ru):
        check_slash(value, path, problems)


def roots(data, path):
    """Достаёт (имя, дерево шагов) из любой известной формы экспорта."""
    if not isinstance(data, dict):
        return []
    tpl = data.get("template", data)
    if not isinstance(tpl, dict):
        return []
    if isinstance(tpl.get("flows"), list):
        return [
            (f.get("displayName", path), f.get("trigger"))
            for f in tpl["flows"]
            if isinstance(f, dict) and f.get("trigger")
        ]
    if isinstance(tpl.get("version"), dict):
        ver = tpl["version"]
        if ver.get("trigger"):
            return [(ver.get("displayName", path), ver["trigger"])]
        return []
    if tpl.get("trigger"):
        return [(tpl.get("displayName", path), tpl["trigger"])]
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
    # Ожидания: базовый флоу чист, каждая мутация — нарушение.
    def mutate(src):
        f = json.loads(json.dumps(ok_flow))
        step = f["nextAction"]
        if src == "compare":
            step["settings"]["sourceCode"] = step["settings"]["sourceCode"].replace(
                "route = 'menu'", "route = 'events'"
            ).replace(
                "if (command === 'start')", "if (command === 'events')"
            )
        elif src == "slash-text":
            step["settings"]["input"]["texts"]["syn.hello"] = "Напишите /help"
        elif src == "slash-code":
            step["settings"]["sourceCode"] += "\n// if (command.startsWith('/myregs')) {}"
        elif src == "switch":
            step["settings"]["sourceCode"] += (
                "\nconst t = () => { switch (command) { case 'start': return 1; case 'events': return 2; } return 0; };"
            )
        elif src == "includes":
            step["settings"]["sourceCode"] += (
                "\nconst K = ['start', 'myregs'];\nif (K.includes(command)) { route = 'x'; }"
            )
        elif src == "dotted":
            step["settings"]["sourceCode"] += "\nif (inputs.command === 'admin') { route = 'x'; }"
        elif src == "no-entry":
            step["settings"]["sourceCode"] = (
                "export const code = async (inputs) => ({ unhandled: true });"
            )
        return f

    bad = []
    problems = []
    hits_ok = check_flow("syn", ok_flow, problems)
    if problems or hits_ok == 0:
        bad.append("базовый флоу: %r (hits=%d)" % (problems, hits_ok))
    for label, mutation in (
        ("сравнение", "compare"),
        ("команда в тексте", "slash-text"),
        ("команда в коде", "slash-code"),
        ("switch", "switch"),
        ("includes", "includes"),
        ("member-выражение", "dotted"),
    ):
        problems = []
        check_flow("syn", mutate(mutation), problems)
        if not problems:
            bad.append("не поймано нарушение: %s" % label)
    problems = []
    check_flow("syn", mutate("no-entry"), problems)
    check_slash("https://app.flow.aiqadam.org/api/v1/webhooks/x/sync", "syn", problems)
    check_slash("#/manage/:id и фото/видео, 24/7, /\\+/gi", "syn", problems)
    check_source_code(
        "const hasCommand = command !== '';\nconst kind = 'e';\nconst status = 'published';\n"
        "const sessionScenario = 'registration';\nconst action = 'staff_list';",
        "syn/step_x",
        problems,
    )
    if problems:
        bad.append("ложные срабатывания: %r" % problems)
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
    for name, tree in flows:
        hits += check_flow(name, tree, problems)
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
