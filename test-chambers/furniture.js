// Test Chambers: the furniture kit (v8.6, dens plan Batch 1b).
// Built once and reused by every den and staff room. A piece is a template: its parts merged into one geometry per
// material, plus the boxes that make it solid. A room's furniture list is merged again across pieces, so a fully
// furnished den costs about one draw call per material, not one per mug. Every piece is original.
//
// Coordinates: metres. A piece's origin is the middle of its footprint on the floor and its front faces +z.
// Wall pieces (`wall: true`) have their back on z = 0 at the mounting point and stand out along +z.
// Ceiling pieces (`ceil: true`) hang down from y = 0. `turn` (0 to 3) is quarter turns about y: 1 faces +x.
//
//   import { Furn } from "./furniture.js";
//   const r = Furn.room([{ k: "desk", at: [3, 0, 4], turn: 2 }, { k: "chair", at: [3, 0, 3.2], ry: 0.4 }], { grime: 0.3 });
//   group.add(r.group); level.boxes.push(...r.solids);   // solids are dark, take no portals, and are never drawn
//
// Grime is 0 (new) to 1 (been there for years); it yellows, dulls and dirties every material, in five steps that
// share materials. Small things are never solid; solid pieces are blocks with no gap a player could get caught in.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { paint, PAINTINGS } from "./painting.js";

export const KIT_VERSION = "kit 1.4";
const TAU = Math.PI * 2, PLAYER_W = 0.6, CATCH = 0.75;      // a gap between 2 cm and 75 cm is one a body can wedge into

// ---------- textures (canvas, made once) ----------
const texCache = {};
function canvasTex(key, w, h, paint, o = {}) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); paint(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (o.rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.rep[0], o.rep[1]); }
  t.anisotropy = o.aniso || 4; t.userData.canvas = c;
  return (texCache[key] = t);
}
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; }
const hand = (g, size, w = 600) => { g.font = `${w} ${size}px "Marker Felt", "Comic Sans MS", "Segoe Print", cursive`; };
const sans = (g, size, w = 700) => { g.font = `${w} ${size}px Helvetica, Arial, sans-serif`; };

