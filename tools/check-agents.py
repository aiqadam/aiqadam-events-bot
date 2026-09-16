#!/usr/bin/env python3
"""Проверяет, что роли агентов держатся канона (ADR-0029).

Зачем. Роли (dev-agent, review-agent) описаны один раз — обычным Markdown
в `docs/agents/`. Харнессы получают только тонкие адаптеры: frontmatter прав
и указатель на канон. Адаптеров больше одного, и без проверки они разъедутся
молча — тем же способом, что и любой второй список одного правила. Скрипт
держит четыре вещи:

1. канон на месте; AGENTS.md ссылается на обе роли; CLAUDE.md начинается
   с импорта `@AGENTS.md` (Claude Code не читает AGENTS.md нативно);
2. адаптеры существуют и тонкие: тело — только ссылки на канон и протокол,
   без заголовков и процедур (короткое тело);
3. у review-agent запрет по умолчанию и read-only allow-list: ни одной
   MCP-мутации, правки — только в журнал пакета, `git commit`/`push` и
   `curl -X POST/PATCH/PUT/DELETE` запрещены; у dev-agent запретов,
   мешающих работе, нет;
4. конфиги MCP согласованы: каждый сервер из `opencode.json`/`.mcp.json`
   покрыт allow-списком ревьюера (иначе его инструменты будут запрещены
   целиком), URL совпадают.

Скрипт офлайн: сеть не нужна. Запускается в pre-commit (при изменениях ролей
и конфигов) и в CI.

    python3 tools/check-agents.py [корень репозитория]

Выход: 0 — чисто, 1 — нарушения, 2 — сломана самопроверка.
"""
import fnmatch
import json
import os
import re
import sys
import tempfile

ROLES = ("dev-agent", "review-agent")

# Read-only инструменты MCP: allow-список ревьюера не может выходить за этот
# набор. Пополнение — осознанное действие: новый инструмент сначала должен
# быть доказуемо читающим.
READ_TOOLS = {
    "ap_flow_structure",
    "ap_read_step_code",
    "ap_list_flows",
    "ap_list_runs",
    "ap_get_run",
    "ap_list_tables",
    "ap_find_records",
    "ap_list_connections",
    "ap_list_variables",
    "ap_export_flow",
    "ap_export_table",
    "ap_validate_flow",
    "ap_validate_step_config",
    "ap_research_pieces",
    "ap_get_piece_props",
    "ap_resolve_property_options",
    "ap_resolve_property_chain",
}

PROTOCOL_REFS = {
    "dev-agent": (
        "docs/agents/dev-agent.md",
        "docs/work/README.md",
        "docs/ROADMAP.md",
        "docs/BACKLOG.md",
    ),
    "review-agent": (
        "docs/agents/review-agent.md",
        "docs/work/REVIEW-CHECKLIST.md",
    ),
}

ADAPTERS = {
    "dev-agent": (
        ("opencode", ".opencode/agent/dev-agent.md"),
        ("claude", ".claude/agents/dev-agent.md"),
    ),
    "review-agent": (
        ("opencode", ".opencode/agent/review-agent.md"),
        ("claude", ".claude/agents/review-agent.md"),
    ),
}

BODY_MAX_LINES = 6
MCP_TOOL_RE = re.compile(r"^(?P<prefix>.+)_(?P<tool>ap_[a-z0-9_]+)$")


def read_file(root, rel):
    path = os.path.join(root, rel)
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        return fh.read()


def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_block(lines, indent):
    """Мини-парсер YAML-подмножества: скаляры и вложенные map по отступу."""
    result = {}
    i = 0
    while i < len(lines):
        raw = lines[i]
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        cur = len(raw) - len(raw.lstrip(" "))
        if cur < indent:
            break
        if cur > indent:
            raise ValueError("неожиданный отступ: %r" % stripped)
        key, sep, value = stripped.partition(":")
        if not sep:
            raise ValueError("не строка key: value: %r" % stripped)
        key = unquote(key.strip())
        value = value.strip()
        if value:
            result[key] = unquote(value)
            i += 1
            continue
        j = i + 1
        nested_indent = None
        while j < len(lines):
            nxt = lines[j]
            if not nxt.strip():
                j += 1
                continue
            nxt_indent = len(nxt) - len(nxt.lstrip(" "))
            if nxt_indent <= cur:
                break
            if nested_indent is None:
                nested_indent = nxt_indent
            j += 1
        result[key] = parse_block(lines[i + 1:j], nested_indent) if nested_indent else {}
        i = j
    return result


