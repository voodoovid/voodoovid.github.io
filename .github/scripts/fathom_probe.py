#!/usr/bin/env python3
"""Temporary: times a few variants of the Fathom Wikidata query to see which part is slow."""
import subprocess, sys, time, os, importlib.util
sp = importlib.util.spec_from_file_location("fd", os.path.join(os.path.dirname(os.path.abspath(__file__)), "fathom_daily.py"))
fd = importlib.util.module_from_spec(sp); sp.loader.exec_module(fd)
out = []
for name in ["Name a country", "Name a painter", "Name a film", "Name a river"]:
    cat = [c for c in fd.CATEGORIES if c[0] == name][0]
    t = time.time()
    try:
        entry, _ = fd.fetch(cat)
        out.append(f"{name:22s} OK {time.time()-t:5.1f}s answers={entry[1].count('|')+1} top={entry[1][:70]!r}")
    except Exception as e:
        out.append(f"{name:22s} ERR {time.time()-t:5.1f}s {str(e)[:150]!r}")
    print(out[-1], flush=True)
os.makedirs("fathom/daily", exist_ok=True)
open("fathom/daily/probe.txt", "w").write("\n".join(out) + "\n")
