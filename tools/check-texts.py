#!/usr/bin/env python3
"""Проверяет, что тексты во входах шагов ссылаются на ключи i18n/ru.json.

Зачем. С W25 (платформенный i18n, `$t`) текст больше не копируется во вход
CODE-шага — там лежит ссылка `{{$t['ключ']}}`, а само значение живёт в
платформенных переводах, импортируемых из `i18n/*.json`. Источник правды —
репозиторий; этот скрипт держит вторую половину инварианта: во входе `texts`
нет ни одной пользовательской строки литералом, каждая ссылка указывает на
существующий ключ `i18n/ru.json` и совпадает с ним по имени.

Почему по имени, а не по значению. Значение в шаге больше не дублируется —
сравнивать нечего; расхождение возможно только в форме ссылки (опечатка,
литерал, `$t` с чужим ключом). Именно это и ловим.

Как пользоваться. Скрипт НЕ ходит в сеть: он читает закоммиченный экспорт
флоу, который снимает `tools/export-flows.sh` (ADR-0018 разрешает GET всем).

    python3 tools/check-texts.py i18n/ru.json flows/*.json

`flows/_manifest.json` можно не исключать — он пропускается сам.

Понимает три формы корня, потому что формат экспорта в проекте менялся:
`.version` (текущая, `GET /flows/:id?versionId=`), `SharedTemplate`
с массивом `flows` (прежняя, `GET /flows/:id/template`) и голый шаг с
`trigger` в корне. Форма, которой не узнал, — это ошибка, а не «0
расхождений»: скрипт, молча не нашедший шагов, хуже отсутствующего.

Обход дерева включает тело цикла (`firstLoopAction`): шаг напоминания живёт
внутри `LOOP_ON_ITEMS`, и без этого его вход не проверялся (найдено в W25).

Выход: строка на каждое расхождение, код возврата 1 если они есть.
"""
import json
import sys


def _walk_branch(branch, out):
    """Ветка ROUTER или continueOnFailure: список детей либо один шаг."""
    if isinstance(branch, dict):
        if isinstance(branch.get("children"), list):
            for child in branch["children"]:
                walk(child, out)
        else:
            walk(branch, out)


def walk(node, out):
    """Собирает все шаги из дерева экспорта флоу.

    Покрывает три места, где шаг терялся: тело цикла (`firstLoopAction`),
    ветки ROUTER (`branches`) и ветки continueOnFailure
    (`continueOnFailureBranches` — объект `onSuccess`/`onFailure`).
    """
    while node:
        out.append(node)
        for branch in (node.get("children") or []):
            walk(branch, out)
        for branch in (node.get("branches") or []):
            _walk_branch(branch, out)
        cfb = node.get("continueOnFailureBranches")
        if isinstance(cfb, dict):
            for branch in cfb.values():
                _walk_branch(branch, out)
        elif isinstance(cfb, list):
            for branch in cfb:
                _walk_branch(branch, out)
        if node.get("firstLoopAction"):
            walk(node["firstLoopAction"], out)
        node = node.get("nextAction")


def expected_ref(key):
    return "{{$t['%s']}}" % key


def check_texts(ru, flows):
    problems = []
    checked = 0
    for name, tree in flows:
        steps = []
        walk(tree, steps)
        for st in steps:
            texts = (st.get("settings") or {}).get("input", {}).get("texts")
            if not isinstance(texts, dict):
                continue
            for key, value in texts.items():
                checked += 1
                want = expected_ref(key)
                if value != want:
                    problems.append(
                        "%s/%s: значение для %r не ссылка на $t\n"
                        "    во флоу: %r\n    ожидалось: %r"
                        % (name, st.get("name"), key, value, want)
                    )
                if key not in ru:
                    problems.append(
                        "%s/%s: ключа %r нет в ru.json" % (name, st.get("name"), key)
                    )
    return checked, problems


def roots(data, path):
    """Достаёт (имя, дерево шагов) из любой известной формы экспорта.

    Возвращает пустой список для файлов, которые флоу не описывают
    (например flows/_manifest.json — это массив).
    """
    if not isinstance(data, dict):
        return []
    tpl = data.get("template", data)
    if not isinstance(tpl, dict):
        return []
    # SharedTemplate: массив flows.
    if isinstance(tpl.get("flows"), list):
        return [
            (f.get("displayName", path), f.get("trigger"))
            for f in tpl["flows"]
            if isinstance(f, dict) and f.get("trigger")
        ]
    # Ответ /flows/:id — версия лежит под .version.
    if isinstance(tpl.get("version"), dict):
        ver = tpl["version"]
        if ver.get("trigger"):
            return [(ver.get("displayName", path), ver["trigger"])]
        return []
    # Текущая форма экспорта: нормализованная .version, trigger в корне.
    if tpl.get("trigger"):
        return [(tpl.get("displayName", path), tpl["trigger"])]
    return []


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    ru = json.load(open(argv[1], encoding="utf-8"))
    flows = []
    skipped = []
    for path in argv[2:]:
        data = json.load(open(path, encoding="utf-8"))
        found = roots(data, path)
        if found:
            flows.extend(found)
        else:
            skipped.append(path)

    if not flows:
        print("НЕ НАЙДЕНО НИ ОДНОГО ФЛОУ в: %s" % ", ".join(argv[2:]))
        print("Форма экспорта не распознана — это ошибка, а не «0 расхождений».")
        return 2

    checked, problems = check_texts(ru, flows)
    for p in problems:
        print(p)
    print(
        "флоу: %d, сверено ссылок $t: %d, расхождений: %d"
        % (len(flows), checked, len(problems))
    )
    if skipped:
        print("пропущено (не флоу): %s" % ", ".join(skipped))
    if checked == 0:
        print("ВНИМАНИЕ: не сверено ни одной ссылки — во входах шагов нет `texts`.")
        return 2
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
