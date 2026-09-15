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
  конкатенацией или шаблоном с `${}` отвергается. Допустимы нормализация
  перед сравнением (`command.trim() === 'start'`) и обёртки
  (`String(command)`, `(command)`) — но литерал всё равно обязан быть
  `'start'`;
- индексироваться (`command[0]`, `command['endsWith']`, `MAP[command]`) —
  отвергается: по частям и по таблице ключей не докажешь, что команд нет;
- искаться в контейнере (`LIST.includes(command)`, `Object.keys(...).includes`,
  `Set.has`, `Map.get`, `/re/.test`) — контейнер обязан быть объявлен
  литеральным списком `'start'`; не-литералы, мутации (`push`, `concat`),
  хвосты у литерала и неизвестные контейнеры отвергаются;
- обрабатываться методами: `startsWith`/`endsWith`/`includes`/`indexOf`/
  `match`/`search`/`replace` — только с литералом `'start'`; `split('@')`,
  регистр/обрезка/срезы — без буквенных аргументов; любой другой метод —
  отвергается.

**Предел честности.** Это не песочница и не тайнт-анализ общего вида: чекер
ловит формы из реального кода и обходов независимого ревью (26 из 26
подсаженных — включая нормализацию, контейнеры и optional chaining) и
отказывает на недоказуемом. Сознательная обфускация (сборка строки из кодов,
`eval`) не детектируется — такой код виден в диффе, последний рубеж
остаётся за ревью, и это записано в ADR-0025.

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


def balanced(src, open_idx):
    """Конец сбалансированной скобки, открытой в open_idx (учитывает кавычки)."""
    pairs = {"(": ")", "[": "]", "{": "}"}
    close = pairs.get(src[open_idx])
    if not close:
        return -1
    depth = 0
    i = open_idx
    quote = ""
    while i < len(src):
        ch = src[i]
        if quote:
            if ch == "\\":
                i += 2
                continue
            if ch == quote:
                quote = ""
        elif ch in "'\"`":
            quote = ch
        elif ch == src[open_idx]:
            depth += 1
        elif ch == close:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def operand_before(src, pos):
    """Выражение слева от pos: с балансировкой скобок, до разделителя верхнего уровня."""
    i = pos - 1
    depth = 0
    while i >= 0:
        ch = src[i]
        if ch in ")]}":
            depth += 1
        elif ch in "([{":
            if depth == 0:
                break
            depth -= 1
        elif depth == 0 and ch in ";,?:&|=\n":
            break
        i -= 1
    return src[i + 1:pos].strip()


def operand_after(src, pos):
    """Выражение справа от pos до разделителя верхнего уровня (скобки парные)."""
    i = pos
    depth = 0
    while i < len(src):
        ch = src[i]
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            if depth == 0:
                break
            depth -= 1
        elif depth == 0 and ch in ";,&|?:\n":
            break
        i += 1
    return src[pos:i].strip()


def strip_parens(text):
    """Снимает сбалансированные внешние скобки: `(command)` → `command`."""
    while text.startswith("(") and balanced(text, 0) == len(text) - 1:
        text = text[1:-1].strip()
    return text


# Операнд допустим, если это командная переменная сама по себе, обёрнутая
# в String()/скобки, с цепочкой методов без вложенных скобок. Аргументы
# методов проверяются отдельно (CALL_RE).
OPERAND_RE = re.compile(
    r"^(?:String\s*\(\s*)?%s(?:\s*\))?(?:\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*\([^()]*\))*$" % IDENT
)
# Методы, применение которых к командной переменной разбирает её содержимое:
# литеральные аргументы обязаны быть 'start'; всё недоказуемое — отказ.
STRICT_LIT_METHODS = {"startsWith", "endsWith", "includes", "indexOf", "match", "search", "replace"}
# Методы-нормализация: числа и 'start'/'@' безопасны, буквенные — нет.
NEUTRAL_METHODS = {"toLowerCase", "toUpperCase", "trim", "slice", "substring", "charAt", "codePointAt", "split", "at"}
LIT_ALLOWLIST = {"start", "@"}
# Поиск команды в контейнере: контейнер обязан быть литеральным списком 'start'.
DANGEROUS_CALLS = {"includes", "indexOf", "has", "get", "test", "match", "search", "exec",
                   "find", "filter", "some", "every", "startsWith", "endsWith"}
# Мутация массива делает его элементы недоказуемыми.
ARRAY_MUTATORS = {"push", "splice", "unshift", "concat", "fill", "copyWithin", "pop",
                  "shift", "sort", "reverse"}
SAFE_OPERANDS = {"undefined", "null", "true", "false"}
EQ_OPS = ("!==", "===", "!=", "==")


def looks_seeded(expr, seeds):
    """Содержит ли выражение командную переменную (по словам)."""
    for name in re.findall(r"[A-Za-z_$][\w$]*", expr):
        if name in seeds:
            return True
    return False


TAIL_RE = re.compile(r"^(?:\s*(?:\?\.|\.)\s*[A-Za-z_$][\w$]*\s*\([^()]*\))*$")