def parse_frontmatter(text):
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None, text, "нет YAML-frontmatter"
    end = None
    for k in range(1, len(lines)):
        if lines[k].strip() == "---":
            end = k
            break
    if end is None:
        return None, text, "frontmatter не закрыт"
    try:
        fm = parse_block(lines[1:end], 0)
    except ValueError as exc:
        return None, text, "frontmatter не разобран: %s" % exc
    return fm, "\n".join(lines[end + 1:]), None


def resolve(rules, value):
    """Правило по образцу: последнее совпадение побеждает (как в opencode)."""
    if not isinstance(rules, dict):
        return None
    action = None
    for pattern, act in rules.items():
        if fnmatch.fnmatchcase(value, pattern):
            action = act if isinstance(act, str) else None
    return action


def check_review_opencode(where, fm, add):
    """Права ревьюера в opencode: deny по умолчанию + read-only allow-list."""
    prefixes = set()
    perm = fm.get("permission")
    if not isinstance(perm, dict):
        add("%s: нет permission — ревьюер неотличим по правам от владельца" % where)
        return prefixes
    if perm.get("*") != "deny":
        add('%s: permission["*"] должен быть "deny" (fail-closed)' % where)
    if perm.get("task") != "deny":
        add("%s: task должен быть запрещён — ревьюер не запускает подагентов" % where)
    read = perm.get("read")
    for probe, expected in (
        ("docs/work/W42-event-wizard.md", "allow"),
        (".env", "deny"),
        ("backend/.env.local", "deny"),
    ):
        action = resolve(read, probe)
        if action != expected:
            add("%s: read %r → %r, ожидалось %r" % (where, probe, action, expected))

    edit = perm.get("edit")
    if not isinstance(edit, dict) or edit.get("*") != "deny":
        add('%s: edit обязан запрещать всё ("*": deny)' % where)
    else:
        for pattern, action in edit.items():
            if action == "allow" and not pattern.startswith("docs/work/"):
                add("%s: edit разрешает %r — ревьюер пишет только журнал (docs/work/)" % (where, pattern))
    for probe, expected in (
        ("docs/work/W42-event-wizard.md", "allow"),
        ("miniapp/src/App.tsx", "deny"),
        ("flows/tg-router.json", "deny"),
    ):
        action = resolve(edit, probe)
        if action != expected:
            add("%s: edit %r → %r, ожидалось %r" % (where, probe, action, expected))

    bash = perm.get("bash")
    if not isinstance(bash, dict):
        add("%s: нет bash-правил — команды ревьюера не ограничены" % where)
    else:
        for probe, expected in (
            ("tools/export-flows.sh", "allow"),
            ("python3 tools/check-migrations.py", "allow"),
            ("git status --short", "allow"),
            ("git log -5", "allow"),
            ("git push origin main", "deny"),
            ("git commit -m x", "deny"),
            ("curl -X POST https://example.com", "deny"),
            ("curl -X DELETE https://example.com", "deny"),
            ("rm -rf build", "deny"),
        ):
            action = resolve(bash, probe)
            if action != expected:
                add("%s: bash %r → %r, ожидалось %r" % (where, probe, action, expected))

    for key, action in perm.items():
        if action != "allow":
            continue
        m = MCP_TOOL_RE.match(key)
        if not m:
            continue
        if m.group("tool") not in READ_TOOLS:
            add("%s: разрешён %s — не read-only (список READ_TOOLS в этом чекере)" % (where, m.group("tool")))
        prefixes.add(m.group("prefix"))
    return prefixes


