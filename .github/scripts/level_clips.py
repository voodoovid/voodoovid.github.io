#!/usr/bin/env python3
"""Brings clips to the same loudness as the SaDos clips (mean about -16.5 dB, peaks under -1.4 dB).
Used by tc_voice.py for the sentries' last words, which come out of the filter chain ~18 dB quieter; also runnable on its own:
  python3 .github/scripts/level_clips.py test-chambers/voice/<hash>.mp3 [...]"""
import os, re, subprocess, sys, tempfile

TARGET_MEAN = -16.5


def mean_db(path):
    err = subprocess.run(["ffmpeg", "-i", path, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True).stderr
    m = re.search(r"mean_volume:\s*(-?[\d.]+) dB", err)
    return float(m.group(1)) if m else None


def level_mp3(path, target=TARGET_MEAN):
    cur = mean_db(path)
    if cur is None:
        return None
    gain = max(-6.0, min(30.0, target - cur))
    tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False, dir=os.path.dirname(os.path.abspath(path))).name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-af", f"volume={gain:.2f}dB,alimiter=limit=0.84:level=disabled", "-codec:a", "libmp3lame", "-b:a", "96k", tmp], check=True)
    os.replace(tmp, path)
    return round(gain, 1)


if __name__ == "__main__":
    for f in sys.argv[1:]:
        print(f, level_mp3(f))