const TEX = {
  dirt: () => canvasTex("dirt", 256, 256, (g, w, h) => {          // ambient-occlusion style mottling: white is clean, dark collects grime
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); const r = rng(7);
    for (let i = 0; i < 900; i++) { const x = r() * w, y = r() * h, s = 2 + r() * 18; g.fillStyle = `rgba(70,58,40,${0.03 + r() * 0.06})`; g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(60,50,35,0)"); gr.addColorStop(0.82, "rgba(60,50,35,0)"); gr.addColorStop(1, "rgba(60,50,35,.35)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (const e of [[0, 0, w, 6], [0, h - 6, w, 6], [0, 0, 6, h], [w - 6, 0, 6, h]]) { g.fillStyle = "rgba(60,50,35,.18)"; g.fillRect(...e); }
  }, { srgb: false }),
  wood: () => canvasTex("wood", 512, 256, (g, w, h) => {
    g.fillStyle = "#9a6b42"; g.fillRect(0, 0, w, h); const r = rng(3);
    for (let y = 0; y < h; y += 1) { const v = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5; g.fillStyle = `rgba(${70 + v * 40},${40 + v * 25},${20 + v * 12},${0.25 + r() * 0.15})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(55,32,16,${0.15 + r() * 0.2})`; g.lineWidth = 0.6 + r() * 1.4; g.beginPath(); const y0 = r() * h; g.moveTo(0, y0); for (let x = 0; x <= w; x += 32) g.lineTo(x, y0 + Math.sin(x * 0.02 + i) * 3 + (r() - 0.5) * 2); g.stroke(); }
    for (let i = 0; i < 3; i++) { const x = r() * w, y = r() * h; for (let k = 6; k > 0; k--) { g.strokeStyle = `rgba(60,34,16,.35)`; g.beginPath(); g.ellipse(x, y, k * 5, k * 1.6, 0, 0, TAU); g.stroke(); } }
  }),
  laminate: () => canvasTex("laminate", 256, 256, (g, w, h) => {      // a speckled beige office desktop
    g.fillStyle = "#cfc4ab"; g.fillRect(0, 0, w, h); const r = rng(11);
    for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,105,80,.25)" : "rgba(255,250,235,.25)"; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }),
  carpet: () => canvasTex("carpet", 256, 256, (g, w, h) => {          // 50 cm carpet tiles, a tired blue-grey, laid with the pile turned each tile
    const r = rng(5);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * 128, y0 = ty * 128, sh = (tx + ty) % 2 ? 4 : -4;
      g.fillStyle = `rgb(${74 + sh},${82 + sh},${94 + sh})`; g.fillRect(x0, y0, 128, 128);
      for (let i = 0; i < 1600; i++) { const v = r(); g.fillStyle = v < 0.33 ? "rgba(40,46,58,.5)" : v < 0.66 ? "rgba(120,128,140,.35)" : "rgba(95,80,70,.25)"; const px = x0 + r() * 128, py = y0 + r() * 128; (tx + ty) % 2 ? g.fillRect(px, py, 1, 2.5) : g.fillRect(px, py, 2.5, 1); }
      g.strokeStyle = "rgba(30,34,40,.55)"; g.lineWidth = 1.2; g.strokeRect(x0 + 0.5, y0 + 0.5, 127, 127);
    }
  }, { rep: [1, 1] }),
  lino: () => canvasTex("lino", 256, 256, (g, w, h) => {              // 30 cm vinyl tiles, cream with a darker fleck, one tile in four a little off
    const r = rng(9);
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      const x0 = tx * 64, y0 = ty * 64, d = (r() - 0.5) * 14;
      g.fillStyle = `rgb(${206 + d},${198 + d},${176 + d})`; g.fillRect(x0, y0, 64, 64);
      for (let i = 0; i < 90; i++) { g.fillStyle = r() < 0.6 ? "rgba(110,98,78,.45)" : "rgba(150,70,50,.25)"; const s = 1 + r() * 2.5; g.fillRect(x0 + r() * 64, y0 + r() * 64, s, s * (0.4 + r())); }
      g.strokeStyle = "rgba(80,70,55,.5)"; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, 63, 63);
    }
  }, { rep: [1, 1] }),
  cork: () => canvasTex("cork", 256, 256, (g, w, h) => {
    g.fillStyle = "#a9794a"; g.fillRect(0, 0, w, h); const r = rng(4);
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < 0.5 ? "rgba(90,56,28,.55)" : "rgba(210,170,120,.45)"; const s = 1 + r() * 3; g.fillRect(r() * w, r() * h, s, s); }
  }),
  fabric: (key, base) => canvasTex("fab" + key, 128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h); const r = rng(base.length * 7 + key.length);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(0,0,0,${0.06 + r() * 0.05})`; g.fillRect(0, y, w, 1); }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.04})`; g.fillRect(x, 0, 1, h); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.12})`; g.fillRect(r() * w, r() * h, 2, 2); }
  }),
  cardboard: () => canvasTex("cardboard", 256, 256, (g, w, h) => {
    g.fillStyle = "#b48a57"; g.fillRect(0, 0, w, h); const r = rng(13);
    for (let i = 0; i < 1500; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,86,48,.25)" : "rgba(220,190,140,.2)"; g.fillRect(r() * w, r() * h, 2, 1); }
    g.fillStyle = "rgba(196,170,120,.85)"; g.fillRect(w * 0.42, 0, w * 0.16, h);          // the tape over the flaps
    g.strokeStyle = "rgba(120,96,60,.5)"; g.strokeRect(w * 0.42, 0, w * 0.16, h);
    g.save(); g.translate(w * 0.2, h * 0.72); g.fillStyle = "rgba(40,30,20,.7)"; sans(g, 13, 800); g.textAlign = "center";
    g.fillText("THIS WAY UP", 0, 30); g.beginPath(); g.moveTo(-8, 18); g.lineTo(-8, 2); g.lineTo(-14, 2); g.lineTo(-4, -10); g.lineTo(6, 2); g.lineTo(0, 2); g.lineTo(0, 18); g.fill(); g.restore();
    g.save(); g.translate(w * 0.8, h * 0.2); g.rotate(-0.08); g.fillStyle = "rgba(30,30,30,.75)"; hand(g, 20); g.textAlign = "center"; g.fillText("FILES", 0, 0); g.fillText("72-79", 0, 22); g.restore();
  }),
  sack: () => canvasTex("sack", 256, 256, (g, w, h) => {              // canvas mail sack, stencilled
    g.fillStyle = "#8d8668"; g.fillRect(0, 0, w, h); const r = rng(17);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.06})`; g.fillRect(0, y, w, 1.5); }
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,240,${0.03 + r() * 0.05})`; g.fillRect(x, 0, 1.5, h); }
    g.fillStyle = "rgba(30,34,40,.75)"; sans(g, 40, 900); g.textAlign = "center"; g.fillText("INTERNAL", w / 2, h * 0.47); g.fillText("MAIL", w / 2, h * 0.65);
    sans(g, 16, 800); g.fillText("FLOOR -3", w / 2, h * 0.78);
  }),
  keys: () => canvasTex("keys", 512, 160, (g, w, h) => {              // an old beige keyboard: worn keycaps
    g.fillStyle = "#6f6858"; g.fillRect(0, 0, w, h);          // dark gaps between the keys
    const rows = [14, 14, 13, 12, 9], kw = w / 15.5;
    sans(g, 11, 600); g.textAlign = "center"; g.textBaseline = "middle";
    const lab = ["ESC1234567890-=", "TQWERTYUIOP[]\\", "CASDFGHJKL;'", "SZXCVBNM,./", "  "];
    rows.forEach((n, ri) => {
      let x = 4 + ri * kw * 0.25; const y = 6 + ri * (h - 12) / 5, kh = (h - 12) / 5 - 4;
      for (let i = 0; i < n; i++) {
        const wide = ri === 4 && i === 4 ? kw * 6 : kw - 4;
        g.fillStyle = ri === 4 && i === 4 ? "#c4bca6" : i === 0 && ri > 0 ? "#a59d88" : "#ddd6c2"; g.fillRect(x, y, wide, kh);
        g.fillStyle = "rgba(0,0,0,.28)"; g.fillRect(x, y + kh - 4, wide, 4); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y, wide, 2);
        g.fillStyle = "rgba(40,36,28,.85)"; const ch = lab[ri][i]; if (ch && ch !== " ") g.fillText(ch, x + wide / 2, y + kh / 2);
        x += wide + 4;
      }
    });
  }),
  crt: () => canvasTex("crt", 256, 192, (g, w, h) => {               // a green-screen terminal left logged in
    const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); gr.addColorStop(0, "#0c2a16"); gr.addColorStop(1, "#020a05");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = "#58ff8e"; g.font = "bold 12px Courier New, monospace";
    const L = ["RECORDS  TERMINAL 4", "", "> LIST SUBJECTS", "  NO RECORDS FOUND", "> LIST STAFF", "  NO RECORDS FOUND", "> WHERE IS EVERYONE", "  UNKNOWN COMMAND", "> _"];
    L.forEach((s, i) => g.fillText(s, 14, 22 + i * 17));
    for (let y = 0; y < h; y += 3) { g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, y, w, 1); }     // soft scan lines (wide enough not to shimmer at a distance)
  }),
  clock: () => canvasTex("clock", 256, 256, (g, w, h) => {           // stopped at 8:38 (every clock in the facility says 8:38)
    g.fillStyle = "#f2efe6"; g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill();
    g.strokeStyle = "#222"; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, r0 = i % 5 ? 112 : 102; g.lineWidth = i % 5 ? 2 : 5; g.beginPath(); g.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); g.lineTo(128 + Math.sin(a) * 118, 128 - Math.cos(a) * 118); g.stroke(); }
    g.fillStyle = "#222"; sans(g, 24, 700); g.textAlign = "center"; g.textBaseline = "middle";
    for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; g.fillText(String(i), 128 + Math.sin(a) * 84, 128 - Math.cos(a) * 84); }
    const hand2 = (a, len, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = "round"; g.beginPath(); g.moveTo(128 - Math.sin(a) * 14, 128 + Math.cos(a) * 14); g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); g.stroke(); };
    hand2((8 + 38 / 60) / 12 * TAU, 58, 8, "#1b1b1b"); hand2(38 / 60 * TAU, 92, 5, "#1b1b1b"); hand2(12 / 60 * TAU, 98, 2, "#b3261e");
    g.fillStyle = "#b3261e"; g.beginPath(); g.arc(128, 128, 6, 0, TAU); g.fill();
  }),
  flipclock: () => canvasTex("flipclock", 512, 256, (g, w, h) => {   // a split-flap desk clock's two windows: 8 | 38
    g.fillStyle = "#0b0b0c"; g.fillRect(0, 0, w, h);
    const card = (x, cw, txt) => {
      const y = 22, ch = h - 44, mid = y + ch / 2;
      for (const top of [true, false]) {                       // each card is two flaps, the top one catching a little more light
        const y0 = top ? y : mid + 3, y1 = top ? mid - 3 : y + ch, gr = g.createLinearGradient(0, y0, 0, y1);
        gr.addColorStop(0, top ? "#3a3b3e" : "#25262a"); gr.addColorStop(1, top ? "#2a2b2e" : "#18191b");
        g.fillStyle = gr; g.beginPath(); g.roundRect(x, y0, cw, y1 - y0, top ? [10, 10, 2, 2] : [2, 2, 10, 10]); g.fill();
      }
      g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip();
      g.fillStyle = "#f1eee6"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${Math.round(ch * 0.84)}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      g.fillText(txt, x + cw / 2, mid + ch * 0.035);
      const sh = g.createLinearGradient(0, mid + 3, 0, mid + 3 + ch * 0.07); sh.addColorStop(0, "rgba(0,0,0,.32)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh; g.fillRect(x, mid + 3, cw, ch * 0.07);                             // the top flap's soft shadow on the lower one
      g.restore();
      g.fillStyle = "#050506"; g.fillRect(x - 2, mid - 3, cw + 4, 6);                      // the split
      g.fillStyle = "#6c6e72"; for (const px of [x + 4, x + cw - 10]) g.fillRect(px, mid - 4, 6, 8);   // hinge pins
    };
    card(28, 150, "8"); card(206, 278, "38");
  }),
  ledclock: () => canvasTex("ledclock", 768, 256, (g, w, h) => {     // green dot-LED digits, 8:38, two segments going
    g.fillStyle = "#030504"; g.fillRect(0, 0, w, h);
    // segments a..g as (x0, y0, x1, y1) in a 1 x 2 digit cell
    const SEG = { a: [0.12, 0, 0.88, 0], b: [1, 0.1, 1, 0.9], c: [1, 1.1, 1, 1.9], d: [0.12, 2, 0.88, 2], e: [0, 1.1, 0, 1.9], f: [0, 0.1, 0, 0.9], g: [0.12, 1, 0.88, 1] };
    const DIG = { 8: "abcdefg", 3: "abcdg" };
    const OFF = "rgba(48,90,54,.22)", ON = "#7dff86";
    const dot = (x, y, r, lit) => {
      if (lit > 0) { g.shadowColor = "rgba(90,255,110," + (0.9 * lit) + ")"; g.shadowBlur = 14 * lit; g.fillStyle = lit >= 1 ? ON : `rgba(125,255,134,${0.18 + lit * 0.6})`; }
      else { g.shadowBlur = 0; g.fillStyle = OFF; }
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.shadowBlur = 0;
    };
    // fail[seg] = function of the dot's index (0..n-1) -> brightness 0..1
    const digit = (ox, oy, sz, d, fail = {}) => {
      for (const k in SEG) {
        const [x0, y0, x1, y1] = SEG[k], n = 7, on = d !== null && DIG[d].includes(k);
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), x = ox + (x0 + (x1 - x0) * t) * sz, y = oy + (y0 + (y1 - y0) * t) * sz;
          dot(x, y, sz * 0.075, on ? (fail[k] ? fail[k](i) : 1) : 0);
        }
      }
    };
    const sz = 92, oy = 34;
    digit(40, oy, sz, null);                                                    // the tens of the hour: blank (its unlit dots still show)
    digit(210, oy, sz, 8, { e: i => (i >= 5 ? 0 : 1), b: i => (i === 4 ? 0 : 1) });   // the 8: the foot of its lower-left bar dead, one dot out on the right
    dot(366, oy + sz * 0.62, 9, 1); dot(366, oy + sz * 1.38, 9, 1);             // colon
    digit(430, oy, sz, 3);
    digit(600, oy, sz, 8, { g: i => (i === 2 || i === 4 ? 0 : 1), c: i => (i >= 4 ? 0.35 : 1) });   // the last 8: two dots dead in its middle bar, the foot of its lower-right bar fading (still reads 8)
  }, { aniso: 8 }),
  notices: () => canvasTex("notices", 512, 340, (g, w, h) => {        // the noticeboard's papers
    const r = rng(21);
    const paper = (x, y, pw, ph, rot, col, lines, title) => {
      g.save(); g.translate(x, y); g.rotate(rot); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(-pw / 2 + 3, -ph / 2 + 4, pw, ph);
      g.fillStyle = col; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.fillStyle = "#222"; if (title) { sans(g, 15, 900); g.textAlign = "center"; g.fillText(title, 0, -ph / 2 + 22); }
      g.textAlign = "left"; sans(g, 9, 500); lines.forEach((s, i) => g.fillText(s, -pw / 2 + 10, -ph / 2 + (title ? 42 : 18) + i * 13));
      g.fillStyle = ["#d33", "#36c", "#2a2", "#ec2"][Math.floor(r() * 4)]; g.beginPath(); g.arc(0, -ph / 2 + 7, 5, 0, TAU); g.fill();
      g.restore();
    };
    paper(110, 100, 160, 150, -0.05, "#f6f3ea", ["Please wash your own mug.", "This means you.", "", "The kitchen is not a", "lost property office."], "KITCHEN");
    paper(300, 90, 130, 120, 0.06, "#fff5a8", ["Fire drill: TUESDAY", "Assemble in car park B.", "Do not use the lifts."], "NOTICE");
    paper(420, 210, 140, 170, -0.03, "#f6f3ea", ["Name        Ext.", "Facilities   201", "Records      214", "Security     230", "Supervisor   200", "Testing      ---"], "PHONE LIST");
    paper(140, 255, 170, 110, 0.04, "#cfe6ff", ["Leaving drinks on Friday!", "Everyone welcome.", "Bring a mug."], "FRIDAY");
    paper(285, 250, 100, 120, -0.09, "#ffd3c9", ["LOST:", "One sock.", "Yellow.", "Answers to", "nothing."]);
  }),
  whiteboard: () => canvasTex("whiteboard", 512, 320, (g, w, h) => {
    g.fillStyle = "#f7f8f6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) { const gr = g.createRadialGradient(0, 0, 4, 0, 0, 70); gr.addColorStop(0, "rgba(110,120,135,.10)"); gr.addColorStop(1, "rgba(110,120,135,0)");      // smears where things were wiped off
      g.save(); g.translate(60 + i * 62, 60 + (i * 97) % 220); g.scale(1.8, 0.5); g.fillStyle = gr; g.fillRect(-70, -70, 140, 140); g.restore(); }
    g.strokeStyle = "#1d4fa8"; g.fillStyle = "#1d4fa8"; hand(g, 28); g.fillText("Q3 PRIORITIES", 30, 48);
    g.lineWidth = 3; g.beginPath(); g.moveTo(30, 58); g.lineTo(250, 56); g.stroke();
    hand(g, 22); ["1. More tests", "2. More subjects", "3. ???", "4. Car park lights"].forEach((s, i) => g.fillText(s, 40, 98 + i * 34));
    g.strokeStyle = "#b3261e"; g.fillStyle = "#b3261e"; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 160); g.lineTo(200, 166); g.stroke();
    hand(g, 20); g.fillText("back Monday", 330, 250);
    g.strokeStyle = "#1e7a3c"; g.beginPath(); g.arc(400, 120, 50, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(350, 120); g.lineTo(450, 120); g.moveTo(400, 70); g.lineTo(400, 170); g.stroke();
  }),
  vend: () => canvasTex("vend", 256, 512, (g, w, h) => {              // the vending machine's front: rows of snacks behind glass, keypad, slot
    g.fillStyle = "#16181b"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#2a2f35"; g.fillRect(12, 12, 170, 400);
    const r = rng(31), cols = ["#c8372d", "#e4a62b", "#3a7bd5", "#3aa457", "#8c4fc1", "#e86d1f", "#d9d2c0"];
    for (let row = 0; row < 6; row++) {
      const y = 22 + row * 64;
      g.fillStyle = "#5b636c"; g.fillRect(16, y + 46, 162, 4);
      for (let c = 0; c < 5; c++) {
        if (r() < 0.25) continue;                          // some slots sold out
        g.fillStyle = cols[Math.floor(r() * cols.length)]; const x = 22 + c * 31; g.fillRect(x, y + 6, 24, 40);
        g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(x + 3, y + 10, 5, 30);
        g.fillStyle = "#cfd4da"; sans(g, 8, 700); g.textAlign = "center"; g.fillText(String.fromCharCode(65 + row) + (c + 1), x + 12, y + 58);
      }
    }
    g.fillStyle = "#0e1a10"; g.fillRect(194, 40, 50, 24); g.fillStyle = "#6dff8f"; g.font = "bold 12px Courier New, monospace"; g.fillText("EMPTY", 198, 57);
    for (let i = 0; i < 12; i++) { g.fillStyle = "#9aa3ac"; g.fillRect(196 + (i % 3) * 16, 80 + Math.floor(i / 3) * 18, 12, 12); }
    g.fillStyle = "#050505"; g.fillRect(204, 170, 30, 6); g.fillRect(24, 430, 150, 54);
    g.fillStyle = "#c9a227"; sans(g, 13, 900); g.save(); g.translate(220, 330); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("SNACKS", 0, 0); g.restore();
  }),
  plate: (label) => canvasTex("plate:" + label, 256, 64, (g, w, h) => {      // a door's name plate
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#d9c88f"); gr.addColorStop(1, "#a8925a"); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#6e5c30"; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = "#2b2414"; sans(g, label.length > 12 ? 22 : 28, 800); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(label.toUpperCase(), w / 2, h / 2 + 1);
  }),
  toolboard: () => canvasTex("toolboard", 512, 256, (g, w, h) => {     // pegboard with painted tool outlines (some tools missing)
    g.fillStyle = "#c9b994"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(60,48,30,.55)"; for (let y = 10; y < h; y += 16) for (let x = 10; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2.2, 0, TAU); g.fill(); }
    g.strokeStyle = "#1b1b1b"; g.lineWidth = 3;
    const outline = (pts) => { g.beginPath(); g.moveTo(...pts[0]); for (const p of pts.slice(1)) g.lineTo(...p); g.closePath(); g.stroke(); };
    outline([[60, 40], [80, 40], [80, 150], [90, 170], [50, 170], [60, 150]]);      // a missing screwdriver
    outline([[330, 40], [350, 40], [356, 210], [324, 210]]);                         // a missing file
    g.strokeRect(410, 40, 70, 30);
  }),
  canvasBack: () => canvasTex("canvasBack", 128, 128, (g, w, h) => {
    g.fillStyle = "#c9bc9c"; g.fillRect(0, 0, w, h); const r = rng(41);
    for (let i = 0; i < 800; i++) { g.fillStyle = `rgba(90,75,50,${r() * 0.2})`; g.fillRect(r() * w, r() * h, 1, 1); }
  }),
  art: () => {                                  // the painting: "Signature Required" (painting.js), painted once (about a second) and kept
    return TEX.artOf("scream");
  },
  artOf: (which = "scream") => {                  // "scream" or "valley": painted once (about a second each) and kept
    const key = "art:" + which;
    if (!texCache[key]) { const c = document.createElement("canvas"); paint(c, which); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.canvas = c; texCache[key] = t; }
    return texCache[key];
  },
  lampShade: () => canvasTex("lampShade", 64, 64, (g, w, h) => { g.fillStyle = "#2f5c3a"; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(0, y, w, 2); } }),
  blob: () => canvasTex("blob", 128, 128, (g, w, h) => {              // soft contact shadow under a floor piece
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, "rgba(0,0,0,.55)"); gr.addColorStop(0.6, "rgba(0,0,0,.25)"); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: false })
};

// ---------- materials, shared per grime step ----------
// e: emissive colour (values over 1 bloom in the game's composer); t: transparent opacity; map: texture maker
const MDEF = {
  steel:    { c: 0x8c949c, r: .55, m: .35 },  steelDk: { c: 0x4a5058, r: .5, m: .4 },   chrome: { c: 0xd6dbe0, r: .18, m: 1 },
  paintGrn: { c: 0x6f7f6a, r: .6, m: .2 },    paintBlu: { c: 0x5a6f86, r: .55, m: .25 }, paintCrm: { c: 0xd8d0bc, r: .6, m: .1 },
  wood:     { c: 0xffffff, r: .62, m: 0, map: "wood" },  woodDk: { c: 0x6b5a4a, r: .6, m: 0, map: "wood" },
  laminate: { c: 0xffffff, r: .5, m: 0, map: "laminate" },
  beige:    { c: 0xd2c9b1, r: .5, m: 0 },     beigeDk: { c: 0xa69d86, r: .55, m: 0 },
  black:    { c: 0x1c1e21, r: .45, m: .05 },  rubber: { c: 0x111214, r: .9, m: 0 },     white: { c: 0xd2d2cc, r: .45, m: 0 },
  fabBlue:  { c: 0xffffff, r: .95, m: 0, map: "fabBlue" },  fabRust: { c: 0xffffff, r: .95, m: 0, map: "fabRust" },  fabGrey: { c: 0xffffff, r: .95, m: 0, map: "fabGrey" },
  leaf:     { c: 0x3f6b35, r: .7, m: 0 },     leafDk: { c: 0x2c4d27, r: .75, m: 0 },    soil: { c: 0x3a2c20, r: 1, m: 0 },
  terra:    { c: 0xa7583a, r: .8, m: 0 },     ceramic: { c: 0xd8d4c8, r: .3, m: 0 },    mugRed: { c: 0xa8332b, r: .3, m: 0 },
  cork:     { c: 0xffffff, r: .95, m: 0, map: "cork" },  card: { c: 0xffffff, r: .9, m: 0, map: "cardboard" },  cardPlain: { c: 0xb48a57, r: .9, m: 0 },
  sack:     { c: 0xffffff, r: 1, m: 0, map: "sack" },    paper: { c: 0xd2cec0, r: .9, m: 0 },  paperYel: { c: 0xd4c682, r: .9, m: 0 },
  keys:     { c: 0xffffff, r: .55, m: 0, map: "keys" },  notices: { c: 0xffffff, r: .85, m: 0, map: "notices" }, board: { c: 0xcfd1ce, r: .35, m: 0, map: "whiteboard" },
  vend:     { c: 0xffffff, r: .35, m: .1, map: "vend", e: [.35, .35, .35], emap: true },  toolbd: { c: 0xffffff, r: .85, m: 0, map: "toolboard" },
  clock:    { c: 0xd0d0cc, r: .5, m: 0, map: "clock" },  flipcard: { c: 0xffffff, r: .45, m: 0, map: "flipclock" },
  ledface:  { c: 0xffffff, r: .25, m: 0, map: "ledclock", e: [1.5, 1.5, 1.5], emap: true },  smoked: { c: 0x1c2a22, r: .06, m: 0, t: .3 },
  plasOrg:  { c: 0xc8662a, r: .38, m: 0 },  canvasBk: { c: 0xffffff, r: .95, m: 0, map: "canvasBack" },
  carpet:   { c: 0xffffff, r: .98, m: 0, map: "carpet" }, lino: { c: 0xffffff, r: .45, m: 0, map: "lino" },
  glass:    { c: 0xcfe3ea, r: .08, m: 0, t: .16 },  water: { c: 0x8fc4e8, r: .05, m: 0, t: .55 },
  screen:   { c: 0x000000, r: .2, m: 0, map: "crt", e: [1.2, 1.2, 1.2], emap: true },
  glow:     { c: 0xffffff, r: .3, m: 0, e: [2.4, 2.25, 2.0] },  glowWarm: { c: 0xffffff, r: .3, m: 0, e: [2.6, 2.0, 1.2] },
  ledRed:   { c: 0x330000, r: .3, m: 0, e: [2.5, .25, .2] },   ledGrn: { c: 0x003300, r: .3, m: 0, e: [.3, 2.4, .5] },
  shade:    { c: 0xffffff, r: .6, m: .1, map: "lampShade" },   brass: { c: 0xb0904a, r: .35, m: .9 },
  yellow:   { c: 0xe0b021, r: .5, m: 0 },  mopHead: { c: 0xcfc6ad, r: 1, m: 0 },  redTool: { c: 0xb3261e, r: .45, m: .1 },
  blob:     { c: 0x000000, r: 1, m: 0, blob: true }
};
// Plain-coloured materials share one of four finishes; their colour rides in the vertex colours, so a den's beige, cream,
// rubber and paper all draw together (fewer draw calls). Textured, glowing and see-through ones keep their own material.
const FINISH = { satin: { r: .42, m: .03 }, matte: { r: .8, m: .02 }, metal: { r: .52, m: .38 }, bright: { r: .22, m: .95 } };
const finishOf = d => d.map || d.e || d.t || d.blob ? null : d.m >= .85 ? "bright" : d.m >= .3 ? "metal" : d.r >= .6 ? "matte" : "satin";
for (const k in MDEF) MDEF[k].fin = finishOf(MDEF[k]);
for (const f in FINISH) MDEF["@" + f] = { c: 0xffffff, r: FINISH[f].r, m: FINISH[f].m, vc: true };
const DINGY = new THREE.Color(0x6a5b42), matCache = new Map();
let ENVMAP = null;          // the game's PMREM environment (Furn.setEnv); the showroom uses scene.environment instead
const ALBEDO = 0.74;        // the game lights props with a strong sky and sun: at full albedo white paint and paper bloomed
export const grimeStep = g => Math.round(Math.max(0, Math.min(1, g || 0)) * 4);            // 0..4
function mat(key, step, vc = false) {
  const id = key + "|" + step + (vc ? "|vc" : ""); if (matCache.has(id)) return matCache.get(id);
  const d = MDEF[key], g = step / 4; let m;
  if (d.blob) m = new THREE.MeshBasicMaterial({ map: TEX.blob(), transparent: true, depthWrite: false, opacity: 0.8 + 0.2 * g, polygonOffset: true, polygonOffsetFactor: -1 });
  else {
    const col = new THREE.Color(d.c);
    if (!d.e) col.lerp(DINGY, 0.28 * g).multiplyScalar(ALBEDO * (1 - 0.16 * g));
    const map = d.map ? (d.map.startsWith("fab") ? TEX.fabric(d.map, { fabBlue: "#40536f", fabRust: "#8a4b33", fabGrey: "#6c6f73" }[d.map]) : TEX[d.map]()) : null;
    m = new THREE.MeshStandardMaterial({ color: col, roughness: Math.min(1, d.r + 0.3 * g), metalness: d.m * (1 - 0.4 * g), map,
      aoMap: TEX.dirt(), aoMapIntensity: 0.15 + 0.85 * g, envMap: ENVMAP, envMapIntensity: 0.6 - 0.25 * g });
    if (d.e) { m.emissive = new THREE.Color(d.e[0], d.e[1], d.e[2]).multiplyScalar(1 - 0.25 * g); if (d.emap) m.emissiveMap = map; }
    if (d.t) { m.transparent = true; m.opacity = d.t; m.depthWrite = false; }
  }
  if ((vc || d.vc) && !d.blob && !d.e) m.vertexColors = true;          // a room's light, baked per piece (see room())
  m.userData.furn = 1;
  matCache.set(id, m); return m;
}

// ---------- the part builder ----------
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
class Kit {
  constructor() { this.parts = {}; this.solid = []; this.stack = [new THREE.Matrix4()]; this.blobs = []; }
  get M() { return this.stack[this.stack.length - 1]; }
  push(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { const m = new THREE.Matrix4().compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1)); this.stack.push(this.M.clone().multiply(m)); return this; }
  pop() { this.stack.pop(); return this; }
  geo(mk, g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    if (g.index) g = g.toNonIndexed();
    for (const a of Object.keys(g.attributes)) if (a !== "position" && a !== "normal" && a !== "uv") g.deleteAttribute(a);      // (colour is added below, for plain finishes)
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));
    g.applyMatrix4(this.M.clone().multiply(_m));
    const fin = MDEF[mk].fin; let key = mk;
    if (fin) { const c = new THREE.Color(MDEF[mk].c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); key = "@" + fin; }
    (this.parts[key] = this.parts[key] || []).push(g); return this;
  }
  box(mk, w, h, d, x, y, z, rx, ry, rz) { return this.geo(mk, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz); }
  // a box with rounded edges and corners (r): a rounded rectangle extruded with a matching bevel
  rbox(mk, w, h, d, r, x, y, z, rx, ry, rz) {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    const iw = w - 2 * r, ih = h - 2 * r, s = new THREE.Shape(), q = Math.min(r * 0.5, iw / 2 - 1e-4, ih / 2 - 1e-4);
    s.moveTo(-iw / 2 + q, -ih / 2); s.lineTo(iw / 2 - q, -ih / 2); s.quadraticCurveTo(iw / 2, -ih / 2, iw / 2, -ih / 2 + q); s.lineTo(iw / 2, ih / 2 - q);
    s.quadraticCurveTo(iw / 2, ih / 2, iw / 2 - q, ih / 2); s.lineTo(-iw / 2 + q, ih / 2); s.quadraticCurveTo(-iw / 2, ih / 2, -iw / 2, ih / 2 - q); s.lineTo(-iw / 2, -ih / 2 + q); s.quadraticCurveTo(-iw / 2, -ih / 2, -iw / 2 + q, -ih / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(d - 2 * r, 1e-3), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    // extrude UVs are in metres; bring them to about 0..1 across the face
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
    return this.geo(mk, g, x, y, z, rx, ry, rz);
  }
  cyl(mk, rt, rb, h, x, y, z, seg = 16, rx, ry, rz, open = false) { return this.geo(mk, new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), x, y, z, rx, ry, rz); }
  sph(mk, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 12) { return this.geo(mk, new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)), x, y, z, 0, 0, 0, sx, sy, sz); }
  torus(mk, R, r, x, y, z, arc = TAU, rx, ry, rz, seg = 20) { return this.geo(mk, new THREE.TorusGeometry(R, r, 8, seg, arc), x, y, z, rx, ry, rz); }
  lathe(mk, pts, x, y, z, seg = 20) {         // profile points, any order: drawn bottom to top so the faces point outwards
    if (pts[0][1] > pts[pts.length - 1][1]) pts = pts.slice().reverse();
    return this.geo(mk, new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg), x, y, z);
  }
  plane(mk, w, h, x, y, z, rx, ry, rz) { return this.geo(mk, new THREE.PlaneGeometry(w, h), x, y, z, rx, ry, rz); }
  rod(mk, a, b, r, seg = 8) {                // a cylinder from point a to point b
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, seg); g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate(A.x, A.y, A.z);
    return this.geo(mk, g);
  }
  solidBox(x0, y0, z0, x1, y1, z1) { this.solid.push([x0, y0, z0, x1, y1, z1]); return this; }
  shadow(w, d) { this.blobs.push([w, d]); return this; }
}

// ---------- the pieces ----------
// Each returns nothing; it fills the kit. `o` holds per-piece options (sizes, labels). `info` is shown in the showroom.
const legs4 = (K, mk, w, d, h, r, inset = 0.04) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl(mk, r, r * 0.85, h, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), 10); };
function casterBase(K, y, R = 0.3) {             // a five-star swivel base on castors
  K.cyl("black", 0.035, 0.045, 0.06, 0, y + 0.02, 0, 12);
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU, cx = Math.sin(a) * R, cz = Math.cos(a) * R;
    K.push(0, y, 0, 0, a, 0).box("black", 0.05, 0.035, R, 0, 0, R / 2).pop();
    K.cyl("rubber", 0.028, 0.028, 0.04, cx, 0.03, cz, 10, Math.PI / 2, a, 0);
    K.cyl("black", 0.008, 0.008, y - 0.03, cx, (y + 0.03) / 2 + 0.01, cz, 6);
  }
}
function drawerFront(K, w, h, x, y, z, mk = "steel") {
  K.rbox(mk, w, h, 0.02, 0.006, x, y, z);
  K.rbox("chrome", Math.min(0.14, w * 0.5), 0.022, 0.03, 0.008, x, y + h * 0.28, z + 0.022);
  K.box("paper", 0.07, 0.035, 0.004, x, y + h * 0.05, z + 0.012);
}
const PIECES = {
  // ---------------- office ----------------
  desk: { name: "Desk", group: "Office", solid: true, info: "Steel pedestal desk, laminate top. Solid.",
    build(K, o) {
      const W = o.w || 1.5, D = 0.75, H = 0.75;
      K.rbox("laminate", W, 0.035, D, 0.012, 0, H - 0.018, 0);
      K.box("steel", 0.42, H - 0.04, D - 0.06, W / 2 - 0.23, (H - 0.04) / 2, 0);              // drawer pedestal
      for (let i = 0; i < 3; i++) drawerFront(K, 0.38, 0.2, W / 2 - 0.23, 0.12 + i * 0.22, D / 2 - 0.02);
      K.box("steel", 0.03, H - 0.04, D - 0.1, -W / 2 + 0.04, (H - 0.04) / 2, 0);                // end panel
      K.box("steel", W - 0.48, 0.4, 0.02, -0.21, H - 0.27, -D / 2 + 0.06);                     // modesty panel
      K.box("rubber", 0.03, 0.01, D - 0.1, -W / 2 + 0.04, 0.005, 0); K.box("rubber", 0.42, 0.01, D - 0.06, W / 2 - 0.23, 0.005, 0);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  chair: { name: "Swivel chair", group: "Office", info: "Five-star base, fabric seat and back. Not solid.",
    build(K, o) {
      casterBase(K, 0.1, 0.3);
      K.cyl("chrome", 0.025, 0.025, 0.32, 0, 0.27, 0, 12); K.cyl("black", 0.035, 0.035, 0.12, 0, 0.18, 0, 12);
      K.box("black", 0.3, 0.03, 0.3, 0, 0.43, 0);
      K.rbox("fabBlue", 0.5, 0.08, 0.48, 0.035, 0, 0.48, 0.02);
      K.box("black", 0.06, 0.32, 0.03, 0, 0.62, -0.24, -0.12);
      K.rbox("fabBlue", 0.46, 0.5, 0.07, 0.03, 0, 0.88, -0.27, -0.1);
      for (const s of [-1, 1]) { K.box("black", 0.035, 0.2, 0.035, s * 0.25, 0.6, 0.02); K.rbox("black", 0.07, 0.03, 0.28, 0.012, s * 0.25, 0.71, 0.04); }
      K.shadow(0.75, 0.75);
    } },
  cabinet: { name: "Filing cabinet", group: "Office", solid: true, info: "Four-drawer steel cabinet. Solid.",
    build(K) {
      const W = 0.47, D = 0.62, H = 1.32;
      K.rbox("paintGrn", W, H, D, 0.012, 0, H / 2, 0);
      for (let i = 0; i < 4; i++) drawerFront(K, W - 0.04, 0.3, 0, 0.17 + i * 0.32, D / 2 + 0.006, "paintGrn");
      K.box("rubber", W - 0.02, 0.03, D - 0.02, 0, 0.015, 0);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  desklamp: { name: "Desk lamp", group: "Office", info: "Angled lamp with a lit shade. Not solid. Gives a lamp to bake.", light: [0, 0.45, 0.12, 0.35, 3, 1, 0.85, 0.6],
    build(K) {
      K.cyl("steelDk", 0.08, 0.09, 0.025, 0, 0.0125, 0, 20);
      K.rod("steelDk", [0, 0.02, 0], [0, 0.3, -0.06], 0.012); K.sph("steelDk", 0.02, 0, 0.3, -0.06);
      K.rod("steelDk", [0, 0.3, -0.06], [0, 0.46, 0.1], 0.011); K.sph("steelDk", 0.022, 0, 0.46, 0.1);
      K.push(0, 0.46, 0.12, 0.75, 0, 0).lathe("shade", [[0.02, 0.02], [0.05, 0], [0.085, -0.09], [0.088, -0.1]], 0, 0, 0, 20).cyl("glowWarm", 0.02, 0.02, 0.03, 0, -0.03, 0, 10).pop();
      K.rod("rubber", [0.06, 0.02, -0.02], [0.2, 0.0, -0.25], 0.004, 4);
    } },
  computer: { name: "Old computer", group: "Office", info: "Beige CRT on a desktop case, green-screen text. Not solid.",
    build(K) {
      K.rbox("beige", 0.44, 0.12, 0.4, 0.01, 0, 0.06, 0);                        // desktop case
      K.box("black", 0.16, 0.025, 0.01, -0.1, 0.07, 0.201); K.box("ledGrn", 0.012, 0.008, 0.006, 0.17, 0.05, 0.203);
      K.rbox("beige", 0.4, 0.34, 0.08, 0.02, 0, 0.32, 0.12);                     // monitor bezel
      K.rbox("beigeDk", 0.33, 0.27, 0.3, 0.04, 0, 0.32, -0.05);                  // the tube's back
      K.box("beigeDk", 0.2, 0.16, 0.12, 0, 0.31, -0.24);
      K.plane("screen", 0.31, 0.24, 0, 0.33, 0.161);
      K.box("beigeDk", 0.04, 0.012, 0.01, 0.15, 0.17, 0.161);
      K.cyl("beigeDk", 0.1, 0.12, 0.03, 0, 0.135, 0.03, 16);
    } },
  keyboard: { name: "Keyboard", group: "Office", info: "Worn beige keyboard with its cable. Not solid.",
    build(K) {
      K.rbox("beige", 0.46, 0.03, 0.17, 0.008, 0, 0.018, 0, 0.06);
      K.plane("keys", 0.44, 0.145, 0, 0.0345, 0.004, -Math.PI / 2 + 0.06);
      K.rod("black", [0, 0.02, -0.085], [0.05, 0.01, -0.3], 0.004, 4);
    } },
  phone: { name: "Desk phone", group: "Office", info: "Corded desk phone, handset on its cradle. Not solid.",
    build(K) {
      K.rbox("black", 0.2, 0.06, 0.2, 0.02, 0, 0.03, 0, 0.12);
      for (let i = 0; i < 12; i++) K.box("steel", 0.022, 0.006, 0.018, (i % 3 - 1) * 0.032, 0.066 - Math.floor(i / 3) * 0.004, 0.05 - Math.floor(i / 3) * 0.028, 0.12);
      K.box("ledRed", 0.012, 0.006, 0.008, 0.08, 0.07, 0.07);
      K.rbox("black", 0.05, 0.04, 0.22, 0.018, -0.06, 0.09, 0, 0, 0, 0);
      K.rbox("black", 0.06, 0.05, 0.06, 0.02, -0.06, 0.085, 0.09); K.rbox("black", 0.06, 0.05, 0.06, 0.02, -0.06, 0.085, -0.09);
      for (let i = 0; i < 6; i++) K.torus("black", 0.012, 0.003, -0.11 - i * 0.012, 0.03, 0.02 + i * 0.01, TAU, 0, Math.PI / 2, 0, 10);
    } },
  intray: { name: "In-tray", group: "Office", info: "Two-tier wire tray with paper. Not solid.",
    build(K) {
      for (const y of [0.01, 0.1]) {
        K.box("steelDk", 0.26, 0.006, 0.34, 0, y, 0);
        for (const s of [-1, 1]) { K.box("steelDk", 0.006, 0.05, 0.34, s * 0.13, y + 0.025, 0); K.box("steelDk", 0.26, 0.05, 0.006, 0, y + 0.025, s * 0.17); }
        K.box("paper", 0.21, 0.012 + y * 0.12, 0.297, 0.005, y + 0.012, 0, 0, 0.04, 0);
      }
      for (const s of [-1, 1]) for (const t of [-1, 1]) K.box("steelDk", 0.008, 0.1, 0.008, s * 0.12, 0.06, t * 0.16);
      K.box("paperYel", 0.08, 0.002, 0.08, 0.04, 0.125, 0.06, 0, 0.5, 0);
    } },
  clock: { name: "Wall clock", group: "Office", wall: true, info: "Stopped at 8:38. Hangs on a wall.",
    build(K) {
      K.cyl("black", 0.16, 0.16, 0.05, 0, 0, 0.025, 32, Math.PI / 2); K.torus("black", 0.16, 0.012, 0, 0, 0.05, TAU, 0, 0, 0, 32);
      K.geo("clock", new THREE.CircleGeometry(0.15, 32), 0, 0, 0.051);
      K.geo("glass", new THREE.CircleGeometry(0.152, 32), 0, 0, 0.058);
    } },
  flipclock: { name: "Flip clock", group: "Office", info: "Split-flap desk clock in orange plastic, flaps at 8:38. Not solid.",
    build(K) {
      const W = 0.24, H = 0.12, D = 0.11;
      K.rbox("plasOrg", W, H, D, 0.03, 0, H / 2 + 0.012, 0);                       // body
      K.box("black", W - 0.035, H - 0.04, 0.01, 0, H / 2 + 0.012, D / 2 - 0.003);   // the dark window
      K.plane("flipcard", W - 0.045, H - 0.05, 0, H / 2 + 0.012, D / 2 + 0.0025);
      K.cyl("steelDk", 0.0016, 0.0016, W - 0.05, 0, H / 2 + 0.012, D / 2 + 0.004, 6, 0, 0, Math.PI / 2);   // the flaps' axle across the split
      K.plane("glass", W - 0.04, H - 0.045, 0, H / 2 + 0.012, D / 2 + 0.008);
      for (const sx of [-1, 1]) K.cyl("plasOrg", 0.012, 0.012, 0.008, sx * (W / 2 + 0.003), H / 2 + 0.03, -0.01, 12, 0, 0, Math.PI / 2);   // setting knobs
      for (const sx of [-1, 1]) K.box("rubber", 0.04, 0.012, D - 0.03, sx * (W / 2 - 0.04), 0.006, 0);   // feet
    } },
  ledclock: { name: "LED wall clock", group: "Stores", wall: true, info: "Green dot-LED clock reading 8:38, two segments failing. Hangs on a wall.",
    build(K) {
      const W = 0.5, H = 0.2, D = 0.06;
      K.rbox("black", W, H, D, 0.012, 0, 0, D / 2);
      K.plane("ledface", W - 0.04, H - 0.04, 0, 0, D + 0.0015);
      K.plane("smoked", W - 0.03, H - 0.03, 0, 0, D + 0.005);
      K.box("steelDk", 0.08, 0.02, 0.04, 0, -H / 2 - 0.006, D / 2);                // cable gland under it
      K.cyl("black", 0.005, 0.005, 0.35, 0.02, -H / 2 - 0.18, 0.02, 6);            // the flex running down the wall
    } },
  noticeboard: { name: "Noticeboard", group: "Office", wall: true, info: "Cork board with pinned notices. Hangs on a wall.",
    build(K) {
      const W = 1.2, H = 0.8;
      K.box("cork", W, H, 0.02, 0, 0, 0.01);
      for (const [w, h, x, y] of [[W + 0.06, 0.04, 0, H / 2], [W + 0.06, 0.04, 0, -H / 2], [0.04, H, -W / 2, 0], [0.04, H, W / 2, 0]]) K.box("wood", w, h, 0.035, x, y, 0.017);
      K.plane("notices", W - 0.04, H - 0.04, 0, 0, 0.0215);
    } },
  whiteboard: { name: "Whiteboard", group: "Office", wall: true, info: "Half-wiped whiteboard with a pen tray. Hangs on a wall.",
    build(K) {
      const W = 1.6, H = 1.0;
      K.box("white", W, H, 0.02, 0, 0, 0.01); K.plane("board", W - 0.02, H - 0.02, 0, 0, 0.0205);
      for (const [w, h, x, y] of [[W + 0.04, 0.025, 0, H / 2], [W + 0.04, 0.025, 0, -H / 2], [0.025, H, -W / 2, 0], [0.025, H, W / 2, 0]]) K.box("chrome", w, h, 0.03, x, y, 0.015);
      K.box("chrome", 0.6, 0.02, 0.08, 0.3, -H / 2 - 0.015, 0.05); K.box("chrome", 0.6, 0.035, 0.008, 0.3, -H / 2 - 0.005, 0.09);
      K.cyl("black", 0.009, 0.009, 0.13, 0.2, -H / 2 + 0.006, 0.05, 8, 0, 0, Math.PI / 2); K.cyl("redTool", 0.009, 0.009, 0.13, 0.38, -H / 2 + 0.006, 0.06, 8, 0, 0.2, Math.PI / 2);
      K.box("black", 0.12, 0.05, 0.03, 0.5, -H / 2 + 0.02, 0.05);
    } },
  bin: { name: "Waste bin", group: "Office", info: "Mesh bin with screwed-up paper. Not solid.",
    build(K) {
      K.lathe("steelDk", [[0, 0], [0.12, 0], [0.15, 0.3], [0.155, 0.3]], 0, 0, 0, 20);
      K.torus("steelDk", 0.152, 0.006, 0, 0.3, 0, TAU, Math.PI / 2, 0, 0, 24);
      K.sph("paper", 0.04, 0.03, 0.28, 0.02, 1, 0.8, 1, 7); K.sph("paper", 0.035, -0.05, 0.26, -0.03, 1, 0.85, 1, 7); K.sph("paperYel", 0.03, 0.02, 0.33, -0.05, 1, 0.8, 1, 6);
      K.shadow(0.4, 0.4);
    } },
  plant: { name: "Pot plant", group: "Office", info: "A rubber plant in a terracotta pot. Not solid.",
    build(K, o) {
      K.lathe("terra", [[0, 0], [0.14, 0], [0.19, 0.32], [0.21, 0.33], [0.21, 0.37], [0.19, 0.37]], 0, 0, 0, 20);
      K.cyl("soil", 0.185, 0.185, 0.02, 0, 0.34, 0, 20);
      K.rod("woodDk", [0, 0.34, 0], [0.02, 1.05, 0.01], 0.015, 6);
      const r = rng(o.seed || 5);
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4 + r() * 0.5, y = 0.5 + i * 0.045, len = 0.22 + r() * 0.08;
        K.push(0.01, y, 0, 0, a, 0).rod("woodDk", [0, 0, 0], [0, 0.04, 0.08], 0.006, 4)
          .push(0, 0.04, 0.08, -0.5 - r() * 0.4, 0, 0).sph(i % 3 ? "leaf" : "leafDk", 0.5, 0, 0, len / 2, 0.11, 0.025, len).pop().pop();
      }
      K.shadow(0.55, 0.55);
    } },
  coatstand: { name: "Coat stand", group: "Office", info: "Bentwood coat stand, one coat left on it. Not solid.",
    build(K) {
      K.cyl("woodDk", 0.025, 0.03, 1.8, 0, 0.9, 0, 12); K.sph("woodDk", 0.04, 0, 1.82, 0);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + 0.4; K.push(0, 0, 0, 0, a, 0).rod("woodDk", [0, 0.35, 0], [0, 0.02, 0.3], 0.018, 8).rod("woodDk", [0, 1.62, 0], [0, 1.75, 0.16], 0.012, 6).sph("woodDk", 0.02, 0, 1.75, 0.16).pop(); }
      K.push(0, 0, 0, 0, 0.4, 0);                   // the coat
      K.lathe("fabGrey", [[0.02, 1.7], [0.16, 1.62], [0.2, 1.45], [0.22, 1.0], [0.24, 0.85], [0.0, 0.84]], 0, 0, 0.18, 14);
      K.pop(); K.shadow(0.7, 0.7);
    } },
  landscape: { name: "Landscape painting", group: "Office", wall: true, hinge: true, art: "valley", info: "\"The Long Valley, Evening\": an original landscape in the manner of the old masters, painted in code. Same hinged gilt frame.",
    build(K, o) { PIECES.painting.build(K, { ...o, w: o.w || 0.9, h: o.h || 0.7 }); } },
  painting: { name: "Framed painting", group: "Office", wall: true, hinge: true, art: "scream", info: "\"Signature Required\": a play on The Scream with the courier screaming, painted in code, in a hinged gilt frame that swings aside.",
    build(K, o) {
      const W = o.w || 0.7, H = o.h || 0.9;
      K.box("canvasBk", W, H, 0.025, 0, 0, 0.03);
      const f = 0.07;
      for (const [w, h, x, y] of [[W + 2 * f, f, 0, H / 2 + f / 2], [W + 2 * f, f, 0, -H / 2 - f / 2], [f, H, -W / 2 - f / 2, 0], [f, H, W / 2 + f / 2, 0]]) { K.box("brass", w, h, 0.05, x, y, 0.035); K.box("woodDk", w * 0.98, h * 0.4, 0.056, x, y, 0.035); }
      K.cyl("steelDk", 0.012, 0.012, 0.12, -W / 2 - f, H / 2 - 0.05, 0.012, 8); K.cyl("steelDk", 0.012, 0.012, 0.12, -W / 2 - f, -H / 2 + 0.05, 0.012, 8);    // hinge knuckles on the left edge
    } },
  // ---------------- break room ----------------
  table: { name: "Table", group: "Break room", solid: true, info: "Canteen table on steel legs. Solid.",
    build(K, o) {
      const W = o.w || 1.2, D = 0.8, H = 0.74;
      K.rbox("laminate", W, 0.03, D, 0.01, 0, H - 0.015, 0); K.box("chrome", W - 0.02, 0.012, D - 0.02, 0, H - 0.036, 0);
      legs4(K, "chrome", W, D, H - 0.03, 0.02, 0.06); K.box("steel", W - 0.12, 0.05, 0.02, 0, H - 0.07, D / 2 - 0.06); K.box("steel", W - 0.12, 0.05, 0.02, 0, H - 0.07, -D / 2 + 0.06);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  stackchair: { name: "Stacking chair", group: "Break room", info: "Plastic shell on a steel frame. Not solid.",
    build(K) {
      for (const sx of [-1, 1]) { K.rod("chrome", [sx * 0.2, 0, 0.2], [sx * 0.2, 0.45, 0.18], 0.012); K.rod("chrome", [sx * 0.2, 0, -0.2], [sx * 0.2, 0.45, -0.18], 0.012); K.rod("chrome", [sx * 0.2, 0.45, -0.18], [sx * 0.2, 0.85, -0.25], 0.012); }
      K.rbox("paintBlu", 0.44, 0.03, 0.42, 0.012, 0, 0.465, 0, -0.04);
      K.rbox("paintBlu", 0.44, 0.3, 0.025, 0.012, 0, 0.72, -0.235, -0.15);
      K.shadow(0.6, 0.6);
    } },
  kettle: { name: "Kettle", group: "Break room", info: "Cordless jug kettle on its base. Not solid.",
    build(K) {
      K.cyl("black", 0.085, 0.09, 0.02, 0, 0.01, 0, 20);
      K.lathe("white", [[0, 0.02], [0.08, 0.02], [0.085, 0.05], [0.075, 0.22], [0.065, 0.235], [0, 0.24]], 0, 0, 0, 20);
      K.box("white", 0.03, 0.17, 0.035, 0, 0.13, -0.095); K.box("white", 0.03, 0.03, 0.06, 0, 0.215, -0.07); K.box("white", 0.03, 0.03, 0.06, 0, 0.05, -0.07);
      K.cyl("white", 0.015, 0.03, 0.05, 0, 0.21, 0.085, 10, 1.1, 0, 0);
      K.box("water", 0.012, 0.12, 0.004, 0.06, 0.11, 0.05, 0, 0.7, 0); K.box("ledRed", 0.012, 0.008, 0.01, 0, 0.012, 0.09);
    } },
  mug: { name: "Mug", group: "Break room", info: "Same mug as the pick-up mug (0.1 m across). Not solid.",
    build(K, o) {
      const mk = o.red ? "mugRed" : "ceramic";
      K.lathe(mk, [[0, 0], [0.045, 0], [0.05, 0.11], [0.046, 0.11], [0.042, 0.012], [0, 0.012]], 0, 0, 0, 24);
      K.torus(mk, 0.03, 0.008, 0.05, 0.055, 0, Math.PI, 0, 0, -Math.PI / 2, 12);
      K.cyl("soil", 0.043, 0.043, 0.004, 0, 0.07, 0, 16);
    } },
  fridge: { name: "Fridge", group: "Break room", solid: true, info: "Tall fridge with a freezer door and notes on it. Solid.",
    build(K) {
      const W = 0.6, D = 0.65, H = 1.75;
      K.rbox("white", W, H, D, 0.03, 0, H / 2, 0);
      K.box("steel", W - 0.02, 0.008, 0.02, 0, 1.22, D / 2);                                       // the split between the doors
      K.rbox("steel", 0.03, 0.34, 0.04, 0.012, -W / 2 + 0.06, 1.0, D / 2 + 0.02); K.rbox("steel", 0.03, 0.22, 0.04, 0.012, -W / 2 + 0.06, 1.38, D / 2 + 0.02);
      K.box("paperYel", 0.08, 0.08, 0.002, 0.1, 1.45, D / 2 + 0.001, 0, 0, 0.12); K.box("paper", 0.15, 0.2, 0.002, 0.05, 0.9, D / 2 + 0.001, 0, 0, -0.05);
      K.box("black", 0.06, 0.03, 0.01, 0.12, 0.97, D / 2 + 0.006);
      K.box("black", W - 0.04, 0.08, 0.02, 0, 0.04, D / 2 - 0.01);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  cooler: { name: "Water cooler", group: "Break room", solid: true, info: "Bottle-top water cooler, half full. Solid.",
    build(K) {
      K.rbox("white", 0.32, 1.0, 0.32, 0.02, 0, 0.5, 0);
      K.box("black", 0.22, 0.12, 0.02, 0, 0.82, 0.17); K.box("redTool", 0.03, 0.04, 0.03, -0.05, 0.8, 0.19); K.box("paintBlu", 0.03, 0.04, 0.03, 0.05, 0.8, 0.19);
      K.box("steelDk", 0.2, 0.015, 0.1, 0, 0.7, 0.18);
      K.lathe("water", [[0, 1.0], [0.13, 1.03], [0.14, 1.15], [0.14, 1.38], [0.1, 1.44], [0.04, 1.46], [0, 1.46]], 0, 0, 0, 20);
      K.lathe("glass", [[0, 1.0], [0.135, 1.03], [0.145, 1.4], [0.12, 1.47], [0.05, 1.49], [0, 1.49]], 0, 0, 0, 20);
      K.solidBox(-0.16, 0, -0.16, 0.16, 1.0, 0.16); K.shadow(0.5, 0.5);
    } },
  vending: { name: "Vending machine", group: "Break room", solid: true, info: "Snack machine, lit front, mostly sold out. Solid.",
    build(K) {
      const W = 0.9, D = 0.8, H = 1.85;
      K.rbox("black", W, H, D, 0.02, 0, H / 2, 0);
      K.plane("vend", W - 0.06, H - 0.1, 0, H / 2 + 0.02, D / 2 + 0.002);
      K.box("glass", 0.6, 1.5, 0.01, -0.12, 1.06, D / 2 + 0.01);
      K.box("chrome", 0.025, 1.5, 0.03, 0.2, 1.06, D / 2 + 0.01);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  sofa: { name: "Sofa", group: "Break room", solid: true, info: "Two-seat sofa, worn cushions. Solid (you can stand on it).",
    build(K, o) {
      const W = o.w || 1.7, D = 0.85;
      K.rbox("fabRust", W, 0.22, D, 0.05, 0, 0.18, 0);
      for (const s of [-1, 1]) { K.rbox("fabRust", 0.2, 0.62, D, 0.06, s * (W / 2 - 0.1), 0.31, 0); K.rbox("fabRust", (W - 0.44) / 2, 0.14, D - 0.26, 0.05, s * (W - 0.44) / 4, 0.35, 0.09, 0.03 * s); }
      K.rbox("fabRust", W - 0.4, 0.5, 0.22, 0.07, 0, 0.55, -D / 2 + 0.12, -0.12);
      K.rbox("fabRust", W - 0.04, 0.5, 0.16, 0.05, 0, 0.42, -D / 2 + 0.08);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl("woodDk", 0.025, 0.02, 0.07, sx * (W / 2 - 0.08), 0.035, sz * (D / 2 - 0.08), 8);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, 0.62, D / 2); K.shadow(W + 0.25, D + 0.25);
    } },
  // ---------------- stores and workshop ----------------
  shelving: { name: "Metal shelving", group: "Stores", solid: true, info: "Five-shelf steel rack with boxes and files. Solid.",
    build(K, o) {
      const W = o.w || 1.2, D = 0.45, H = 2.0;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box("steelDk", 0.035, H, 0.035, sx * (W / 2 - 0.018), H / 2, sz * (D / 2 - 0.018));
      const r = rng(o.seed || 3);
      for (let i = 0; i < 5; i++) {
        const y = 0.08 + i * 0.46; K.box("steel", W, 0.025, D, 0, y, 0); K.box("steelDk", W, 0.04, 0.01, 0, y - 0.005, D / 2);
        if (i === 4) continue;
        let x = -W / 2 + 0.06;
        while (x < W / 2 - 0.2) {
          const k = r(), w = k < 0.4 ? 0.3 : k < 0.7 ? 0.07 : 0.22;
          if (k < 0.4) K.box("card", w, 0.24, 0.36, x + w / 2, y + 0.135, 0, 0, (r() - 0.5) * 0.1, 0);
          else if (k < 0.7) { for (let j = 0; j < 3; j++) K.box(j % 2 ? "paintBlu" : "redTool", 0.022, 0.3, 0.26, x + j * 0.024 + 0.012, y + 0.163, 0.04); }
          else K.box("cardPlain", w, 0.14, 0.3, x + w / 2, y + 0.083, 0.02);
          x += w + 0.04 + r() * 0.05;
        }
      }
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  lockers: { name: "Lockers", group: "Stores", solid: true, info: "A bank of three steel lockers, one ajar. Solid.",
    build(K, o) {
      const n = o.n || 3, CW = 0.38, W = n * CW, D = 0.5, H = 1.85;
      K.box("paintBlu", W, H, D - 0.02, 0, H / 2, -0.01);
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + CW * (i + 0.5), ajar = i === n - 1;
        K.push(x - CW / 2 + 0.01, 0, D / 2 - 0.01, 0, ajar ? -0.5 : 0, 0);
        K.box("paintBlu", CW - 0.02, H - 0.08, 0.015, CW / 2 - 0.01, H / 2, 0.008);
        for (let v = 0; v < 5; v++) K.box("steelDk", 0.16, 0.012, 0.004, CW / 2 - 0.01, H - 0.2 - v * 0.03, 0.017);
        K.rbox("chrome", 0.03, 0.1, 0.03, 0.01, CW - 0.07, 1.05, 0.025);
        K.box("paper", 0.09, 0.05, 0.002, CW / 2 - 0.01, 1.45, 0.017);
        K.pop();
      }
      K.box("black", W, 0.07, 0.02, 0, 0.035, D / 2 - 0.02);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2 - 0.01); K.shadow(W + 0.2, D + 0.2);
    } },
  workbench: { name: "Workbench", group: "Stores", solid: true, info: "Heavy wooden bench with a vice and a lower shelf. Solid.",
    build(K, o) {
      const W = o.w || 1.8, D = 0.7, H = 0.9;
      K.box("wood", W, 0.06, D, 0, H - 0.03, 0); K.box("wood", W - 0.1, 0.03, D - 0.1, 0, 0.18, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.box("steelDk", 0.06, H - 0.06, 0.06, sx * (W / 2 - 0.06), (H - 0.06) / 2, sz * (D / 2 - 0.06));
      K.push(W / 2 - 0.25, H, D / 2 - 0.02);                      // the vice
      K.box("steelDk", 0.18, 0.08, 0.1, 0, 0.04, -0.03); K.box("steelDk", 0.18, 0.08, 0.04, 0, 0.04, 0.06); K.cyl("chrome", 0.012, 0.012, 0.2, 0, 0.04, 0.14, 8, Math.PI / 2); K.cyl("chrome", 0.008, 0.008, 0.18, 0, 0.04, 0.24, 6, 0, 0, Math.PI / 2);
      K.pop();
      K.box("card", 0.4, 0.25, 0.35, -W / 4, 0.32, 0); K.box("redTool", 0.36, 0.14, 0.18, 0.2, 0.27, 0.05);
      K.rod("redTool", [-0.3, H + 0.01, 0.12], [-0.05, H + 0.02, 0.18], 0.012, 6); K.box("steel", 0.08, 0.025, 0.035, -0.02, H + 0.015, 0.185);
      K.solidBox(-W / 2, 0, -D / 2, W / 2, H, D / 2); K.shadow(W + 0.2, D + 0.2);
    } },
  toolboard: { name: "Tool board", group: "Stores", wall: true, info: "Pegboard with painted outlines; most tools gone. Hangs on a wall.",
    build(K) {
      K.box("toolbd", 1.4, 0.7, 0.015, 0, 0, 0.012); K.plane("toolbd", 1.38, 0.69, 0, 0, 0.02);
      K.rod("steelDk", [0.15, 0.25, 0.02], [0.15, 0.25, 0.08], 0.004, 4); K.push(0.15, 0.17, 0.08).rod("redTool", [0, 0.08, 0], [0, -0.1, 0], 0.012, 6).box("steel", 0.09, 0.03, 0.02, 0, -0.12, 0).pop();
      K.rod("steelDk", [0.45, 0.25, 0.02], [0.45, 0.25, 0.08], 0.004, 4); K.push(0.45, 0.25, 0.07).torus("steel", 0.06, 0.008, 0, -0.07, 0, TAU, 0, 0, 0, 16).pop();
    } },
  mop: { name: "Mop and bucket", group: "Stores", info: "Yellow wheeled bucket with wringer and mop. Not solid.",
    build(K) {
      K.rbox("yellow", 0.42, 0.28, 0.3, 0.04, 0, 0.17, 0);
      K.geo("water", new THREE.PlaneGeometry(0.36, 0.24), 0, 0.25, 0, -Math.PI / 2);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.cyl("rubber", 0.025, 0.025, 0.02, sx * 0.17, 0.025, sz * 0.12, 10, 0, 0, Math.PI / 2);
      K.rbox("steelDk", 0.18, 0.12, 0.24, 0.03, 0.11, 0.36, 0); K.rod("steelDk", [0.11, 0.42, 0], [0.11, 0.6, -0.05], 0.01);
      K.rod("wood", [-0.06, 0.25, 0.02], [-0.25, 1.35, -0.12], 0.014, 8); K.sph("mopHead", 0.09, -0.06, 0.24, 0.02, 1.2, 0.8, 1.2, 8);
      K.shadow(0.6, 0.5);
    } },
  carton: { name: "Cardboard box", group: "Stores", info: "Taped carton (size option). The small one matches the pick-up box. Not solid.",
    build(K, o) {
      const s = o.size || "big", [w, h, d] = s === "small" ? [0.18, 0.14, 0.12] : s === "mid" ? [0.4, 0.3, 0.3] : [0.55, 0.42, 0.42];
      K.rbox(s === "small" ? "cardPlain" : "card", w, h, d, 0.006, 0, h / 2, 0);
      if (s !== "small") { K.box("cardPlain", w * 0.5, 0.006, d * 0.98, -w * 0.25, h + 0.003, 0, 0, 0, -0.05); K.box("cardPlain", w * 0.5, 0.006, d * 0.98, w * 0.25, h + 0.003, 0, 0, 0, 0.03); K.shadow(w + 0.15, d + 0.15); }
    } },
  sack: { name: "Mail sack", group: "Stores", info: "Canvas internal-mail sack, tied, with a parcel peeking out. Not solid.",
    build(K) {
      K.lathe("sack", [[0, 0], [0.22, 0.02], [0.28, 0.2], [0.26, 0.42], [0.16, 0.56], [0.06, 0.6], [0.05, 0.66], [0.08, 0.72], [0, 0.73]], 0, 0, 0, 18);
      K.torus("woodDk", 0.055, 0.012, 0, 0.62, 0, TAU, Math.PI / 2, 0, 0, 14);
      K.box("cardPlain", 0.16, 0.1, 0.12, 0.2, 0.05, 0.18, 0, 0.5, 0.1);
      K.shadow(0.7, 0.7);
    } },
  sortrack: { name: "Sorting rack", group: "Stores", solid: true, info: "Mail pigeonholes on a counter, some still full. Solid.",
    build(K, o) {
      const W = o.w || 1.5, D = 0.45, C = 0.9, cols = 6, rows = 5, cw = W / cols, ch = 0.16;
      K.box("woodDk", W, C, D, 0, C / 2, 0); K.box("laminate", W + 0.04, 0.03, D + 0.04, 0, C + 0.015, 0);
      const rd = 0.32, top = C + 0.03 + rows * ch;
      K.box("wood", W, rows * ch, 0.015, 0, C + 0.03 + rows * ch / 2, -D / 2 + 0.008);
      for (let i = 0; i <= cols; i++) K.box("wood", 0.012, rows * ch, rd, -W / 2 + i * cw, C + 0.03 + rows * ch / 2, -D / 2 + rd / 2);
      for (let j = 0; j <= rows; j++) K.box("wood", W, 0.012, rd, 0, C + 0.03 + j * ch, -D / 2 + rd / 2);
      const r = rng(o.seed || 8);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (r() < 0.45) continue;
        const n = 1 + Math.floor(r() * 4);
        for (let k = 0; k < n; k++) K.box(r() < 0.8 ? "paper" : "paperYel", cw - 0.04, 0.003, 0.22, -W / 2 + (i + 0.5) * cw, C + 0.04 + j * ch + k * 0.006, -D / 2 + 0.14, 0, (r() - 0.5) * 0.1, 0);
        if (r() < 0.2) K.box("paper", cw - 0.05, 0.11, 0.004, -W / 2 + (i + 0.5) * cw, C + 0.09 + j * ch, -D / 2 + 0.27, -0.3, 0, 0);
      }
      for (let i = 0; i < cols; i++) K.box("paper", cw * 0.6, 0.025, 0.002, -W / 2 + (i + 0.5) * cw, top + 0.03, -D / 2 + rd + 0.002);
      K.solidBox(-W / 2 - 0.02, 0, -D / 2, W / 2 + 0.02, top, D / 2 + 0.02); K.shadow(W + 0.2, D + 0.2);
    } },
  // ---------------- fittings ----------------
  ceillight: { name: "Ceiling light", group: "Fittings", ceil: true, info: "Recessed 60 cm panel light. Gives a lamp to bake.", light: [0, -0.35, 0, 0.5, 5, 1, 0.97, 0.9],
    build(K) { K.box("white", 0.62, 0.03, 0.62, 0, -0.015, 0); K.box("glow", 0.56, 0.005, 0.56, 0, -0.033, 0); for (const s of [-1, 1]) { K.box("white", 0.56, 0.008, 0.015, 0, -0.035, s * 0.09); K.box("white", 0.015, 0.008, 0.56, s * 0.09, -0.035, 0); } } },
  striplight: { name: "Strip light", group: "Fittings", ceil: true, info: "Batten with a bare tube, on two chains (length option). Gives a lamp to bake.", light: [0, -0.45, 0, 0.45, 5, 1, 1, 0.95],
    build(K, o) {
      const L = o.len || 1.5;
      K.box("white", L, 0.06, 0.1, 0, -0.33, 0); K.cyl("glow", 0.017, 0.017, L - 0.1, 0, -0.38, 0, 10, 0, 0, Math.PI / 2);
      for (const s of [-1, 1]) { K.cyl("white", 0.022, 0.022, 0.03, s * (L / 2 - 0.04), -0.38, 0, 10, 0, 0, Math.PI / 2); for (let i = 0; i < 6; i++) K.torus("steel", 0.018, 0.004, s * (L / 2 - 0.15), -0.03 - i * 0.05, 0, TAU, 0, i % 2 ? Math.PI / 2 : 0, 0, 8); }
    } },
  floor: { name: "Floor covering", group: "Fittings", flat: true, info: "Carpet tile or lino laid on a floor (w, d, type options). Not solid.",
    build(K, o) {
      const w = o.w || 3, d = o.d || 3, g = new THREE.PlaneGeometry(w, d), uv = g.attributes.uv, t = o.type === "carpet" ? 1 : 1 / 1.2;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * t, uv.getY(i) * d * t);      // tiles at real size (texture repeat wraps)
      K.geo(o.type === "carpet" ? "carpet" : "lino", g, 0, 0.004, 0, -Math.PI / 2);
    } },
  skirting: { name: "Skirting", group: "Fittings", wall: true, info: "Painted skirting board along a wall (length option).",
    build(K, o) { const L = o.len || 3; K.box("paintCrm", L, 0.1, 0.018, 0, 0.05, 0.009); K.box("paintCrm", L, 0.012, 0.024, 0, 0.098, 0.012); } },
  door: { name: "Office door", group: "Fittings", wall: true, info: "Closed panel door with a name plate (label option). Set on a wall; it does not open.",
    build(K) {
      const W = 0.9, H = 2.05;
      for (const [w, h, x, y] of [[0.07, H + 0.07, -W / 2 - 0.035, H / 2], [0.07, H + 0.07, W / 2 + 0.035, H / 2], [W + 0.14, 0.07, 0, H + 0.035]]) K.box("paintCrm", w, h, 0.04, x, y, 0.02);
      K.box("wood", W, H, 0.04, 0, H / 2, 0.02);
      for (const y of [0.55, 1.45]) K.box("woodDk", W - 0.2, 0.7, 0.012, 0, y, 0.044);
      K.cyl("brass", 0.03, 0.03, 0.01, W / 2 - 0.1, 1.0, 0.045, 14, Math.PI / 2); K.rod("brass", [W / 2 - 0.1, 1.0, 0.05], [W / 2 - 0.1, 1.0, 0.1], 0.01); K.rod("brass", [W / 2 - 0.1, 1.0, 0.1], [W / 2 - 0.22, 1.0, 0.1], 0.01);
      K.box("brass", 0.3, 0.075, 0.006, 0, 1.6, 0.0445);
    } }
};
// pieces with a per-instance texture (the door's name plate) add it after merging; the painting keeps its own group so it can swing
const PLATE = { door: (o) => ({ w: 0.29, h: 0.068, x: 0, y: 1.6, z: 0.048, tex: TEX.plate(o.label || "Records") }) };

// ---------- templates ----------
const tmplCache = new Map();
function tmplKey(k, o) { const p = { ...o }; delete p.at; delete p.turn; delete p.ry; delete p.k; delete p.grime; return k + JSON.stringify(p); }
function template(k, o = {}) {
  const key = tmplKey(k, o); if (tmplCache.has(key)) return tmplCache.get(key);
  const P = PIECES[k]; if (!P) throw new Error("no such piece: " + k);
  const K = new Kit(); P.build(K, o);
  const parts = Object.entries(K.parts).map(([mk, gs]) => ({ mk, geo: mergeGeometries(gs, false) }));
  const box = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
  let tris = 0; for (const p of parts) tris += p.geo.attributes.position.count / 3;
  const t = { k, P, parts, solid: K.solid, blobs: K.blobs, box, tris, light: P.light };
  tmplCache.set(key, t); return t;
}

// a quarter turn (0..3) or a free yaw, as a matrix about the piece's origin
function placeMatrix(it) {
  const yaw = it.ry !== undefined ? it.ry : (it.turn || 0) * Math.PI / 2;
  const [x, y, z] = it.at || [0, 0, 0];
  return { m: new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)), yaw, x, y, z };
}
function solidWorld(b, pm) {                       // a template's solid box, placed (axis-aligned; a free yaw takes the box round it)
  const pts = []; for (const X of [b[0], b[3]]) for (const Z of [b[2], b[5]]) pts.push(new THREE.Vector3(X, 0, Z).applyMatrix4(pm.m));
  const xs = pts.map(p => p.x), zs = pts.map(p => p.z);
  const r = v => Math.round(v * 1000) / 1000;
  return { min: [r(Math.min(...xs)), r(pm.y + b[1]), r(Math.min(...zs))], max: [r(Math.max(...xs)), r(pm.y + b[4]), r(Math.max(...zs))], mat: "dark", portal: false, furn: true };
}

// one piece on its own (the showroom)
function makePiece(k, o = {}, grime = 0, clone = false) {        // clone: the meshes get their own geometry (a level disposes its meshes' geometry)
  const t = template(k, o), g = new THREE.Group(), step = grimeStep(grime);
  for (const p of t.parts) { const m = new THREE.Mesh(clone ? p.geo.clone() : p.geo, mat(p.mk, step)); g.add(m); }
  if (PLATE[k]) g.add(plateMesh(PLATE[k](o)));
  for (const [w, d] of t.blobs) { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat("blob", step)); b.rotation.x = -Math.PI / 2; b.position.y = 0.002; g.add(b); }
  if (t.P.hinge) return hinged(g, t, o, step);
  g.userData.t = t; return g;
}
function plateMesh(p) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshStandardMaterial({ map: p.tex, roughness: .35, metalness: .6, envMapIntensity: .5 }));
  m.position.set(p.x, p.y, p.z); m.userData.ownMat = 1; return m;
}
// the painting: the frame turns about its left edge. `art` is a canvas (the real picture, drawn in code) or the stand-in.
function hinged(g, t, o, step) {
  const which = t.P.art || "scream", W = o.w || PAINTINGS[which].m[0], H = o.h || PAINTINGS[which].m[1], f = 0.07, pivot = new THREE.Group(), wrap = new THREE.Group();
  pivot.position.set(-W / 2 - f, 0, 0.012); wrap.add(pivot);
  g.position.set(W / 2 + f, 0, -0.012); pivot.add(g);
  const art = o.art instanceof HTMLCanvasElement ? Object.assign(new THREE.CanvasTexture(o.art), { colorSpace: THREE.SRGBColorSpace }) : TEX.artOf(which);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: art, color: 0xd8d8d8, emissive: 0x8c8c8c, emissiveMap: art, roughness: .6, metalness: 0, aoMap: TEX.dirt(), aoMapIntensity: 0.2 + 0.6 * step / 4 }));
  face.position.z = 0.0435; face.userData.ownMat = 1; g.add(face);
  wrap.userData = { t, pivot, face, open: 0 };
  return wrap;
}
// swing a painting (0 shut flat on the wall, 1 open a little past square)
function swing(p, a) { p.userData.open = a; p.userData.pivot.rotation.y = -a * 1.75; }
function setArt(p, canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; p.userData.face.material.map = t; p.userData.face.material.emissiveMap = t; p.userData.face.material.needsUpdate = true; }

// ---------- a room's furniture, merged ----------
// list: [{ k, at: [x, y, z], turn | ry, ...piece options }]. opts: { grime, shadows: true }.
// Returns { group, solids, lamps, paintings, calls, tris, warnings }.
// `solids` are dark level boxes (never drawn: the meshes are the look). `lamps` are [x, y, z, ...] lamp args for the level's bake.
function room(list, opts = {}) {
  const step = grimeStep(opts.grime), byMat = {}, group = new THREE.Group(), solids = [], lamps = [], paintings = [], warnings = [];
  let tris = 0;
  const blobGeos = [];
  for (const it of list) {
    const t = template(it.k, it), pm = placeMatrix(it);
    if (t.solid.length && it.ry !== undefined && Math.abs(Math.round(it.ry / (Math.PI / 2)) * Math.PI / 2 - it.ry) > 1e-3) warnings.push(`${it.k} at ${it.at}: a solid piece turned off the quarter; its box is the box round it`);
    if (t.P.hinge || it.own) { const p = makePiece(it.k, it, opts.grime, true); p.applyMatrix4(pm.m); group.add(p); paintings.push(p); tris += t.tris; continue; }
    let lo = null, hi = null;
    if (opts.shade) {                     // the room's baked light at the foot and the top of the piece, blended up each vertex
      const b = t.box, c = new THREE.Vector3((b.min.x + b.max.x) / 2, 0, (b.min.z + b.max.z) / 2).applyMatrix4(pm.m);
      const y0 = pm.y + Math.max(b.min.y, -3), y1 = pm.y + Math.min(b.max.y, 3);
      lo = lightAt(opts.shade, c.x, y0 + 0.15, c.z); hi = lightAt(opts.shade, c.x, y1 + 0.05, c.z); lo.y = y0; hi.y = y1;
    }
    for (const p of t.parts) {
      const g = p.geo.clone().applyMatrix4(pm.m);
      if (lo) { const pos = g.attributes.position, base = g.attributes.color, col = new Float32Array(pos.count * 3), span = Math.max(0.01, hi.y - lo.y);
        for (let i = 0; i < pos.count; i++) { const f = Math.max(0, Math.min(1, (pos.getY(i) - lo.y) / span)); for (let k = 0; k < 3; k++) col[i * 3 + k] = (lo.c[k] + (hi.c[k] - lo.c[k]) * f) * (base ? base.array[i * 3 + k] : 1); }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3)); }
      (byMat[p.mk] = byMat[p.mk] || []).push(g);
    }
    if (PLATE[it.k]) { const pl = plateMesh(PLATE[it.k](it)); pl.applyMatrix4(pm.m); group.add(pl); }
    if (opts.shadows !== false) for (const [w, d] of t.blobs) { const b = new THREE.PlaneGeometry(w, d); b.rotateX(-Math.PI / 2); b.translate(0, 0.003, 0); blobGeos.push(b.applyMatrix4(pm.m)); }
    for (const b of t.solid) solids.push(solidWorld(b, pm));
    if (t.light) { const [lx, ly, lz, ...rest] = t.light, v = new THREE.Vector3(lx, ly, lz).applyMatrix4(pm.m); lamps.push([v.x, v.y, v.z, ...rest]); }
    tris += t.tris;
  }
  for (const mk in byMat) { const m = new THREE.Mesh(mergeGeometries(byMat[mk], false), mat(mk, step, !!opts.shade)); m.userData.furn = 1; group.add(m); }
  if (blobGeos.length) group.add(new THREE.Mesh(mergeGeometries(blobGeos, false), mat("blob", step)));
  group.traverse(o => { o.userData.ownMat = o.userData.ownMat || 0; });
  return { group, solids, lamps, paintings, calls: group.children.length, tris, warnings: warnings.concat(gapCheck(solids, opts.walls || [])) };
}

// shade(x, y, z) -> [r, g, b] is the level's bake at a point (about 0.42 in the dark, 1 or more by a lamp); the scene's own lights
// already light the furniture, so the bake becomes a multiplier that darkens a piece in a dark corner and warms it by a lamp
function lightAt(shade, x, y, z) { const s = shade(x, y, z); return { c: s.map(v => Math.max(0.32, Math.min(1.2, v / 0.95))) }; }

// ---------- the no-trap rule ----------
// Reports any gap between two solid things (furniture or the room's own boxes, `walls`) that is wider than 2 cm and
// narrower than 75 cm: the player is 60 cm wide, so such a gap is one they can be pushed into and stuck.
function gapCheck(solids, walls = []) {
  const out = [], all = solids.map(s => ({ b: s, f: 1 })).concat(walls.map(w => ({ b: w, f: 0 })));
  for (let i = 0; i < solids.length; i++) for (let j = 0; j < all.length; j++) {
    const A = solids[i], B = all[j].b; if (A === B || (all[j].f && j <= i)) continue;
    if (A.max[1] <= B.min[1] + 0.05 || B.max[1] <= A.min[1] + 0.05) continue;        // one above the other
    const lowTop = Math.min(A.max[1], B.max[1]); if (lowTop < 0.45) continue;           // you can step over anything under 45 cm
    for (const ax of [0, 2]) {
      const o = ax === 0 ? 2 : 0;
      if (A.max[o] <= B.min[o] + 0.1 || B.max[o] <= A.min[o] + 0.1) continue;           // not side by side along this axis
      const gap = Math.max(B.min[ax] - A.max[ax], A.min[ax] - B.max[ax]);
      if (gap > 0.02 && gap < CATCH && !filled(all, A, B, ax, o)) out.push(`gap of ${gap.toFixed(2)} m between ${A.min.map(v => v.toFixed(1))} and ${B.min.map(v => v.toFixed(1))}: close it or open it to ${CATCH} m`);
    }
  }
  return out;
}

function filled(all, A, B, ax, o) {               // another solid stands in the gap between A and B, so it is not a gap
  const lo = Math.min(A.max[ax], B.max[ax]), hi = Math.max(A.min[ax], B.min[ax]), m = (lo + hi) / 2, mo = (Math.max(A.min[o], B.min[o]) + Math.min(A.max[o], B.max[o])) / 2;
  return all.some(({ b }) => b !== A && b !== B && b.min[ax] <= m && b.max[ax] >= m && b.min[o] <= mo && b.max[o] >= mo && b.max[1] > 0.45);
}
function setEnv(t) { if (t === ENVMAP) return; ENVMAP = t; for (const m of matCache.values()) if (m.isMeshStandardMaterial) { m.envMap = t; m.needsUpdate = true; } }
// a list of every piece for the showroom
const list = () => Object.entries(PIECES).map(([k, P]) => ({ k, name: P.name, group: P.group, info: P.info, solid: !!P.solid, wall: !!P.wall, ceil: !!P.ceil }));
function preload(grimes = [0]) { for (const k in PIECES) template(k, {}); for (const g of grimes) for (const k in MDEF) mat(k, grimeStep(g)); }      // build up front, so nothing waits later

const art = (which = "scream") => TEX.artOf(which).userData.canvas;          // a painted canvas (paints it if it has not been yet)
export const Furn = { setEnv, art, PAINTINGS, list, make: makePiece, room, swing, setArt, gapCheck, template, preload, grimeStep, PIECES, MDEF, PLAYER_W, CATCH, KIT_VERSION };
