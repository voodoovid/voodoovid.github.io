#!/usr/bin/env python3
"""Add new Wordle answers to Flip Five's New word pool. Run hourly by .github/workflows/wordle.yml.

Reads the recent daily answers saved in flip-five/wordle.json and, for every answer from UTC yesterday or earlier
(so it is already live in every time zone, and tomorrow's word is never revealed), makes sure the word is in ANSWERS
inside flip-five/index.html. A word that was only in EXTRA (accepted as a guess) moves across; a word in neither is added.
The version number is deliberately NOT changed, so a word-list update never shows up as a new game version.

  add_wordle_answers.py [--page PATH] [--days PATH] [--today YYYY-MM-DD]   (the options are for testing)
"""
import argparse, datetime, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ap = argparse.ArgumentParser()
ap.add_argument("--page", default=str(ROOT / "flip-five" / "index.html"))
ap.add_argument("--days", default=str(ROOT / "flip-five" / "wordle.json"))
ap.add_argument("--today", default=datetime.datetime.now(datetime.timezone.utc).date().isoformat())
args = ap.parse_args()

cutoff = (datetime.date.fromisoformat(args.today) - datetime.timedelta(days=1)).isoformat()
days = json.load(open(args.days)).get("days", {})
recent = [d["w"] for k, d in sorted(days.items()) if k <= cutoff and isinstance(d.get("w"), str) and re.fullmatch(r"[a-z]{5}", d["w"])]

page = Path(args.page).read_text(encoding="utf-8")
pat = lambda name: re.compile(r'(const %s\s*=\s*")([a-z]+)(")' % name)
ma, mx = pat("ANSWERS").search(page), pat("EXTRA").search(page)
assert ma and mx, "ANSWERS / EXTRA strings not found"
split = lambda s: re.findall(".{5}", s)
assert len(ma.group(2)) % 5 == 0 and len(mx.group(2)) % 5 == 0, "word strings are not whole five-letter words"
answers, extra = split(ma.group(2)), split(mx.group(2))
assert len(answers) > 2000 and len(extra) > 10000, "word lists look wrong; refusing to edit"
have = set(answers)
new = []
for w in recent:
    if w not in have and w not in new:
        new.append(w)
if not new:
    print("no new answers (checked %d recent words up to %s)" % (len(recent), cutoff)); raise SystemExit
before = set(answers) | set(extra)
extra = [w for w in extra if w not in new]
answers = answers + new
assert before <= set(answers) | set(extra), "a guessable word would be lost"
# write EXTRA first: replacing ANSWERS moves the offsets after it
page = page[:mx.start(2)] + "".join(extra) + page[mx.end(2):] if mx.start() > ma.start() else page
if mx.start() > ma.start():
    ma = pat("ANSWERS").search(page)
    page = page[:ma.start(2)] + "".join(answers) + page[ma.end(2):]
else:
    page = page[:ma.start(2)] + "".join(answers) + page[ma.end(2):]
    mx = pat("EXTRA").search(page)
    page = page[:mx.start(2)] + "".join(extra) + page[mx.end(2):]
Path(args.page).write_text(page, encoding="utf-8")
print("added %d new answers: %s" % (len(new), " ".join(new)))
