#!/usr/bin/env python3
"""Parse the AI-map node files, run consistency checks, emit aimap.json.

Node file format (one block per node):
  == <id> | <Name>
  def: ...            definition (required)
  f: ...              core formula (optional)
  aka: a; b           aliases
  pre: id, id=Name    prerequisites
  to: id, ...         leads to
  x: id, ...          cross-links (highways)
  paper: Authors | Title | Year
  yr: 1950
  st: status          d: beg|int|adv          r: llm rag agents cv | all | none
  !defaults k=v ...   defaults for following nodes in the file
A reference "id=Name" points to a node in a continent not built yet (pending).
"""
import json, re, sys, glob, os
from collections import defaultdict

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATUSES = {"foundational", "dominant", "active", "classic", "superseded",
            "milestone", "debate", "border", "unmapped"}
DIFFS = {"beg": "Beginner", "int": "Intermediate", "adv": "Advanced"}
ROUTES = ["llm", "rag", "agents", "cv"]

def parse(path):
    nodes, defaults, cur = [], {}, None
    for ln, raw in enumerate(open(path, encoding="utf-8"), 1):
        line = raw.rstrip("\n")
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("!defaults"):
            defaults = dict(kv.split("=", 1) for kv in s.split()[1:])
            continue
        if s.startswith("== "):
            idn, name = [p.strip() for p in s[3:].split("|", 1)]
            cur = {"id": idn, "name": name, "_file": os.path.basename(path), "_line": ln,
                   "st": defaults.get("st"), "d": defaults.get("d"), "r": defaults.get("r")}
            nodes.append(cur)
            continue
        m = re.match(r"^(\w+):\s?(.*)$", s)
        if not m or cur is None:
            raise SystemExit(f"{path}:{ln}: cannot parse: {s}")
        k, v = m.group(1), m.group(2).strip()
        if k in cur and k not in ("st", "d", "r"):
            raise SystemExit(f"{path}:{ln}: duplicate field {k} in {cur['id']}")
        cur[k] = v
    return nodes

def refs(v):
    out = []
    for part in [p.strip() for p in (v or "").split(",") if p.strip()]:
        if "=" in part:
            i, n = part.split("=", 1); out.append((i.strip(), n.strip()))
        else:
            out.append((part, None))
    return out

