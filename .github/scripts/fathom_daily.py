#!/usr/bin/env python3
"""Builds Fathom's daily dives: one file per day, fathom/daily/YYYY-MM-DD.json, holding that day's seven prompts and
every accepted answer, most common first (the same [prompt, "answer|answer/alias|..."] shape as fathom/prompts.js).

Each day mixes WD_PER_DAY prompts made fresh from Wikidata (answers ranked by how many Wikipedias have an article
on them, so famous answers sit near the surface and obscure ones sink deep) with curated prompts from prompts.js.
A day's file is never rewritten once it exists, so everyone gets the same dive.

Every Wikidata category with enough answers also goes into fathom/freeplay.json, the pool Free dives draw from. It is
kept apart from the daily files so a free dive never shows a coming day's prompts.

  python3 .github/scripts/fathom_daily.py            make any missing days from yesterday (UTC) to DAYS_AHEAD ahead,
                                                     then add any category missing from freeplay.json
  python3 .github/scripts/fathom_daily.py --check    run every Wikidata category, write fathom/daily/check.txt and
                                                     rebuild fathom/freeplay.json
"""
import datetime, json, os, random, re, subprocess, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "fathom", "daily")
FREE = os.path.join(ROOT, "fathom", "freeplay.json")
ROUNDS, WD_PER_DAY, DAYS_AHEAD, KEEP_PAST = 7, 4, 14, 14
MAX_ANSWERS, MIN_ANSWERS = 200, 20
FREE_BUDGET = 20 * 60                          # seconds a weekly run may spend adding categories to freeplay.json
EPOCH = datetime.date(2026, 10, 12)          # the game's day 0
UA = "FathomDaily/1.0 (https://voodoovid.github.io/fathom/; daily word game prompts)"

# (prompt, pattern binding ?item, minimum Wikipedia articles, kind). kind: "person" adds surnames, "team" adds
# short team names ("Toronto Maple Leafs" -> "Maple Leafs", "Leafs").
def occ(q): return f"?item wdt:P106 wd:{q} ."
def held(q): return f"?item wdt:P39 wd:{q} ."
def won(q): return f"?item wdt:P166 wd:{q} ."
def inst(q): return f"?item wdt:P31 wd:{q} ."
def kind_of(q): return f"?item wdt:P31/wdt:P279* wd:{q} ."
def variety(q): return f"?item (wdt:P31|wdt:P279)/wdt:P279* wd:{q} ."
def country_in(*qs): return f"VALUES ?ct {{ {' '.join('wd:' + q for q in qs)} }} ?item wdt:P31 wd:Q3624078 ; wdt:P30 ?ct ."
def team(league, cls): return f"?item wdt:P118 wd:{league} ; wdt:P31 wd:{cls} ."
def city_in(q): return f"?item wdt:P17 wd:{q} ; wdt:P31/wdt:P279* wd:Q515 ."
def of_country(q, c): return f"?item wdt:P31 wd:{q} ; wdt:P17 wd:{c} ."
def sung_by(artist, kind="Q7366"): return f"?item wdt:P175 wd:{artist} ; wdt:P31/wdt:P279* wd:{kind} ."