def check_review_claude(where, fm, add):
    """Права ревьюера в Claude Code: только точные read-only MCP-инструменты."""
    prefixes = set()
    raw = fm.get("tools")
    if not isinstance(raw, str):
        add("%s: нет tools — субагент унаследует и мутирующие MCP-инструменты" % where)
        return prefixes
    tools = [t.strip() for t in raw.split(",") if t.strip()]
    for tool in tools:
        if tool == "Agent" or tool.startswith("Agent("):
            add("%s: Agent — ревьюер не запускает подагентов" % where)
        if not tool.startswith("mcp__"):
            continue
        parts = tool.split("__")
        if len(parts) < 3 or parts[-1] == "*":
            add("%s: %s — серверный вилдкард, включает мутации; нужны точные инструменты" % (where, tool))
            continue
        name = parts[-1]
        if name not in READ_TOOLS:
            add("%s: %s — не read-only инструмент (список READ_TOOLS в этом чекере)" % (where, tool))
        prefixes.add(parts[-2])
    for required in ("Read", "Grep", "Glob", "Bash", "Edit"):
        if required not in tools:
            add("%s: в tools нет %s — протокол роли не выполнить" % (where, required))
    return prefixes


def check_review_adapter(harness, where, fm, add):
    if harness == "opencode":
        return check_review_opencode(where, fm, add)
    return check_review_claude(where, fm, add)


def load_mcp_servers(root, add):
    servers = set()
    urls = set()
    text = read_file(root, "opencode.json")
    if text is None:
        add("нет opencode.json")
    else:
        try:
            data = json.loads(text)
        except ValueError as exc:
            add("opencode.json не разобран: %s" % exc)
            data = {}
        for name, cfg in (data.get("mcp") or {}).items():
            if isinstance(cfg, dict) and cfg.get("enabled") is False:
                continue
            servers.add(name)
            if isinstance(cfg, dict) and cfg.get("url"):
                urls.add(cfg["url"])
    text = read_file(root, ".mcp.json")
    if text is None:
        add("нет .mcp.json")
    else:
        try:
            data = json.loads(text)
        except ValueError as exc:
            add(".mcp.json не разобран: %s" % exc)
            data = {}
        for name, cfg in (data.get("mcpServers") or {}).items():
            servers.add(name)
            if isinstance(cfg, dict) and cfg.get("url"):
                urls.add(cfg["url"])
    if len(urls) > 1:
        add("URL MCP-серверов расходятся между opencode.json и .mcp.json: %s" % ", ".join(sorted(urls)))
    return servers