def operand_is_simple(expr, seeds):
    """Операнд — командная переменная (возможно String()/скобки/цепочка методов)."""
    text = strip_parens(expr.strip())
    if not OPERAND_RE.fullmatch(text):
        return False
    body = text
    if body.startswith("String"):
        body = re.sub(r"^String\s*\(\s*", "", body)
        if body.endswith(")"):
            body = body[:-1].strip()
    # Голова — часть до первой цепочки вызовов; перебираем разбиения по точкам,
    # потому что жадный IDENT съел бы первый метод.
    for i, ch in enumerate(body + "."):
        if ch != ".":
            continue
        head, tail = body[:i], body[i:]
        if head and IDENT_RE.fullmatch(head) and seeded(head, seeds) and TAIL_RE.fullmatch(tail):
            return True
    return False


def literal_of(text):
    """(значение, динамика) если текст — ровно один литерал, иначе (None, False)."""
    text = strip_parens(text.strip())
    m = LIT.fullmatch(text)
    if not m:
        return None, False
    value = next(g for g in m.groups() if g is not None)
    return value, "${" in value


def array_literals(src):
    """Имя → элементы массива; unsafe — имена, у литерала которых есть хвост.

    `const L = ['start'].concat(['events'])` — литерал уже не весь контейнер,
    элементы недоказуемы; такие имена уходят в unsafe и валят includes(command).
    """
    arrays = {}
    unsafe = set()
    for m in re.finditer(r"([A-Za-z_$][\w$]*)\s*=\s*\[", src):
        open_idx = src.index("[", m.start())
        end = balanced(src, open_idx)
        if end < 0:
            continue
        name = m.group(1)
        arrays[name] = split_top_level(src[open_idx + 1:end])
        rest = src[end + 1:].lstrip()
        if rest[:1] in (".", "("):
            unsafe.add(name)
    return arrays, unsafe