CATEGORIES = [
    # places
    ("Name a country", inst("Q3624078"), 1, None),
    ("Name a country in Europe", country_in("Q46"), 1, None),
    ("Name a country in Africa", country_in("Q15"), 1, None),
    ("Name a country in Asia", country_in("Q48"), 1, None),
    ("Name a country in the Americas", country_in("Q49", "Q18"), 1, None),
    ("Name a capital city", "?c wdt:P31 wd:Q3624078 ; wdt:P36 ?item .", 1, None),
    ("Name a US state", inst("Q35657"), 1, None),
    ("Name a US city", inst("Q1093829"), 25, None),
    ("Name a Canadian city", "?item wdt:P17 wd:Q16 ; wdt:P31/wdt:P279* wd:Q515 .", 12, None),
    ("Name a river", inst("Q4022"), 30, None),
    ("Name a mountain", inst("Q8502"), 25, None),
    ("Name a lake", inst("Q23397"), 25, None),
    ("Name an island", inst("Q23442"), 30, None),
    ("Name a volcano", inst("Q8072"), 12, None),
    ("Name a desert", inst("Q8514"), 8, None),
    ("Name a sea", inst("Q165"), 10, None),
    ("Name a UNESCO World Heritage Site", "?item wdt:P1435 wd:Q9259 .", 40, None),
    # science and nature
    ("Name a chemical element", inst("Q11344"), 1, None),
    ("Name a constellation", inst("Q8928"), 1, None),
    ("Name a moon in our solar system", inst("Q2537"), 5, None),
    ("Name a dog breed", inst("Q39367"), 5, None),
    ("Name a cat breed", inst("Q43577"), 3, None),
    ("Name a horse breed", inst("Q1160573"), 5, None),
    ("Name a dinosaur", "?item wdt:P105 wd:Q34740 ; wdt:P171/wdt:P171* wd:Q430 .", 8, None),
    ("Name a disease", inst("Q12136"), 50, None),
    ("Name a gemstone", kind_of("Q83437"), 5, None),
    ("Name a mineral", inst("Q12089225"), 20, None),
    ("Name a programming language", inst("Q9143"), 20, None),
    # people
    ("Name a painter", occ("Q1028181"), 45, "person"),
    ("Name a composer", occ("Q36834"), 45, "person"),
    ("Name a physicist", occ("Q169470"), 45, "person"),
    ("Name a chemist", occ("Q593644"), 35, "person"),
    ("Name a mathematician", occ("Q170790"), 45, "person"),
    ("Name a philosopher", occ("Q4964182"), 55, "person"),
    ("Name a novelist", occ("Q6625963"), 45, "person"),
    ("Name a poet", occ("Q49757"), 55, "person"),
    ("Name a sculptor", occ("Q1281618"), 30, "person"),
    ("Name an architect", occ("Q42973"), 30, "person"),
    ("Name a film director", occ("Q2526255"), 55, "person"),
    ("Name an inventor", occ("Q205375"), 30, "person"),
    ("Name an explorer", occ("Q11900058"), 30, "person"),
    ("Name an astronaut", occ("Q11631"), 25, "person"),
    ("Name a comedian", occ("Q245068"), 35, "person"),
    ("Name a fashion designer", occ("Q3501317"), 25, "person"),
    ("Name a computer scientist", occ("Q82594"), 30, "person"),
    ("Name a Formula One driver", occ("Q10841764"), 40, "person"),
    ("Name a tennis player", occ("Q10833314"), 50, "person"),
    ("Name a chess player", occ("Q10873124"), 30, "person"),
    ("Name a US president", held("Q11696"), 1, "person"),
    ("Name a Canadian prime minister", held("Q839078"), 1, "person"),
    ("Name a British prime minister", held("Q14211"), 1, "person"),
    ("Name a Roman emperor", held("Q842606"), 1, "person"),
    ("Name a pope", held("Q19546"), 25, "person"),
    ("Name a Nobel Prize in Literature winner", won("Q37922"), 1, "person"),
    ("Name a Nobel Prize in Physics winner", won("Q38104"), 1, "person"),
    ("Name a Best Actor Oscar winner", won("Q103916"), 1, "person"),
    ("Name a Best Actress Oscar winner", won("Q103618"), 1, "person"),
    ("Name a Greek god or goddess", kind_of("Q22989102"), 5, None),
    ("Name a Norse god or goddess", kind_of("Q16513881"), 3, None),
    ("Name an Egyptian god or goddess", kind_of("Q146083"), 3, None),
    ("Name a mythical creature", kind_of("Q2239243"), 15, None),
    # culture and things
    ("Name a band", inst("Q215380"), 50, None),
    ("Name a language", inst("Q34770"), 60, None),
    ("Name a currency", inst("Q8142"), 20, None),
    ("Name a religion", inst("Q9174"), 20, None),
    ("Name a car maker", inst("Q786820"), 20, None),
    ("Name a car model", inst("Q3231690"), 25, None),
    ("Name a video game console", kind_of("Q8076"), 10, None),
    ("Name a board game", inst("Q131436"), 12, None),
    ("Name a cocktail", kind_of("Q134768"), 8, None),
    ("Name a cheese", variety("Q10943"), 6, None),
    ("Name a kind of bread", variety("Q7802"), 8, None),
    ("Name a pasta shape", variety("Q178"), 5, None),
    ("Name an airline", inst("Q46970"), 20, None),
    ("Name a newspaper", inst("Q11032"), 25, None),
    ("Name a museum", inst("Q33506"), 40, None),
    ("Name a university", inst("Q3918"), 50, None),
    ("Name a skyscraper", inst("Q11303"), 15, None),
    ("Name a bridge", inst("Q12280"), 20, None),
    ("Name a Shakespeare play", "?item wdt:P50 wd:Q692 ; wdt:P31/wdt:P279* wd:Q25379 .", 1, None),
    ("Name an opera", inst("Q1344"), 20, None),
    ("Name a typeface", inst("Q17451"), 8, None),
    ("Name a war", inst("Q198"), 50, None),
    ("Name an empire", inst("Q48349"), 30, None),
    ("Name a website", inst("Q35127"), 40, None),
    ("Name a musical instrument", "?item wdt:P279/wdt:P279* wd:Q34379 .", 30, None),
    ("Name an NHL team", team("Q1215892", "Q4498974"), 1, "team"),
    ("Name an NBA team", team("Q155223", "Q13393265"), 1, "team"),
    ("Name an NFL team", team("Q1215884", "Q17156793"), 1, "team"),
    ("Name an MLB team", team("Q1163715", "Q13027888"), 1, "team"),
    ("Name a Premier League club", team("Q9448", "Q476028"), 1, "team"),
    # more of everything (added to widen the free-play pool; a category with too few answers is skipped automatically)
    ("Name a Bundesliga club", team("Q82595", "Q476028"), 1, "team"),
    ("Name a La Liga club", team("Q324867", "Q476028"), 1, "team"),
    ("Name a Serie A club", team("Q15804", "Q476028"), 1, "team"),
    ("Name a Ligue 1 club", team("Q13394", "Q476028"), 1, "team"),
    # more places
    ("Name a US state capital", "?c wdt:P31 wd:Q35657 ; wdt:P36 ?item .", 1, None),
    ("Name a UK city", city_in("Q145"), 20, None),
    ("Name a French city", city_in("Q142"), 20, None),
    ("Name a German city", city_in("Q183"), 20, None),
    ("Name an Italian city", city_in("Q38"), 20, None),
    ("Name a Spanish city", city_in("Q29"), 20, None),
    ("Name a Japanese city", city_in("Q17"), 20, None),
    ("Name an Australian city", city_in("Q408"), 15, None),
    ("Name a Brazilian city", city_in("Q155"), 15, None),
    ("Name a waterfall", inst("Q34038"), 15, None),
    ("Name a peninsula", inst("Q34763"), 20, None),
    ("Name a bay", inst("Q39594"), 25, None),
    ("Name a strait", inst("Q37901"), 12, None),
    ("Name a glacier", inst("Q35666"), 12, None),
    ("Name a national park", inst("Q46169"), 25, None),
    ("Name a zoo", inst("Q43501"), 15, None),
    ("Name an airport", inst("Q1248784"), 40, None),
    ("Name a castle", inst("Q23413"), 25, None),
    ("Name a palace", inst("Q16560"), 25, None),
    ("Name a cathedral", inst("Q2977"), 30, None),
    ("Name a stadium", inst("Q483110"), 25, None),
    ("Name a lighthouse", inst("Q39715"), 12, None),
    ("Name a dam", inst("Q12323"), 25, None),
    ("Name a canal", inst("Q12284"), 20, None),
    ("Name a theme park", inst("Q194195"), 20, None),
    ("Name a star", inst("Q523"), 25, None),
    ("Name a galaxy", inst("Q318"), 20, None),
    ("Name a Canadian university", of_country("Q3918", "Q16"), 8, None),
    ("Name a US university", of_country("Q3918", "Q30"), 30, None),
    # more science, food and things
    ("Name a fruit", kind_of("Q3314483"), 10, None),
    ("Name a vegetable", kind_of("Q11004"), 8, None),
    ("Name a spice", kind_of("Q42527"), 8, None),
    ("Name a herb", kind_of("Q207123"), 6, None),
    ("Name a nut", kind_of("Q11009"), 5, None),
    ("Name a metal", kind_of("Q11426"), 5, None),
    ("Name a soup", kind_of("Q41425"), 6, None),
    ("Name a cake", kind_of("Q13276"), 6, None),
    ("Name a dessert", kind_of("Q182818"), 8, None),
    ("Name a wine grape", kind_of("Q10978"), 8, None),
    ("Name a type of tea", variety("Q6097"), 5, None),
    ("Name a unit of measurement", inst("Q47574"), 20, None),
    ("Name an academic subject", inst("Q11862829"), 30, None),
    ("Name a sport", kind_of("Q349"), 25, None),
    ("Name a martial art", kind_of("Q11417"), 10, None),
    ("Name a kind of dance", variety("Q11639"), 10, None),
    ("Name a music genre", inst("Q188451"), 40, None),
    ("Name a color", kind_of("Q1075"), 8, None),
    ("Name an operating system", inst("Q9135"), 25, None),
    ("Name a record label", inst("Q18127"), 40, None),
    ("Name a magazine", inst("Q41298"), 50, None),
    ("Name a bank", inst("Q22687"), 35, None),
    ("Name a festival", inst("Q132241"), 20, None),
    # history
    ("Name a battle", inst("Q178561"), 60, None),
    ("Name a treaty", inst("Q131569"), 40, None),
    ("Name a revolution", inst("Q10931"), 20, None),
    ("Name a political party", inst("Q7278"), 70, None),
    ("Name a dynasty", inst("Q164950"), 20, None),
    # films, shows, books, music and games
    ("Name a film", inst("Q11424"), 120, None),
    ("Name an animated film", inst("Q202866"), 40, None),
    ("Name a TV series", inst("Q5398426"), 90, None),
    ("Name a video game", inst("Q7889"), 80, None),
    ("Name a novel", inst("Q8261"), 80, None),
    ("Name a play", inst("Q25379"), 40, None),
    ("Name a musical", inst("Q2743"), 25, None),
    ("Name a manga series", inst("Q21198342"), 25, None),
    ("Name an album", inst("Q482994"), 80, None),
    ("Name a song", inst("Q7366"), 60, None),
    ("Name a Beatles song", sung_by("Q1299"), 12, None),
    ("Name a fictional character", inst("Q95074"), 70, None),
    ("Name a superhero", inst("Q188784"), 25, None),
    ("Name a cartoon character", inst("Q15711870"), 30, None),
    ("Name a Pokemon", inst("Q3966183"), 20, None),
    # more people
    ("Name a singer", occ("Q177220"), 80, "person"),
    ("Name an actor", occ("Q33999"), 120, "person"),
    ("Name a rapper", occ("Q2252262"), 50, "person"),
    ("Name a guitarist", occ("Q855091"), 50, "person"),
    ("Name a pianist", occ("Q486748"), 55, "person"),
    ("Name a violinist", occ("Q1259917"), 40, "person"),
    ("Name a conductor", occ("Q158852"), 45, "person"),
    ("Name a soccer player", occ("Q937857"), 100, "person"),
    ("Name a basketball player", occ("Q3665646"), 70, "person"),
    ("Name a baseball player", occ("Q10871364"), 60, "person"),
    ("Name a hockey player", occ("Q11774891"), 55, "person"),
    ("Name an American football player", occ("Q19204627"), 60, "person"),
    ("Name a golfer", occ("Q11303721"), 45, "person"),
    ("Name a boxer", occ("Q11338576"), 50, "person"),
    ("Name a swimmer", occ("Q10843402"), 50, "person"),
    ("Name a cricketer", occ("Q12299841"), 60, "person"),
    ("Name a racing driver", occ("Q378622"), 55, "person"),
    ("Name an astronomer", occ("Q11063"), 40, "person"),
    ("Name a biologist", occ("Q864503"), 45, "person"),
    ("Name an economist", occ("Q188094"), 45, "person"),
    ("Name a psychologist", occ("Q212980"), 45, "person"),
    ("Name a historian", occ("Q201788"), 50, "person"),
    ("Name a physician", occ("Q39631"), 55, "person"),
    ("Name a playwright", occ("Q214917"), 55, "person"),
    ("Name a screenwriter", occ("Q28389"), 60, "person"),
    ("Name a photographer", occ("Q33231"), 45, "person"),
    ("Name an entrepreneur", occ("Q131524"), 45, "person"),
    ("Name a saint", occ("Q43115"), 50, "person"),
    ("Name a US vice president", held("Q11699"), 1, "person"),
    ("Name a president of France", held("Q191954"), 1, "person"),
    ("Name a Nobel Peace Prize winner", won("Q35637"), 1, "person"),
    ("Name a Nobel Prize in Chemistry winner", won("Q44585"), 1, "person"),
    ("Name a Nobel Prize in Medicine winner", won("Q80061"), 1, "person"),
    ("Name a Best Director Oscar winner", won("Q103360"), 1, "person"),
    ("Name a Best Picture Oscar winner", won("Q102427"), 1, None),
]

