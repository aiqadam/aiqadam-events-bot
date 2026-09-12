#!/usr/bin/env python3
"""Сверяет тексты во входах шагов флоу с i18n/ru.json.

Зачем. ADR-0014 назвал ценой то, что у текста стало два источника правды:
`i18n/ru.json` и вход `texts` CODE-шага. В журнале W24 было написано, что
расхождение «не ловится ничем» — ревью показало, что ловится, и вот чем.

Как пользоваться. Скрипт НЕ ходит в сеть: он читает JSON-экспорты флоу,
которые снимает ревьюер (ADR-0006 разрешает ему GET /flows/<id>/template).

    python3 tools/check-texts.py i18n/ru.json export1.json export2.json ...

Владельцу пакета REST не разрешён, поэтому экспорт для него — не путь.
Ему остаётся `ap_read_step_code` по каждому шагу; формат входа тот же,
и функцию check_texts можно позвать на собранном вручную словаре.

Выход: строка на каждое расхождение, код возврата 1 если они есть.
"""
import json
import sys


def walk(node, out):
    """Собирает все шаги из дерева экспорта флоу."""
    while node:
        out.append(node)
        for branch in (node.get("children") or []):
            walk(branch, out)
        for branch in (node.get("branches") or []):
            walk(branch, out)
        node = node.get("nextAction")


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
                if key not in ru:
                    problems.append(
                        "%s/%s: ключа %r нет в ru.json" % (name, st.get("name"), key)
                    )
                elif ru[key] != value:
                    problems.append(
                        "%s/%s: %r\n    во флоу:   %r\n    в ru.json: %r"
                        % (name, st.get("name"), key, value, ru[key])
                    )
    return checked, problems


def main(argv):
    if len(argv) < 3:
        print(__doc__)
        return 2
    ru = json.load(open(argv[1], encoding="utf-8"))
    flows = []
    for path in argv[2:]:
        data = json.load(open(path, encoding="utf-8"))
        tpl = data.get("template", data)
        flows.append((tpl.get("displayName", path), tpl.get("trigger")))

    checked, problems = check_texts(ru, flows)
    for p in problems:
        print(p)
    print("сверено пар ключ-значение: %d, расхождений: %d" % (checked, len(problems)))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