def split_top_level(chunk):
    """Элементы списка через запятую верхнего уровня (скобки/кавычки учтены)."""
    out = []
    depth = 0
    quote = ""
    cur = ""
    i = 0
    while i < len(chunk):
        ch = chunk[i]
        if quote:
            if ch == "\\":
                cur += chunk[i:i + 2]
                i += 2
                continue
            if ch == quote:
                quote = ""
        elif ch in "'\"`":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            out.append(cur.strip())
            cur = ""
            i += 1
            continue
        cur += ch
        i += 1
    if cur.strip():
        out.append(cur.strip())
    return out


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

    def check_pair(cmd_side, other, context):
        if not operand_is_simple(cmd_side, seeds):
            fail("в %s выражение над командой %r недоказуемо" % (context, cmd_side))
            return
        if other in SAFE_OPERANDS or re.fullmatch(r"-?\d+", other or ""):
            return
        lit, dynamic = literal_of(other)
        if lit is None and not dynamic:
            fail("в %s сравнение команды с не-литералом %r (недоказуемо)" % (context, other))
            return
        literal_ok(lit, dynamic, context)

    def check_container(elements, context):
        if not elements:
            fail("%s — контейнер пуст/недоказуем" % context)
            return
        for e in elements:
            lit, dynamic = literal_of(e)
            if lit is None and not dynamic:
                fail("%s содержит не-литерал %r (недоказуемо)" % (context, e))
                continue
            if lit != "start":
                fail("%s: элемент %r — допустим только 'start'" % (context, lit))

    i = 0
    while i < len(src):
        op = next((o for o in EQ_OPS if src.startswith(o, i)), None)
        if not op:
            i += 1
            continue
        left = operand_before(src, i)
        right = operand_after(src, i + len(op))
        left_hit = looks_seeded(left, seeds)
        right_hit = looks_seeded(right, seeds)
        if left_hit and right_hit:
            fail("сравнение команды с выражением над командой (%r %s %r)" % (left, op, right))
        elif left_hit:
            check_pair(left, right, "сравнение команды")
        elif right_hit:
            check_pair(right, left, "сравнение команды")
        i += len(op)

    for m in re.finditer(r"switch\s*\(", src):
        open_idx = src.index("(", m.start())
        close_idx = balanced(src, open_idx)
        if close_idx < 0:
            continue
        scrutinee = src[open_idx + 1:close_idx].strip()
        if not looks_seeded(scrutinee, seeds):
            continue
        if not operand_is_simple(scrutinee, seeds):
            fail("switch по выражению над командой %r (недоказуемо)" % scrutinee)
            continue
        brace = src.find("{", close_idx)
        body_end = balanced(src, brace) if brace >= 0 else -1
        body = src[brace:body_end + 1] if body_end > brace else ""
        for case in CASE_RE.findall(body):
            lit, dynamic = literal_of(case)
            if lit is None and not dynamic:
                fail("case с не-литералом %r в switch по команде" % case.strip())
                continue
            literal_ok(lit, dynamic, "switch по команде")

    for m in re.finditer(r"(?:^|[^\w.$])(%s)\s*\[" % IDENT, src):
        head = m.group(1)
        if seeded(head, seeds):
            fail("обращение `%s[...]` к команде (по частям недоказуемо)" % head)
    for m in re.finditer(r"\[\s*(%s)\s*\]" % IDENT, src):
        if seeded(m.group(1), seeds):
            fail("подстановка `[%s]` по команде (таблица ключей недоказуема)" % m.group(1))
    for m in re.finditer(r"(?:^|[^\w.$])(%s)\s+in\s+" % IDENT, src):
        if seeded(m.group(1), seeds):
            fail("оператор `in` по команде (ключи недоказуемы)")

    arrays, unsafe = array_literals(src)
    mutated = set(unsafe)
    for name in arrays:
        for mut in ARRAY_MUTATORS:
            if re.search(r"\b%s\s*(?:\?\.|\.)\s*%s\s*\(" % (re.escape(name), mut), src):
                mutated.add(name)

    for m in re.finditer(r"(\?\.|\.)\s*(\w+)\s*\(\s*(%s)\s*\)" % IDENT, src):
        method, ident = m.group(2), m.group(3)
        if method not in DANGEROUS_CALLS or not seeded(ident, seeds):
            continue
        container = operand_before(src, m.start())
        if container.split(".")[-1] in seeds:
            continue  # метод на самой команде — проверяется ниже
        if container.startswith("["):
            open_idx = src.index("[", m.start() - len(container))
            close_idx = balanced(src, open_idx)
            rest = src[close_idx + 1:].lstrip() if close_idx >= 0 else ""
            if rest[:1] in (".", "("):
                fail("инлайн-контейнер с хвостом %r (элементы недоказуемы)" % rest[:20])
                continue
            check_container(split_top_level(src[open_idx + 1:close_idx]), "инлайн-контейнер")
            continue
        if container in arrays:
            if container in mutated:
                fail("контейнер `%s` мутируется в этом же шаге — элементы недоказуемы" % container)
                continue
            check_container(arrays[container], "`%s.%s`" % (container, method))
            continue
        fail("`%s.%s(%s)` — контейнер не объявлен литеральным списком 'start' (недоказуемо)"
             % (container, method, ident))

    for m in re.finditer(r"(%s)\s*(?:\?\.|\.)\s*(\w+)\s*\(([^()]*)\)" % IDENT, src):
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
        elif src == "normalize-trim":
            code = code.replace("if (command === 'start')", "if (command.trim() === 'events')")
        elif src == "switch-normalized":
            code = code + "\nconst t3 = () => { switch (command.toLowerCase()) { case 'events': return 1; } return 0; };"
        elif src == "push":
            code = code + "\nconst L1 = ['start'];\nL1.push('events');\nif (L1.includes(command)) { route = 'x'; }"
        elif src == "concat-array":
            code = code + "\nconst L2 = ['start'].concat(['events']);\nif (L2.includes(command)) { route = 'x'; }"
        elif src == "objkeys":
            code = code + "\nif (Object.keys({ events: 1 }).includes(command)) { route = 'x'; }"
        elif src == "regex-test":
            code = code + "\nif (/^ev/.test(command)) { route = 'x'; }"
        elif src == "set-has":
            code = code + "\nif (new Set(['events']).has(command)) { route = 'x'; }"
        elif src == "map-get":
            code = code + "\nif (M1.get(command)) { route = 'x'; }"
        elif src == "optional-chain":
            code = code + "\nif (command?.endsWith('vents')) { route = 'x'; }"
        elif src == "bracket-method":
            code = code + "\nif (command['endsWith']('vents')) { route = 'x'; }"
        elif src == "char-index":
            code = code + "\nif (command[0] === 'e') { route = 'x'; }"
        elif src == "slice-compare":
            code = code + "\nif (command.slice(0, 2) === 'ev') { route = 'x'; }"
        elif src == "string-of-compare":
            code = code + "\nif (String(command) === 'events') { route = 'x'; }"
        elif src == "normalize-ok":
            code = code.replace("if (command === 'start')", "if (command.trim() === 'start')")
        elif src == "case-parens":
            code = code + "\nconst t4 = () => { switch (command) { case ('start'): return 1; } return 0; };"
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
        ("нормализация перед сравнением", "normalize-trim"),
        ("switch по нормализованной команде", "switch-normalized"),
        ("push в контейнер", "push"),
        ("concat у контейнера", "concat-array"),
        ("Object.keys().includes", "objkeys"),
        ("regex.test", "regex-test"),
        ("Set.has", "set-has"),
        ("Map.get", "map-get"),
        ("optional chaining", "optional-chain"),
        ("command['endsWith']", "bracket-method"),
        ("command[0]", "char-index"),
        ("slice-сравнение", "slice-compare"),
        ("String(command) === чужая", "string-of-compare"),
    ):
        problems = []
        check_flow("syn", mutate(mutation), problems)
        if not problems:
            bad.append("не поймано нарушение: %s" % label)

    problems = []
    check_flow("syn", mutate("startsWith-ok"), problems)
    check_flow("syn", mutate("normalize-ok"), problems)
    check_flow("syn", mutate("case-parens"), problems)
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
        if path.endswith("_manifest.json") or (isinstance(data, dict) and path.startswith("flows/")):
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
