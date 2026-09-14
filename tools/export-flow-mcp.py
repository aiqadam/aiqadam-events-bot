#!/usr/bin/env python3
"""Кладёт снимок флоу, снятый MCP-инструментом `ap_export_flow`, в flows/<name>.json
в той же нормализованной форме, что и tools/export-flows.sh, и обновляет
_manifest.json.

Зачем два пути. export-flows.sh ходит в REST с ключом платформы и доказывает
опубликованность версии сверкой publishedVersionId. У агента ключа может не
быть; `ap_export_flow` доступен через MCP без ключа, но отдаёт текущий
черновик. Решением владельца (ADR-0021) источник правды — репозиторий, а
факт синхронности инстанса фиксируется таблицей `migrations`, поэтому снимок
через MCP допустим при условии, что черновик равен опубликованной версии
(снимок снимается сразу после ap_lock_and_publish, до любой правки) и это
записано в манифест: `source: "mcp"`, `versionId` — из flows[0].id.

    python3 tools/export-flow-mcp.py <raw-ap_export_flow.json> [...]

Секреты: ap_export_flow по своему контракту не содержит значений connections
и variables; check-export-secrets.sh всё равно запускать перед коммитом.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "flows")
DROP_EVERYWHERE = ("lastUpdatedDate", "lastTestDate", "sampleDataFileId")
DROP_ROOT = ("created", "updated", "id", "flowId", "updatedBy")
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")


def walk(node):
    if isinstance(node, dict):
        return {k: walk(v) for k, v in node.items() if k not in DROP_EVERYWHERE}
    if isinstance(node, list):
        return [walk(x) for x in node]
    return node


def main(paths):
    manifest_path = os.path.join(OUT, "_manifest.json")
    manifest = json.load(open(manifest_path, encoding="utf-8")) if os.path.exists(manifest_path) else []
    by_flow = {m["flow"]: m for m in manifest}
    for p in paths:
        raw = json.load(open(p, encoding="utf-8"))
        flows = raw.get("flows") or []
        if len(flows) != 1:
            sys.exit("%s: ожидали ровно один flows[], получили %d" % (p, len(flows)))
        v = flows[0]
        name = v.get("displayName", "")
        if not SAFE_NAME.match(name) or ".." in name:
            sys.exit("%s: небезопасное имя флоу %r" % (p, name))
        if v.get("state") != "LOCKED":
            sys.exit("%s: версия не LOCKED — черновик правился после публикации, снимок не годится" % p)
        version_id, flow_id = v.get("id"), v.get("flowId")
        norm = walk(v)
        for k in DROP_ROOT:
            norm.pop(k, None)
        with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(norm, f, ensure_ascii=False, indent=2, sort_keys=True)
            f.write("\n")
        by_flow[name] = {"flow": name, "flowId": flow_id, "publishedVersionId": version_id, "source": "mcp"}
        print("записан flows/%s.json (version %s, source mcp)" % (name, version_id))
    manifest = sorted(by_flow.values(), key=lambda m: m["flow"])
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")
    print("_manifest.json: %d флоу" % len(manifest))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
