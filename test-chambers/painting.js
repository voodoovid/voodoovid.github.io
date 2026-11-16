// Test Chambers: the painting in the Records office (v8.8). "Signature Required": a play on The Scream (Edvard Munch, 1893, public domain)
// with the game's own courier in the middle of it: rust jacket, hood down, messenger bag, the undelivered parcel, hands to the face.
// Painted in code: an underpainting (sky and fjord per pixel, walkway and figure as shapes), then long wavering brush strokes that
// take their colour from it and follow its forms, then the face, dark contour lines and a vignette. Same seed, same picture.
//   import { paintLandscape } from "./painting.js";  paintLandscape(canvas);      (the name is kept from the first picture)
export const PAINTING = { title: "Signature Required", w: 896, h: 1152 };

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

export function paintLandscape(canvas, seed = 1893) {
  const W = canvas.width = PAINTING.w, H = canvas.height = PAINTING.h, R = mulberry(seed), { n2, fbm } = makeNoise(seed);
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const UC = mk(), U = UC.getContext("2d", { willReadFrequently: true }), MC = mk(), M = MC.getContext("2d", { willReadFrequently: true });
  M.fillStyle = "#000"; M.fillRect(0, 0, W, H);
  const KIND = ["rgb(0,0,0)", "rgb(50,0,0)", "rgb(100,0,0)", "rgb(150,0,0)", "rgb(200,0,0)"];          // sky and fjord, -, walkway, rail, figure (red channel / 50)
  const shape = (path, fill, kind) => { for (const g of [U, M]) { g.beginPath(); path(g); g.fillStyle = g === U ? fill : KIND[kind]; g.fill(); } };
  const hv = u => .375 + .022 * Math.sin(u * 5 + .6), VP = [-.06, .40];                                 // the skyline, and where the walkway runs to
  // ----- sky and fjord, per pixel at half size: wavering bands -----
  {
    const sw = W / 2 | 0, sh = H / 2 | 0, img = new ImageData(sw, sh), d = img.data;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const u = x / sw, v = y / sh, h0 = hv(u); let c;
      if (v < h0) {
        const g = v / h0, b = v * 44 + 2.4 * Math.sin(u * 3.4 + v * 9) + 3.2 * fbm(u * 2.2, v * 5, 3), t = .5 + .5 * Math.sin(b);
        c = mix([198, 54, 30], [240, 138, 44], sm(.15, .75, t)); c = mix(c, [250, 206, 96], sm(.78, .98, t));
        c = mix(c, [118, 158, 160], sm(.34, .1, t) * sm(.2, .09, Math.abs(g - .6)) * .95);                 // one cold band through the fire
        c = mix(c, [150, 40, 30], sm(.25, 0, g) * .45);
      } else {
        const q = v - h0, b = q * 30 + 2.8 * Math.sin(u * 4.4 - v * 6) + 3.4 * fbm(u * 2.6 + 4, v * 4, 3), t = .5 + .5 * Math.sin(b);
        c = mix([26, 42, 86], [62, 98, 146], t);
        const bay = Math.exp(-(((u - .34) / .34) ** 2 + ((v - .505) / .075) ** 2)); c = mix(c, mix([226, 204, 120], [130, 168, 150], t), sm(.3, .8, bay));
        const hill = sm(.5, .78, u) * sm(.2, .05, q); c = mix(c, mix([18, 26, 56], [40, 66, 110], t), hill * .9);
        c = mix(c, mix([44, 84, 84], [104, 128, 78], t), sm(.24, .4, q) * .85);
      }
      const i = (y * sw + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    const sc = document.createElement("canvas"); sc.width = sw; sc.height = sh; sc.getContext("2d").putImageData(img, 0, 0);
    U.imageSmoothingQuality = "high"; U.drawImage(sc, 0, 0, W, H);
  }
  const P = (g, f, pts) => { pts.forEach(([u, v], i) => g[i ? "lineTo" : "moveTo"](u * W, v * H)); };
  // ----- the walkway and its rail, running away to the left -----
  { const g = U.createLinearGradient(0, .4 * H, W * .6, H); g.addColorStop(0, "rgb(120,96,84)"); g.addColorStop(.5, "rgb(176,110,56)"); g.addColorStop(1, "rgb(206,138,62)");
    shape(c => P(c, 0, [VP, [1.05, 1.0], [1.05, 1.1], [-.06, 1.1]]), g, 2);
    for (let i = 0; i < 16; i++) { const e = .43 + i * .05 + R() * .02; U.strokeStyle = i % 3 ? "rgba(96,58,36,.55)" : "rgba(70,84,120,.5)"; U.lineWidth = 2 + i * .7; U.beginPath(); U.moveTo(VP[0] * W, VP[1] * H); U.lineTo(e > 1 ? (2.05 - e) * W : -.06 * W, e > 1 ? 1.1 * H : (e + .1) * H); U.stroke(); }
    shape(c => P(c, 0, [VP, [1.05, .735], [1.05, 1.0]]), "rgb(112,70,44)", 3);
    for (const [e, wd, col] of [[.735, .02, "rgb(196,128,64)"], [.865, .016, "rgb(86,50,34)"], [.99, .02, "rgb(70,40,30)"], [.80, .008, "rgb(150,92,52)"], [.93, .008, "rgb(140,84,48)"]]) { U.strokeStyle = col; U.lineWidth = wd * W; U.beginPath(); U.moveTo(VP[0] * W, VP[1] * H); U.lineTo(1.05 * W, e * H); U.stroke(); } }
  for (const [u, top, wd] of [[.075, .30, .017], [.125, .315, .015]]) {                                   // two figures, far back, walking on
    const foot = VP[1] + (u - VP[0]) * (1.0 - VP[1]) / 1.11 + .035;
    shape(c => P(c, 0, [[u - wd * .9, top + .03], [u + wd * .9, top + .03], [u + wd * 1.15, foot - .05], [u + wd * .8, foot], [u + wd * .1, foot - .045], [u - wd * .7, foot], [u - wd * 1.1, foot - .05]]), "rgb(24,26,48)", 4);
    shape(c => c.arc(u * W, (top + .014) * H, wd * .62 * W, 0, 7), "rgb(196,170,130)", 4);
    shape(c => c.ellipse(u * W, (top + .002) * H, wd * 1.05 * W, .0045 * H, 0, 0, 7), "rgb(16,16,30)", 4); shape(c => c.rect((u - wd * .6) * W, (top - .014) * H, wd * 1.2 * W, .016 * H), "rgb(16,16,30)", 4);
  }
  // ----- the courier -----
  const RUST = "rgb(170,78,38)", RUST_D = "rgb(120,50,28)", SKIN = "rgb(230,206,152)";
  const torso = c => { c.moveTo(.35 * W, .80 * H); c.bezierCurveTo(.30 * W, .88 * H, .33 * W, .95 * H, .27 * W, 1.02 * H); c.lineTo(.76 * W, 1.02 * H); c.bezierCurveTo(.70 * W, .94 * H, .72 * W, .87 * H, .65 * W, .80 * H); c.bezierCurveTo(.58 * W, .755 * H, .42 * W, .755 * H, .35 * W, .80 * H); };
  shape(torso, RUST, 4);
  { const g = U.createLinearGradient(.3 * W, 0, .75 * W, 0); g.addColorStop(0, "rgba(232,140,60,.55)"); g.addColorStop(.45, "rgba(170,78,38,0)"); g.addColorStop(1, "rgba(60,30,50,.6)"); U.save(); U.beginPath(); torso(U); U.clip(); U.fillStyle = g; U.fillRect(.25 * W, .76 * H, .52 * W, .3 * H); U.restore(); }
  for (const sd of [-1, 1]) {                                                                             // sleeves up to the hands
    const x = u => (.5 + sd * u) * W;
    shape(c => { c.moveTo(x(.15), .85 * H); c.bezierCurveTo(x(.235), .83 * H, x(.215), .76 * H, x(.152), .712 * H); c.lineTo(x(.078), .722 * H); c.bezierCurveTo(x(.12), .76 * H, x(.11), .79 * H, x(.07), .81 * H); c.closePath(); }, sd < 0 ? "rgb(188,92,42)" : "rgb(140,60,34)", 4);
    shape(c => c.ellipse(x(.104), .652 * H, .033 * W, .074 * H, sd * -.2, 0, 7), SKIN, 4);
    shape(c => c.ellipse(x(.116), .72 * H, .044 * W, .015 * H, sd * .2, 0, 7), RUST_D, 4);               // cuff
  }
  shape(c => c.ellipse(.5 * W, .775 * H, .135 * W, .034 * H, 0, 0, 7), RUST_D, 4);                        // the hood, down round the collar
  shape(c => c.ellipse(.5 * W, .768 * H, .085 * W, .02 * H, 0, 0, 7), "rgb(84,36,26)", 4);
  shape(c => { c.moveTo(.455 * W, .70 * H); c.lineTo(.545 * W, .70 * H); c.lineTo(.55 * W, .775 * H); c.lineTo(.45 * W, .775 * H); c.closePath(); }, "rgb(206,178,128)", 4);      // neck
  shape(c => P(c, 0, [[.60, .79], [.655, .805], [.36, 1.02], [.29, 1.02]]), "rgb(52,50,48)", 4);         // the bag's strap
  shape(c => P(c, 0, [[.175, .915], [.395, .905], [.41, 1.02], [.17, 1.02]]), "rgb(92,90,72)", 4);       // the bag
  shape(c => P(c, 0, [[.205, .862], [.365, .852], [.372, .925], [.212, .935]]), "rgb(204,166,112)", 4);  // the parcel in it
  shape(c => { c.ellipse(.5 * W, .59 * H, .086 * W, .105 * H, 0, 0, 7); }, SKIN, 4);                      // the head: wide brow, long jaw
  shape(c => { c.ellipse(.5 * W, .655 * H, .062 * W, .075 * H, 0, 0, 7); }, SKIN, 4);
  shape(c => { c.moveTo(.413 * W, .575 * H); c.bezierCurveTo(.405 * W, .455 * H, .595 * W, .455 * H, .587 * W, .575 * H); c.bezierCurveTo(.56 * W, .525 * H, .44 * W, .525 * H, .413 * W, .575 * H); }, "rgb(58,38,28)", 4);   // short hair
  { const g = U.createRadialGradient(.47 * W, .6 * H, 0, .5 * W, .62 * H, .16 * W); g.addColorStop(0, "rgba(246,226,170,.5)"); g.addColorStop(.6, "rgba(230,206,152,0)"); g.addColorStop(1, "rgba(120,130,110,.5)"); U.save(); U.beginPath(); U.ellipse(.5 * W, .59 * H, .086 * W, .105 * H, 0, 0, 7); U.ellipse(.5 * W, .655 * H, .062 * W, .075 * H, 0, 0, 7); U.clip(); U.fillStyle = g; U.fillRect(.4 * W, .5 * H, .2 * W, .25 * H); U.fillStyle = "rgb(58,38,28)"; U.beginPath(); U.moveTo(.413 * W, .575 * H); U.bezierCurveTo(.405 * W, .455 * H, .595 * W, .455 * H, .587 * W, .575 * H); U.bezierCurveTo(.56 * W, .525 * H, .44 * W, .525 * H, .413 * W, .575 * H); U.fill(); U.restore(); }

  for (const sd of [-1, 1]) { U.fillStyle = "rgb(244,238,214)"; U.beginPath(); U.arc((.5 + sd * .036) * W, .578 * H, .019 * W, 0, 7); U.fill(); U.fillStyle = "rgb(30,26,44)"; U.beginPath(); U.arc((.5 + sd * .036) * W, .58 * H, .007 * W, 0, 7); U.fill(); }
  U.fillStyle = "rgb(52,26,26)"; U.beginPath(); U.ellipse(.5 * W, .682 * H, .028 * W, .042 * H, 0, 0, 7); U.fill();

  // ----- the brush: long strokes that take their colour from the underpainting and follow its forms -----
  const src = U.getImageData(0, 0, W, H).data, msk = M.getImageData(0, 0, W, H).data, g = canvas.getContext("2d");
  g.drawImage(UC, 0, 0); g.lineCap = "round";
  const at = (x, y) => (clamp(y | 0, 0, H - 1) * W + clamp(x | 0, 0, W - 1)) * 4, lum = k => src[k] + src[k + 1] + src[k + 2];
  function stroke(x, y, w, len, a, c, al) {
    const dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2, bx = -dy * .5 * (R() - .5), by = dx * .5 * (R() - .5);
    const line = (ox, oy, col, lw, alpha) => { g.strokeStyle = css(col, alpha); g.lineWidth = lw; g.beginPath(); g.moveTo(x - dx + ox, y - dy + oy); g.quadraticCurveTo(x + bx + ox, y + by + oy, x + dx + ox, y + dy + oy); g.stroke(); };
    line(0, 0, c, w, al);
    const nx = -Math.sin(a) * w * .27, ny = Math.cos(a) * w * .27;
    line(nx, ny, [c[0] + 16, c[1] + 14, c[2] + 10], w * .2, .5); line(-nx, -ny, [c[0] - 18, c[1] - 18, c[2] - 12], w * .2, .5);
  }
  function pass(size, step, pick, jit = 22, alpha = .88) {
    const cols = Math.ceil(W / step), rows = Math.ceil(H / step), order = new Uint32Array(cols * rows);
    for (let i = 0; i < order.length; i++) order[i] = i;
    for (let i = order.length - 1; i > 0; i--) { const j = R() * (i + 1) | 0, t = order[i]; order[i] = order[j]; order[j] = t; }
    for (const o of order) {
      const x = (o % cols + R()) * step, y = ((o / cols | 0) + R()) * step, i = at(x, y), kind = Math.round(msk[i] / 50);
      if (pick && !pick(x, y, i, kind)) continue;
      const u = x / W, v = y / H, j = (R() - .5) * jit, c = [src[i] + j + (R() - .5) * jit * .5, src[i + 1] + j + (R() - .5) * jit * .5, src[i + 2] + j + (R() - .5) * jit * .5];
      const gx = lum(at(x + 5, y)) - lum(at(x - 5, y)), gy = lum(at(x, y + 5)) - lum(at(x, y - 5)), mg = Math.hypot(gx, gy);
      let a, len;
      if (kind === 2 || kind === 3) { a = Math.atan2(y - VP[1] * H, x - VP[0] * W) + (R() - .5) * .08; len = size * 3.4; }
      else if (mg > 24) { a = Math.atan2(gy, gx) + Math.PI / 2 + (R() - .5) * .3; len = size * (kind === 4 ? 2 : 3.2); }
      else if (kind === 4) { a = Math.PI / 2 + (u - .5) * .9 + (R() - .5) * .5; len = size * 2.2; }
      else if (v < hv(u)) { a = .3 * Math.cos(u * 3.4 + v * 9) + (R() - .5) * .15; len = size * 3.6; }
      else { a = -.45 * Math.cos(u * 4.4 - v * 6) + (R() - .5) * .2; len = size * 3.2; }
      stroke(x, y, size * (.75 + R() * .5), len * (.7 + R() * .6), a, c, alpha);
    }
  }
  pass(13, 9); pass(7, 6, null, 20);
  pass(3.6, 4, (x, y, i, kind) => { const k = at(x + 6, y + 3); return kind === 4 || Math.abs(src[i] - src[k]) + Math.abs(src[i + 1] - src[k + 1]) + Math.abs(src[i + 2] - src[k + 2]) > 22 || R() < .25; }, 16, .9);

  // ----- the face, the parcel's label, the pass, and dark wavering contours -----
  const ink = (pts, w, col, wob = 1.6) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = "round"; g.beginPath(); pts.forEach(([u, v], i) => g[i ? "lineTo" : "moveTo"](u * W + (R() - .5) * wob, v * H + (R() - .5) * wob)); g.stroke(); };
  const arc = (cu, cv, ru, rv, a0, a1, n = 26) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([cu + Math.cos(a) * ru, cv + Math.sin(a) * rv]); } return o; };
  const DARK = "rgba(34,30,56,.85)";
  for (const sd of [-1, 1]) {
    const ex = .5 + sd * .036;
    ink(arc(ex, .578, .018, .018, 0, 6.3, 14), 3.2, "rgba(34,30,56,.7)", 2.6);
    g.fillStyle = "rgba(28,24,40,.9)"; g.beginPath(); g.arc(ex * W + (R() - .5) * 2, .58 * H, .0052 * W, 0, 7); g.fill();
    ink(arc(ex, .566, .026, .02, Math.PI * 1.12, Math.PI * 1.88, 10), 2.4, "rgba(70,46,34,.9)");                                   // brow, up
    g.fillStyle = "rgba(60,40,44,.9)"; g.beginPath(); g.ellipse((.5 + sd * .0095) * W, .628 * H, 2.6, 3.4, 0, 0, 7); g.fill();      // nostril
    ink(arc(.5 + sd * .058, .655, .03, .06, sd > 0 ? 1.2 : Math.PI - 1.2, sd > 0 ? 2.3 : Math.PI - 2.3, 8), 2, "rgba(150,120,90,.7)"); // hollow cheek
    for (const k of [-.014, -.002, .01]) ink([[.5 + sd * (.118 + k), .592], [.5 + sd * (.106 + k), .66]], 2, "rgba(140,104,76,.75)", 2.4);   // fingers
  }
  ink(arc(.5, .682, .027, .041, 0, 6.3, 16), 3.4, "rgba(34,30,56,.7)", 2.6);                                                        // the scream
  const SOFT = "rgba(34,30,56,.55)";
  ink(arc(.5, .59, .086, .105, Math.PI * 1.02, Math.PI * 1.98, 14), 3.6, SOFT, 3); ink([[.44, .685], [.468, .722], [.5, .732], [.532, .722], [.56, .685]], 3.4, SOFT, 3);
  ink([[.65, .80], [.705, .88], [.715, .95], [.755, 1.0]], 4, SOFT, 4); ink([[.35, .80], [.325, .85]], 4, SOFT, 4);
  for (const sd of [-1, 1]) { ink([[.5 + sd * .2, .835], [.5 + sd * .2, .78], [.5 + sd * .155, .715]], 3.6, SOFT, 3.5); ink(arc(.5 + sd * .104, .652, .036, .078, sd > 0 ? -1.4 : Math.PI + 1.4, sd > 0 ? 1.3 : Math.PI - 1.3, 10), 3.2, SOFT, 3); }
  ink([[.5, .80], [.497, .88], [.503, .95], [.5, 1.0]], 2.4, "rgba(70,30,24,.85)", 2);                                               // the zip
  g.save(); g.translate(.585 * W, .875 * H); g.rotate(.1); g.fillStyle = "rgb(236,232,220)"; g.fillRect(-13, -17, 26, 34); g.fillStyle = "rgb(60,70,90)"; g.fillRect(-9, -12, 18, 4); g.fillRect(-9, -3, 18, 2); g.fillRect(-9, 3, 12, 2); g.strokeStyle = "rgba(40,40,50,.8)"; g.lineWidth = 1.5; g.strokeRect(-13, -17, 26, 34); g.restore();   // visitor pass
  ink([[.60, .80], [.585, .86]], 2, "rgba(40,40,50,.8)");
  g.save(); g.translate(.288 * W, .893 * H); g.rotate(-.06); g.fillStyle = "rgb(238,234,222)"; g.fillRect(-34, -16, 68, 32); g.fillStyle = "rgb(60,56,50)"; for (const [yy, ww] of [[-9, 46], [-2, 52], [5, 30]]) g.fillRect(-28, yy, ww, 2.4); g.fillStyle = "rgb(190,52,40)"; g.fillRect(8, 3, 22, 9); g.restore();   // the label: still not signed for
  ink([[.205, .862], [.365, .852], [.372, .925]], 2.2, "rgba(90,60,36,.8)"); ink([[.175, .915], [.395, .905], [.41, 1.0]], 2.6, "rgba(40,40,36,.8)");
  { const vg = g.createRadialGradient(W * .5, H * .52, H * .36, W * .5, H * .5, H * .74); vg.addColorStop(0, "rgba(20,10,10,0)"); vg.addColorStop(1, "rgba(20,10,10,.36)"); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  return canvas;
}