QUERY = """SELECT ?item ?label ?links (GROUP_CONCAT(DISTINCT ?alias; separator="\\t") AS ?aliases) (SAMPLE(?famL) AS ?fam) WHERE {
  { SELECT DISTINCT ?item ?links WHERE { %s ?item wikibase:sitelinks ?links . FILTER(?links >= %d) }
    ORDER BY DESC(?links) LIMIT %d }
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
  %s
} GROUP BY ?item ?label ?links ORDER BY DESC(?links)"""
# Wikidata chokes when one query both ranks the items and attaches their names, so it takes two small ones:
# first the ranked item list (fast), then the names and aliases of just those items.
RANK = """SELECT ?item ?links WHERE { %s ?item wikibase:sitelinks ?links . FILTER(?links >= %d) } ORDER BY DESC(?links) LIMIT %d"""
NAMES = """SELECT ?item ?label (GROUP_CONCAT(DISTINCT ?alias; separator="\\t") AS ?aliases) (SAMPLE(?famL) AS ?fam) WHERE {
  VALUES ?item { %s }
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(LANG(?alias) = "en") }
  %s
} GROUP BY ?item ?label"""
FAMILY = 'OPTIONAL { ?item wdt:P734 ?f . ?f rdfs:label ?famL . FILTER(LANG(?famL) = "en") }'

