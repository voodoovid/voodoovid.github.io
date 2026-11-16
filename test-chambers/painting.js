// Test Chambers: the painting in the Records office (v8.7). An ORIGINAL landscape, painted in code: no real picture is copied.
// "The Long Valley, Evening": a river valley at golden hour, low sun on the left, lit clouds, hazy mountains, a big tree on the right.
// How: an underpainting (sky and clouds per pixel, land as shapes), then about 40,000 brush strokes that take their colour from it
// (big, medium, small; each with bristle lines), then highlights, a warm varnish and a vignette. Same seed, same picture.
//   import { paintLandscape } from "./painting.js";  paintLandscape(canvas);
export const PAINTING = { title: "The Long Valley, Evening", w: 1152, h: 896 };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function makeNoise(seed) {
  const hsh = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1013904223) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hsh(xi, yi), b = hsh(xi + 1, yi), c = hsh(xi, yi + 1), d = hsh(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * n2(x * f, y * f); t += a; a *= .5; f *= 2.03; } return s / t; };
  return { n2, fbm };
}
const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, sm = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const ramp = (stops, t) => { for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); return stops[stops.length - 1][1]; };

export function paintLandscape(canvas, seed = 1847) {
  const W = canvas.width = PAINTING.w, H = canvas.height = PAINTING.h, R = mulberry(seed), { n2, fbm } = makeNoise(seed);
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const UC = mk(), U = UC.getContext("2d", { willReadFrequently: true }), MC = mk(), M = MC.getContext("2d", { willReadFrequently: true });
  const HOR = 0.615, SUN = [0.27, 0.565];
  M.fillStyle = "#000"; M.fillRect(0, 0, W, H);
  const KIND = ["rgb(0,0,0)", "rgb(50,0,0)", "rgb(100,0,0)", "rgb(150,0,0)", "rgb(200,0,0)"];          // sky, mountain, land, water, foliage (red channel / 50)
  const shape = (path, fill, kind) => { for (const g of [U, M]) { g.beginPath(); path(g); g.fillStyle = g === U ? fill : KIND[kind]; g.fill(); } };

  // ----- sky and clouds, per pixel at half size. The clouds are cumulus built from spheres (a height field), lit from the sun's side -----
  {
    const sw = W / 2 | 0, sh = Math.ceil(H * (HOR + 0.03) / 2), img = new ImageData(sw, sh), d = img.data, hf = new Float32Array(sw * sh), bs = new Float32Array(sw * sh).fill(-1);
    // [centre u, base v, width, height, puffs]: a tower right of centre, a bank on the left, high ones, and small flat ones far off
    const CLOUDS = [[.56, .385, .44, .33, 190], [.17, .31, .36, .2, 130], [.40, .125, .26, .09, 60], [.93, .16, .3, .13, 70], [.02, .09, .22, .07, 36],
      [.45, .47, .13, .045, 30], [.74, .49, .17, .05, 34], [.09, .475, .14, .04, 26], [.91, .51, .12, .035, 22], [.31, .505, .09, .025, 16]];
    for (const [cu, bv, cw, ch, n] of CLOUDS) {
      const base = bv * H / 2;
      for (let i = 0; i < n; i++) {
        const t = R(), env = (1 - Math.abs(2 * t - 1) ** 2.2) * (.55 + .45 * n2(t * 5 + cu * 31, bv * 17)), up = R() ** .8;
        const r = cw * sw * (R() < .3 ? .02 + .03 * R() : .05 + .07 * R()) * (1.15 - .5 * up), px = (cu + (t - .5) * cw) * sw, py = base - up * env * ch * H / 2 - r * .25;
        const x0 = Math.max(0, px - r | 0), x1 = Math.min(sw - 1, px + r + 1 | 0), y0 = Math.max(0, py - r | 0), y1 = Math.min(sh - 1, Math.min(py + r, base) | 0);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const q = r * r - (x - px) ** 2 - (y - py) ** 2; if (q <= 0) continue; const h = Math.sqrt(q) * Math.min(1, (base - y) / 3), k = y * sw + x; if (h > hf[k]) { hf[k] = h; bs[k] = base; } }
      }
    }
    const hAt = (x, y) => hf[clamp(y | 0, 0, sh - 1) * sw + clamp(x | 0, 0, sw - 1)];
    const wisp = (u, v) => { const s = sm(.42, .56, v); return lerp(fbm(u * 2.2 + 3.1, v * 9 + 1.3, 4) - .1, fbm(u * 2.4 + 9, v * 30 + 4, 3) + .03, s); };
    const SKY = [[0, [46, 80, 132]], [.45, [104, 148, 186]], [.8, [208, 208, 180]], [1, [247, 210, 146]], [1.2, [247, 210, 146]]];
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const u = x / sw, v = y * 2 / H, t = v / HOR;
      let c = ramp(SKY, t);
      const du = (u - SUN[0]) * (W / H), dv = v - SUN[1], dd = du * du + dv * dv, l = Math.sqrt(dd) + 1e-4, glow = Math.exp(-dd / .07);
      c = mix(c, [255, 234, 170], glow * .7);
      const ws = sm(.55, .70, wisp(u, v)) * (.28 + .5 * sm(.42, .52, v)) * (1 - .6 * sm(.5, .62, v));        // thin high cloud, and bars low over the hills
      if (ws > 0) c = mix(c, mix([236, 226, 214], [255, 214, 150], clamp(t)), ws);
      const wx = x + (n2(u * 26, v * 26) - .5) * 9 + (n2(u * 70, v * 70) - .5) * 3, wy = y + (n2(u * 26 + 40, v * 26) - .5) * 7, h = hAt(wx, wy);
      if (h > 0) {
        const gx = hAt(wx + 2, wy) - hAt(wx - 2, wy), gy = hAt(wx, wy + 2) - hAt(wx, wy - 2), nl = Math.hypot(gx, gy, 3.2), nx = -gx / nl, ny = -gy / nl, nz = 3.2 / nl;
        const lit = clamp(nx * (-du / l) * .7 + ny * (-dv / l) * .5 + ny * -.6 + nz * .5 + .1);                // the sun's side, a little from the sky above, a little straight on
        const base = bs[clamp(wy | 0, 0, sh - 1) * sw + clamp(wx | 0, 0, sw - 1)], under = sm(26, 2, base - wy) * (1 - lit * .5);
        const light = mix([255, 251, 240], [255, 222, 164], clamp(t * t * 1.2)), shade = mix(mix([124, 136, 172], [170, 150, 156], clamp(t * t)), [204, 150, 120], under * .7 * clamp(t * 1.5));
        let cc = mix(shade, light, sm(.2, .66, lit));
        const rim = (1 - sm(0, 7, h)) * clamp(-(gx * du + gy * dv) / (l * (Math.hypot(gx, gy) + .01)) * -1 + .3);      // thin edges on the sun's side glow
        cc = mix(cc, [255, 244, 210], rim * .6);
        c = mix(c, cc, sm(0, 2.2, h) * (.97 - .25 * sm(.44, .52, v)));
      }
      const i = (y * sw + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    const sc = document.createElement("canvas"); sc.width = sw; sc.height = sh; sc.getContext("2d").putImageData(img, 0, 0);
    U.imageSmoothingQuality = "high"; U.drawImage(sc, 0, 0, W, sh * 2);
  }
  // ----- mountains, three ranges, lower where the valley opens toward the sun -----
  const RANGES = [{ b: .52, a: .25, f: 2.0, c1: [112, 128, 176], c2: [206, 192, 176] }, { b: .565, a: .13, f: 3.3, c1: [92, 112, 140], c2: [186, 178, 142] }, { b: .606, a: .06, f: 5.2, c1: [70, 92, 80], c2: [150, 150, 96] }];
  RANGES.forEach((r, i) => {
    const yOf = u => r.b - r.a * (fbm(u * r.f + i * 13.7, i * 7.7 + 2, 5) - .3) * 2 * (.3 + .7 * sm(.03, .34, Math.abs(u - .34)));
    const gr = U.createLinearGradient(0, (r.b - r.a) * H, 0, (HOR + .02) * H); gr.addColorStop(0, css(r.c1)); gr.addColorStop(1, css(r.c2));
    shape(g => { g.moveTo(0, H * (HOR + .02)); for (let x = 0; x <= W; x += 3) g.lineTo(x, yOf(x / W) * H); g.lineTo(W, H * (HOR + .02)); g.closePath(); }, gr, 1);
    for (let x = 0; x < W; x += 5) {                   // faces turned to the sun catch the light, the others fall into blue shadow
      const u = x / W, y0 = yOf(u), sl = (yOf(u + .012) - yOf(u - .012)) * (u > SUN[0] ? -1 : 1), lit = clamp(sl * 26), sh = clamp(-sl * 26), hgt = (HOR - y0) * H * (.35 + .5 * n2(u * 40, i));
      if (hgt < 3) continue;
      const g2 = U.createLinearGradient(0, y0 * H, 0, y0 * H + hgt); g2.addColorStop(0, lit > sh ? css([255, 222, 170], .5 * lit) : css([58, 70, 120], .4 * sh)); g2.addColorStop(1, "rgba(128,128,128,0)");
      U.fillStyle = g2; U.fillRect(x, y0 * H + 1, 5, hgt);
    }
  });
  { const g = U.createRadialGradient(SUN[0] * W, SUN[1] * H, 0, SUN[0] * W, SUN[1] * H, W * .46); g.addColorStop(0, "rgba(255,232,170,.55)"); g.addColorStop(.35, "rgba(255,222,160,.16)"); g.addColorStop(1, "rgba(255,220,160,0)"); U.fillStyle = g; U.fillRect(0, 0, W, H * (HOR + .02)); }
  // ----- the valley floor -----
  { const g = U.createLinearGradient(0, HOR * H, 0, H); g.addColorStop(0, "rgb(214,194,120)"); g.addColorStop(.12, "rgb(168,166,88)"); g.addColorStop(.4, "rgb(110,128,62)"); g.addColorStop(1, "rgb(50,70,36)");
    shape(c => c.rect(0, HOR * H - 2, W, H), g, 2); }
  for (let i = 0; i < 170; i++) {                      // fields and cloud shadows, flattened by distance
    const v = HOR + .008 + R() ** 1.6 * .36, s = (v - HOR) / (1 - HOR), u = R(), rw = (.03 + R() * .1) * (.4 + s * 1.6), lit = R() < .5 + .3 * sm(.6, .0, Math.abs(u - SUN[0]));
    U.fillStyle = lit ? css([226, 196, 104], .16 + R() * .2) : css([44, 74, 46], .14 + R() * .2);
    U.beginPath(); U.ellipse(u * W, v * H, rw * W, rw * W * (.035 + s * .07), (R() - .5) * .1, 0, 7); U.fill();
  }
  // ----- the river, winding out of the light -----
  const rivC = s => .36 + .2 * s + .12 * Math.sin(s * 5.2 + .4) * (.3 + s), rivW = s => .004 + .17 * s ** 1.8;
  {
    const g = U.createLinearGradient(0, HOR * H, 0, H); g.addColorStop(0, "rgb(255,232,170)"); g.addColorStop(.3, "rgb(214,208,180)"); g.addColorStop(.65, "rgb(140,162,176)"); g.addColorStop(1, "rgb(84,116,142)");
    shape(c => { const N = 60; for (let i = 0; i <= N; i++) { const s = i / N; c.lineTo((rivC(s) - rivW(s)) * W, (HOR + s * (1 - HOR)) * H); } for (let i = N; i >= 0; i--) { const s = i / N; c.lineTo((rivC(s) + rivW(s)) * W, (HOR + s * (1 - HOR)) * H); } c.closePath(); }, g, 3);
    for (const side of [-1, 1]) for (let i = 0; i < 70; i++) {          // dark bank reflections along both edges
      const s = .08 + R() * .92, x = (rivC(s) + side * rivW(s) * (.72 + R() * .26)) * W, y = (HOR + s * (1 - HOR)) * H;
      U.fillStyle = css([40, 62, 48], .22 + .3 * s); U.beginPath(); U.ellipse(x, y, (6 + 40 * s) * (0.6 + R()), 2 + 6 * s, 0, 0, 7); U.fill();
    }
  }
  // ----- trees: far hedgerows, nearer copses with long shadows, a farm -----
  const HAZE = [176, 168, 122];
  function copse(u, v, len, hgt, haze) {             // a line of trees standing on the ground at v: lumpy top, flat foot, lit on the sun's side
    const n = Math.max(3, len / hgt * 2.2 | 0), dir = Math.sign(SUN[0] - u) || 1, cs = [];
    for (let i = 0; i < n; i++) { const r = hgt * (.32 + .3 * R()); cs.push([u + (i / (n - 1) - .5) * len + (R() - .5) * hgt * .3, v - r * (.7 + R() * .9) * W / H, r]); }
    U.fillStyle = css([30, 48, 40], .32 * (1 - haze)); U.beginPath(); U.ellipse((u - dir * hgt * .9) * W, (v + hgt * .12) * H, (len * .55 + hgt * 1.2) * W, hgt * .22 * W, 0, 0, 7); U.fill();      // its shadow, thrown away from the sun
    for (const [x, y, r] of cs) { shape(g => g.arc(x * W, y * H, r * W, 0, 7), css(mix([30 + R() * 12, 48 + R() * 14, 28], HAZE, haze)), 4); shape(g => g.rect((x - r * .8) * W, y * H, r * 1.6 * W, v * H - y * H), css(mix([28, 44, 26], HAZE, haze)), 4); }
    for (const [x, y, r] of cs) for (let k = 0; k < 3; k++) { U.fillStyle = css(mix(R() < .25 ? [176, 156, 74] : [92 + R() * 30, 112 + R() * 16, 50], HAZE, haze * .8), .75); U.beginPath(); U.arc((x + dir * r * (.2 + R() * .5)) * W, (y - r * (R() - .2) * .7 * W / H) * H, r * W * (.22 + R() * .25), 0, 7); U.fill(); }
  }
  for (let i = 0; i < 44; i++) { const s = .01 + R() ** 1.7 * .3, v = HOR + s * (1 - HOR), u = R(), len = (.02 + R() * .09) * (.5 + s * 2); if (Math.abs(u - rivC(s)) < rivW(s) + len * .5 + .01) continue; copse(u, v, len, .005 + s * .05, clamp(.6 - s * 2)); }
  for (const [u, s, len, h] of [[.10, .40, .12, .034], [.67, .36, .10, .03], [.955, .42, .08, .04], [.56, .24, .05, .018], [.24, .27, .06, .018]]) copse(u, HOR + s * (1 - HOR), len, h, .12);
  { const fx = .665 * W, fy = (HOR + .19 * (1 - HOR)) * H;                                              // a farm among its trees, a thread of smoke
    copse(.64, HOR + .2 * (1 - HOR), .05, .016, .25);
    U.fillStyle = "rgb(232,214,176)"; U.fillRect(fx, fy - 9, 20, 9); U.fillStyle = "rgb(150,84,58)"; U.beginPath(); U.moveTo(fx - 2, fy - 9); U.lineTo(fx + 10, fy - 17); U.lineTo(fx + 22, fy - 9); U.fill();
    U.fillStyle = "rgb(212,196,160)"; U.fillRect(fx + 24, fy - 6, 11, 6); U.fillStyle = "rgb(128,76,56)"; U.fillRect(fx + 23, fy - 8, 13, 2.5); }
  // ----- foreground: dark banks, the great tree on the right, a slim dark one on the left against the light -----
  { const g = U.createLinearGradient(0, .8 * H, 0, H); g.addColorStop(0, "rgb(92,90,42)"); g.addColorStop(.22, "rgb(48,54,30)"); g.addColorStop(1, "rgb(24,28,20)");
    shape(c => { c.moveTo(.5 * W, H); c.bezierCurveTo(.62 * W, .93 * H, .74 * W, .85 * H, W, .81 * H); c.lineTo(W, H); c.closePath(); }, g, 2);
    shape(c => { c.moveTo(0, .87 * H); c.bezierCurveTo(.08 * W, .875 * H, .17 * W, .93 * H, .27 * W, H); c.lineTo(0, H); c.closePath(); }, g, 2); }
  function tree(bu, bv, fu, fv, tw, cu, cv, ru, rv, nb, per) {       // trunk from the ground (bu, bv) to its fork (fu, fv), boughs to each mass of leaves
    const dir = Math.sign(SUN[0] - cu) || 1, limb = (x0, y0, x1, y1, w0, w1, bend) => { const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2;
      for (let k = 0; k < 14; k++) { const t0 = k / 14, t1 = (k + 1) / 14, q = t => [(1 - t) ** 2 * x0 + 2 * t * (1 - t) * mx + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * my + t * t * y1], a = q(t0), b = q(t1), w = lerp(w0, w1, t0) * W;
        for (const gg of [U, M]) { gg.strokeStyle = gg === U ? "rgb(40,31,23)" : KIND[4]; gg.lineWidth = w; gg.lineCap = "round"; gg.beginPath(); gg.moveTo(a[0] * W, a[1] * H); gg.lineTo(b[0] * W, b[1] * H); gg.stroke(); }
        U.strokeStyle = "rgba(196,146,78,.7)"; U.lineWidth = w * .22; U.beginPath(); U.moveTo(a[0] * W + dir * w * .36, a[1] * H); U.lineTo(b[0] * W + dir * w * .36, b[1] * H); U.stroke(); } };
    limb(bu, bv, fu, fv, tw * 1.5, tw * .8, tw * .5);
    shape(c => c.ellipse(bu * W, bv * H, tw * 1.7 * W, tw * .7 * W, 0, 0, 7), "rgb(38,30,22)", 4);
    const boughs = []; for (let i = 0; i < nb; i++) { const a = i / nb * 6.283 + R() * .5, q = .35 + .6 * Math.sqrt(R()); boughs.push([cu + Math.cos(a) * ru * q, cv + Math.sin(a) * rv * q * .92, ru * (.2 + .13 * R())]); }
    boughs.push([cu, cv, ru * .3]);
    for (const [x, y] of boughs) limb(fu, fv, x, y + .01, tw * .5, tw * .1, (R() - .5) * ru * .3);
    const leaves = []; for (const [x, y, br] of boughs) for (let i = 0; i < per; i++) { const a = R() * 6.283, q = Math.sqrt(R()) * br * 1.2; leaves.push([x + Math.cos(a) * q, y + Math.sin(a) * q * .8 * W / H, br * (.1 + .22 * R()), x, y, br]); }
    for (const [x, y, r] of leaves) shape(g => g.arc(x * W, y * H, r * W, 0, 7), css([20 + R() * 12, 32 + R() * 14, 20 + R() * 8]), 4);
    for (const [x, y, r, bx, by, br] of leaves) {      // each mass: mid green on top and toward the sun, gold only on the sunward rim
      const side = (x - bx) / br * dir, top = (by - y) / br * H / W, e = (x - cu) / ru * dir;
      if (side + top * .7 > -.2 && R() < .75) { const k = clamp(.35 + side * .4 + top * .3); U.fillStyle = css(mix([40, 58, 30], [96 + R() * 30, 108 + R() * 20, 44], k), .9); U.beginPath(); U.arc((x + dir * r * .2) * W, (y - r * .2 * W / H) * H, r * W * .8, 0, 7); U.fill(); }
      if (side > .45 && e > .1 && R() < .3 + e * .4) { U.fillStyle = css(e > .5 && R() < .5 ? [214, 182, 92] : [150, 146, 64], .85); U.beginPath(); U.arc((x + dir * r * .4) * W, (y - r * .05 * W / H) * H, r * W * .5, 0, 7); U.fill(); }
    }
  }
  tree(.845, .885, .822, .50, .017, .80, .285, .19, .22, 15, 46);
  tree(.03, .905, .045, .62, .011, .03, .44, .105, .17, 10, 34);

  // ----- the brush: strokes that take their colour from the underpainting -----
  const src = U.getImageData(0, 0, W, H).data, msk = M.getImageData(0, 0, W, H).data, g = canvas.getContext("2d");
  g.drawImage(UC, 0, 0); g.lineCap = "round";
  const at = (x, y) => { const i = ((clamp(y | 0, 0, H - 1)) * W + clamp(x | 0, 0, W - 1)) * 4; return i; };
  function stroke(x, y, w, len, a, c, al) {
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, bx = -dy * .35 * (R() - .5), by = dx * .35 * (R() - .5);
    const line = (ox, oy, col, lw, alpha) => { g.strokeStyle = css(col, alpha); g.lineWidth = lw; g.beginPath(); g.moveTo(x - dx + ox, y - dy + oy); g.quadraticCurveTo(x + bx + ox, y + by + oy, x + dx + ox, y + dy + oy); g.stroke(); };
    line(0, 0, c, w, al);
    const nx = -Math.sin(a) * w * .27, ny = Math.cos(a) * w * .27;
    line(nx, ny, [c[0] + 11, c[1] + 10, c[2] + 7], w * .2, .45); line(-nx, -ny, [c[0] - 12, c[1] - 12, c[2] - 10], w * .2, .45);
  }
  function pass(size, step, pick, jit = 14, alpha = .85) {
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step), order = new Uint32Array(cols * rows);
    for (let i = 0; i < order.length; i++) order[i] = i;
    for (let i = order.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0, t = order[i]; order[i] = order[j]; order[j] = t; }
    for (const o of order) {
      const x = (o % cols + R()) * step, y = ((o / cols | 0) + R()) * step, i = at(x, y), kind = Math.round(msk[i] / 50);
      if (pick && !pick(x, y, i, kind)) continue;
      const u = x / W, v = y / H, j = (R() - .5) * jit, c = [src[i] + j + (R() - .5) * jit * .4, src[i + 1] + j + (R() - .5) * jit * .4, src[i + 2] + j + (R() - .5) * jit * .4];
      let a, len;
      if (kind === 0) {                                  // round the cloud forms where there is an edge, long and level in open sky
        const lum = k => src[k] + src[k + 1] + src[k + 2], gx = lum(at(x + 5, y)) - lum(at(x - 5, y)), gy = lum(at(x, y + 5)) - lum(at(x, y - 5)), mg = Math.hypot(gx, gy);
        if (mg > 26) { a = Math.atan2(gy, gx) + Math.PI / 2 + (R() - .5) * .5; len = size * 1.5; } else { a = (fbm(u * 3.2 + 5, v * 4.5 + 2, 3) - .5) * 1.2; len = size * 2.3; }
      }
      else if (kind === 1) { a = .25 + (n2(u * 9, v * 9) - .5) * 1.1; len = size * 1.8; }
      else if (kind === 2) { a = v > .82 && src[i] < 100 ? -1.3 + R() * .6 : (n2(u * 7, v * 12) - .5) * .5; len = size * 2.1; }
      else if (kind === 3) { a = (R() - .5) * .1; len = size * 3; }
      else { a = R() * Math.PI; len = size * 1.05; }
      stroke(x, y, size * (.75 + R() * .5), len * (.7 + R() * .6), a, c, alpha);
    }
  }
  pass(15, 10, null, 12, .8);
  pass(8, 6, null, 12, .85);
  pass(4.2, 4, (x, y, i, kind) => { const k = at(x + 6, y + 3); return kind === 4 || Math.abs(src[i] - src[k]) + Math.abs(src[i + 1] - src[k + 1]) + Math.abs(src[i + 2] - src[k + 2]) > 20 || R() < .3; }, 12, .9);
  pass(2.6, 3, (x, y, i, kind) => kind === 4 && R() < .7, 30, .9);            // leaves

  // ----- last touches -----
  { const sx = SUN[0] * W, sy = SUN[1] * H, sg = g.createRadialGradient(sx, sy, 0, sx, sy, 46); sg.addColorStop(0, "rgba(255,250,226,.95)"); sg.addColorStop(.28, "rgba(255,244,204,.75)"); sg.addColorStop(1, "rgba(255,236,180,0)"); g.fillStyle = sg; g.fillRect(sx - 50, sy - 50, 100, 100); }
  for (let i = 0; i < 520; i++) {                       // the sun's path on the water
    const s = R() ** 1.3, y = (HOR + s * (1 - HOR)) * H, hw = rivW(s) * W, cx = rivC(s) * W, x = lerp(cx, SUN[0] * W + s * 120, .45) + (R() - .5) * (14 + hw * 1.1);
    if (Math.round(msk[at(x, y)] / 50) !== 3) continue;
    stroke(x, y, 1.6 + s * 3, 6 + s * 26, (R() - .5) * .08, [255, 244 - s * 20, 204 - s * 30], .5 + R() * .4);
  }
  for (let i = 0; i < 2600; i++) {                      // light catching the sun side of the leaves
    const x = R() * W, y = R() * H; if (Math.round(msk[at(x, y)] / 50) !== 4) continue;
    const sd = x / W > SUN[0] ? -1 : 1, edge = Math.round(msk[at(x + sd * 8, y + 2)] / 50) !== 4, near = y / H > .12 && (x / W > .58 || x / W < .16) && y / H < .62;
    if (!(edge ? R() < .7 : R() < (near ? .05 : .03))) continue;
    const far = y / H > HOR ? .5 : 0;
    stroke(x, y, near ? 2.4 : 1.6, near ? 4.5 : 3, R() * 3.2, mix(edge ? [236, 200, 96] : [150, 146, 62], HAZE, far * .4), .85);
  }
  for (let i = 0; i < 240; i++) {                       // grasses on the near banks
    const x = R() * W, y = (.84 + R() * .16) * H; if (Math.round(msk[at(x, y)] / 50) !== 2 || src[at(x, y)] > 90) continue;
    const h = 10 + R() * 26, lean = (R() - .5) * 12; g.strokeStyle = R() < .3 ? "rgba(196,170,78,.8)" : "rgba(24,30,18,.8)"; g.lineWidth = 1 + R() * 1.4; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * .3, y - h * .6, x + lean, y - h); g.stroke();
  }
  for (const [u, s, c] of [[-.055, .34, [92, 54, 34]], [-.07, .36, [226, 214, 190]], [-.04, .37, [58, 38, 28]], [-.085, .33, [120, 72, 44]]]) {   // cattle come down to drink
    const x = (rivC(s) - rivW(s) + u * .35) * W, y = (HOR + s * (1 - HOR)) * H;
    g.fillStyle = css(c); g.beginPath(); g.ellipse(x, y, 7, 3.6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x + 6.5, y - 2.2, 2.6, 2.1, 0, 0, 7); g.fill();
    g.fillRect(x - 5, y + 2, 1.6, 4.4); g.fillRect(x + 3.4, y + 2, 1.6, 4.4); g.fillStyle = "rgba(255,236,180,.75)"; g.fillRect(x - 5, y - 4.2, 9, 1.3);
  }
  g.strokeStyle = "rgba(40,40,52,.75)"; g.lineWidth = 1.5;
  for (const [u, v, s] of [[.44, .30, 7], [.47, .285, 5.5], [.415, .32, 5], [.50, .31, 4.5], [.455, .335, 4]]) { const x = u * W, y = v * H; g.beginPath(); g.moveTo(x - s, y - s * .35); g.quadraticCurveTo(x - s * .4, y - s * .7, x, y); g.quadraticCurveTo(x + s * .4, y - s * .7, x + s, y - s * .3); g.stroke(); }
  g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(255,242,218)"; g.fillRect(0, 0, W, H); g.globalCompositeOperation = "source-over";      // old varnish
  { const vg = g.createRadialGradient(W * .46, H * .5, H * .42, W * .5, H * .5, W * .74); vg.addColorStop(0, "rgba(24,14,0,0)"); vg.addColorStop(1, "rgba(24,14,0,.34)"); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  return canvas;
}
