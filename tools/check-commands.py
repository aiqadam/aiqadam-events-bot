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
ловит формы из реального кода и обходов независимого ревью (накопленная
батарея подсажек на копии живого экспорта — нормализация, контейнеры,
цепочки методов, голые вызовы, optional chaining) и отказывает
на недоказуемом. Сознательная обфускация (сборка строки из кодов,
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

CASE_RE = re.compile(r"case\s+([^:]+):")

# Методы на командной переменной: литеральные аргументы обязаны быть
# в allowlist; числовые аргументы (индексы/срезы) безопасны.
STRICT_LIT_METHODS = {"startsWith", "endsWith", "includes", "indexOf", "match", "search", "replace"}
NEUTRAL_METHODS = {"toLowerCase", "toUpperCase", "trim", "slice", "substring", "charAt", "codePointAt", "split", "at"}
LIT_ALLOWLIST = {"start", "@"}

EQ_OPS = ("!==", "===", "!=", "==")
# Сравнение командной переменной с этими константами — не разбор команды.
SAFE_OPERANDS = {"undefined", "null", "true", "false"}


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
    """Возвращает (origin, seeds): «сама команда» и она же с производными.

    origin — имя `command`/`cmd`, имена из блока разбора и алиасы без вызовов.
    seeds — origin плюс всё, куда команда попала присваиванием (производные:
    `raw = command.split('@')`). Подстановка `X[...]` запрещена только для
    origin: у производной индексация — часть уже проверенного преобразования.
    """
    origin = set()
    PARSE_HINT = re.compile(r"\.(slice|substring|charAt|split|replace|toLowerCase|toUpperCase|trim)\s*\(")
    parse_statements = []
    for m in GUARD_RE.finditer(src):
        guard = m.group(0)
        subject = re.match(r"([A-Za-z_$][\w$]*)\s*\.", guard)
        subject = subject.group(1) if subject else ""
        block = block_after(src, m.end())
        parse_statements.append(block or src[max(0, src.rfind(";", 0, m.start())) : m.end()])
        for st in re.split(r"[;{}]", block or ""):
            if not PARSE_HINT.search(st):
                continue
            if subject and subject not in st and not SPLIT_AT_RE.search(st):
                continue
            for name in ASSIGN_RE.findall(st):
                origin.add(name)
    for st in parse_statements:
        for name in ASSIGN_RE.findall(st):
            if NAME_RE.match(name):
                origin.add(name)
    for name in re.findall(r"[A-Za-z_$][\w$]*", src):
        if NAME_RE.match(name):
            origin.add(name)

    split_seeded = set()
    for st in src.split(";"):
        if SPLIT_AT_RE.search(st) or "bot_command" in st:
            split_seeded.update(ASSIGN_RE.findall(st))
    seeds = set(origin) | split_seeded
    for _ in range(4):
        grew = False
        for st in src.split(";"):
            if not any(re.search(r"\b%s\b" % re.escape(s), st) for s in seeds):
                continue
            names = ASSIGN_RE.findall(st)
            for m2 in re.finditer(r"\}\s*=", st):
                open_idx = matching_open(st, m2.start())
                if open_idx < 0:
                    continue
                rhs_end = min([x for x in (st.find(";", m2.end()), st.find("}", m2.end())) if x >= 0] or [len(st)])
                rhs = st[m2.end():rhs_end].strip()
                if not (rhs.startswith("{") or (IDENT_RE.fullmatch(rhs) and rhs in seeds)):
                    continue
                for target in pattern_targets(st[open_idx:m2.start() + 1]):
                    if target not in seeds:
                        seeds.add(target)
                        grew = True
                    origin.add(target)
                    names.append(target)
            for m2 in re.finditer(r"catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)", src):
                head = src[:m2.start()]
                try_idx = head.rfind("try")
                if try_idx < 0:
                    continue
                body_start = src.find("{", try_idx)
                body_end = balanced(src, body_start) if body_start >= 0 else -1
                if body_end < 0 or body_end > m2.start():
                    continue
                if looks_seeded(src[body_start:body_end], seeds):
                    caught = m2.group(1)
                    if caught not in seeds:
                        seeds.add(caught)
                        grew = True
                    origin.add(caught)
            if not names:
                continue
            rhs = strip_parens((st.split("=", 1)[1] if "=" in st else "").strip())
            alias = bool(IDENT_RE.fullmatch(rhs)) and rhs in seeds
            for name in names:
                if name not in seeds:
                    seeds.add(name)
                    grew = True
                if alias:
                    origin.add(name)
        if not grew:
            break
    return origin, seeds


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



def split_top_level_char(chunk, sep):
    """Индексы sep на верхнем уровне (скобки/кавычки учтены)."""
    out = []
    depth = 0
    quote = ""
    i = 0
    while i < len(chunk):
        ch = chunk[i]
        if quote:
            if ch == "\\":
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
        elif ch == sep and depth == 0:
            out.append(i)
        i += 1
    return out


def pattern_targets(text):
    """Имена, которые принимает шаблон деструктуризации (рекурсивно)."""
    text = strip_parens(text.strip())
    if text.startswith("{") and balanced(text, 0) == len(text) - 1:
        names = []
        for part in split_top_level(text[1:-1]):
            colons = split_top_level_char(part, ":")
            if colons:
                names.extend(pattern_targets(part[colons[0] + 1:]))
                continue
            name = part.split("=", 1)[0].strip().lstrip("...").strip()
            if name and IDENT_RE.fullmatch(name):
                names.append(name)
        return names
    name = text.split("=", 1)[0].strip().lstrip("...").strip()
    return [name] if name and IDENT_RE.fullmatch(name) else []


def matching_open(src, close_idx):
    """Индекс `{`, чья сбалансированная пара — close_idx (`}`)."""
    for m in re.finditer(r"\{", src[:close_idx]):
        if balanced(src, m.start()) == close_idx:
            return m.start()
    return -1


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
            if ch == "?" and src[i + 1:i + 2] == ".":
                i -= 1
                continue
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
            if ch == "?" and src.startswith("?.", i):
                i += 2
                continue
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
# методов проверяются отдельно (разбор вызовов ниже).
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
    wrap = re.match(r"^String\s*\(", body)
    if wrap:
        close_idx = balanced(body, body.index("("))
        if close_idx > 0:
            body = (body[wrap.end():close_idx] + body[close_idx + 1:]).strip()
    # Голова — часть до первой цепочки вызовов; перебираем разбиения по точкам,
    # потому что жадный IDENT съел бы первый метод.
    for i, ch in enumerate(body + "."):
        if ch != ".":
            continue
        head, tail = body[:i], body[i:]
        if head.endswith("?"):
            head = head[:-1]
        if (
            head
            and IDENT_RE.fullmatch(head)
            and any(seg in seeds for seg in head.split("."))
            and TAIL_RE.fullmatch(tail)
        ):
            return True
    # без вызовов: member-выражение, где хоть один сегмент — команда
    return bool(IDENT_RE.fullmatch(body)) and any(seg in seeds for seg in body.split("."))


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
    origin, seeds = command_idents(src)
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
            if e.startswith("..."):
                inner = e[3:].strip()
                if inner.startswith("[") and balanced(inner, 0) == len(inner) - 1:
                    check_container(split_top_level(inner[1:-1]), context)
                    continue
                fail("%s: спред %r недоказуем" % (context, e))
                continue
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

    arrays, unsafe = array_literals(src)
    mutated = set(unsafe)
    for name in arrays:
        for mut in ARRAY_MUTATORS:
            if re.search(r"\b%s\s*(?:\?\.|\.)\s*%s\s*\(" % (re.escape(name), mut), src):
                mutated.add(name)

    def container_elements(receiver, method, arg_text):
        """Контейнерный поиск команды: получатель обязан быть литералом 'start'."""
        if receiver.startswith("[") and balanced(receiver, 0) == len(receiver) - 1:
            check_container(split_top_level(receiver[1:-1]), "инлайн-контейнер")
            return
        name = receiver.split(".")[-1]
        if name in mutated:
            fail("контейнер `%s` мутируется/имеет хвост — элементы недоказуемы" % name)
            return
        if name in arrays:
            check_container(arrays[name], "`%s.%s`" % (name, method))
            return
        fail("`%s.%s(%s)` — контейнер не литеральный список 'start' (недоказуемо)"
             % (receiver, method, arg_text))

    for m in re.finditer(r"(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)\s*\??\.?\s*\(", src):
        dot_pos, method = m.start(), m.group(1)
        open_idx = src.index("(", m.end() - 1)
        close_idx = balanced(src, open_idx)
        if close_idx < 0:
            continue
        args = src[open_idx + 1:close_idx]
        receiver = operand_before(src, dot_pos)
        recv_seeded = looks_seeded(receiver, seeds)
        args_seeded = looks_seeded(args, seeds)
        if recv_seeded:
            arg_list = [a.strip() for a in split_top_level(args) if a.strip()]
            if method in STRICT_LIT_METHODS:
                if not arg_list:
                    fail("`%s.%s()` без литерала" % (receiver, method))
                    continue
                for a in arg_list:
                    lit, dynamic = literal_of(a)
                    if lit is None and not dynamic:
                        fail("`%s.%s(%s)` — аргумент недоказуем" % (receiver, method, a))
                        continue
                    literal_ok(lit, dynamic, "`%s.%s`" % (receiver, method))
            elif method in NEUTRAL_METHODS:
                for a in arg_list:
                    if re.fullmatch(r"-?\d+", a):
                        continue
                    lit, dynamic = literal_of(a)
                    if lit is None and not dynamic:
                        fail("`%s.%s(%s)` — аргумент недоказуем" % (receiver, method, a))
                        continue
                    if dynamic:
                        fail("`%s.%s(%s)` — шаблон с ${} (недоказуемо)" % (receiver, method, a))
                        continue
                    if lit not in LIT_ALLOWLIST:
                        fail("`%s.%s(%s)` — литерал вне {start, @}" % (receiver, method, lit))
            else:
                fail("неизвестная операция `%s.%s()` над командой" % (receiver, method))
        elif method in DANGEROUS_CALLS and args_seeded:
            container_elements(receiver, method, args.strip())
        elif method not in ("String",) and any(
            IDENT_RE.fullmatch(a.strip()) and seeded(a.strip(), seeds)
            for a in split_top_level(args)
        ):
            fail("передача команды в вызов `%s(%s)` недоказуема" % (method, args.strip()))

    for m in re.finditer(r"(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(", src):
        callee = m.group(1)
        if callee in ("String", "Number", "Boolean", "Array", "Object") or callee in (
            "if", "else", "for", "while", "switch", "catch", "return", "typeof", "do",
            "function", "new", "await", "delete", "void", "in", "of", "case", "break",
            "continue", "throw", "try", "finally", "import", "super", "yield", "keyof", "instanceof",
        ):
            continue
        open_idx = src.index("(", m.end() - 1)
        close_idx = balanced(src, open_idx)
        if close_idx < 0:
            continue
        args = src[open_idx + 1:close_idx]
        if looks_seeded(args, seeds):
            fail("передача команды в вызов `%s(%s)` недоказуема" % (callee, args.strip()))

    for m in re.finditer(r"\[", src):
        close_idx = balanced(src, m.start())
        if close_idx < 0:
            continue
        content = src[m.start() + 1:close_idx]
        if looks_seeded(content, seeds):
            fail("подстановка `[%s]` по команде (таблица ключей недоказуема)" % content.strip())
            break
        before = operand_before(src, m.start())
        if IDENT_RE.fullmatch(before) and before in origin:
            fail("обращение `%s[...]` к команде (по частям недоказуемо)" % before)
            break

    for m in re.finditer(r"\)\s*\??\.?\s*\(", src):
        open_idx = src.index("(", m.end() - 1)
        close_idx = balanced(src, open_idx)
        if close_idx < 0:
            continue
        args = src[open_idx + 1:close_idx]
        if looks_seeded(args, seeds):
            fail("передача команды в вызов выражения `(%s)` недоказуема" % args.strip())

    for m in re.finditer(r"\]\s*\??\s*\(", src):
        open_idx = src.index("(", m.end() - 1)
        close_idx = balanced(src, open_idx)
        if close_idx < 0:
            continue
        args = src[open_idx + 1:close_idx]
        if looks_seeded(args, seeds):
            fail("вызов по подстановке с командой (недоказуемо)")

    for m in re.finditer(r"\bin\b", src):
        left = operand_before(src, m.start())
        right = operand_after(src, m.end())
        if looks_seeded(left, seeds) or looks_seeded(right, seeds):
            fail("оператор `in` с командой (ключи недоказуемы)")

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
        elif src == "optional-call":
            code = code + "\nif (command.match?.(/events/)) { route = 'x'; }"
        elif src == "bracket-method":
            code = code + "\nif (command['endsWith']('vents')) { route = 'x'; }"
        elif src == "char-index":
            code = code + "\nif (command[0] === 'e') { route = 'x'; }"
        elif src == "slice-compare":
            code = code + "\nif (command.slice(0, 2) === 'ev') { route = 'x'; }"
        elif src == "string-of-compare":
            code = code + "\nif (String(command) === 'events') { route = 'x'; }"
        elif src == "chain-strict":
            code = code + "\nif (command.toLowerCase().startsWith('ev')) { route = 'x'; }"
        elif src == "container-transformed":
            code = code.replace("if (command === 'start')", "if (KNOWN3.includes(command.trim()))")
        elif src == "alias-subscript-ok":
            code = code + "\nconst raw9 = command.split('@');\nroute = raw9[0];"
        elif src == "helper-call":
            code = code + "\nconst known9 = ['start', 'events'];\nconst isKnown9 = (c) => known9.includes(c);\nif (isKnown9(command)) { route = 'x'; }"
        elif src == "bare-call":
            code = code + "\nconst f9 = (x) => x;\nif (f9(command)) { route = 'x'; }"
        elif src == "encode-call":
            code = code + "\nconst z9 = encodeURIComponent(command);"
        elif src == "length-ok":
            code = code + "\nif (command.length === 0) { route = 'none'; }"
        elif src == "opt-chain-compare":
            code = code.replace("if (command === 'start')", "if (command?.toLowerCase() === 'events')")
        elif src == "iife":
            code = code + "\nif (((c) => c === 'events')(command)) { route = 'x'; }"
        elif src == "catch-throw":
            code = code + "\ntry { throw command; } catch (c7) { if (c7 === 'events') { route = 'x'; } }"
        elif src == "destructure-nonseed":
            code = code + "\nif (command === 'start') { const { eventId } = parsed9; }\nconst ok9 = eventId === 'e1';"
        elif src == "destructure-nested":
            code = code + "\nconst { a5: { c55 } } = { a5: { c55: command } };\nif (c55 === 'events') { route = 'x'; }"
        elif src == "destructure":
            code = code + "\nconst { c5 } = { c5: command };\nif (c5 === 'events') { route = 'x'; }"
        elif src == "opt-chain-ok":
            code = code.replace("if (command === 'start')", "if (command?.toLowerCase() === 'start')")
        elif src == "string-trim-ok":
            code = code + "\nif (String(command).trim() === 'start') { route = 'menu'; }"
        elif src == "spread-ok":
            code = code + "\nif ([...['start']].includes(command)) { route = 'menu'; }"
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
        ("optional call", "optional-call"),
        ("цепочка методов с чужим литералом", "chain-strict"),
        ("контейнер с преобразованным аргументом", "container-transformed"),
        ("вызов функции с командой", "helper-call"),
        ("голый вызов с командой", "bare-call"),
        ("encodeURIComponent", "encode-call"),
        ("?. в сравнении", "opt-chain-compare"),
        ("IIFE с командой", "iife"),
        ("деструктуризация с командой", "destructure"),
        ("вложенная деструктуризация с командой", "destructure-nested"),
        ("утечка через catch", "catch-throw"),
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
    check_flow("syn", mutate("alias-subscript-ok"), problems)
    check_flow("syn", mutate("length-ok"), problems)
    check_flow("syn", mutate("string-trim-ok"), problems)
    check_flow("syn", mutate("spread-ok"), problems)
    check_flow("syn", mutate("opt-chain-ok"), problems)
    check_flow("syn", mutate("destructure-nonseed"), problems)
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