def check_tree(root):
    problems = []

    def add(msg):
        problems.append(msg)

    agents = read_file(root, "AGENTS.md")
    if agents is None:
        add("нет AGENTS.md — канонического контекст-файла")
    else:
        if "Роли агентов" not in agents:
            add("AGENTS.md: нет раздела «Роли агентов»")
        for role in ROLES:
            if "docs/agents/%s.md" % role not in agents:
                add("AGENTS.md: нет ссылки на docs/agents/%s.md" % role)

    claude_path = os.path.join(root, "CLAUDE.md")
    if os.path.islink(claude_path):
        if os.path.basename(os.path.realpath(claude_path)) != "AGENTS.md":
            add("CLAUDE.md: симлинк ведёт не на AGENTS.md")
    elif not os.path.isfile(claude_path):
        add("нет CLAUDE.md — Claude Code не увидит инструкций")
    else:
        with open(claude_path, encoding="utf-8") as fh:
            head = next((l.strip() for l in fh if l.strip()), "")
        if head != "@AGENTS.md":
            add("CLAUDE.md: первая непустая строка должна быть @AGENTS.md, а не %r" % head)

    for role in ROLES:
        if read_file(root, "docs/agents/%s.md" % role) is None:
            add("нет канона роли: docs/agents/%s.md" % role)

    review_prefixes = set()
    for role in ROLES:
        for harness, rel in ADAPTERS[role]:
            text = read_file(root, rel)
            if text is None:
                add("нет адаптера %s для %s: %s" % (role, harness, rel))
                continue
            fm, body, err = parse_frontmatter(text)
            if err:
                add("%s: %s" % (rel, err))
                continue
            if harness == "claude" and fm.get("name") != role:
                add("%s: name=%r, ожидалось %r" % (rel, fm.get("name"), role))
            if not str(fm.get("description") or "").strip():
                add("%s: пустой description" % rel)
            body_lines = [l for l in body.splitlines() if l.strip()]
            if len(body_lines) > BODY_MAX_LINES:
                add("%s: тело %d строк (максимум %d) — процедура должна жить в каноне"
                    % (rel, len(body_lines), BODY_MAX_LINES))
            if any(l.lstrip().startswith("#") for l in body_lines):
                add("%s: заголовок в теле адаптера — это процедура, её место в каноне" % rel)
            for ref in PROTOCOL_REFS[role]:
                if ref not in body:
                    add("%s: тело не ссылается на %s" % (rel, ref))
            if role == "dev-agent":
                if harness == "opencode":
                    if fm.get("mode") != "primary":
                        add("%s: mode=%r, у владельца пакета — primary" % (rel, fm.get("mode")))
                    if '  "*": deny' in text:
                        add('%s: у dev-agent есть «"*": deny» — работа с MCP запрещена' % rel)
            else:
                review_prefixes |= check_review_adapter(harness, rel, fm, add)

    for server in sorted(load_mcp_servers(root, add)):
        if server not in review_prefixes:
            add("review-agent: allow-список не покрывает MCP-сервер %r "
                "— его инструменты будут запрещены целиком" % server)
    return problems


FIXTURE = {
    "AGENTS.md": "# AGENTS\n\n## Роли агентов\n\n"
                 "[docs/agents/dev-agent.md](docs/agents/dev-agent.md)\n"
                 "[docs/agents/review-agent.md](docs/agents/review-agent.md)\n",
    "CLAUDE.md": "@AGENTS.md\n",
    "docs/agents/dev-agent.md": "# Роль\n",
    "docs/agents/review-agent.md": "# Роль\n",
    ".opencode/agent/dev-agent.md": (
        "---\ndescription: d\nmode: primary\n---\n"
        "`docs/agents/dev-agent.md` `docs/work/README.md` `docs/ROADMAP.md` `docs/BACKLOG.md`\n"
    ),
    ".opencode/agent/review-agent.md": (
        "---\ndescription: r\nmode: all\npermission:\n"
        '  "*": deny\n'
        '  read:\n    "*": allow\n    "*.env": deny\n    "*.env.*": deny\n  task: deny\n'
        '  edit:\n    "*": deny\n    "docs/work/*.md": allow\n'
        '  bash:\n    "*": allow\n    "git *": deny\n    "git status *": allow\n'
        '    "git log *": allow\n    "rm *": deny\n    "curl -X POST *": deny\n'
        '    "curl -X DELETE *": deny\n'
        "  qadam-flow_ap_flow_structure: allow\n"
        "  qadam-flow_ap_read_step_code: allow\n"
        "---\n"
        "`docs/agents/review-agent.md` `docs/work/REVIEW-CHECKLIST.md`\n"
    ),
    ".claude/agents/dev-agent.md": (
        "---\nname: dev-agent\ndescription: d\n---\n"
        "`docs/agents/dev-agent.md` `docs/work/README.md` `docs/ROADMAP.md` `docs/BACKLOG.md`\n"
    ),
    ".claude/agents/review-agent.md": (
        "---\nname: review-agent\ndescription: r\n"
        "tools: Read, Grep, Glob, Bash, Edit, "
        "mcp__qadam-flow__ap_flow_structure, mcp__qadam-flow__ap_read_step_code\n"
        "---\n"
        "`docs/agents/review-agent.md` `docs/work/REVIEW-CHECKLIST.md`\n"
    ),
    "opencode.json": '{"mcp": {"qadam-flow": {"type": "remote", "url": "https://example.com/mcp"}}}\n',
    ".mcp.json": '{"mcpServers": {"qadam-flow": {"type": "http", "url": "https://example.com/mcp"}}}\n',
}


