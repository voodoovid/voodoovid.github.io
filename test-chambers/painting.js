// Test Chambers: the paintings (v8.9), both painted in code. Same seed, same picture.
//  "scream"  "Signature Required": a play on The Scream (Edvard Munch, 1893, public domain) with the game's own courier in the middle
//            of it: rust jacket, hood down, messenger bag, the undelivered parcel, hands to the face. Portrait. The Records office.
//  "valley"  "The Long Valley, Evening": an ORIGINAL landscape in the manner of the old masters (no real picture is copied): a river
//            valley at golden hour, cumulus clouds, hazy mountains, a great tree. Landscape. To hang elsewhere.
// How: an underpainting (sky per pixel, the rest as shapes), then brush strokes that take their colour from it and follow its forms.
// Nothing in the Scream is drawn with a line: its contours are dark paint worked in by the same brush.
//   import { paint, PAINTINGS } from "./painting.js";  paint(canvas, "scream");
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

function paintScream(canvas, seed = 1893) {
  const W = canvas.width = 896, H = canvas.height = 1152, R = mulberry(seed), { n2, fbm } = makeNoise(seed);
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const UC = mk(), MC = mk(); let U = UC.getContext("2d", { willReadFrequently: true }), M = MC.getContext("2d", { willReadFrequently: true });
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
        c = mix([190, 62, 36], [230, 136, 54], sm(.15, .75, t)); c = mix(c, [238, 198, 104], sm(.78, .98, t));
        c = mix(c, [112, 148, 156], sm(.34, .1, t) * Math.max(sm(.2, .09, Math.abs(g - .6)), .6 * sm(.12, .04, Math.abs(g - .2))) * .95);                 // one cold band through the fire
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
  // The figure is painted on its own layer, then laid in strip by strip with a sideways sway, so head, hands and body all waver together
  const FC = mk(), FM = mk(), U0 = U, M0 = M; U = FC.getContext("2d"); M = FM.getContext("2d");
  // ----- the courier, painted as the original's figure is: a swaying body, a skull of a head, flat hands, no drawn lines -----
  const SKIN = [216, 198, 140], bz = (c, p) => { c.moveTo(p[0][0] * W, p[0][1] * H); for (let i = 1; i < p.length; i += 3) c.bezierCurveTo(p[i][0] * W, p[i][1] * H, p[i + 1][0] * W, p[i + 1][1] * H, p[i + 2][0] * W, p[i + 2][1] * H); };
  const BODY = [[.385, .80], [.31, .86], [.40, .93], [.345, 1.03], [.52, 1.05], [.60, 1.05], [.70, 1.03], [.74, .95], [.63, .89], [.635, .80], [.57, .765], [.44, .765], [.385, .80]];
  shape(c => bz(c, BODY), "rgb(150,70,36)", 4);
  U.save(); U.beginPath(); bz(U, BODY); U.clip();                                                          // the jacket's folds sway with the body: light on the left, blue shadow on the right
  { const g = U.createLinearGradient(.32 * W, 0, .74 * W, 0); g.addColorStop(0, "rgba(226,130,58,.6)"); g.addColorStop(.4, "rgba(150,70,36,0)"); g.addColorStop(1, "rgba(46,40,78,.7)"); U.fillStyle = g; U.fillRect(.25 * W, .74 * H, .55 * W, .3 * H); }
  for (let i = 0; i < 9; i++) { const x0 = .36 + i * .04 + R() * .02; U.strokeStyle = i % 3 === 0 ? "rgba(52,46,84,.55)" : i % 3 === 1 ? "rgba(104,44,34,.6)" : "rgba(204,112,54,.5)"; U.lineWidth = 6 + R() * 8; U.beginPath(); U.moveTo(x0 * W, .78 * H); U.bezierCurveTo((x0 - .06) * W, .86 * H, (x0 + .05) * W, .93 * H, (x0 - .02) * W, 1.03 * H); U.stroke(); }
  U.restore();
  for (const sd of [-1, 1]) {                                                                             // forearms rising to the face
    const x = u => (.51 + sd * u) * W, q = u => .51 + sd * u;
    shape(c => P(c, 0, [[q(.062), .712], [q(.128), .712], [q(.185), .80], [q(.165), .87], [q(.085), .87], [q(.088), .79]]), sd < 0 ? "rgb(176,86,40)" : "rgb(112,54,44)", 4);
    shape(c => c.ellipse(x(.095), .716 * H, .038 * W, .013 * H, sd * .15, 0, 7), "rgb(96,42,30)", 4);                                // cuff
    shape(c => c.ellipse(x(.09), .648 * H, .025 * W, .074 * H, sd * .1, 0, 7), css(sd < 0 ? [198, 184, 120] : [168, 160, 118]), 4);            // the hand: one long flat shape against the cheek, a tone darker than the face
  }
  shape(c => c.ellipse(.51 * W, .778 * H, .125 * W, .03 * H, 0, 0, 7), "rgb(110,48,30)", 4);              // the hood, down round the collar
  shape(c => P(c, 0, [[.47, .70], [.55, .70], [.56, .78], [.46, .78]]), "rgb(190,170,118)", 4);          // neck
  shape(c => P(c, 0, [[.60, .79], [.65, .805], [.38, 1.02], [.31, 1.02]]), "rgb(48,46,52)", 4);          // the bag's strap
  shape(c => P(c, 0, [[.185, .925], [.385, .915], [.40, 1.02], [.18, 1.02]]), "rgb(80,82,70)", 4);       // the bag
  shape(c => P(c, 0, [[.21, .872], [.36, .862], [.367, .932], [.217, .942]]), "rgb(192,156,104)", 4);    // the parcel in it
  U.save(); U.translate(.288 * W, .902 * H); U.rotate(-.06); U.fillStyle = "rgb(226,220,200)"; U.fillRect(-30, -13, 60, 26); U.fillStyle = "rgb(176,58,44)"; U.fillRect(8, 1, 16, 8); U.fillStyle = "rgba(70,66,60,.8)"; U.fillRect(-24, -7, 40, 3); U.fillRect(-24, 0, 26, 3); U.restore();   // its label, still unsigned
  U.fillStyle = "rgb(222,216,198)"; U.save(); U.translate(.59 * W, .872 * H); U.rotate(.12); U.fillRect(-9, -12, 18, 24); U.restore();                                  // the visitor pass
  const HEAD = [[.51, .485], [.59, .485], [.615, .56], [.592, .625], [.575, .68], [.555, .735], [.51, .738], [.465, .735], [.445, .68], [.428, .625], [.405, .56], [.43, .485], [.51, .485]];
  shape(c => bz(c, HEAD), css(SKIN), 4);
  U.save(); U.beginPath(); bz(U, HEAD); U.clip();
  { const g = U.createLinearGradient(.42 * W, 0, .61 * W, 0); g.addColorStop(0, "rgba(240,224,164,.6)"); g.addColorStop(.5, "rgba(216,198,140,0)"); g.addColorStop(1, "rgba(120,132,112,.65)"); U.fillStyle = g; U.fillRect(.4 * W, .47 * H, .23 * W, .28 * H); }
  { const g = U.createLinearGradient(0, .485 * H, 0, .548 * H); g.addColorStop(0, "rgba(64,48,38,.9)"); g.addColorStop(.5, "rgba(96,76,54,.6)"); g.addColorStop(1, "rgba(150,130,90,0)"); U.fillStyle = g; U.fillRect(.4 * W, .47 * H, .23 * W, .09 * H); }                                              // close-cropped hair, hardly more than a shadow on the skull
  for (const sd of [-1, 1]) { U.fillStyle = "rgba(150,132,96,.6)"; U.beginPath(); U.ellipse((.51 + sd * .052) * W, .66 * H, .014 * W, .05 * H, sd * .25, 0, 7); U.fill(); }   // hollow cheeks
  for (const sd of [-1, 1]) { const ex = (.51 + sd * .033) * W, ey = .582 * H, g = U.createRadialGradient(ex, ey, 0, ex, ey, .024 * W);                         // eyes: smudged sockets, a pale middle, a speck
    g.addColorStop(0, "rgba(92,84,92,.0)"); g.addColorStop(.45, "rgba(92,84,92,.7)"); g.addColorStop(.7, "rgba(110,104,100,.55)"); g.addColorStop(1, "rgba(120,112,100,0)"); U.fillStyle = g; U.fillRect(ex - 24, ey - 24, 48, 48);
    U.fillStyle = "rgba(226,214,176,.85)"; U.beginPath(); U.ellipse(ex, ey, .0085 * W, .0095 * W, 0, 0, 7); U.fill(); U.fillStyle = "rgba(50,44,56,.85)"; U.beginPath(); U.arc(ex + sd, ey + 1, .0036 * W, 0, 7); U.fill();
    U.fillStyle = "rgba(96,74,64,.8)"; U.beginPath(); U.ellipse((.51 + sd * .009) * W, .636 * H, 2.6, 3.6, 0, 0, 7); U.fill(); }
  { const mx = .51 * W, my = .692 * H, g = U.createRadialGradient(mx, my, 0, mx, my, .05 * W); g.addColorStop(0, "rgba(66,40,40,.95)"); g.addColorStop(.5, "rgba(84,52,46,.85)"); g.addColorStop(.75, "rgba(150,112,84,.55)"); g.addColorStop(1, "rgba(170,140,100,0)");
    U.save(); U.translate(mx, my); U.scale(.62, 1); U.translate(-mx, -my); U.fillStyle = g; U.fillRect(mx - 60, my - 50, 120, 100); U.restore(); }                 // the mouth: a long dark O with no edge
  U.restore();
  U.lineCap = "round"; U.lineJoin = "round"; U.strokeStyle = "rgba(44,50,92,.5)";                              // contours: dark blue paint under the brush, never a drawn line
  U.lineWidth = 9; U.beginPath(); bz(U, BODY); U.stroke(); U.lineWidth = 6; U.beginPath(); bz(U, HEAD.slice(3, 10)); U.stroke();
  for (const sd of [-1, 1]) { U.beginPath(); U.ellipse((.51 + sd * .09) * W, .648 * H, .027 * W, .076 * H, sd * .1, sd > 0 ? -1.2 : Math.PI - 1.4, sd > 0 ? 1.4 : Math.PI + 1.2); U.stroke(); }

  U = U0; M = M0;
  const sway = v => W * (.8 + 1.6 * (v - .45)) * (.017 * Math.sin(v * 27 + .4) + .006 * Math.sin(v * 73 + 2));
  for (let y = (.3 * H) | 0; y < H; y += 2) { const dx = y / H > .46 ? sway(y / H) : 0; U.drawImage(FC, 0, y, W, 2, dx, y, W, 2); M.drawImage(FM, 0, y, W, 2, dx, y, W, 2); }

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
  pass(11, 8, null, 26); pass(6, 5, null, 24);
  pass(3.2, 3.5, (x, y, i, kind) => { const k = at(x + 6, y + 3); return (kind === 4 && (y / H > .75 || y / H < .47 || R() < .4)) || Math.abs(src[i] - src[k]) + Math.abs(src[i + 1] - src[k + 1]) + Math.abs(src[i + 2] - src[k + 2]) > 22 || R() < .3; }, 18, .9);

  const TINT = [[212, 190, 124], [236, 222, 170], [150, 158, 150], [186, 168, 112], [128, 140, 150]];
  for (let i = 0; i < 900; i++) {                      // the face and hands, worked over with long loose strokes that run down and waver: nothing stays sharp
    const x = (.36 + R() * .30) * W, y = (.47 + R() * .29) * H, k = at(x, y); if (Math.round(msk[k] / 50) !== 4 || src[k] < 150 || src[k + 2] > src[k]) continue;
    const v = y / H, t = TINT[R() * TINT.length | 0], q = .08 + R() * .2, len = 9 + R() * 12, a = Math.PI / 2 + .3 * Math.cos(v * 27 + .4) + (R() - .5) * .3;
    if (Math.round(msk[at(x + Math.cos(a) * len * .7, y + Math.sin(a) * len * .7)] / 50) !== 4 || Math.round(msk[at(x - Math.cos(a) * len * .7, y - Math.sin(a) * len * .7)] / 50) !== 4 || Math.round(msk[at(x - 7, y)] / 50) !== 4 || Math.round(msk[at(x + 7, y)] / 50) !== 4) continue;      // stay inside the shape: no fringe
    stroke(x, y, 2.2 + R() * 2, len, a, [lerp(src[k], t[0], q), lerp(src[k + 1], t[1], q), lerp(src[k + 2], t[2], q)], .4);
  }
  { const cx = .51 * W + sway(.692), cy = .692 * H; for (let i = 0; i < 12; i++) stroke(cx + (R() - .5) * 14, cy + (R() - .5) * 40, 4.5, 14, Math.PI / 2 + (R() - .5) * .5, [62 + R() * 26, 38 + R() * 10, 38], .5);       // the dark of the mouth, put back loosely
    for (const sd of [-1, 1]) { const ex = (.51 + sd * .033) * W + sway(.582), ey = .582 * H; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283 + R() * .4; stroke(ex + Math.cos(a) * 12, ey + Math.sin(a) * 12, 2.6, 8, a + Math.PI / 2, [98 + R() * 20, 90, 96], .4); } stroke(ex, ey, 7, 3, 0, [226, 214, 176], .6); stroke(ex + sd, ey + 1, 3.4, 2.5, 0, [48, 42, 54], .75); } }
  { const vg = g.createRadialGradient(W * .5, H * .52, H * .36, W * .5, H * .5, H * .74); vg.addColorStop(0, "rgba(20,10,10,0)"); vg.addColorStop(1, "rgba(20,10,10,.36)"); g.fillStyle = vg; g.fillRect(0, 0, W, H); }
  return canvas;
}

function paintValley(canvas, seed = 1847) {
  const W = canvas.width = 1152, H = canvas.height = 896, R = mulberry(seed), { n2, fbm } = makeNoise(seed);
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

export const PAINTINGS = { scream: { title: "Signature Required", w: 896, h: 1152, m: [0.7, 0.9], paint: paintScream }, valley: { title: "The Long Valley, Evening", w: 1152, h: 896, m: [0.9, 0.7], paint: paintValley } };
export function paint(canvas, which = "scream") { return PAINTINGS[which].paint(canvas); }