def main():
    files = sorted(glob.glob(os.path.join(HERE, "content", "topics", "*.txt")))
    raw = [n for f in files for n in parse(f)]
    errors, warnings = [], []
    byid = {}
    for n in raw:
        if n["id"] in byid:
            errors.append(f"duplicate id {n['id']} ({n['_file']}:{n['_line']})")
        byid[n["id"]] = n
    unmapped = {n["id"] for n in raw if n["id"].count(".") == 0 and n.get("st") == "unmapped"}

    def parent_of(i):
        if i == "ai": return None
        return "ai" if "." not in i else i.rsplit(".", 1)[0]

    pending = {}
    known = {}
    for n in raw:
        for fld in ("pre", "to", "x"):
            for rid, rname in refs(n.get(fld)):
                if rname and rid not in byid: known.setdefault(rid, rname)
    out = []
    for n in raw:
        i = n["id"]; where = f"{n['_file']}:{n['_line']} {i}"
        p = parent_of(i)
        if p and p not in byid:
            errors.append(f"{where}: parent {p} missing")
        for req in ("def", "st", "d"):
            if not n.get(req):
                errors.append(f"{where}: missing {req}")
        if n.get("st") not in STATUSES:
            errors.append(f"{where}: bad status {n.get('st')}")
        if n.get("d") not in DIFFS:
            errors.append(f"{where}: bad difficulty {n.get('d')}")
        r = (n.get("r") or "").replace(",", " ").split()
        if r == ["all"]: r = list(ROUTES)
        if r == ["none"]: r = []
        bad = [x for x in r if x not in ROUTES]
        if bad: errors.append(f"{where}: bad route {bad}")
        node = {"id": i, "name": n["name"], "parent": p, "level": 0 if i == "ai" else i.count(".") + 1,
                "def": n.get("def", ""), "formula": n.get("f"), "aka": [a.strip() for a in n.get("aka", "").split(";") if a.strip()],
                "status": n.get("st"), "difficulty": n.get("d"),
                "year": int(n["yr"]) if n.get("yr") else None, "pre": [], "to": [], "x": []}
        if n.get("rev"):
            rp = [x.strip() for x in n["rev"].split("|")]
            node["review"] = {"by": rp[0], "date": rp[1] if len(rp) > 1 else None}
        if n.get("paper"):
            parts = [x.strip() for x in n["paper"].split("|")]
            if len(parts) != 3 or not parts[2].isdigit():
                errors.append(f"{where}: bad paper field")
            else:
                node["paper"] = {"authors": parts[0], "title": parts[1], "year": int(parts[2])}
                if node["year"] is None and n.get("st") == "milestone":
                    node["year"] = int(parts[2])
        for fld in ("pre", "to", "x"):
            for rid, rname in refs(n.get(fld)):
                if not rname and rid not in byid: rname = known.get(rid)
                if rid == i:
                    errors.append(f"{where}: self-reference in {fld}"); continue
                if rid in byid:
                    node[fld].append(rid)
                    if rname and rname != byid[rid]["name"]:
                        warnings.append(f"{where}: {rid} given name '{rname}' but defined as '{byid[rid]['name']}'")
                    continue
                cont = rid.split(".")[0]
                if cont in unmapped and rname:
                    if rid in pending and pending[rid]["name"] != rname:
                        errors.append(f"{where}: pending {rid} named '{rname}' vs '{pending[rid]['name']}'")
                    pending.setdefault(rid, {"name": rname, "continent": cont, "refs": []})["refs"].append(i)
                    node[fld].append(rid)
                    if fld == "pre":
                        warnings.append(f"{where}: prerequisite {rid} is in an unbuilt continent")
                elif cont in unmapped:
                    errors.append(f"{where}: pending ref {rid} has no name")
                else:
                    errors.append(f"{where}: {fld} -> {rid} does not exist")
        out.append(node)

    # cycle check on prerequisites (defined nodes only)
    g = {n["id"]: [p for p in n["pre"] if p in byid] for n in out}
    color = {}
    def dfs(u, stack):
        color[u] = 1; stack.append(u)
        for v in g[u]:
            if color.get(v) == 1:
                errors.append("prerequisite cycle: " + " -> ".join(stack[stack.index(v):] + [v]))
            elif not color.get(v):
                dfs(v, stack)
        stack.pop(); color[u] = 2
    sys.setrecursionlimit(10000)
    for u in g:
        if not color.get(u): dfs(u, [])

    # prerequisite must not be the node's own ancestor (redundant) or descendant (circular by containment)
    for n in out:
        for p in n["pre"]:
            if p in byid and p.startswith(n["id"] + "."):
                errors.append(f"{n['id']}: prerequisite {p} is its own descendant")
            if n["id"].startswith(p + "."):
                errors.append(f"{n['id']}: prerequisite {p} is its own ancestor (containment is not a prerequisite)")

    # duplicate names / aliases
    names = defaultdict(list)
    for n in out:
        for nm in [n["name"]] + n["aka"]:
            names[nm.lower()].append(n["id"])
    for nm, ids in names.items():
        if len(set(ids)) > 1:
            errors.append(f"duplicate name/alias '{nm}': {ids}")
    for pid, pv in pending.items():
        for nm in [pv["name"].lower()]:
            if nm in names:
                warnings.append(f"pending {pid} '{pv['name']}' shares a name with defined {names[nm]}")

    # reverse edges for UI
    rev = defaultdict(lambda: {"neededBy": [], "from": [], "xBack": []})
    for n in out:
        for p in n["pre"]: rev[p]["neededBy"].append(n["id"])
        for t in n["to"]: rev[t]["from"].append(n["id"])
        for t in n["x"]: rev[t]["xBack"].append(n["id"])

    stats = defaultdict(int)
    for n in out:
        stats[f"L{n['level']}"] += 1
    stats["papers"] = sum(1 for n in out if n.get("paper"))
    stats["edges"] = sum(len(n["pre"]) + len(n["to"]) + len(n["x"]) for n in out)
    stats["pending"] = len(pending)
    data = {"version": 1, "built": [n["id"] for n in out if n["level"]==1 and n["status"]!="unmapped"], "nodes": out,
            "reverse": rev, "pending": pending, "stats": dict(stats)}
    os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
    json.dump(data, open(os.path.join(HERE, "build", "world-of-ai.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    for w in warnings: print("WARN ", w)
    for e in errors: print("ERROR", e)
    print("STATS", dict(stats))
    print(f"{len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)

if __name__ == "__main__":
    main()