def write_fixture(root):
    for rel, text in FIXTURE.items():
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)


def patch(root, rel, old, new, count=1):
    path = os.path.join(root, rel)
    with open(path, encoding="utf-8") as fh:
        text = fh.read()
    if old not in text:
        raise AssertionError("фикстура не содержит %r" % old)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(text.replace(old, new, count))


def self_test():
    """Синтетическое дерево: чекер обязан пропускать валидное и ловить подсажки."""
    bad = []

    def run(label, mutate):
        with tempfile.TemporaryDirectory() as tmp:
            write_fixture(tmp)
            mutate(tmp)
            problems = check_tree(tmp)
            if not problems:
                bad.append("не поймано: %s" % label)

    with tempfile.TemporaryDirectory() as tmp:
        write_fixture(tmp)
        problems = check_tree(tmp)
        if problems:
            bad.append("валидное дерево не прошло: %r" % problems)

    run("MCP-мутация в allow-списке ревьюера", lambda t: patch(
        t, ".opencode/agent/review-agent.md",
        "  qadam-flow_ap_flow_structure: allow",
        "  qadam-flow_ap_flow_structure: allow\n  qadam-flow_ap_add_step: allow",
    ))
    run("нет deny по умолчанию", lambda t: patch(
        t, ".opencode/agent/review-agent.md",
        '  "*": deny\n  read:\n    "*": allow', '  read:\n    "*": allow',
    ))
    run("edit расширен за журнал", lambda t: patch(
        t, ".opencode/agent/review-agent.md",
        '    "docs/work/*.md": allow',
        '    "docs/work/*.md": allow\n    "miniapp/*": allow',
    ))
    run("read открыл .env", lambda t: patch(
        t, ".opencode/agent/review-agent.md", '    "*.env": deny', '    "*.env": allow',
    ))
    run("task разрешён ревьюеру", lambda t: patch(
        t, ".opencode/agent/review-agent.md", "  task: deny", "  task: allow",
    ))
    run("адаптер обзавёлся процедурой", lambda t: patch(
        t, ".opencode/agent/dev-agent.md", "`docs/BACKLOG.md`\n",
        "`docs/BACKLOG.md`\n\n## Процедура\n1. Сделай что-то своё\n",
    ))
    run("канон роли пропал", lambda t: os.remove(os.path.join(t, "docs/agents/review-agent.md")))
    run("CLAUDE.md без импорта", lambda t: patch(t, "CLAUDE.md", "@AGENTS.md", "# Свои правила"))
    run("MCP-сервер не покрыт allow-списком", lambda t: patch(
        t, "opencode.json",
        '"qadam-flow": {"type": "remote", "url": "https://example.com/mcp"}',
        '"qadam-flow": {"type": "remote", "url": "https://example.com/mcp"},\n'
        '    "other": {"type": "remote", "url": "https://example.com/mcp"}',
    ))
    run("URL конфигов разошлись", lambda t: patch(
        t, ".mcp.json", "https://example.com/mcp", "https://other.example.com/mcp",
    ))
    run("Claude-адаптер с серверным вилдкардом", lambda t: patch(
        t, ".claude/agents/review-agent.md",
        "mcp__qadam-flow__ap_flow_structure", "mcp__qadam-flow__*",
    ))

    if bad:
        print("САМОПРОВЕРКА ЧЕКЕРА ПРОВАЛЕНА:")
        for line in bad:
            print("  " + line)
        return 2
    print("самопроверка чекера: ok (валидное дерево проходит, подсажки ловятся)")
    return 0


def main(argv):
    root = argv[1] if len(argv) > 1 else "."
    broken = self_test()
    if broken:
        return broken
    problems = check_tree(root)
    for line in problems:
        print(line)
    print("роли: %d, адаптеров: %d, нарушений: %d" % (len(ROLES), sum(len(v) for v in ADAPTERS.values()), len(problems)))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
