#!/usr/bin/env python3
"""Voices new Test Chambers lines (run by .github/workflows/tc-voice.yml, which has internet access).
Reads test-chambers/voice-todo.json ([{hash, chamber, text}], written from __tc.allLines() for lines without a clip),
speaks each with Kokoro (af_heart, the natural SaDos base voice), runs them through glados_voice.py (the SaDos effect,
stutter by chamber), adds them to voice/, lines.js and the offline list in sw.js, and empties the todo list.
Entries with "voice": "sentry" are the sentries' last words: a different Kokoro voice, pitched up and band-limited like a
little speaker (no SaDos effect), written straight to voice/.
"""
import json, os, re, subprocess, sys, tempfile
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from level_clips import level_mp3
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
TC = os.path.join(ROOT, "test-chambers")
SCRIPTS = os.path.join(ROOT, ".github", "scripts")


def fnv1a(text):  # the same hash the game uses (lineHash): FNV-1a over UTF-16 code units, 8 hex digits
    h = 0x811C9DC5
    data = text.encode("utf-16-le")
    for i in range(0, len(data), 2):
        h ^= data[i] | (data[i + 1] << 8)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"


SENTRY_VOICE = "af_sky"
SENTRY_PITCH = 1.14      # pitch up by this factor, tempo kept
SENTRY_FILTER = "asetrate={hi},aresample={sr},atempo={tempo:.4f},highpass=f=380,lowpass=f=5000,acompressor=threshold=-20dB:ratio=3,aecho=0.7:0.5:16:0.18,volume=1.3"


def sentry_mp3(wav, sr, out):          # the sentries' small, bright speaker voice
    flt = SENTRY_FILTER.format(hi=int(sr * SENTRY_PITCH), sr=sr, tempo=1 / SENTRY_PITCH)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-af", flt, "-codec:a", "libmp3lame", "-b:a", "96k", out], check=True)
    level_mp3(out)                     # the filter chain leaves it ~18 dB under SaDos: bring it to her level
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True, check=True).stdout
    return round(float(probe.strip()), 2)


def main(model, voices):
    todo = json.load(open(os.path.join(TC, "voice-todo.json")))
    if not todo:
        print("nothing to voice"); return
    for t in todo:
        if fnv1a(t["text"]) != t["hash"]:
            sys.exit(f"hash mismatch for {t['text']!r}: {fnv1a(t['text'])} != {t['hash']}")
    levels_path = os.path.join(SCRIPTS, "glados_levels.json")
    levels = json.load(open(levels_path))
    for t in todo:
        if t.get("voice") != "sentry":
            levels[t["hash"]] = t["chamber"]
    json.dump(levels, open(levels_path, "w"), indent=0)

    kokoro = Kokoro(model, voices)
    with tempfile.TemporaryDirectory() as tmp:
        natural = os.path.join(tmp, "natural"); os.makedirs(natural)
        sentry_durs = {}
        for t in todo:
            if t.get("voice") == "sentry":
                samples, sr = kokoro.create(t["text"], voice=SENTRY_VOICE, speed=1.05, lang="en-us")
                wav = os.path.join(tmp, t["hash"] + ".wav"); sf.write(wav, np.asarray(samples, dtype=np.float32), sr)
                os.makedirs(os.path.join(TC, "voice"), exist_ok=True)
                sentry_durs[t["hash"]] = sentry_mp3(wav, sr, os.path.join(TC, "voice", t["hash"] + ".mp3"))
                print("spoke (sentry)", t["hash"], t["text"][:60]); continue
            speak = t["text"].replace("SaDos", "Sahdos")      # her name is said "SAH-dos"
            samples, sr = kokoro.create(speak, voice="af_heart", speed=1.0, lang="en-us")
            wav = os.path.join(tmp, t["hash"] + ".wav"); sf.write(wav, np.asarray(samples, dtype=np.float32), sr)
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "96k", os.path.join(natural, t["hash"] + ".mp3")], check=True)
            print("spoke", t["hash"], t["text"][:60])
        durs = dict(sentry_durs)
        if os.listdir(natural):
            out = subprocess.run([sys.executable, os.path.join(SCRIPTS, "glados_voice.py"), natural, os.path.join(TC, "voice")], capture_output=True, text=True, check=True).stdout
            durs.update(json.loads(out.strip().splitlines()[-1]))

    lines_path = os.path.join(TC, "lines.js")
    src = open(lines_path).read()
    m = re.search(r"window\.TC_VOICE\s*=\s*(\{.*\})\s*;?\s*$", src, re.S)
    have = json.loads(m.group(1)); have.update(durs)
    open(lines_path, "w").write("window.TC_VOICE = " + json.dumps(have) + ";\n")

    sw_path = os.path.join(ROOT, "sw.js")
    sw = open(sw_path).read()
    new = [f'"test-chambers/voice/{h}.mp3"' for h in durs if f"test-chambers/voice/{h}.mp3" not in sw]
    if new:
        sw = sw.replace('"test-chambers/lines.js",', '"test-chambers/lines.js", ' + ", ".join(new) + ",", 1)
    if durs:                     # new or re-recorded clips: a new cache name makes installed copies fetch them
        sw = re.sub(r'const CACHE = "voodoovid-games-v(\d+)";', lambda k: f'const CACHE = "voodoovid-games-v{int(k.group(1)) + 1}";', sw, 1)
        open(sw_path, "w").write(sw)
    json.dump([], open(os.path.join(TC, "voice-todo.json"), "w"))
    print(f"voiced {len(durs)} lines")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
