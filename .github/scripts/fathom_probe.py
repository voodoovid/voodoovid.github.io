#!/usr/bin/env python3
"""Temporary: times a few variants of the Fathom Wikidata query to see which part is slow."""
import subprocess, sys, time, os, importlib.util
sp = importlib.util.spec_from_file_location("fd", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fathom_daily.py"))
fd = importlib.util.module_from_spec(sp); sp.loader.exec_module(fd)
PAT = fd.inst("Q3624078")
Q = {
  "A full query (POST)": fd.QUERY % (PAT, 1, 340, ""),
  "A2 full, limit 120": fd.QUERY % (PAT, 1, 120, ""),
  "B no aliases": f"SELECT ?item ?label ?links WHERE {{ {{ SELECT DISTINCT ?item ?links WHERE {{ {PAT} ?item wikibase:sitelinks ?links . }} ORDER BY DESC(?links) LIMIT 340 }} ?item rdfs:label ?label . FILTER(LANG(?label)='en') }}",
  "C subquery only": f"SELECT ?item ?links WHERE {{ {PAT} ?item wikibase:sitelinks ?links . }} ORDER BY DESC(?links) LIMIT 340",
  "D plain list": f"SELECT ?item WHERE {{ {PAT} }} LIMIT 5",
  "E label service": f"SELECT ?item ?itemLabel WHERE {{ {PAT} SERVICE wikibase:label {{ bd:serviceParam wikibase:language 'en'. }} }} LIMIT 20",
}
out = []
def run(name, q, get=False):
    t = time.time()
    args = ["curl", "-sS", "--max-time", "50", "-A", fd.UA, "-H", "Accept: application/sparql-results+json", "-w", "\n%{http_code}"]
    args += (["-G"] if get else []) + ["--data-urlencode", "query=" + q, "https://query.wikidata.org/sparql"]
    r = subprocess.run(args, capture_output=True, text=True)
    body, _, code = r.stdout.rpartition("\n")
    out.append(f"{name:24s} rc={r.returncode} http={code} {time.time()-t:5.1f}s rows={body.count('\"item\"')} {(r.stderr or body[:100])[:100]!r}"); print(out[-1], flush=True)
for n, q in Q.items(): run(n, q)
run("A full query (GET)", Q["A full query (POST)"], get=True)
run("D plain list (again)", Q["D plain list"])
os.makedirs("fathom/daily", exist_ok=True)
open("fathom/daily/probe.txt", "w").write("\n".join(out) + "\n")