def sparql(q):
    # curl with a hard time limit: a stalled connection can't hang the run
    last = None
    for attempt in range(2):
        r = subprocess.run(["curl", "-sS", "--max-time", "60", "-A", UA, "-H", "Accept: application/sparql-results+json",
                            "--data-urlencode", "query=" + q, "-w", "\\n%{http_code}", "https://query.wikidata.org/sparql"],
                           capture_output=True, text=True)
        body, _, code = r.stdout.rpartition("\n")
        if r.returncode == 0 and code == "200": return json.loads(body)["results"]["bindings"]
        last = RuntimeError(f"curl {r.returncode} http {code}: {(r.stderr or body)[:150]}")
        if r.returncode == 28 or code in ("500", "502", "504"): break     # too heavy: trying again won't help
        time.sleep(8)
    raise last

def clean(s):
    s = re.sub(r"\s*\([^)]*\)", "", s)                  # "Mercury (planet)" -> "Mercury"
    s = re.sub(r"[|/\t]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def key(s): return re.sub(r"[^a-z0-9]", "", s.lower())

def fetch(cat):
    prompt, pattern, min_links, kind = cat
    ranked = sparql(RANK % (pattern, min_links, MAX_ANSWERS + 40))
    links = {r["item"]["value"].rsplit("/", 1)[1]: r["links"]["value"] for r in ranked}
    named = {}
    for r in sparql(NAMES % (" ".join("wd:" + q for q in links), FAMILY if kind == "person" else "")):
        named.setdefault(r["item"]["value"].rsplit("/", 1)[1], r)
    rows = []                                           # same shape the old single query gave, most linked first
    for q, n in links.items():
        if q in named: rows.append({**named[q], "links": {"value": n}})
    items = []
    for r in rows:
        label = clean(r["label"]["value"])
        if not label or re.fullmatch(r"Q\d+", label) or len(label) > 45: continue
        aliases = [clean(a) for a in r.get("aliases", {}).get("value", "").split("\t")]
        aliases = [a for a in aliases if 2 <= len(a) <= 40 and key(a) and key(a) != key(label)][:8]
        fam = clean(r["fam"]["value"]) if "fam" in r else ""
        items.append({"label": label, "aliases": aliases, "fam": fam, "links": int(r["links"]["value"])})
    if kind == "person":
        # a surname counts on its own when only one person on the list has it ("Lincoln", not "Bush")
        counts = {}
        for it in items:
            sur = it["fam"] or (it["label"].split(" ")[-1] if " " in it["label"] else "")
            if re.fullmatch(r"[IVXLC]+|Jr\.?|Sr\.?", sur): sur = ""
            it["sur"] = sur
            if sur: counts[key(sur)] = counts.get(key(sur), 0) + 1
        for it in items:
            if it["sur"] and counts[key(it["sur"])] == 1 and len(key(it["sur"])) >= 3: it["aliases"].append(it["sur"])
    if kind == "team":
        words = {}
        for it in items:
            w = it["label"].split(" ")
            it["short"] = [" ".join(w[i:]) for i in range(1, len(w))]
            for s in it["short"]: words[key(s)] = words.get(key(s), 0) + 1
        for it in items:
            it["aliases"] += [s for s in it["short"] if words[key(s)] == 1 and len(key(s)) >= 3]
    seen, parts = set(), []
    for it in items:
        names = []
        for n in [it["label"]] + it["aliases"]:
            k = key(n)
            if k and k not in seen and n not in names: names.append(n); seen.add(k)
        if names and key(names[0]) == key(it["label"]): parts.append("/".join(names))
        if len(parts) >= MAX_ANSWERS: break
    return [prompt, "|".join(parts)], items

def curated():
    js = "global.window={};require(process.argv[1]);process.stdout.write(JSON.stringify(window.FATHOM_PROMPTS))"
    return json.loads(subprocess.check_output(["node", "-e", js, os.path.join(ROOT, "fathom", "prompts.js")]))

def order(n, seed, i):
    """Item i of an endless walk through range(n): a fresh shuffle every pass, so nothing repeats within a pass."""
    p = random.Random(seed * 1000003 + i // n).sample(range(n), n)
    return p[i % n]

def make_day(date, cur, bad):
    d = (date - EPOCH).days
    picks, used = [], set()
    i, tries = d * WD_PER_DAY, 0
    while len(picks) < WD_PER_DAY and tries < 40:
        cat = CATEGORIES[order(len(CATEGORIES), 11, i)]
        i += 1; tries += 1
        if cat[0] in bad or key(cat[0]) in used: continue
        try:
            entry, _ = fetch(cat)
        except Exception as e:
            print(date, cat[0], "failed:", e); bad.add(cat[0]); continue
        n = entry[1].count("|") + 1 if entry[1] else 0
        if n < MIN_ANSWERS: print(date, cat[0], "only", n, "answers"); bad.add(cat[0]); continue
        picks.append((entry[0], entry[1], "wd")); used.add(key(entry[0]))
        time.sleep(2)
    j = d * (ROUNDS - WD_PER_DAY)
    while len(picks) < ROUNDS:
        p, lst = cur[order(len(cur), 29, j)]; j += 1
        if key(p) in used: continue
        picks.append((p, lst, "cur")); used.add(key(p))
    random.Random(d).shuffle(picks)
    return {"date": date.isoformat(), "prompts": [[p, l] for p, l, _ in picks], "wikidata": [p for p, _, s in picks if s == "wd"]}

def load_free():
    try: return json.load(open(FREE))["prompts"]
    except Exception: return []

def save_free(prompts):
    """fathom/freeplay.json: [prompt, answers] for every Wikidata category, in CATEGORIES order."""
    order = {c[0]: i for i, c in enumerate(CATEGORIES)}
    prompts = sorted((p for p in prompts if p[0] in order), key=lambda p: order[p[0]])
    open(FREE, "w").write(json.dumps({"built": datetime.date.today().isoformat(), "prompts": prompts},
                                     ensure_ascii=False, separators=(",", ":")) + "\n")
    print("freeplay.json:", len(prompts), "categories", flush=True)

def update_free():
    """Add the categories freeplay.json doesn't have yet (a full rebuild happens with --check)."""
    have = load_free()
    names = {p[0] for p in have}
    start = time.time()
    for cat in CATEGORIES:
        if cat[0] in names: continue
        if time.time() - start > FREE_BUDGET: print("freeplay: out of time, the rest next run"); break
        try:
            entry, _ = fetch(cat)
            if entry[1].count("|") + 1 >= MIN_ANSWERS: have.append(entry); print("freeplay: added", cat[0])
            else: print("freeplay: skipped (too few answers)", cat[0])
        except Exception as e:
            print("freeplay: failed", cat[0], str(e)[:100])
        time.sleep(2)
    save_free(have)

def low_categories():
    """Categories the last --check found with too few answers (a script edit re-checks them)."""
    try: lines = open(os.path.join(OUT, "check.txt")).read().splitlines()
    except Exception: return set()
    return {m[1] for m in (re.match(r"LOW\s+\d+\s+[\d.]+s\s+(.*)", l) for l in lines) if m}

def check_one(cat):
        t = time.time(); entry_ok = None
        try:
            entry, items = fetch(cat)
            n = entry[1].count("|") + 1 if entry[1] else 0
            top = ", ".join(entry[1].split("|")[:8])
            low = ", ".join(entry[1].split("|")[-3:])
            if n >= MIN_ANSWERS: entry_ok = entry
            line = f"{'OK ' if n >= MIN_ANSWERS else 'LOW'} {n:4d} {time.time() - t:5.1f}s  {cat[0]}\n      top: {top}\n      end: {low}"
        except Exception as e:
            line = f"ERR      {time.time() - t:5.1f}s  {cat[0]}: {str(e)[:200]}"
        print(line, flush=True)
        return line, entry_ok

def check():
    # three at a time (Wikidata allows five per visitor); the report is saved as it goes, in category order
    from concurrent.futures import ThreadPoolExecutor
    os.makedirs(OUT, exist_ok=True)
    lines, free = [None] * len(CATEGORIES), []
    with ThreadPoolExecutor(3) as pool:
        futs = {pool.submit(check_one, c): i for i, c in enumerate(CATEGORIES)}
        for f in __import__("concurrent.futures").futures.as_completed(futs):
            lines[futs[f]], entry = f.result()
            if entry: free.append(entry)
            open(os.path.join(OUT, "check.txt"), "w").write("\n".join(l for l in lines if l) + "\n")
            save_free(free)

def main():
    if "--check" in sys.argv: return check()
    os.makedirs(OUT, exist_ok=True)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    cur, bad = curated(), low_categories()
    for k in range(-1, DAYS_AHEAD + 1):            # UTC yesterday covers the Americas' "today"
        date = today + datetime.timedelta(days=k)
        path = os.path.join(OUT, date.isoformat() + ".json")
        if os.path.exists(path): continue
        day = make_day(date, cur, bad)
        open(path, "w").write(json.dumps(day, ensure_ascii=False, separators=(",", ":")) + "\n")
        print(date, "saved:", day["wikidata"])
    cutoff = today - datetime.timedelta(days=KEEP_PAST)
    for f in os.listdir(OUT):
        m = re.fullmatch(r"(\d{4}-\d\d-\d\d)\.json", f)
        if m and datetime.date.fromisoformat(m[1]) < cutoff: os.remove(os.path.join(OUT, f))
    update_free()

if __name__ == "__main__":
    main()
