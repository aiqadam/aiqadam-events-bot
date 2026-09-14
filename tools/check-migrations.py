#!/usr/bin/env python3
"""Детерминированная сверка: flows/_manifest.json ↔ живой инстанс ↔ migrations.

Зачем. ADR-0021 делает репозиторий источником правды, а синхронность
инстанса фиксирует таблица migrations — «одна строка на каждое изменение
инстанса через MCP». Цена ADR-0021: пропущенная строка «ничем не ловится,
кроме ревью». Этот скрипт — та самая ловушка: он воспроизводит сверку
REVIEW-CHECKLIST п. 2 (migrations ↔ _manifest.json ↔ список флоу) без
человека и без ревьюера.

Как пользоваться (GET-only, ADR-0018; ключ — как в export-flows.sh):

    tools/check-migrations.py

Инварианты (каждое нарушение — код возврата 1):

  A. Репозиторий ↔ инстанс. Набор флоу, flowId и publishedVersionId в
     живом `GET /api/v1/flows` совпадают с `flows/_manifest.json`; у флоу
     есть файл flows/<name>.json. Это же ловит флоу, собранный мимо
     процесса (кейс `menu` из аудита W34).
  B. Инстанс ↔ migrations.
     B1. У флоу со строками последняя строка publish по объекту даёт
         version_id == publishedVersionId и object_id == flowId.
     B2. Если последняя строка объекта — delete, флоу не должен жить.
     B3. Флоу без единой строки обязан иметь updated раньше создания
         таблицы migrations (менявшийся после создания таблицы без строки —
         пропущенная запись, кейс W33–W34).
     B4. Объекты строк существуют в проекте, если последняя их строка —
         не delete.
  C. Гигиена строк: id уникален и в формате YYYY-MM-DD-<пакет>-<NN>;
     applied_at — ISO/UTC; action из допустимых; version_id непустой у
     publish и '-' у остальных; commit — '-' или существующий git-хэш;
     у table:-строк version_id '-' и object_id — живой id таблицы.
  W. Только предупреждения (не валят проверку): похожие на ПД фрагменты в
     note — длинные цифровые последовательности (telegram_id/телефон),
     формат bot-токена и ключ платформы.

Понимать fail-closed, а не «0 ошибок»: если живой список флоу или таблицу
migrations получить не удалось, скрипт падает с ошибкой, а не молча
говорит «OK».
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BASE_URL = os.environ.get("QADAM_BASE_URL", "https://app.flow.aiqadam.org")
PROJECT_ID = os.environ.get("QADAM_PROJECT_ID", "vZXlkfz60dx6kX97yICx7")
KEYCHAIN_SERVICE = "aiqadam-events-bot:qadam-flow-api"

ACTIONS = {"create", "update", "publish", "disable", "delete"}
ID_RE = re.compile(r"^\d{4}-\d{2}-\d{2}-[A-Za-z0-9]+-\d{2}$")
NAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
PII_PATTERNS = (
    ("длинная цифровая последовательность (telegram_id/телефон?)", re.compile(r"\b\d{9,}\b")),
    ("формат bot-токена", re.compile(r"\b\d{5,}:AA[A-Za-z0-9_-]{30,}")),
    ("формат ключа платформы", re.compile(r"\bsk-[A-Za-z0-9]{20,}")),
)


def die(msg, code=2):
    print("ОШИБКА: %s" % msg, file=sys.stderr)
    sys.exit(code)


def load_key():
    if os.environ.get("QADAM_API_KEY"):
        return os.environ["QADAM_API_KEY"]
    try:
        key = subprocess.run(
            ["security", "find-generic-password", "-w", "-s", KEYCHAIN_SERVICE],
            capture_output=True, text=True,
        ).stdout.strip()
    except OSError:
        key = ""
    if key:
        return key
    die(
        "ключа платформы нет ни в QADAM_API_KEY, ни в Keychain (%s).\n"
        "Положить его туда — работа человека (шаг 0.7 ROADMAP); "
        "репозиторий ключ не хранит." % KEYCHAIN_SERVICE,
        code=2,
    )


def api_get(key, path):
    req = urllib.request.Request(
        BASE_URL + path, headers={"Authorization": "Bearer " + key}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def api_get_all(key, path):
    out, cursor = [], None
    while True:
        sep = "&" if "?" in path else "?"
        page_path = path + (sep + "cursor=" + cursor if cursor else "")
        page = api_get(key, page_path)
        out.extend(page.get("data") or [])
        cursor = page.get("next")
        if not cursor:
            return out


def parse_ts(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def migration_rows(key, table_id):
    """Строки migrations: список dict с полями по именам + время вставки записи."""
    pages = []
    cursor = None
    while True:
        page_path = "/api/v1/records?tableId=%s&limit=500" % table_id
        if cursor:
            page_path += "&cursor=" + cursor
        page = api_get(key, page_path)
        pages.append(page)
        cursor = page.get("next")
        if not cursor:
            break
    rows = []
    for page in pages:
        for rec in page.get("data", []):
            cells = rec.get("cells") or {}
            row = {}
            for cell in cells.values():
                row[cell.get("fieldName")] = cell.get("value")
            row["_record_created"] = rec.get("created")
            row["_record_id"] = rec.get("id")
            rows.append(row)
    return rows


def last_publish(rows_for_object):
    """Последняя publish-строка по объекту: max applied_at (тай-брейк — время вставки)."""
    publishes = [r for r in rows_for_object if r.get("action") == "publish"]
    if not publishes:
        return None
    return max(
        publishes,
        key=lambda r: (parse_ts(r.get("applied_at")), parse_ts(r["_record_created"])),
    )


def last_row(rows_for_object):
    return max(
        rows_for_object,
        key=lambda r: (parse_ts(r.get("applied_at")), parse_ts(r["_record_created"])),
    )


def git_commit_exists(sha):
    if not re.fullmatch(r"[0-9a-f]{7,40}", sha):
        return False
    return (
        subprocess.run(
            ["git", "cat-file", "-e", sha + "^{commit}"],
            capture_output=True, cwd=REPO_ROOT,
        ).returncode
        == 0
    )


def main():
    key = load_key()

    manifest = json.load(open(os.path.join(REPO_ROOT, "flows", "_manifest.json")))
    manifest_by_name = {e["flow"]: e for e in manifest}

    fails, warns = [], []

    def fail(msg):
        fails.append(msg)

    def warn(msg):
        warns.append(msg)

    # --- живой инстанс -----------------------------------------------------
    try:
        live_flows = api_get_all(key, "/api/v1/flows?projectId=%s&limit=200" % PROJECT_ID)
        live_tables = api_get_all(key, "/api/v1/tables?projectId=%s&limit=100" % PROJECT_ID)
        live_vars = api_get_all(key, "/api/v1/variables?projectId=%s&limit=100" % PROJECT_ID)
    except Exception as exc:  # noqa: BLE001 — fail-closed: нет данных — нет проверки
        die("живой проект не прочитан (GET): %s" % exc)

    tables_by_name = {t["name"]: t for t in live_tables}
    vars_by_name = {v["name"]: v for v in live_vars}

    # id таблицы migrations — из каталога, чтобы не дублировать источник
    catalog = open(os.path.join(REPO_ROOT, "catalog", "tables", "migrations.md")).read()
    m = re.search(r"внутренний id`?\*?\*:?\s*`([A-Za-z0-9]+)`", catalog)
    migrations_table_id = os.environ.get("QADAM_MIGRATIONS_TABLE_ID") or (m.group(1) if m else None)
    if not migrations_table_id:
        die("в catalog/tables/migrations.md не найден внутренний id таблицы")
    migrations_table = tables_by_name.get("migrations")
    if not migrations_table or migrations_table["id"] != migrations_table_id:
        die("таблица migrations не найдена на инстансе (ожидали id %s)" % migrations_table_id)
    anchor = parse_ts(migrations_table["created"])

    try:
        rows = migration_rows(key, migrations_table_id)
    except Exception as exc:  # noqa: BLE001
        die("записи migrations не прочитаны (GET /records): %s" % exc)

    # --- инвариант A: манифест ↔ инстанс ↔ файлы ---------------------------
    live_by_name = {}
    for f in live_flows:
        name = (f.get("version") or {}).get("displayName") or ""
        live_by_name[name] = f

    for name in sorted(set(manifest_by_name) | set(live_by_name)):
        if name not in live_by_name:
            fail("A: флоу %r есть в манифесте, на инстансе его нет" % name)
            continue
        if name not in manifest_by_name:
            fail("A: флоу %r есть на инстансе, в _manifest.json его нет "
                 "(собран/изменён мимо репозитория?)" % name)
            continue
        f, e = live_by_name[name], manifest_by_name[name]
        if f["id"] != e["flowId"]:
            fail("A: flowId %r: инстанс %s, манифест %s" % (name, f["id"], e["flowId"]))
        if f.get("publishedVersionId") != e["publishedVersionId"]:
            fail("A: %r: publishedVersionId инстанс %s, манифест %s"
                 % (name, f.get("publishedVersionId"), e["publishedVersionId"]))
        if not os.path.exists(os.path.join(REPO_ROOT, "flows", name + ".json")):
            fail("A: для %r нет файла flows/%s.json" % (name, name))

    for name in live_by_name:
        if name not in manifest_by_name and re.fullmatch(NAME_RE, name):
            continue  # уже отрапортовано выше
        if name and not re.fullmatch(NAME_RE, name):
            fail("A: имя флоу %r небезопасно для flows/*.json" % name)

    # --- инвариант C: гигиена строк ----------------------------------------
    rows_by_object = {}
    seen_ids = set()
    for r in rows:
        rid, obj = r.get("id"), r.get("object")
        rows_by_object.setdefault(obj, []).append(r)

        if not ID_RE.fullmatch(rid or ""):
            fail("C: строка %r: id не в формате YYYY-MM-DD-<пакет>-<NN>" % (rid or r["_record_id"]))
        elif rid in seen_ids:
            fail("C: дубликат id %r" % rid)
        seen_ids.add(rid)

        try:
            parse_ts(r.get("applied_at") or "")
        except Exception:  # noqa: BLE001
            fail("C: строка %s: applied_at не ISO/UTC (%r)" % (rid, r.get("applied_at")))

        action = r.get("action")
        if action not in ACTIONS:
            fail("C: строка %s: action %r не из %s" % (rid, action, sorted(ACTIONS)))

        vid = r.get("version_id")
        if action == "publish":
            if not vid or vid == "-":
                fail("C: строка %s: publish без version_id" % rid)
        elif vid is not None and vid != "-":
            fail("C: строка %s: у action %s version_id должен быть '-' (получено %r)"
                 % (rid, action, vid))

        commit = r.get("commit")
        if commit not in ("-", None, "") and not git_commit_exists(commit):
            fail("C: строка %s: commit %r не найден в git" % (rid, commit))

        for pattern_name, pattern in PII_PATTERNS:
            if pattern.search(r.get("note") or ""):
                warn("W: строка %s: в note %s" % (rid, pattern_name))

    # --- инвариант B: инстанс ↔ migrations ---------------------------------
    for name, e in sorted(manifest_by_name.items()):
        obj = "flow:" + name
        rrows = rows_by_object.get(obj, [])
        if not rrows:
            f = live_by_name.get(name)
            if f and parse_ts(f["updated"]) >= anchor:
                fail("B3: флоу %r менялся после создания таблицы migrations "
                     "(updated %s), но строк в migrations нет" % (name, f["updated"]))
            continue
        lp = last_publish(rrows)
        if lp is None:
            continue
        if lp.get("version_id") != e["publishedVersionId"]:
            fail("B1: %r: последняя publish-строка %s даёт version_id %s, "
                 "манифест %s" % (name, lp["id"], lp.get("version_id"), e["publishedVersionId"]))
        if lp.get("object_id") != e["flowId"]:
            fail("B1: %r: object_id последней publish-строки %s (%s), flowId %s"
                 % (name, lp["id"], lp.get("object_id"), e["flowId"]))

    for name, f in sorted(live_by_name.items()):
        obj = "flow:" + name
        rrows = rows_by_object.get(obj, [])
        if rrows and last_row(rrows).get("action") == "delete":
            fail("B2: %r удалён в migrations, но жив на инстансе" % name)

    for obj, rrows in sorted(rows_by_object.items()):
        if last_row(rrows).get("action") == "delete":
            continue
        kind, _, obj_name = obj.partition(":")
        if kind == "flow" and obj_name not in live_by_name:
            fail("B4: %r — строка есть, флоу на инстансе нет (не delete)" % obj)
        elif kind == "table":
            t = tables_by_name.get(obj_name)
            if not t:
                fail("B4: %r — строка есть, таблицы нет (не delete)" % obj)
            else:
                for r in rrows:
                    if r.get("object_id") not in (t["id"], "-"):
                        fail("B4: строка %s: object_id %r, живой id таблицы %s"
                             % (r["id"], r.get("object_id"), t["id"]))
        elif kind == "variable" and obj_name not in vars_by_name:
            fail("B4: %r — строка есть, переменной нет (не delete)" % obj)

    # живые таблицы, созданные после migrations, обязаны иметь строку create
    for name, t in sorted(tables_by_name.items()):
        obj = "table:" + name
        rrows = rows_by_object.get(obj, [])
        if parse_ts(t["created"]) > anchor and not any(
            r.get("action") == "create" for r in rrows
        ):
            fail("B3: таблица %r создана после migrations, строки create нет" % name)

    # --- отчёт --------------------------------------------------------------
    print("migrations: %d строк, %d флоу на инстансе, %d в манифесте"
          % (len(rows), len(live_by_name), len(manifest_by_name)))
    for w in warns:
        print("ПРЕДУПРЕЖДЕНИЕ: %s" % w)
    for f in fails:
        print("РАСХОЖДЕНИЕ: %s" % f)
    if fails:
        print("Итог: %d расхождений — состояние разъехалось" % len(fails))
        sys.exit(1)
    print("Итог: сверка пройдена")


if __name__ == "__main__":
    main()
