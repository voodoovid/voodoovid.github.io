#!/usr/bin/env python3
"""Turns the natural Kokoro SaDos clips into the flat, cold, slightly glitchy SaDos voice.
usage: glados_voice.py IN_DIR OUT_DIR   (reads IN_DIR/*.mp3, writes OUT_DIR/*.mp3 and prints {hash: seconds})
Chain: channel vocoder on a near-monotone buzz (stepped pitch) mixed with the dry voice, a few stutter glitches,
a touch of sample-hold grit, a hollow comb, a short metallic echo, then a deliberate 0.93x slow-down.
Original (natural) clips: git show 0ff98cc:test-chambers/voice/<hash>.mp3
"""
import sys, os, subprocess, json, zlib
import numpy as np
from scipy.signal import butter, sosfilt

SR = 24000
DRY, WET = 0.34, 0.80        # dry voice and vocoded voice levels
F0 = 168.0                   # buzz pitch (Hz); steps +-1 semitone every ~0.15 s
SLOW = 0.93

def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ar", str(SR), "-ac", "1", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)

def encode(x, path):
    pcm = np.clip(x, -1, 1).astype(np.float32).tobytes()
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-filter:a", f"atempo={SLOW}", "-codec:a", "libmp3lame", "-b:a", "88k", path], input=pcm, check=True)

def vocode(x, rng):
    n = len(x)
    edges = [150.0]                                      # every band is wide enough to hold a buzz harmonic
    while edges[-1] < 7800: edges.append(max(edges[-1] * 1.2, edges[-1] + 185))
    edges = np.array(edges)
    # stepped near-monotone pitch
    step = int(0.15 * SR); n_steps = n // step + 2
    semis = rng.choice([-1, 0, 0, 1], size=n_steps)
    f0 = F0 * 2 ** (np.repeat(semis, step)[:n] / 12.0)
    phase = np.cumsum(f0 / SR) % 1.0
    saw = phase * 2 - 1
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    env_lp = butter(2, 55, btype="low", fs=SR, output="sos")
    for lo, hi in zip(edges[:-1], edges[1:]):
        bp = butter(2, [lo, min(hi, SR / 2 - 100)], btype="band", fs=SR, output="sos")
        mod = sosfilt(bp, x)
        env = np.maximum(sosfilt(env_lp, np.abs(mod)) * 1.9, 0)
        mix = 0.0 if hi < 2200 else (0.45 if hi < 4200 else 0.9)       # high bands: mostly noise so s/t/k stay crisp
        car = sosfilt(bp, saw * (1 - mix) + noise * 0.35 * mix)
        out += car * env
    rms = lambda a: np.sqrt(np.mean(a ** 2) + 1e-12)
    return out * (rms(x) / rms(out))

def glitch(x, rng):
    # a few short stutters at loud moments
    n = len(x); frame = int(0.03 * SR)
    e = np.array([np.abs(x[i:i + frame]).mean() for i in range(0, n - frame, frame)])
    if len(e) < 20: return x
    loud = np.where(e > np.percentile(e, 60))[0]
    loud = loud[(loud > 6) & (loud < len(e) - 8)]
    if len(loud) == 0: return x
    k = 1 if n < 2.5 * SR else 2 if n < 6 * SR else 3
    picks = sorted(rng.choice(loud, size=min(k, len(loud)), replace=False))
    y = x.copy(); shift = 0
    for p in picks:
        a = p * frame + shift; L = int(rng.uniform(0.035, 0.06) * SR)
        seg = y[a:a + L].copy()
        if len(seg) < L: continue
        fade = np.linspace(0, 1, 120); seg[:120] *= fade; seg[-120:] *= fade[::-1]
        reps = int(rng.choice([2, 3]))
        y = np.concatenate([y[:a + L], np.tile(seg, reps), y[a + L:]]); shift += L * reps
    return y

def comb(x):
    d = lambda a, ms, g: np.concatenate([np.zeros(int(SR * ms / 1000)), a])[:len(a)] * g
    y = x + d(x, 3.7, 0.30) + d(x, 8.1, 0.16)
    y = y + d(y, 62, 0.11) + d(y, 118, 0.06)
    return y

def grit(x):
    hold = np.repeat(x[::2], 2)[:len(x)]
    q = np.round(hold * 90) / 90
    return x * 0.8 + q * 0.2

def process(x, seed):
    rng = np.random.default_rng(seed)
    pad = np.zeros(int(0.12 * SR)); x = np.concatenate([pad, x, pad])
    v = vocode(x, rng)
    y = DRY * x + WET * v
    y = glitch(y, rng); y = grit(y); y = comb(y)
    y = np.tanh(y * 1.25) / np.tanh(1.25)
    y *= 0.89 / (np.max(np.abs(y)) + 1e-9)
    f = int(0.01 * SR); y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    return y

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]; os.makedirs(dst, exist_ok=True); durs = {}
    for fn in sorted(os.listdir(src)):
        if not fn.endswith(".mp3"): continue
        h = fn[:-4]; x = decode(os.path.join(src, fn))
        y = process(x, zlib.crc32(h.encode()))
        out = os.path.join(dst, fn); encode(y, out)
        durs[h] = round(len(y) / SR / SLOW, 2)
    print(json.dumps(durs))
