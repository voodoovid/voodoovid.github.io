/* Test Chambers: the film lens and the film's outdoor set (v8.49, Nov 27, 2026; v8.51: the same set by day for the closing film, `setDay`,
   the MaybeMail van and its beaver, a rounded door camera).
   `createFilm(THREE, renderer)` gives the opening film its own way of drawing a frame, in place of the game's composer:
     1. the world drawn upside down into a small picture, which wet floors mirror (`mirrorize`),
     2. the picture itself, with real shadows,
     3. a focus pass (near and far things blur, like a lens),
     4. glow and a sideways streak round bright lights,
     5. the grade: filmic tone curve, cool shadows, grain, vignette.
   `buildExterior` builds the rainy car park and the front of the building. The film's direction (shots, timing, the courier) is in
   `Cut` in index.html. Nothing here touches the game's own scene. */
export function createFilm(THREE, renderer) {
  const PI = Math.PI, V3 = THREE.Vector3, clamp = (x, a, b) => Math.min(b, Math.max(a, x)), ss = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, mix = (a, b, u) => a + (b - a) * u;
  function rng(s) { return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const R = rng(4107);
  function canvasTex(w, h, paint, srgb = true) { const c = document.createElement("canvas"); c.width = w; c.height = h; paint(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
  function speckle(g, n, w, h, lo, hi, a) { for (let i = 0; i < n; i++) { const v = lo + R() * (hi - lo) | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${a * (0.4 + R() * 0.6)})`; g.fillRect(R() * w, R() * h, 1 + R() * 2.5, 1 + R() * 2.5); } }
  function normalTex(n, height, strength) {       // a height field turned into a normal map
    const hmap = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) hmap[y * n + x] = height(x, y);
    return canvasTex(n, n, (g) => { const im = g.createImageData(n, n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const a = hmap[y * n + (x + 1) % n] - hmap[y * n + (x + n - 1) % n], b = hmap[((y + 1) % n) * n + x] - hmap[((y + n - 1) % n) * n + x]; const nx = -a * strength, ny = -b * strength, l = Math.hypot(nx, ny, 1), i = (y * n + x) * 4; im.data[i] = (nx / l * .5 + .5) * 255; im.data[i + 1] = (ny / l * .5 + .5) * 255; im.data[i + 2] = (1 / l * .5 + .5) * 255; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, false);
  }
  function noise2(seed) { const r = rng(seed), P = new Float32Array(4096); for (let i = 0; i < 4096; i++) P[i] = r(); const at = (x, y) => P[((y & 63) << 6) | (x & 63)]; return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, a = u * u * (3 - 2 * u), b = v * v * (3 - 2 * v); return mix(mix(at(xi, yi), at(xi + 1, yi), a), mix(at(xi, yi + 1), at(xi + 1, yi + 1), a), b); }; }

  /* ---------- quality ---------- */
  const QUALS = { high: { cap: 1600, mirror: 0.5, taps: 56, shadow: 2048, rain: 1, msaa: 4 }, medium: { cap: 1280, mirror: 0.4, taps: 32, shadow: 1024, rain: 0.6, msaa: 4 }, low: { cap: 1024, mirror: 0.33, taps: 18, shadow: 0, rain: 0.4, msaa: 2 } };
  const ORDER = ["high", "medium", "low"];
  let qName = "high", Q = QUALS.high, W = 0, H = 0, ema = 0, slowFor = 0, perfT = 0;
  const onQuality = [];

  /* ---------- the lens ---------- */
  const U = { tRefl: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uT: { value: 0 }, uMirror: { value: 0 } };
  const RT = (w, h, o) => new THREE.WebGLRenderTarget(Math.max(2, w | 0), Math.max(2, h | 0), Object.assign({ type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }, o));
  let rtMain = null, rtRefl = null, rtDof = null, rtS1 = null, rtS2 = null, rtWarm = null; const NB = 6, down = [], up = [];
  const fsScene = new THREE.Scene(), fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), fsTri = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)), null); fsTri.frustumCulled = false; fsScene.add(fsTri);
  const VS = "varying vec2 uv_; void main(){ uv_ = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }";
  const pass = (fs, uniforms, defines) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: "precision highp float; varying vec2 uv_;\n" + fs, uniforms, defines: defines || {}, depthTest: false, depthWrite: false, toneMapped: false });
  const run = (mat, target) => { fsTri.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };
  const mDof = pass(`uniform sampler2D tC, tD; uniform vec2 px; uniform float near, far, focus, K, maxR, seed;
    float lin(float d){ float z = d * 2. - 1.; return 2. * near * far / (far + near - z * (far - near)); } float coc(float d){ return clamp(K * abs(1. / focus - 1. / d), 0., maxR); }
    void main(){ float d0 = lin(texture2D(tD, uv_).x), c0 = coc(d0); float rot = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)) + seed)) * 6.2832;
      vec3 acc = texture2D(tC, uv_).rgb; float wsum = 1.;
      for (int i = 1; i < TAPS; i++) { float fi = float(i), r = sqrt(fi / float(TAPS)) * maxR, a = fi * 2.39996 + rot; vec2 o = vec2(cos(a), sin(a)) * r * px; vec2 q = uv_ + o;
        float ds = lin(texture2D(tD, q).x), cs = coc(ds); float reach = ds < d0 ? cs : min(cs, c0); float w = smoothstep(r - 1.2, r + .6, reach); vec3 c = texture2D(tC, q).rgb; w *= 1. + dot(c, vec3(.3, .5, .2)) * .6; acc += c * w; wsum += w; }
      gl_FragColor = vec4(acc / wsum, 1.); }`, { tC: { value: null }, tD: { value: null }, px: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 400 }, focus: { value: 5 }, K: { value: 17 }, maxR: { value: 17 }, seed: { value: 0 } }, { TAPS: 56 });
  const mPre = pass("uniform sampler2D t; uniform vec2 px; void main(){ vec3 c = (texture2D(t, uv_ + px * vec2(-.5)).rgb + texture2D(t, uv_ + px * vec2(.5, -.5)).rgb + texture2D(t, uv_ + px * vec2(-.5, .5)).rgb + texture2D(t, uv_ + px * vec2(.5)).rgb) * .25; float l = max(c.r, max(c.g, c.b)); c *= smoothstep(.55, 1.6, l); gl_FragColor = vec4(min(c, vec3(24.)), 1.); }", { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mDown = pass("uniform sampler2D t; uniform vec2 px; void main(){ vec3 c = texture2D(t, uv_).rgb * 4.; c += texture2D(t, uv_ + px * vec2(-1.)).rgb + texture2D(t, uv_ + px * vec2(1., -1.)).rgb + texture2D(t, uv_ + px * vec2(-1., 1.)).rgb + texture2D(t, uv_ + px * vec2(1.)).rgb; gl_FragColor = vec4(c / 8., 1.); }", { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mUp = pass("uniform sampler2D t, tB; uniform vec2 px; void main(){ vec3 c = texture2D(t, uv_ + px * vec2(-2., 0.)).rgb + texture2D(t, uv_ + px * vec2(2., 0.)).rgb + texture2D(t, uv_ + px * vec2(0., -2.)).rgb + texture2D(t, uv_ + px * vec2(0., 2.)).rgb; c += (texture2D(t, uv_ + px * vec2(-1., 1.)).rgb + texture2D(t, uv_ + px * vec2(1., 1.)).rgb + texture2D(t, uv_ + px * vec2(-1., -1.)).rgb + texture2D(t, uv_ + px * vec2(1., -1.)).rgb) * 2.; gl_FragColor = vec4(c / 12. + texture2D(tB, uv_).rgb, 1.); }", { t: { value: null }, tB: { value: null }, px: { value: new THREE.Vector2() } });
  const mStreak = pass("uniform sampler2D t; uniform vec2 px; void main(){ vec3 c = vec3(0.); float ws = 0.; for (int i = -12; i <= 12; i++) { float w = exp(-float(i * i) / 60.); c += texture2D(t, uv_ + px * float(i)).rgb * w; ws += w; } gl_FragColor = vec4(c / ws, 1.); }", { t: { value: null }, px: { value: new THREE.Vector2() } });
  const mFinal = pass(`uniform sampler2D tC, tB, tS; uniform float uT, expo, glow, streak, vig, grain, punch; uniform vec3 tint;
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
    float h(vec2 q){ return fract(sin(dot(q, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec2 c = uv_ - .5; float r2 = dot(c, c); vec2 ca = c * r2 * .012;
      vec3 col = vec3(texture2D(tC, uv_ - ca).r, texture2D(tC, uv_).g, texture2D(tC, uv_ + ca).b);
      col += texture2D(tB, uv_).rgb * glow + texture2D(tS, uv_).rgb * vec3(.35, .6, 1.) * streak;
      col *= expo * tint; col = aces(col);
      float l = dot(col, vec3(.2126, .7152, .0722)); col = mix(vec3(l), col, 1.06); col += vec3(-.006, .004, .012) * (1. - l) * (1. - l); col *= mix(vec3(1.), vec3(1.03, 1., .95), smoothstep(.2, .8, l));      // cool shadows, warm highlights
      col = pow(col, vec3(1. / 2.2)); col = mix(col, col * col * (3. - 2. * col), punch);                                                                                          // deeper blacks
      col *= 1. - smoothstep(.16, .78, r2 * 1.7) * vig;
      float g = (h(gl_FragCoord.xy + fract(uT * 7.13) * 91.) + h(gl_FragCoord.xy * 1.3 + fract(uT * 3.71) * 57.) - 1.); col += g * grain * (1. - l * .6);
      gl_FragColor = vec4(col, 1.); }`, { tC: { value: null }, tB: { value: null }, tS: { value: null }, uT: U.uT, expo: { value: 1.05 }, glow: { value: 0.085 }, streak: { value: 0.1 }, vig: { value: 0.62 }, grain: { value: 0.032 }, punch: { value: 0.28 }, tint: { value: new THREE.Vector3(1, 1, 1) } });

  function alloc(cw, ch) {
    const k = Math.min(1, Q.cap / Math.max(cw, 1)), w = Math.max(64, Math.round(cw * k)), h = Math.max(36, Math.round(ch * k));
    if (rtMain && w === W && h === H) return;
    for (const r of [rtMain, rtRefl, rtDof, rtS1, rtS2, ...down, ...up]) if (r) { if (r.depthTexture) r.depthTexture.dispose(); r.dispose(); }
    W = w; H = h; down.length = up.length = 0;
    rtMain = RT(W, H, { depthBuffer: true, samples: Q.msaa, depthTexture: new THREE.DepthTexture(W, H) }); rtRefl = RT(W * Q.mirror, H * Q.mirror, { depthBuffer: true }); rtDof = RT(W, H);
    for (let i = 0; i < NB; i++) { down.push(RT(W >> (i + 1), H >> (i + 1))); up.push(RT(W >> (i + 1), H >> (i + 1))); }
    rtS1 = RT(W >> 2, H >> 2); rtS2 = RT(W >> 2, H >> 2); if (!rtWarm) rtWarm = RT(8, 8);
    U.tRefl.value = rtRefl.texture; U.uRes.value.set(W, H);
    mDof.uniforms.tC.value = rtMain.texture; mDof.uniforms.tD.value = rtMain.depthTexture; mDof.uniforms.px.value.set(1 / W, 1 / H); mDof.uniforms.K.value = mDof.uniforms.maxR.value = 17 * H / 720;
    mFinal.uniforms.tC.value = rtDof.texture; mFinal.uniforms.tS.value = rtS2.texture;
  }
  function setQuality(name) {
    if (!QUALS[name]) name = "high"; if (name === qName && rtMain) return;
    qName = name; Q = QUALS[name]; if (mDof.defines.TAPS !== Q.taps) { mDof.defines.TAPS = Q.taps; mDof.needsUpdate = true; }
    W = H = 0; ema = 0; slowFor = 0; perfT = 0; for (const f of onQuality) f(Q, name);
  }
  // called once a frame with the real frame time: if the film cannot keep up, it steps the quality down (never up) and says so
  function perf(dtMs) {
    perfT += dtMs; if (perfT < 900) return false; ema = ema ? ema * 0.9 + dtMs * 0.1 : dtMs;
    slowFor = ema > 30 ? slowFor + dtMs : 0; const i = ORDER.indexOf(qName);
    if (slowFor > 1100 && i < ORDER.length - 1) { setQuality(ORDER[i + 1]); return true; }
    return false;
  }

  const _size = new THREE.Vector2(), flipped = [];
  /* o: { t, flip: [groups to mirror], hide: [things not drawn in the mirror picture], mirror: bool, focus (m), blur (0..1.5), expo, tint: [r,g,b], warm: bool } */
  function render(scene, camera, o) {
    renderer.getDrawingBufferSize(_size); alloc(_size.x, _size.y);
    U.uT.value = o.t || 0; const wasShadow = renderer.shadowMap.enabled, wasTarget = renderer.getRenderTarget();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (o.mirror) {
      U.uMirror.value = 0; renderer.shadowMap.enabled = false; flipped.length = 0;
      for (const h of o.hide || []) if (h && h.visible) { h.visible = false; flipped.push(h); }
      for (const g of o.flip) { g.scale.y = -1; g.updateMatrixWorld(true); }
      renderer.setRenderTarget(rtRefl); renderer.clear(); renderer.render(scene, camera);
      for (const g of o.flip) { g.scale.y = 1; g.updateMatrixWorld(true); } for (const h of flipped) h.visible = true;
      U.uMirror.value = 1;
    } else U.uMirror.value = 0;
    renderer.shadowMap.enabled = Q.shadow > 0;
    renderer.setRenderTarget(rtMain); renderer.clear(); renderer.render(scene, camera);
    renderer.shadowMap.enabled = wasShadow; U.uMirror.value = 0;
    const d = mDof.uniforms; d.near.value = camera.near; d.far.value = camera.far; d.focus.value = Math.max(0.15, o.focus || 5); d.K.value = 17 * H / 720 * (o.blur == null ? 1 : o.blur); d.seed.value = ((o.t || 0) * 24 % 64) / 64;
    run(mDof, rtDof);
    mPre.uniforms.t.value = rtDof.texture; mPre.uniforms.px.value.set(1 / W, 1 / H); run(mPre, down[0]);
    for (let i = 1; i < NB; i++) { mDown.uniforms.t.value = down[i - 1].texture; mDown.uniforms.px.value.set(1 / down[i - 1].width, 1 / down[i - 1].height); run(mDown, down[i]); }
    let acc = down[NB - 1]; for (let i = NB - 2; i >= 0; i--) { mUp.uniforms.t.value = acc.texture; mUp.uniforms.tB.value = down[i].texture; mUp.uniforms.px.value.set(.5 / acc.width, .5 / acc.height); run(mUp, up[i]); acc = up[i]; }
    mStreak.uniforms.t.value = down[1].texture; mStreak.uniforms.px.value.set(2.2 / rtS1.width, 0); run(mStreak, rtS1); mStreak.uniforms.t.value = rtS1.texture; mStreak.uniforms.px.value.set(5 / rtS1.width, 0); run(mStreak, rtS2);
    const f = mFinal.uniforms; f.tB.value = acc.texture; f.expo.value = o.expo == null ? 1.05 : o.expo; const tn = o.tint || [1, 1, 1]; f.tint.value.set(tn[0], tn[1], tn[2]);
    run(mFinal, o.warm ? rtWarm : null);
    renderer.setRenderTarget(wasTarget);
  }

  /* ---------- wet floors: a material that mirrors the upside-down picture ----------
     o: { puddles: true (noise puddles and rain rings, for the car park) | false, gloss: 0..1 (how mirror-like where there are no puddles),
          amount: strength, stretch: how far the smear runs toward the lens, dark: how much the wet darkens the surface } */
  function mirrorize(mat, o) {
    o = Object.assign({ puddles: false, gloss: 0.5, amount: 1, stretch: 0.34, dark: 1 }, o);
    const mu = { uPud: { value: o.puddles ? 1 : 0 }, uGloss: { value: o.gloss }, uAmt: { value: o.amount }, uStretch: { value: o.stretch }, uDark: { value: o.dark } };
    mat.userData.mirror = mu;
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, U, mu);
      s.vertexShader = s.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWp;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.)).xyz;");
      s.fragmentShader = s.fragmentShader.replace("#include <common>", `#include <common>
        varying vec3 vWp; uniform sampler2D tRefl; uniform vec2 uRes; uniform float uT, uMirror, uPud, uGloss, uAmt, uStretch, uDark; float pud; vec3 nWorld;
        float gh(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(gh(i), gh(i+vec2(1,0)), f.x), mix(gh(i+vec2(0,1)), gh(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 q){ return gn(q) * .55 + gn(q * 2.3 + 7.) * .3 + gn(q * 5.1 + 3.) * .15; }
        vec2 ripples(vec2 p){ vec2 acc = vec2(0.);                       // raindrops landing: rings that spread and fade
          for (int k = 0; k < 2; k++) { vec2 q = p * (k == 0 ? 2.6 : 1.7) + float(k) * 13.7, c = floor(q); for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 cc = c + vec2(float(i), float(j));
            float ph = fract(uT * (.75 + gh(cc + 3.) * .5) + gh(cc)), born = floor(uT * (.75 + gh(cc + 3.) * .5) + gh(cc)); vec2 o = vec2(gh(cc + born * 1.7 + 1.), gh(cc + born * 2.3 + 2.)) * .8 + .1, d = q - cc - o; float r = length(d), w = ph * .9;
            acc += normalize(d + 1e-5) * sin((r - w) * 46.) * smoothstep(.07, 0., abs(r - w)) * (1. - ph) * (1. - ph); } }
          return acc; }`)
        .replace("#include <map_fragment>", `#include <map_fragment>
          if (uPud > .5) { pud = smoothstep(.54, .68, fbm(vWp.xz * .34 + vec2(4.2, 1.3)) + .08 * gn(vWp.xz * 3.)); pud = max(pud, smoothstep(.62, .7, gn(vWp.xz * 1.9 + 20.)) * .8); diffuseColor.rgb *= mix(1., mix(.62, .4, pud), uDark); } else pud = uGloss;`)
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nif (uPud > .5) roughnessFactor = mix(roughnessFactor, .04, pud);")
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
          if (uPud > .5) { vec2 rp = ripples(vWp.xz) * (.25 + .75 * pud); vec3 flat_ = normalize((viewMatrix * vec4(rp.x * .22, 1., rp.y * .22, 0.)).xyz); normal = normalize(mix(normal, flat_, pud * .92)); }
          nWorld = normalize((vec4(normal, 0.) * viewMatrix).xyz);`)
        .replace("#include <opaque_fragment>", `if (uMirror > .5) { vec2 suv = gl_FragCoord.xy / uRes; float fr = pow(1. - clamp(dot(normalize(vViewPosition), normal), 0., 1.), 5.); fr = mix(.035, 1., fr);
            float rough = 1. - pud; vec2 off = nWorld.xz * vec2(.045, .11); vec3 rf = vec3(0.); float jit = gh(gl_FragCoord.xy + uT);
            float ws = 0.; for (int i = 0; i < 12; i++) { float k = (float(i) + jit) / 12.; float w = 1. - k * .8; rf += texture2D(tRefl, suv + off + vec2((gh(suv * 91. + float(i)) - .5) * .02, -k * uStretch) * rough).rgb * w; ws += w; } rf /= ws;
            outgoingLight = outgoingLight * (1. - pud * fr * .9) + rf * fr * mix(.5, 1., pud) * uAmt; }
          #include <opaque_fragment>`);
    };
    mat.needsUpdate = true; return mat;
  }

  /* ---------- MaybeMail: the made-up local courier whose van this is (v8.50). An original mark: the name in two colours, a line under it,
     and a cartoon beaver in a mail bag, shrugging. what: "side" (all three), "word" (the name only), "beaver" (the beaver only). ---------- */
  function paintBeaver(g, cx, by, k) {       // cx: centre, by: where the feet stand, k: scale (1 = about 290 px tall)
    const OUT = "#2a1a10", FUR = "#9a6235", DARK = "#6f4322", BELLY = "#e2c197", TAIL = "#4b3222";
    g.save(); g.translate(cx, by); g.scale(k, k); g.lineJoin = g.lineCap = "round"; g.strokeStyle = OUT; g.lineWidth = 6;
    const ell = (x, y, rx, ry, rot, fill, stroke = true) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); g.fillStyle = fill; g.fill(); if (stroke) g.stroke(); };
    // the tail: a flat paddle lying out to one side
    g.save(); g.translate(92, -34); g.rotate(-0.42); ell(0, 0, 66, 30, 0, TAIL); g.save(); g.beginPath(); g.ellipse(0, 0, 62, 26, 0, 0, 6.2832); g.clip(); g.lineWidth = 2.5; g.strokeStyle = "rgba(20,12,6,.7)"; for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(i * 16 - 40, -40); g.lineTo(i * 16 + 40, 40); g.stroke(); g.beginPath(); g.moveTo(i * 16 + 40, -40); g.lineTo(i * 16 - 40, 40); g.stroke(); } g.restore(); g.restore();
    // feet
    ell(-34, -8, 30, 13, -0.12, DARK); ell(34, -8, 30, 13, 0.12, DARK);
    // body and belly
    ell(0, -92, 70, 84, 0, FUR); ell(0, -80, 44, 58, 0, BELLY, false);
    // the mail bag: a strap across the chest, the bag on the hip, an envelope poking out
    g.lineWidth = 13; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-50, -150); g.quadraticCurveTo(10, -100, 52, -58); g.stroke(); g.lineWidth = 7; g.strokeStyle = "#1f7a78"; g.beginPath(); g.moveTo(-50, -150); g.quadraticCurveTo(10, -100, 52, -58); g.stroke();
    g.lineWidth = 6; g.strokeStyle = OUT; g.fillStyle = "#f4efe2"; g.save(); g.translate(58, -82); g.rotate(0.3); g.beginPath(); g.rect(-20, -16, 40, 28); g.fill(); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(-20, -16); g.lineTo(0, 0); g.lineTo(20, -16); g.stroke(); g.restore();
    g.lineWidth = 6; g.fillStyle = "#1f7a78"; g.beginPath(); g.roundRect(30, -70, 58, 44, 9); g.fill(); g.stroke();
    // arms: shoulders up, elbows out, palms to the sky
    for (const sd of [-1, 1]) { const arm = () => { g.beginPath(); g.moveTo(sd * 48, -142); g.quadraticCurveTo(sd * 92, -92, sd * 136, -128); g.stroke(); }; g.lineWidth = 34; g.strokeStyle = OUT; arm(); g.lineWidth = 23; g.strokeStyle = FUR; arm();
      g.lineWidth = 6; g.strokeStyle = OUT; g.save(); g.translate(sd * 150, -140); g.rotate(sd * 0.22); ell(0, 0, 26, 11, 0, DARK); for (const fx of [-15, -3, 9]) ell(sd * fx + sd * 6, -10, 6, 8, sd * 0.3, DARK); ell(-sd * 20, -7, 6, 8, -sd * 0.7, DARK); g.fillStyle = DARK; g.fillRect(-18, -5, 36, 8); g.restore(); }
    // the head, tipped to one side
    g.save(); g.translate(0, -192); g.rotate(-0.15);
    ell(-52, -52, 17, 17, 0, DARK); ell(52, -52, 17, 17, 0, DARK); ell(-52, -52, 8, 8, 0, "#c98f6a", false); ell(52, -52, 8, 8, 0, "#c98f6a", false);
    ell(0, 0, 76, 68, 0, FUR);
    ell(0, 24, 46, 34, 0, BELLY, false);
    // eyes looking up and away, brows as high as they go
    for (const sd of [-1, 1]) { ell(sd * 27, -16, 15, 19, 0, "#fff"); ell(sd * 27 + 5, -24, 6.5, 8, 0, OUT, false); g.lineWidth = 6; g.beginPath(); g.arc(sd * 27, -30, 22, Math.PI * (sd < 0 ? 1.18 : 1.32), Math.PI * (sd < 0 ? 1.68 : 1.82)); g.stroke(); }
    // nose, a mouth that has given up on one side, and the teeth
    g.fillStyle = OUT; g.beginPath(); g.moveTo(-15, 6); g.quadraticCurveTo(0, -3, 15, 6); g.quadraticCurveTo(0, 26, -15, 6); g.fill();
    g.lineWidth = 5; g.beginPath(); g.moveTo(-26, 34); g.quadraticCurveTo(-6, 42, 8, 34); g.quadraticCurveTo(20, 28, 30, 36); g.stroke();
    g.fillStyle = "#fff"; g.lineWidth = 4; g.beginPath(); g.roundRect(-11, 35, 22, 22, 4); g.fill(); g.stroke(); g.beginPath(); g.moveTo(0, 36); g.lineTo(0, 56); g.stroke();
    g.restore(); g.restore();
  }
  function paintMaybeMail(g, w, h, what) {
    g.clearRect(0, 0, w, h);
    const word = (cx, base, px) => { g.font = "italic 900 " + px + "px Helvetica, Arial, sans-serif"; g.textBaseline = "alphabetic"; g.textAlign = "left"; const a = g.measureText("Maybe").width, b = g.measureText("Mail").width, x = cx - (a + b) / 2;
      g.fillStyle = "#1c3557"; g.fillText("Maybe", x, base); g.fillStyle = "#d9601a"; g.fillText("Mail", x + a, base); return [x, a + b]; };
    if (what === "word") { word(w / 2, h * 0.76, h * 0.74); return; }
    if (what === "beaver") { paintBeaver(g, w / 2 - 8, h - 6, h / 300); return; }
    const m = word(w / 2, 148, 156);
    g.font = "800 27px Helvetica, Arial, sans-serif"; g.fillStyle = "#4b5560"; g.textAlign = "center"; try { g.letterSpacing = "7px"; } catch (e) {} g.fillText("SAME DAY. MAYBE.", w / 2, 192); try { g.letterSpacing = "0px"; } catch (e) {}
    paintBeaver(g, w / 2 - 10, h - 4, 0.98);
  }

  /* ---------- the outdoor set: a wet car park at night and the front of the building ----------
     Everything stands where the old film's set stood: the door at x 0 in the wall at z 0, the lamp post with the flyer at -2.2 / 11.
     o: { sign: { text, dead: [letter indexes that never light], buzz: [letter indexes that dip dim and come back] } } */
  function buildExterior(o) {
    const world = new THREE.Group(), still = new THREE.Group(), nightOnly = [];     // `world` is mirrored for the wet ground; `still` (the ground itself) is not
    const BOX = new THREE.BoxGeometry(1, 1, 1), QUAD = new THREE.PlaneGeometry(1, 1);
    const std = p => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0 }, p));
    const lit = (r, g, b, p) => new THREE.MeshBasicMaterial(Object.assign({ color: new THREE.Color(r, g, b), fog: false }, p));
    const sh = m => { m.castShadow = true; m.receiveShadow = true; return m; };
    const box = (par, mat, w, h, d, x, y, z) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); par.add(m); return sh(m); };
    const quad = (par, mat, w, h, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(QUAD, mat); m.scale.set(w, h, 1); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0, "YXZ"); par.add(m); m.receiveShadow = true; return m; };
    const cyl = (par, mat, r0, r1, h, x, y, z, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat); m.position.set(x, y, z); par.add(m); return sh(m); };
    const GLOW = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 1, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.12, "rgba(255,255,255,.55)"); gr.addColorStop(.4, "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false);
    const glow = (par, r, g, b, size, x, y, z) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: new THREE.Color(r, g, b), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.scale.set(size, size, 1); s.position.set(x, y, z); par.add(s); nightOnly.push(s); return s; };
    const shadowLights = [], dayOnly = new THREE.Group(); dayOnly.visible = false; world.add(dayOnly); let isDay = false;

    // the sky the wet things reflect
    let env, envDay; { const eq = canvasTex(512, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#04060a"); gr.addColorStop(.45, "#080b12"); gr.addColorStop(.5, "#15100c"); gr.addColorStop(.56, "#030405"); gr.addColorStop(1, "#020203"); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
        for (const [x, y, r, c] of [[256, 96, 26, "rgba(255,160,70,.9)"], [120, 110, 16, "rgba(255,150,60,.6)"], [400, 118, 14, "rgba(190,215,255,.7)"]]) { const rg = g.createRadialGradient(x, y, 1, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); } });
      eq.mapping = THREE.EquirectangularReflectionMapping; const pm = new THREE.PMREMGenerator(renderer); env = pm.fromEquirectangular(eq).texture; pm.dispose(); eq.dispose(); }
    const skyU = { uDay: { value: 0 }, uT: U.uT };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
      vertexShader: "varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }",
      fragmentShader: `varying vec3 p; uniform float uDay, uT; float h(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fb(vec2 q){ return n(q) * .5 + n(q * 2.1 + 3.) * .26 + n(q * 4.3 + 9.) * .14 + n(q * 8.7 + 1.) * .1; }
        void main(){ vec3 d = normalize(p); float y = abs(d.y); float c = n(d.xz / (y + .25) * 2.2) * .6 + n(d.xz / (y + .25) * 5.) * .4;
          vec3 col = mix(vec3(.046, .026, .014), vec3(.004, .006, .012), smoothstep(0., .45, y)); col += vec3(.028, .016, .008) * c * (1. - smoothstep(0., .6, y));
          if (uDay > .5) { vec2 q = d.xz / (y + .12) * 1.3 + vec2(uT * .006, uT * .002); float cl = smoothstep(.5, .78, fb(q)) * smoothstep(.02, .22, y), sh = smoothstep(.45, .9, fb(q + vec2(.12, .05)));
            vec3 blue = mix(vec3(.78, .86, .93), vec3(.2, .42, .78), pow(smoothstep(0., .9, y), .6)); col = mix(blue, mix(vec3(1.25, 1.22, 1.16), vec3(.72, .76, .84), sh * .55), cl * .9) * .78; }
          gl_FragColor = vec4(col, 1.); }` }));
    world.add(sky);

    // the ground: asphalt with puddles; the pavement by the wall, wet too
    const nA = noise2(11), nB = noise2(12), nC = noise2(31), nD = noise2(32);
    const asphN = normalTex(512, (x, y) => nA(x / 3.1, y / 3.1) * .6 + nB(x / 1.3, y / 1.3) * .5 + nA(x / 22, y / 22) * 1.2, 2.2);
    const asph = canvasTex(512, 512, (g) => { g.fillStyle = "#1a1c1f"; g.fillRect(0, 0, 512, 512); speckle(g, 14000, 512, 512, 18, 64, .55); speckle(g, 900, 512, 512, 90, 140, .4); });
    asph.repeat.set(30, 22.5); asphN.repeat.set(30, 22.5);
    const groundM = mirrorize(std({ map: asph, normalMap: asphN, normalScale: new THREE.Vector2(.9, .9), roughness: 0.55, envMapIntensity: 0.4 }), { puddles: true });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 67.4), groundM); ground.rotation.x = -PI / 2; ground.position.set(0, 0, 36.3); ground.receiveShadow = true; still.add(ground);
    const paveT = canvasTex(512, 512, (g) => { g.fillStyle = "#4b4f52"; g.fillRect(0, 0, 512, 512); speckle(g, 7000, 512, 512, 40, 110, .3); g.strokeStyle = "rgba(12,14,15,.85)"; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); } for (let j = 0; j <= 2; j++) { g.beginPath(); g.moveTo(0, j * 256); g.lineTo(512, j * 256); g.stroke(); } });
    const paveN = normalTex(512, (x, y) => nC(x / 2.2, y / 2.2) * .5 + ((x % 128 < 4 || y % 256 < 4) ? -1.6 : 0), 1.4);
    paveT.repeat.set(18, 1.3); paveN.repeat.set(18, 1.3);
    const paveM = mirrorize(std({ map: paveT, normalMap: paveN, roughness: 0.3, envMapIntensity: .7 }), { gloss: 0.72, amount: 0.9, stretch: 0.2 });
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(90, 2.6), paveM); pave.rotation.x = -PI / 2; pave.position.set(0, 0, 1.3); pave.receiveShadow = true; still.add(pave);     // flush with the tarmac and the lobby floor: no step at the door
    box(world, std({ color: 0x5b5f61, roughness: 0.45 }), 46, 0.03, 0.14, 0, 0.015, 2.67);
    const lineT = canvasTex(64, 512, (g) => { g.clearRect(0, 0, 64, 512); g.fillStyle = "#b9bcbc"; g.fillRect(4, 0, 56, 512); g.globalCompositeOperation = "destination-out"; for (let i = 0; i < 900; i++) { g.globalAlpha = .5 * R(); g.fillRect(R() * 64, R() * 512, 2 + R() * 9, 2 + R() * 14); } });
    const paint = std({ map: lineT, transparent: true, opacity: .5, roughness: .5, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    for (let i = -5; i <= 5; i++) { if (i === 0) continue; const x = i * 2.7 + (i > 0 ? 1.3 : -1.3); quad(world, paint, 0.12, 5, x, 0.003, 9.5, -PI / 2); quad(world, paint, 0.12, 5, x, 0.003, 24.5, -PI / 2); }

    // the building: concrete panels with real joints, a row of dark windows
    const concN = normalTex(256, (x, y) => nC(x / 2, y / 2) * .5 + nD(x / 9, y / 9) * .8 + (nC(x / 1.1, y / 40) > .95 ? -.5 : 0), 0.55); concN.repeat.set(2, 2);
    const concT = () => canvasTex(256, 256, (g) => { const v = 78 + (R() * 14 | 0); g.fillStyle = `rgb(${v},${v + 3},${v + 5})`; g.fillRect(0, 0, 256, 256); speckle(g, 2600, 256, 256, 50, 120, .2);
      for (let i = 0; i < 12; i++) { const x = R() * 256, gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(14,16,18,.42)"); gr.addColorStop(.35 + R() * .65, "rgba(14,16,18,0)"); g.fillStyle = gr; g.fillRect(x, 0, 3 + R() * 16, 256); }
      const gb = g.createLinearGradient(0, 180, 0, 256); gb.addColorStop(0, "rgba(10,12,12,0)"); gb.addColorStop(1, "rgba(10,12,12,.3)"); g.fillStyle = gb; g.fillRect(0, 180, 256, 76);
      for (const [x, y] of [[20, 20], [236, 20], [20, 236], [236, 236]]) { g.fillStyle = "rgba(10,10,12,.75)"; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); } });
    const concMs = [0, 1, 2, 3].map(() => std({ map: concT(), normalMap: concN, roughness: 0.62, envMapIntensity: 0.5 }));
    const frameM = std({ color: 0x15181b, roughness: 0.4, metalness: 0.7 }), glassM = new THREE.MeshPhysicalMaterial({ color: 0x030507, roughness: 0.05, metalness: 0, envMapIntensity: 1.6, clearcoat: 1 });
    const PW = 3.3, PH = 2.5, GAP = 0.045;
    for (let r = 0; r < 4; r++) for (let c = -7; c <= 6; c++) {
      const x = (c + .5) * PW, y = r * PH + PH / 2, win = r === 2 && c !== -1 && c !== 0, door = r === 0 && (c === -1 || c === 0);
      if (door) { if (c === -1) { box(world, concMs[1], PW - 1.0 - GAP, PH, 0.4, -PW + (PW - 1.0) / 2, y, -0.2); box(world, concMs[2], PW - 1.0 - GAP, PH, 0.4, PW - (PW - 1.0) / 2, y, -0.2); box(world, concMs[0], 2.0, PH - 2.36, 0.4, 0, 2.36 + (PH - 2.36) / 2, -0.2); } continue; }
      if (win) { box(world, concMs[(c + 9) % 4], PW - GAP, 0.5, 0.4, x, r * PH + 0.25, -0.2); box(world, concMs[(c + 10) % 4], PW - GAP, 0.3, 0.4, x, r * PH + PH - 0.15, -0.2); box(world, concMs[(c + 8) % 4], 0.35, 1.7, 0.4, x - PW / 2 + 0.19, r * PH + 1.35, -0.2); box(world, concMs[(c + 11) % 4], 0.35, 1.7, 0.4, x + PW / 2 - 0.19, r * PH + 1.35, -0.2);
        box(world, frameM, 2.62, 1.72, 0.08, x, r * PH + 1.35, -0.2); box(world, glassM, 2.5, 1.6, 0.04, x, r * PH + 1.35, -0.15); box(world, frameM, 0.05, 1.6, 0.06, x, r * PH + 1.35, -0.13); box(world, concMs[0], 2.8, 0.06, 0.16, x, r * PH + 0.5, 0.04); continue; }
      box(world, concMs[(c * 3 + r * 5 + 40) % 4], PW - GAP, PH - GAP, 0.4, x, y, -0.2);
    }
    { const bk = new THREE.MeshBasicMaterial({ color: 0x010101 }); box(world, bk, 22.9, 10, 0.2, -12.55, 5, -0.115); box(world, bk, 22.9, 10, 0.2, 12.55, 5, -0.115); box(world, bk, 2.2, 7.6, 0.2, 0, 6.2, -0.115); }      // unlit black behind the panel joints
    box(world, std({ color: 0x2c3033, roughness: .5, metalness: .5 }), 46.4, 0.18, 0.5, 0, 10.05, -0.2);
    { const pipe = std({ color: 0x23272a, roughness: 0.35, metalness: 0.8 }); cyl(world, pipe, 0.055, 0.055, 10, 4.98, 5, 0.09, 12); for (const y of [1.2, 3.7, 6.2, 8.7]) box(world, pipe, 0.16, 0.05, 0.14, 4.98, y, 0.06); }
    // the canopy and its tube light
    const canM = std({ color: 0x1c2023, roughness: 0.45, metalness: 0.6 });
    box(world, canM, 3.8, 0.16, 1.8, 0, 2.98, 0.9); box(world, canM, 3.8, 0.3, 0.06, 0, 2.93, 1.8);
    for (const x of [-1.6, 1.6]) { const t = cyl(world, canM, 0.02, 0.02, 1.5, x, 3.55, 0.75, 8); t.rotation.x = -0.86; }
    box(world, std({ color: 0xc8ccc8, roughness: 0.5 }), 1.5, 0.05, 0.16, 0, 2.875, 0.9);
    const tubeM = lit(1, 1, 1); { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 1.3, 10), tubeM); t.rotation.z = PI / 2; t.position.set(0, 2.84, 0.9); world.add(t); }
    const tubeGlow = glow(world, .55, .68, 1, 1.5, 0, 2.84, 0.92);
    const tubeL = new THREE.SpotLight(0xcfe4ff, 70, 14, 1.25, 1, 1.8); tubeL.position.set(0, 2.8, 0.95); tubeL.target.position.set(0, 0, 1.6); world.add(tubeL, tubeL.target);
    tubeL.castShadow = true; tubeL.shadow.camera.near = 0.2; tubeL.shadow.camera.far = 14; tubeL.shadow.bias = -0.0006; shadowLights.push([tubeL, 0.5]);
    // the sign over the door: the game's lettering; some letters dead, a couple that buzz
    const SG = Object.assign({ text: "TEST LABORATORY", dead: [8, 12, 13, 14], buzz: [1, 10] }, o && o.sign), dead = new Set(SG.dead), dim = new Map(SG.buzz.map(i => [i, 1]));
    const signC = document.createElement("canvas"); signC.width = 1024; signC.height = 128; const signT = new THREE.CanvasTexture(signC); signT.colorSpace = THREE.SRGBColorSpace; signT.anisotropy = 8;
    function drawSign() { const g = signC.getContext("2d"); g.fillStyle = "#050607"; g.fillRect(0, 0, 1024, 128); g.font = "800 78px Helvetica, Arial, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
      const ch = [...SG.text]; let ws = ch.map(c => g.measureText(c).width + 9), tot = ws.reduce((a, b) => a + b, 0);
      if (tot > 960) { const f = 960 / tot; g.font = "800 " + (78 * f).toFixed(1) + "px Helvetica, Arial, sans-serif"; ws = ch.map(c => g.measureText(c).width + 9 * f); tot = ws.reduce((a, b) => a + b, 0); } let x = 512 - tot / 2;
      ch.forEach((c, i) => { const k = dim.has(i) ? dim.get(i) : 1; g.fillStyle = dead.has(i) ? "#1d1a17" : k >= 1 ? "#ffe9c4" : `rgb(${255 * k | 0},${233 * k | 0},${196 * k * .9 | 0})`; g.fillText(c, x, 68); x += ws[i]; }); signT.needsUpdate = true; }
    drawSign();
    const signM = lit(2.6, 2.6, 2.6, { map: signT }); box(world, std({ color: 0x0c0d0f, roughness: 0.3, metalness: 0.6 }), 4.2, 0.62, 0.14, 0, 3.6, 0.1); quad(world, signM, 4.0, 0.5, 0, 3.6, 0.175).receiveShadow = false;
    const signGlow = glow(world, 1.0, .78, .5, 3.4, 0, 3.6, 0.3); signGlow.scale.set(6.5, 1.8, 1); signGlow.material.opacity = 0.1;
    const signL = new THREE.PointLight(0xffdcae, 5, 8, 2); signL.position.set(0, 3.6, 0.9); world.add(signL);
    // the doors: two glazed leaves on their hinges (leaf[1], the right one, is the one that gets pushed)
    const steel = std({ color: 0x6a7178, roughness: 0.32, metalness: 0.85, envMapIntensity: 1.1 }), bar = std({ color: 0xb8bcc0, roughness: 0.2, metalness: 1 });
    box(world, frameM, 0.08, 2.36, 0.3, -0.96, 1.18, -0.2); box(world, frameM, 0.08, 2.36, 0.3, 0.96, 1.18, -0.2); box(world, frameM, 2.0, 0.1, 0.3, 0, 2.31, -0.2);
    const doorGlass = new THREE.MeshPhysicalMaterial({ color: 0x0a1210, roughness: 0.06, transparent: true, opacity: 0.2, envMapIntensity: 1.4, depthWrite: false });
    const leaf = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.915, 0, -0.2); world.add(g); const x = -s * 0.455;     // the leaf's own centre, measured from its hinge
      box(g, steel, 0.9, 0.52, 0.05, x, 0.29, 0); box(g, steel, 0.9, 0.2, 0.05, x, 2.16, 0); box(g, steel, 0.14, 1.52, 0.05, x - 0.38, 1.3, 0); box(g, steel, 0.14, 1.52, 0.05, x + 0.38, 1.3, 0);
      const gl = new THREE.Mesh(BOX, doorGlass); gl.scale.set(0.64, 1.52, 0.02); gl.position.set(x, 1.3, 0); g.add(gl);
      const bx = -s * 0.8; for (const z of [0.07, -0.07]) { cyl(g, bar, 0.016, 0.016, 0.5, bx, 1.1, z, 10); box(g, steel, 0.03, 0.03, 0.06, bx, 1.3, z * 0.6); box(g, steel, 0.03, 0.03, 0.06, bx, 0.9, z * 0.6); }
      g.userData.bar = new V3(bx, 1.1, 0.07); return g; });
    box(world, std({ color: 0x08090a, roughness: 0.6 }), 1.84, 0.025, 0.34, 0, 0.0125, -0.2);
    // bollards
    { const bm = std({ color: 0x66643f, roughness: 0.38 }), band = std({ color: 0xb8b8b0, roughness: 0.3, emissive: 0x111110 }); for (const x of [-3.3, -1.9, 1.9, 3.3]) { cyl(world, bm, 0.1, 0.11, 1.07, x, 0.535, 2.25, 18); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8, 0, PI * 2, 0, PI / 2), bm); cap.position.set(x, 1.07, 2.25); world.add(sh(cap)); cyl(world, band, 0.102, 0.103, 0.08, x, 0.92, 2.25, 18).castShadow = false; } }
    // the camera by the door: big enough to read, low enough to sit in the canopy's light. v8.50: a rounded body (a tube with a domed back), a curved hood, a ball joint on a curved arm
    const camPiv = new THREE.Group(), camHead = new THREE.Group(); camPiv.position.set(1.42, 2.42, 0.3); world.add(camPiv); camPiv.add(camHead);
    const ledM = lit(0, 0, 0), lensM = new THREE.MeshPhysicalMaterial({ color: 0x05070c, roughness: 0.04, metalness: 0.2, clearcoat: 1, envMapIntensity: 3 });
    { const m = std({ color: 0xd3d6d4, roughness: 0.32, metalness: 0.1, envMapIntensity: 0.9 }), dk = std({ color: 0x0c0d0e, roughness: 0.3, metalness: .5 });
      const plate = cyl(world, m, 0.07, 0.075, 0.03, 1.42, 2.29, 0.015, 28); plate.rotation.x = PI / 2;                           // round wall plate
      const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new V3(1.42, 2.29, 0.02), new V3(1.42, 2.29, 0.24), new V3(1.42, 2.335, 0.3)), 18, 0.026, 14), m); world.add(sh(arm));
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.043, 22, 16), m); ball.position.set(0, -0.088, 0); camPiv.add(sh(ball));
      const body = cyl(camHead, m, 0.074, 0.074, 0.3, 0, 0, 0.07, 32); body.rotation.x = PI / 2;
      const back = new THREE.Mesh(new THREE.SphereGeometry(0.074, 32, 16, 0, PI * 2, 0, PI / 2), m); back.rotation.x = -PI / 2; back.scale.y = 0.8; back.position.set(0, 0, -0.08); camHead.add(sh(back));
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.4, 32, 1, true, PI * 0.64, PI * 0.72), std({ color: 0xd3d6d4, roughness: 0.32, side: THREE.DoubleSide })); hood.rotation.x = PI / 2; hood.position.set(0, 0, 0.12); camHead.add(sh(hood));
      const ring = cyl(camHead, dk, 0.076, 0.07, 0.036, 0, 0, 0.236, 32); ring.rotation.x = PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.064, 0.008, 10, 32), dk); rim.position.set(0, 0, 0.255); camHead.add(rim);
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.056, 24, 16), lensM); lens.scale.set(1, 1, 0.42); lens.position.set(0, 0, 0.252); camHead.add(lens);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), ledM); led.position.set(0.046, 0.04, 0.258); camHead.add(led);
}
    const ledGlow = glow(camHead, 1, .06, .03, 0.001, 0.046, 0.04, 0.275);
    // lamp posts
    const postM = std({ color: 0x353b40, roughness: 0.3, metalness: 0.75, envMapIntensity: 1.2 }), sodium = new THREE.Color(1, 0.52, 0.16);
    const lampLens = [], s0 = [], lampSpots = [];
    function lampPost(x, z, ax, az) { cyl(world, postM, 0.07, 0.1, 6.2, x, 3.1, z, 20); cyl(world, postM, 0.14, 0.16, 0.5, x, 0.25, z, 20); box(world, postM, 0.24, 0.03, 0.24, x, 0.015, z);
      const curve = new THREE.QuadraticBezierCurve3(new V3(x, 6.1, z), new V3(x, 6.75, z), new V3(x + ax * 1.3, 6.55, z + az * 1.3)); world.add(sh(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.045, 10), postM)));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), postM); head.scale.set(1.35, 0.3, 0.6); head.rotation.y = -Math.atan2(az, ax); head.position.set(x + ax * 1.55, 6.52, z + az * 1.55); world.add(sh(head)); return [x + ax * 1.55, 6.44, z + az * 1.55, -Math.atan2(az, ax)]; }
    const L1 = lampPost(-2.2, 11, 0.55, 0.835), L2 = lampPost(8.6, 9.2, -1, 0); lampPost(-14, 20, 1, 0);
    function lamp(p, I, share) { const lens = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 8), lit(6, 3.2, 1)); lampLens.push(lens.material); s0.push(I); lens.scale.set(1.25, 0.18, 0.5); lens.rotation.y = p[3]; lens.position.set(p[0], p[1] - 0.03, p[2]); world.add(lens);
      const s = new THREE.SpotLight(sodium, I, 26, 1.05, 0.85, 1.7); s.position.set(p[0], p[1] - 0.1, p[2]); s.target.position.set(p[0], 0, p[2] - 0.7); world.add(s, s.target);
      s.castShadow = true; s.shadow.camera.near = 0.5; s.shadow.camera.far = 22; s.shadow.bias = -0.0004; shadowLights.push([s, share]);
      glow(world, 1, .52, .16, 2.6, p[0], p[1] - 0.06, p[2]);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(5.2, 6.4, 40, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, uniforms: { uT: U.uT },      // the lit rain and mist under the lamp
        vertexShader: "varying vec3 vN, vV, vP; void main(){ vP = position; vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
        fragmentShader: `varying vec3 vN, vV, vP; uniform float uT; float h(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); } float n(vec2 q){ vec2 i = floor(q), f = fract(q); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
          void main(){ float e = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float up = (vP.y + 3.2) / 6.4; float a = e * (0.05 + up * up * 0.5) * (.75 + .5 * n(vec2(atan(vP.x, vP.z) * 3., vP.y * 1.4 + uT * 1.6)));
            gl_FragColor = vec4(vec3(1., .5, .15) * a * .2, 1.); }` }));
      cone.position.set(p[0], p[1] - 3.25, p[2] - 0.3); world.add(cone); nightOnly.push(cone); lampSpots.push(s); return s; }
    lamp(L1, 420, 1); lamp(L2, 130, 0.5); glow(world, 1, .52, .16, 2.2, -12.45, 6.44, 20);
    for (const [x, z, s] of [[-26, 34, 1.6], [22, 40, 1.4], [30, 14, 1.8], [-34, 10, 1.5]]) { glow(world, 1, .5, .16, s * 2, x, 6.3, z); const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), lit(5, 2.6, .8)); b.position.set(x, 6.3, z); world.add(b); nightOnly.push(b); }
    // the flyer: the game's own design, on real paper (curled, taped, wet), its tear-off tabs loose in the wind
    const paintFlyer = (g) => {
      g.fillStyle = "#e9e2cf"; g.fillRect(0, 0, 512, 724); speckle(g, 2500, 512, 724, 120, 190, .12);
      for (let i = 0; i < 9; i++) { const x = R() * 512, gr = g.createLinearGradient(0, 0, 0, 724); gr.addColorStop(0, "rgba(90,80,60,.22)"); gr.addColorStop(.5 + R() * .5, "rgba(90,80,60,0)"); g.fillStyle = gr; g.fillRect(x, 0, 6 + R() * 26, 724); }
      g.fillStyle = "#17191b"; g.textAlign = "center"; g.textBaseline = "alphabetic";
      g.font = "900 96px Helvetica, Arial, sans-serif"; g.fillText("PAID", 256, 122); g.font = "900 70px Helvetica, Arial, sans-serif"; g.fillText("VOLUNTEERS", 256, 198); g.font = "900 96px Helvetica, Arial, sans-serif"; g.fillText("WANTED", 256, 292);
      g.fillRect(48, 316, 416, 6);
      g.font = "600 30px Helvetica, Arial, sans-serif"; ["Help with a simple study.", "No experience needed.", "Light refreshments provided (cake)."].forEach((s, i) => g.fillText(s, 256, 372 + i * 44));
      g.font = "800 32px Helvetica, Arial, sans-serif"; g.fillText("ASK AT THE FRONT DOOR", 256, 530); g.font = "600 26px Helvetica, Arial, sans-serif"; g.fillText("Open all hours", 256, 568);
      g.strokeStyle = "#17191b"; g.lineWidth = 2; g.setLineDash([7, 6]); g.beginPath(); g.moveTo(0, 604); g.lineTo(512, 604); g.stroke(); g.setLineDash([]);
      g.font = "700 17px Helvetica, Arial, sans-serif"; for (let i = 0; i < 8; i++) { g.save(); g.translate(i * 64 + 38, 664); g.rotate(-PI / 2); g.fillText("FRONT DOOR", 0, 0); g.restore(); }
      for (let i = 0; i < 26; i++) { const x = R() * 512, y = R() * 600, r = 4 + R() * 12; const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, "rgba(70,62,48,.20)"); rg.addColorStop(1, "rgba(70,62,48,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); }
    };
    const flyerT = canvasTex(512, 724, paintFlyer);
    const flyerDayT = canvasTex(512, 724, (g) => { paintFlyer(g); g.fillStyle = "rgba(236,231,214,.8)"; g.fillRect(0, 0, 512, 724);      // years of sun: the print nearly gone, the lower half torn away
      g.globalCompositeOperation = "destination-out"; g.fillStyle = "#000"; g.beginPath(); g.moveTo(0, 724); g.lineTo(0, 430); let yy = 430; for (let x = 0; x <= 512; x += 16) { yy += (R() - .42) * 46; yy = clamp(yy, 300, 520); g.lineTo(x, yy); } g.lineTo(512, 724); g.fill(); g.globalCompositeOperation = "source-over"; });
    flyerDayT.wrapS = flyerDayT.wrapT = THREE.ClampToEdgeWrapping;
    flyerT.wrapS = flyerT.wrapT = THREE.ClampToEdgeWrapping;
    const FW = 0.27, FH = 0.382, FX = -2.2, FY = 1.56, FZ = 11.105;
    const flyerG = new THREE.PlaneGeometry(FW, FH * 604 / 724, 16, 14); flyerG.translate(0, FH * 60 / 724, 0);
    const flyerM = std({ map: flyerT, color: 0x8f8f8f, roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: .5 });
    { const uv = flyerG.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 120 / 724 + uv.getY(i) * 604 / 724); }
    const flyerDayM = std({ map: flyerDayT, color: 0xe6e2d6, roughness: 0.9, side: THREE.DoubleSide, alphaTest: 0.5, envMapIntensity: .2 }), tabPivs = [];
    const flyer = new THREE.Mesh(flyerG, flyerM); flyer.position.set(FX, FY, FZ); flyer.rotation.z = 0.035; world.add(flyer);      // casts and takes no shadows: either turns it black at this angle
    const fBase = flyerG.attributes.position.array.slice(), tabs = [];
    for (let i = 0; i < 8; i++) { if (i === 5) continue; const g = new THREE.PlaneGeometry(FW / 8 - 0.0012, FH * 120 / 724, 1, 6); g.translate(0, -FH * 60 / 724, 0); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) { uv.setX(k, (i + uv.getX(k)) / 8); uv.setY(k, uv.getY(k) * 120 / 724); }
      const piv = new THREE.Group(); piv.position.set(FW * ((i + .5) / 8 - .5), FH * (120 / 724 - .5), 0.0005); piv.add(new THREE.Mesh(g, flyerM)); flyer.add(piv); tabPivs.push(piv); tabs.push({ g, base: g.attributes.position.array.slice(), ph: R() * 6, amp: .6 + R() * .8 }); }
    { const tape = new THREE.MeshPhysicalMaterial({ color: 0xcfc7a8, roughness: 0.18, transparent: true, opacity: 0.55, clearcoat: 1 }); for (const [x, y, r] of [[-.118, .178, .5], [.12, .172, -.6]]) { const t = new THREE.Mesh(BOX, tape); t.scale.set(0.07, 0.024, 0.0015); t.position.set(x, y, 0.004); t.rotation.z = r; flyer.add(t); } }
    // the courier's van, hazards on. v8.50: it is MaybeMail's (a made-up local courier), with their shrugging beaver under the name
    const van = new THREE.Group(); van.position.set(2.25, 0, 5.9); van.rotation.y = -1.3; world.add(van); const haz = [], tyres = [], vanDayG = new THREE.Group(); vanDayG.visible = false; van.add(vanDayG); let vanBodyM, vanLogoM;
    { const sp = new THREE.Shape(); sp.moveTo(0.1, 0.42); sp.lineTo(0.04, 1.2); sp.quadraticCurveTo(0.02, 2.3, 0.3, 2.42); sp.lineTo(3.3, 2.46); sp.quadraticCurveTo(3.75, 2.44, 4.25, 1.62); sp.quadraticCurveTo(4.5, 1.34, 5.0, 1.24); sp.quadraticCurveTo(5.22, 1.16, 5.22, 0.8); sp.lineTo(5.2, 0.42); sp.lineTo(0.1, 0.42);
      const bodyM = vanBodyM = new THREE.MeshPhysicalMaterial({ color: 0xaeb3b6, roughness: 0.32, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.3 });
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(sp, { depth: 1.82, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 4, curveSegments: 14 }), bodyM); body.rotation.y = PI / 2; body.position.set(-0.91, 0, 0); van.add(sh(body));
      const dk = std({ color: 0x0b0c0d, roughness: 0.5 }), tyre = std({ color: 0x0c0c0d, roughness: 0.75 }), hub = std({ color: 0x8a8f94, roughness: 0.3, metalness: 0.9 });
      for (const zz of [-0.95, -4.2]) for (const s of [-1, 1]) { { const ty = cyl(van, tyre, 0.36, 0.36, 0.24, s * 0.86, 0.36, zz, 24); ty.rotation.z = PI / 2; tyres.push(ty); } cyl(van, hub, 0.2, 0.2, 0.25, s * 0.865, 0.36, zz, 16).rotation.z = PI / 2; }
      box(van, dk, 1.9, 0.2, 0.16, 0, 0.42, 0); box(van, dk, 0.012, 1.86, 0.02, 0, 1.38, 0.035); box(van, dk, 1.7, 0.012, 0.02, 0, 0.56, 0.036);
      for (const s of [-1, 1]) { box(van, glassM, 0.56, 0.5, 0.02, s * 0.42, 1.78, 0.036); box(van, hub, 0.03, 0.14, 0.03, s * 0.07, 1.25, 0.05);
        box(van, lit(.5, .02, .02), 0.13, 0.3, 0.03, s * 0.86, 1.12, 0.03).castShadow = false; const hz = lit(0, 0, 0); box(van, hz, 0.13, 0.14, 0.03, s * 0.86, 1.36, 0.03).castShadow = false; haz.push(hz); box(van, lit(.3, .3, .3), 0.13, 0.08, 0.03, s * 0.86, 0.93, 0.03).castShadow = false;
        box(van, std({ color: 0xc8581a, roughness: 0.35 }), 0.02, 0.2, 3.4, s * 0.985, 1.3, -1.9); box(van, dk, 0.1, 0.16, 0.06, s * 1.08, 1.6, -4.02); box(van, glassM, 0.02, 0.62, 0.9, s * 0.99, 1.75, -4.0); glow(van, 1, .04, .02, 0.5, s * 0.86, 1.12, 0.08); }
      box(van, std({ color: 0xd8d6c0, roughness: 0.4 }), 0.5, 0.11, 0.012, 0, 0.74, 0.04); 
      // the livery: the name, the line under it, and the beaver, on both sides; the name and the beaver again on the back doors
      vanLogoM = std({ map: canvasTex(1024, 502, (g) => paintMaybeMail(g, 1024, 502, "side")), transparent: true, roughness: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); vanLogoM.map.wrapS = vanLogoM.map.wrapT = THREE.ClampToEdgeWrapping;
      const wordM = std({ map: canvasTex(512, 128, (g) => paintMaybeMail(g, 512, 128, "word")), transparent: true, roughness: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), bvM = std({ map: canvasTex(256, 256, (g) => paintMaybeMail(g, 256, 256, "beaver")), transparent: true, roughness: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      for (const sd of [-1, 1]) { const q = quad(van, vanLogoM, 2.0, 0.98, sd * 0.992, 1.89, -1.72, 0, sd * PI / 2); q.receiveShadow = true; }
      quad(van, wordM, 0.68, 0.17, -0.46, 1.38, 0.046); quad(van, bvM, 0.5, 0.5, -0.47, 1.03, 0.046); vanLogoM.userData.more = [wordM, bvM];      // v8.52: the beaver right under the name (it was on the other door, out of shot)
      // years later (the closing film): rust creeping up the panels, grime on the glass
      const rustT = (seed, w, h) => canvasTex(w, h, (g) => { const r = rng(seed); g.clearRect(0, 0, w, h);
        for (let i = 0; i < 70; i++) { const x = r() * w, y = h - Math.pow(r(), 3.2) * h * .6, rad = 14 + r() * 60; const rg = g.createRadialGradient(x, y, 1, x, y, rad); const c = r() < .5 ? "122,62,24" : r() < .5 ? "92,44,18" : "150,84,34"; rg.addColorStop(0, `rgba(${c},${.3 + r() * .3})`); rg.addColorStop(.6, `rgba(${c},.18)`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
        for (let i = 0; i < 46; i++) { const x = r() * w, y = r() * h * .7, len = 30 + r() * 150, gr = g.createLinearGradient(0, y, 0, y + len); gr.addColorStop(0, "rgba(96,52,22,.5)"); gr.addColorStop(1, "rgba(96,52,22,0)"); g.fillStyle = gr; g.fillRect(x, y, 2 + r() * 5, len); }
        for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${60 + r() * 60 | 0},${34 + r() * 30 | 0},16,${r() * .35})`; g.fillRect(r() * w, h - Math.pow(r(), 1.6) * h, 1 + r() * 3, 1 + r() * 3); }
        const gd = g.createLinearGradient(0, 0, 0, h); gd.addColorStop(0, "rgba(70,66,52,.1)"); gd.addColorStop(1, "rgba(52,44,30,.42)"); g.fillStyle = gd; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = "destination-in"; const ge = g.createLinearGradient(0, 0, w, 0); ge.addColorStop(0, "rgba(0,0,0,0)"); ge.addColorStop(.12, "rgba(0,0,0,1)"); ge.addColorStop(.88, "rgba(0,0,0,1)"); ge.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = ge; g.fillRect(0, 0, w, h); g.globalCompositeOperation = "source-over"; });
      const rm = (seed, w, h) => { const t = rustT(seed, w, h); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return std({ map: t, transparent: true, roughness: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }); };
      for (const sd of [-1, 1]) { quad(vanDayG, rm(60 + sd, 1024, 512), 3.5, 1.95, sd * 0.996, 1.42, -1.75, 0, sd * PI / 2); quad(vanDayG, std({ color: 0x6a6656, transparent: true, opacity: 0.55, roughness: 1, depthWrite: false }), 0.9, 0.62, sd * 1.003, 1.75, -4.0, 0, sd * PI / 2); }
      quad(vanDayG, rm(71, 512, 512), 1.84, 1.95, 0, 1.42, 0.052); }
    const hazL = new THREE.PointLight(0xff8a14, 0, 9, 1.8); hazL.position.set(0, 1.3, 1.4); van.add(hazL);
    const hazG = [glow(van, 1, .5, .06, 0.01, -0.86, 1.36, 0.08), glow(van, 1, .5, .06, 0.01, 0.86, 1.36, 0.08)];
    let treeM;
    // far things: fence and tree line
    { const link = canvasTex(64, 64, (g) => { g.clearRect(0, 0, 64, 64); g.strokeStyle = "rgba(130,138,146,1)"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 32); g.lineTo(32, 0); g.lineTo(64, 32); g.lineTo(32, 64); g.closePath(); g.stroke(); }); link.repeat.set(60, 6);
      const fm = std({ map: link, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, metalness: .6, roughness: .4 }), pm = std({ color: 0x4a5056, metalness: .7, roughness: .4 });
      for (const s of [-1, 1]) { quad(world, fm, 44, 2.4, s * 22.5, 1.2, 22, 0, PI / 2); for (let z = 0; z <= 44; z += 2.75) cyl(world, pm, 0.035, 0.035, 2.5, s * 22.5, 1.25, z, 8).castShadow = false; }
      const trees = canvasTex(1024, 128, (g) => { g.clearRect(0, 0, 1024, 128); g.fillStyle = "#3c4a2c"; g.beginPath(); g.moveTo(0, 128); let y = 60; for (let x = 0; x <= 1024; x += 6) { y += (R() - .5) * 22; y = clamp(y, 18, 96); g.lineTo(x, y); } g.lineTo(1024, 128); g.fill(); });
      const tm = treeM = lit(.03, .04, .06, { map: trees, transparent: true }); quad(world, tm, 120, 14, -40, 7, 22, 0, PI / 2); quad(world, tm, 120, 14, 40, 7, 22, 0, -PI / 2); quad(world, tm, 160, 14, 0, 7, 62, 0, PI); }
    // rain: streaks that catch the lamps, and the drips off the canopy's edge
    const LIGHTS = [[L1[0], L1[1], L1[2], 1, .52, .16, 9.0], [L2[0], L2[1], L2[2], 1, .52, .16, 7.5], [0, 2.8, 1.0, .75, .86, 1, 2.2], [0, 3.6, 0.6, 1, .8, .55, 0.9]];
    function rainMesh(N, place) {
      const g = new THREE.InstancedBufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3)); g.setIndex([0, 1, 2, 2, 1, 3]);
      const a = new Float32Array(N * 4), b = new Float32Array(N); for (let i = 0; i < N; i++) { a.set(place(i), i * 4); b[i] = R(); }
      g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4)); g.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 1)); g.instanceCount = N;
      const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uT: U.uT, uLp: { value: LIGHTS.map(l => new V3(l[0], l[1], l[2])) }, uLc: { value: LIGHTS.map(l => new V3(l[3] * l[6], l[4] * l[6], l[5] * l[6])) }, uHz: { value: new THREE.Vector4(0, 0, 0, 0) } },
        vertexShader: `attribute vec4 aA; attribute float aB; uniform float uT; uniform vec3 uLp[4], uLc[4]; uniform vec4 uHz; varying vec3 vC; varying vec2 vQ;
          void main(){ float top = aA.w < 0. ? 2.85 : 13., sp = abs(aA.w); float y = top - mod(aA.y + sp * uT, top); vec3 dir = normalize(vec3(.09, -1., .03));
            vec3 p = vec3(aA.x + (top - y) * .09, y, aA.z + (top - y) * .03); float len = sp * (aA.w < 0. ? .02 : .04);
            vec3 toC = normalize(cameraPosition - p), side = normalize(cross(dir, toC)); float dist = distance(cameraPosition, p), wd = max(.0014, .00052 * dist);
            vec3 wp = p + side * position.x * wd - dir * position.y * len;
            if (aA.w > 0. && p.z < 1.9 && abs(p.x) < 2. && p.y < 2.9) wp = vec3(0., -9., 0.); if (aA.w > 0. && p.z < -.1) wp = vec3(0., -9., 0.);
            vec3 c = vec3(.012, .016, .024); for (int i = 0; i < 4; i++) { vec3 d = uLp[i] - p; float r2 = dot(d, d); float dn = i < 2 ? smoothstep(.45, .95, d.y / sqrt(r2)) : 1.; c += uLc[i] * dn / (1. + r2 * .9); }
            { vec3 d = uHz.xyz - p; c += vec3(1., .45, .05) * uHz.w / (1. + dot(d, d) * 1.2); }
            vC = c * (.3 + .6 * aB) * min(1., .0014 / wd * 1.6 + .3) * .8; vQ = position.xy; gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.); }`,
        fragmentShader: "varying vec3 vC; varying vec2 vQ; void main(){ float a = (1. - abs(vQ.x)) * smoothstep(0., .25, vQ.y) * smoothstep(1., .5, vQ.y); gl_FragColor = vec4(vC * a, 1.); }" }));
      m.frustumCulled = false; m.userData.N = N; world.add(m); return m;
    }
    const NRAIN = 22000, rain = rainMesh(NRAIN, () => [-20 + R() * 40, R() * 13, -1 + R() * 26, 8.5 + R() * 3.5]);
    const drips = rainMesh(170, (i) => i % 5 === 0 ? [(R() < .5 ? -1.93 : 1.93), R() * 2.85, R() * 1.8, -(4.5 + R() * 2)] : [-1.9 + R() * 3.8, R() * 2.85, 1.835, -(4.5 + R() * 2)]);
    const applyQ = (q) => { rain.geometry.instanceCount = Math.round(NRAIN * q.rain); for (const [l, share] of shadowLights) { const sz = Math.max(256, q.shadow * share | 0); l.castShadow = q.shadow > 0; if (l.shadow.mapSize.x !== sz) { l.shadow.mapSize.set(sz, sz); if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; } } } };
    onQuality.push(applyQ); applyQ(Q);

    nightOnly.push(rain, drips);
    /* ---------- v8.50: the same place years later, by day (the closing film). Everything here hangs on `dayOnly`, shown by `setDay(true)`:
       the sun (with shadows), grass round the car park, cracks with real blades of grass and weeds growing out of them, ivy grown leaf by leaf
       up the front of the building and in at the door, a roof (the last shot rises over it), the light that falls in through the door. ---------- */
    const RD = rng(9120), dm = new THREE.Object3D(), tcol = new THREE.Color();
    const sun = new THREE.DirectionalLight(0xfff0d8, 4.4); sun.position.set(13, 21, 19); sun.target.position.set(0, 0, 6); dayOnly.add(sun, sun.target);
    sun.castShadow = true; { const c = sun.shadow.camera; c.left = -24; c.right = 24; c.top = 20; c.bottom = -20; c.near = 2; c.far = 70; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; }
    // inside: the low light that comes in through the door and lies across the lobby floor, and its shafts in the dusty air
    const sunIn = new THREE.SpotLight(0xffe2b4, 260, 16, 0.5, 0.5, 1.2); sunIn.position.set(1.35, 2.25, 3.1); sunIn.target.position.set(-0.35, 0, -4.2); dayOnly.add(sunIn, sunIn.target);
    sunIn.castShadow = true; sunIn.shadow.bias = -0.0006; sunIn.shadow.camera.near = 0.5; sunIn.shadow.camera.far = 16;
    const fillIn = new THREE.PointLight(0xcfdcf0, 5, 9, 1.6); fillIn.position.set(0, 1.9, -1.2); dayOnly.add(fillIn);
    const shaftT = canvasTex(64, 256, (g) => { const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "rgba(255,255,255,.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 256); const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, "rgba(0,0,0,1)"); gx.addColorStop(.3, "rgba(0,0,0,0)"); gx.addColorStop(.7, "rgba(0,0,0,0)"); gx.addColorStop(1, "rgba(0,0,0,1)"); g.globalCompositeOperation = "destination-out"; g.fillStyle = gx; g.fillRect(0, 0, 64, 256); }, false);
    const shafts = []; for (const [x, w, a] of [[-0.36, 0.5, 0.075], [0.4, 0.52, 0.06], [0.02, 1.3, 0.035]]) { const m = new THREE.Mesh(QUAD, new THREE.MeshBasicMaterial({ map: shaftT, color: new THREE.Color(1.5, 1.25, .9), transparent: true, opacity: a, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      m.scale.set(w, 5.4, 1); m.position.set(x - 0.22, 0.95, -2.5); m.rotation.set(1.17, 0.08, 0, "YXZ"); dayOnly.add(m); shafts.push([m, a]); }
    // grass beyond the fence and past the end of the tarmac
    const grassT = canvasTex(256, 256, (g) => { g.fillStyle = "#56683a"; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { const v = RD(); g.fillStyle = `rgba(${50 + v * 70 | 0},${78 + v * 70 | 0},${30 + v * 30 | 0},.5)`; g.fillRect(RD() * 256, RD() * 256, 1 + RD() * 2, 2 + RD() * 5); } }); grassT.repeat.set(60, 60);
    const grassM = std({ map: grassT, roughness: 1, envMapIntensity: 0.2 });
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), grassM); m.rotation.x = -PI / 2; m.position.set(0, -0.03, 30); m.receiveShadow = true; dayOnly.add(m);
      const gs = grassT.clone(); gs.repeat.set(4, 12); gs.needsUpdate = true; const gm = std({ map: gs, roughness: 1, envMapIntensity: 0.2, polygonOffset: true, polygonOffsetFactor: -3 });
      for (const sd of [-1, 1]) { const q = new THREE.Mesh(new THREE.PlaneGeometry(22.6, 70), gm); q.rotation.x = -PI / 2; q.position.set(sd * 33.9, 0.004, 35); q.receiveShadow = true; dayOnly.add(q); }
      const q = new THREE.Mesh(new THREE.PlaneGeometry(45.4, 26), gm); q.rotation.x = -PI / 2; q.position.set(0, 0.004, 57.2); q.receiveShadow = true; dayOnly.add(q); }
    // the roof, and what stands on it
    { const rf = std({ color: 0x3c4043, roughness: 0.9 }), unit = std({ color: 0x7c8286, roughness: 0.5, metalness: 0.5 }); box(dayOnly, rf, 46.4, 0.3, 30, 0, 9.82, -15.2); box(dayOnly, rf, 46.4, 10, 0.4, 0, 5, -30.2); for (const sd of [-1, 1]) box(dayOnly, rf, 0.4, 10, 30, sd * 23, 5, -15.2);
      for (const [x, z, w, h, d] of [[-9, -6, 2.4, 1.2, 1.8], [6, -9, 3.2, 1.5, 2.2], [14, -4.5, 1.4, 0.9, 1.4], [-16, -12, 2, 1.1, 2]]) box(dayOnly, unit, w, h, d, x, 9.97 + h / 2, z); }
    // cracks across the tarmac
    const crackLines = [], CK = 44, toPx = (x, z) => [(x + CK / 2) / CK * 2048, (z + 1) / CK * 2048];
    const crackT = canvasTex(2048, 2048, (g) => { g.clearRect(0, 0, 2048, 2048); g.lineCap = g.lineJoin = "round";
      const crack = (x, z, ang, len, wd, depth) => { const pts = [[x, z]]; let cx = x, cz = z;
        for (let k = 0; k < len; k++) { ang += (RD() - .5) * .75; cx += Math.cos(ang) * .3; cz += Math.sin(ang) * .3; if (cz < 2.75 || cz > 42 || Math.abs(cx) > 21) break; pts.push([cx, cz]); if (depth < 2 && RD() < .08) crack(cx, cz, ang + (RD() < .5 ? 1 : -1) * (.6 + RD() * .7), len * .5 | 0, wd * .6, depth + 1); }
        for (const [lw, col] of [[wd * 2.6, "rgba(60,58,52,.35)"], [wd, "rgba(8,9,9,.95)"]]) { g.lineWidth = lw; g.strokeStyle = col; g.beginPath(); pts.forEach((q, k) => { const c = toPx(q[0], q[1]); k ? g.lineTo(c[0], c[1]) : g.moveTo(c[0], c[1]); }); g.stroke(); } crackLines.push(pts); };
      for (let k = 0; k < 16; k++) crack(-16 + RD() * 32, 3.2 + RD() * 24, RD() * 6.28, 40 + RD() * 40, 3 + RD() * 2.4, 0);
      crack(-6, 12.5, 0.15, 70, 4.5, 0); crack(3.5, 7.6, 2.2, 50, 4, 0);
      for (let k = 0; k < 60; k++) { const x = RD() * 2048, y = RD() * 2048, r = 30 + RD() * 110, rg = g.createRadialGradient(x, y, 2, x, y, r); const c = RD() < .5 ? "120,116,104" : "40,42,38"; rg.addColorStop(0, `rgba(${c},.2)`); rg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = rg; g.fillRect(x - r, y - r, r * 2, r * 2); } }, true);
    crackT.wrapS = crackT.wrapT = THREE.ClampToEdgeWrapping;
    { const m = new THREE.Mesh(new THREE.PlaneGeometry(CK, CK), std({ map: crackT, transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.rotation.x = -PI / 2; m.position.set(0, 0.003, CK / 2 - 1); m.receiveShadow = true; dayOnly.add(m); }
    // grass and weeds: every tuft is real blades (bent, tapering strips), swaying a little
    function tuftGeo(nBlades, seed) { const r = rng(seed), pos = [], uv = [], col = [], idx = []; const SEG = 4;
      for (let b = 0; b < nBlades; b++) { const a = r() * 6.2832, bx = Math.cos(a) * r() * .05, bz = Math.sin(a) * r() * .05, la = r() * 6.2832, lean = .12 + r() * .5, hh = .45 + r() * .55, wd = .012 + r() * .012, fx = Math.cos(la), fz = Math.sin(la), sx = -fz, sz = fx, base = pos.length / 3, sh = .55 + r() * .45;
        for (let k = 0; k <= SEG; k++) { const u = k / SEG, w = wd * (1 - u * .92), cx = bx + fx * lean * u * u * hh, cz = bz + fz * lean * u * u * hh, cy = hh * (u - .12 * u * u);
          pos.push(cx - sx * w, cy, cz - sz * w, cx + sx * w, cy, cz + sz * w); uv.push(0, u, 1, u); const cc = (.35 + .65 * u) * sh; col.push(cc, cc, cc, cc, cc, cc); }
        for (let k = 0; k < SEG; k++) { const o = base + k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g; }
    const bladeM = std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, envMapIntensity: 0.3 });
    bladeM.onBeforeCompile = (sd) => { sd.uniforms.uT = U.uT; sd.vertexShader = sd.vertexShader.replace("#include <common>", "#include <common>\nuniform float uT;").replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
      { vec3 ip = instanceMatrix[3].xyz; float k = uv.y * uv.y; transformed.x += (sin(uT * 1.9 + ip.x * 1.7 + ip.z * 1.1) * .05 + sin(uT * 3.7 + ip.z * 2.3) * .02 + .03) * k; transformed.z += sin(uT * 1.4 + ip.x * .9 + ip.z * 2.1) * .03 * k; }
      #endif`); };
    const tufts = [];      // [x, z, size, kind]: 0 grass, 1 dry grass, 2 weed
    const clearOf = (x, z) => !(Math.abs(x - van.position.x) < 2.6 && Math.abs(z - van.position.z) < 3.2);
    for (const pts of crackLines) for (let k = 1; k < pts.length; k++) { if (RD() < .62 && clearOf(pts[k][0], pts[k][1])) tufts.push([pts[k][0] + (RD() - .5) * .14, pts[k][1] + (RD() - .5) * .14, .22 + RD() * .5, RD() < .2 ? 1 : 0]); if (RD() < .07) tufts.push([pts[k][0], pts[k][1], .5 + RD() * .5, 2]); }
    for (let k = 0; k < 260; k++) { const x = (RD() - .5) * 44; if (Math.abs(x) < 1.1 && RD() < .8) continue; tufts.push([x, 2.62 + RD() * .16, .3 + RD() * .55, RD() < .25 ? 1 : 0]); }                    // along the pavement's edge
    for (let k = 0; k < 150; k++) { const x = (RD() - .5) * 44; if (Math.abs(x) < 1.15) continue; tufts.push([x, 0.06 + RD() * .12, .35 + RD() * .75, RD() < .2 ? 2 : 0]); }                    // against the wall
    for (const bx of [-3.3, -1.9, 1.9, 3.3]) for (let k = 0; k < 5; k++) tufts.push([bx + (RD() - .5) * .34, 2.25 + (RD() - .5) * .34, .25 + RD() * .4, 0]);
    for (const [px, pz] of [[-2.2, 11], [8.6, 9.2], [-14, 20]]) for (let k = 0; k < 22; k++) { const a = RD() * 6.28, d = .14 + RD() * .5; tufts.push([px + Math.cos(a) * d, pz + Math.sin(a) * d, .3 + RD() * .7, RD() < .25 ? 2 : RD() < .3 ? 1 : 0]); }
    for (let k = 0; k < 420; k++) { const sd = RD() < .5 ? -1 : 1; tufts.push([sd * (22.5 + (RD() - .6) * 1.6), RD() * 44, .5 + RD() * .9, RD() < .3 ? 1 : 0]); }                 // the fence line, both sides
    for (let k = 0; k < 2600; k++) { const x = (RD() - .5) * 110, z = RD() * 80; if (Math.abs(x) < 23.2 && z < 44.6) continue; tufts.push([x, z, .5 + RD() * 1.0, RD() < .3 ? 1 : 0]); }             // the rough ground outside
    for (let k = 0; k < 30; k++) { const a = RD() * 6.28, d = 1.2 + RD() * 1.6; tufts.push([van.position.x + Math.cos(a) * d * .8, van.position.z + Math.sin(a) * d * 1.3, .3 + RD() * .5, 0]); }       // round the van, which has not moved
    const tGeo = [tuftGeo(9, 5), tuftGeo(7, 6), tuftGeo(12, 7)], tMesh = [0, 1, 2].map(kd => { const list = tufts.filter(q => q[3] === kd), m = new THREE.InstancedMesh(tGeo[kd], bladeM, list.length);
      list.forEach((q, n) => { dm.position.set(q[0], 0, q[1]); dm.rotation.set(0, RD() * 6.28, 0); const sc = q[2] * (kd === 2 ? 1.5 : 1); dm.scale.set(sc * (kd === 2 ? .8 : 1.1), sc, sc * (kd === 2 ? .8 : 1.1)); dm.updateMatrix(); m.setMatrixAt(n, dm.matrix);
        if (kd === 1) tcol.setRGB(.62 + RD() * .2, .56 + RD() * .16, .28 + RD() * .1); else if (kd === 2) tcol.setRGB(.2 + RD() * .1, .38 + RD() * .14, .12 + RD() * .06); else tcol.setRGB(.26 + RD() * .16, .46 + RD() * .2, .13 + RD() * .08); m.setColorAt(n, tcol); });
      m.castShadow = kd !== 1; m.receiveShadow = true; m.frustumCulled = false; dayOnly.add(m); return m; });
    { const heads = tufts.filter(q => q[3] === 2), fm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), std({ color: 0xe8c12a, roughness: 0.6, emissive: 0x3a2c04 }), heads.length * 2); let n = 0;      // a few yellow flower heads on the weeds
      for (const q of heads) for (let k = 0; k < 2; k++) { dm.position.set(q[0] + (RD() - .5) * .2 * q[2], q[2] * (.75 + RD() * .5), q[1] + (RD() - .5) * .2 * q[2]); dm.rotation.set(0, 0, 0); dm.scale.setScalar(.8 + RD() * .8); dm.updateMatrix(); fm.setMatrixAt(n++, dm.matrix); } fm.frustumCulled = false; dayOnly.add(fm); }
    // ivy: vines grown up the wall, a real leaf every few centimetres, each one turned and tipped off the wall a little
    const leafGeo = (() => { const pts = [[0, -.5], [.2, -.46], [.46, -.5], [.5, -.2], [.36, -.02], [.44, .22], [.2, .2], [.1, .36], [0, .56], [-.1, .36], [-.2, .2], [-.44, .22], [-.36, -.02], [-.5, -.2], [-.46, -.5], [-.2, -.46]];
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(q => new THREE.Vector2(q[0], q[1])))), p = g.attributes.position, col = []; for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); p.setZ(k, -(x * x) * .5 - (y * y) * .16); const v = .78 + .22 * (1 - Math.min(1, Math.abs(x) * 2.4)); col.push(v, v, v); } g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g; })();
    const leaves = [], stems = [];
    const blocked = (x, y) => (Math.abs(x) < 1.12 && y < 2.45) || (Math.abs(x) < 2.25 && y > 3.22 && y < 3.98) || (Math.abs(x - 1.42) < .34 && y > 2.2 && y < 2.8);
    function vine(x, y, ang, len, zOff, depth) { let px = x, py = y; for (let k = 0; k < len; k++) { ang += (RD() - .5) * .5; ang = ang * .93 + (PI / 2) * .07; const nx = px + Math.cos(ang) * .06, ny = py + Math.sin(ang) * .06; if (ny > 9.7 || ny < .02 || Math.abs(nx) > 22.8) break; if (blocked(nx, ny)) { ang += nx > 0 ? -.5 : .5; continue; }
        stems.push(px, py, zOff, nx, ny, zOff); px = nx; py = ny; const n = depth > 1 ? 2 : 3; for (let j = 0; j < n; j++) leaves.push([px + (RD() - .5) * .2, py + (RD() - .5) * .2, zOff + .01 + RD() * .06, .05 + RD() * .055, RD() * 6.28, .25 + RD() * .8, RD(), 0]);
        if (depth < 3 && RD() < (depth ? .045 : .075)) vine(px, py, ang + (RD() < .5 ? 1 : -1) * (.5 + RD() * .8), len * (.35 + RD() * .3) | 0, zOff, depth + 1); } }
    for (const [x, len] of [[-1.45, 95], [-2.1, 120], [-3.4, 105], [1.5, 60], [2.4, 110], [3.9, 85], [-5.6, 70], [-8.2, 120], [-9, 95], [6.3, 60], [8.4, 115], [9.5, 90], [-13, 70], [-16.5, 110], [13.2, 100], [17, 80], [-20.5, 90], [20.6, 70], [-11.2, 40], [11.4, 45], [-4.6, 50], [5.1, 75], [-6.8, 100], [-1.25, 40], [1.3, 38]]) vine(x + (RD() - .5) * .3, .04, PI / 2 + (RD() - .5) * .5, len * 1.25 | 0, .012, 0);
    for (let k = 0; k < 15; k++) { let x = -1.85 + RD() * 3.7, y = 2.82; const n = 6 + RD() * 15 | 0; for (let j = 0; j < n; j++) { y -= .06; x += (RD() - .5) * .03; stems.push(x, y + .06, 1.845, x, y, 1.845); leaves.push([x + (RD() - .5) * .07, y, 1.85 + RD() * .03, .07 + RD() * .07, RD() * 6.28, .2 + RD() * .5, RD(), 0]); } }      // trailing off the canopy's edge
    // in at the door: over the threshold and across the lobby floor, and up the frame inside
    { let x = 0.86, z = 0.5, a = -1.9; for (let k = 0; k < 64; k++) { a += (RD() - .5) * .5; a = a * .9 + (-1.75) * .1; x += Math.cos(a) * .06; z += Math.sin(a) * .06; if (z < -3.1) break; for (let j = 0; j < 2; j++) leaves.push([x + (RD() - .5) * .2, .012 + RD() * .03, z + (RD() - .5) * .2, .07 + RD() * .08, RD() * 6.28, .1 + RD() * .35, RD(), 1]); }
      for (let k = 0; k < 44; k++) { const y = .05 + k * .052; leaves.push([-0.9 + (RD() - .5) * .16, y, -0.46 - RD() * .03, .07 + RD() * .07, RD() * 6.28, .2 + RD() * .5, RD(), 2]); if (k > 30) leaves.push([-0.9 + (k - 30) * .07 + (RD() - .5) * .1, 2.34 + (RD() - .5) * .1, -0.46 - RD() * .03, .07 + RD() * .07, RD() * 6.28, .2 + RD() * .5, RD(), 2]); } }
    const leafM = std({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, envMapIntensity: 0.6 });
    const ivy = new THREE.InstancedMesh(leafGeo, leafM, leaves.length), e3 = new THREE.Euler();
    leaves.forEach((q, n) => { dm.position.set(q[0], q[1], q[2]); if (q[7] === 1) dm.rotation.set(-PI / 2 + q[5] * (RD() - .5), 0, q[4]); else if (q[7] === 2) dm.rotation.set(q[5] * (RD() - .3), PI, q[4], "YXZ"); else dm.rotation.set(q[5] * (RD() - .3), (RD() - .5) * q[5], q[4]); dm.scale.setScalar(q[3]); dm.updateMatrix(); ivy.setMatrixAt(n, dm.matrix);
      const v = q[6], b = .45 + RD() * .75; if (v < .025) tcol.setRGB(.3, .13, .05); else if (v < .05) tcol.setRGB(.32, .28, .08); else tcol.setRGB((.035 + v * .05) * b, (.11 + v * .12) * b, (.03 + v * .03) * b); ivy.setColorAt(n, tcol); });
    ivy.castShadow = true; ivy.receiveShadow = true; ivy.frustumCulled = false; dayOnly.add(ivy);
    { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(stems, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a1f12 })); l.frustumCulled = false; dayOnly.add(l); }
    // fallen leaves and grit blown against the door and the wall
    { const n = 240, lm = new THREE.InstancedMesh(leafGeo, std({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 }), n); for (let k = 0; k < n; k++) { const nearDoor = k < 110, x = nearDoor ? (RD() - .5) * 4.2 : (RD() - .5) * 40, z = nearDoor ? .1 + Math.pow(RD(), 2) * 2.2 : .1 + Math.pow(RD(), 2.5) * 6;
        dm.position.set(x, .008 + RD() * .01, z); dm.rotation.set(-PI / 2 + (RD() - .5) * .5, 0, RD() * 6.28); dm.scale.setScalar(.05 + RD() * .07); dm.updateMatrix(); lm.setMatrixAt(k, dm.matrix); tcol.setRGB(.34 + RD() * .2, .2 + RD() * .14, .07 + RD() * .05); lm.setColorAt(k, tcol); } lm.receiveShadow = true; lm.frustumCulled = false; dayOnly.add(lm); }
    shadowLights.push([sun, 2], [sunIn, 0.5]); applyQ(Q);
    const N = { ground: groundM.color.clone(), pave: paveM.color.clone(), van: vanBodyM.color.clone(), glass: doorGlass.color.clone() };
    function setDay(on) {
      isDay = !!on; dayOnly.visible = isDay; for (const o of nightOnly) o.visible = !isDay; skyU.uDay.value = isDay ? 1 : 0; vanDayG.visible = isDay;
      groundM.userData.mirror.uPud.value = isDay ? 0 : 1; groundM.userData.mirror.uGloss.value = isDay ? 0 : 0.5; groundM.userData.mirror.uAmt.value = isDay ? 0 : 1; paveM.userData.mirror.uAmt.value = isDay ? 0 : 0.9; groundM.color.copy(N.ground).multiplyScalar(isDay ? 6.5 : 1); groundM.roughness = isDay ? 0.96 : 0.55;
      paveM.userData.mirror.uGloss.value = isDay ? 0 : 0.72; paveM.roughness = isDay ? 0.9 : 0.3; paveM.color.copy(N.pave).multiplyScalar(isDay ? 1.25 : 1);
      treeM.color.setRGB(isDay ? .34 : .03, isDay ? .4 : .04, isDay ? .36 : .06); lampLens.forEach(m => isDay ? m.color.setRGB(.5, .5, .46) : m.color.setRGB(6, 3.2, 1)); lampSpots.forEach((l, k) => { l.intensity = isDay ? 0 : s0[k]; });
      flyer.material = isDay ? flyerDayM : flyerM; for (const pv of tabPivs) pv.visible = !isDay; flyer.rotation.z = isDay ? -0.09 : 0.035;
      van.position.y = isDay ? -0.1 : 0; van.rotation.z = isDay ? 0.022 : 0; vanBodyM.color.copy(N.van); if (isDay) vanBodyM.color.multiplyScalar(0.82); vanBodyM.roughness = isDay ? 0.7 : 0.32; vanBodyM.clearcoat = isDay ? 0.1 : 1;
      for (const m of [vanLogoM, ...vanLogoM.userData.more]) { m.opacity = isDay ? 0.6 : 1; m.color.setScalar(isDay ? 0.9 : 1); }
      doorGlass.opacity = isDay ? 0.2 : 0.2; doorGlass.roughness = isDay ? 0.45 : 0.06; if (isDay) doorGlass.color.set(0x3d3a30); else doorGlass.color.copy(N.glass);
      if (isDay) { tubeM.color.setRGB(.25, .26, .25); tubeL.intensity = 0; signL.intensity = 0; hazL.intensity = 0; for (const m of haz) m.color.setRGB(.12, .06, .02); ledM.color.setRGB(0, 0, 0); }
    }
    const hn = noise2(77), _wp = new V3(), _t = new V3(); let buzzNext = 0;
    /* s: { see: V3 the door camera looks at (or null), turn: 0..1 how far it has turned to it, led: 0..1 } */
    function update(t, s) {
      if (isDay) { updateDay(t, s); return; }
      // the flyer breathes in the wind; its tabs flutter
      { const p = flyerG.attributes.position; for (let i = 0; i < p.count; i++) { const x = fBase[i * 3], y = fBase[i * 3 + 1], u = x / FW + .5, v = (y + FH * .5) / FH; const curl = Math.pow(Math.abs(u - .5) * 2, 2.2) * -0.012 + Math.sin(u * 7 + v * 3) * .0012; const free = 1 - ss((v - .55) / .45); p.setZ(i, curl + free * (Math.sin(t * 5.2 + u * 4) * .0025 + Math.sin(t * 2.1 + v * 6) * .004 + .006 * (1 - v))); } p.needsUpdate = true; flyerG.computeVertexNormals();
        for (const tb of tabs) { const q = tb.g.attributes.position, gust = .5 + .5 * Math.sin(t * 1.3 + 1) * Math.sin(t * .7); for (let i = 0; i < q.count; i++) { const y = tb.base[i * 3 + 1], k = -y / (FH * 120 / 724); q.setZ(i, k * k * (.012 + tb.amp * gust * .016 * (1 + Math.sin(t * 9 + tb.ph)) + .006 * Math.sin(t * 17 + tb.ph * 2))); } q.needsUpdate = true; tb.g.computeVertexNormals(); } }
      // the tube under the canopy stutters now and then; the sign hums, and two of its letters dip and come back
      const dipA = hn(t * 1.7, 40) > 0.86 && hn(t * 37, 41) > 0.45, buzz = (1 - .05 * hn(t * 31, 3)) * (dipA ? .35 : 1);
      tubeM.color.setRGB(7 * buzz, 7.8 * buzz, 8.6 * buzz); tubeL.intensity = 70 * buzz; tubeGlow.material.opacity = buzz;
      if (t >= buzzNext || t < buzzNext - 1) { buzzNext = t + 0.05 + hn(t * 13, 50) * 0.09; let ch = false; SG.buzz.forEach((i, k) => { const slow = hn(t * 0.55 + k * 9.1, 60 + k), fast = hn(t * 19 + k * 3.3, 70 + k); const v = slow > 0.52 ? (fast > 0.5 ? 0.38 : fast > 0.3 ? 0.62 : 1) : 1; if (v !== dim.get(i)) { dim.set(i, v); ch = true; } }); if (ch) drawSign(); }
      const sb = 1 - .06 * hn(t * 23, 8); signM.color.setRGB(2.6 * sb, 2.6 * sb, 2.6 * sb); signL.intensity = 5 * sb;
      const ph = (t + .25) % 0.84, hz = ph < .42 ? Math.min(1, ph / .05) : Math.max(0, 1 - (ph - .42) / .09); for (const m of haz) m.color.setRGB(6 * hz, 2.3 * hz, .15 * hz); hazL.intensity = 1.6 * hz; for (const g of hazG) g.scale.setScalar(.01 + 0.9 * hz);
      hazL.getWorldPosition(_wp); rain.material.uniforms.uHz.value.set(_wp.x, _wp.y, _wp.z, 2.2 * hz);
      // the camera by the door
      const k = s && s.see ? clamp(s.turn, 0, 1.2) : 0; let yaw = 0.9, pit = 0.45;
      if (s && s.see) { camPiv.getWorldPosition(_wp); _t.copy(s.see).sub(_wp); yaw = mix(0.9, Math.atan2(_t.x, _t.z), k); pit = mix(0.45, -Math.atan2(_t.y, Math.hypot(_t.x, _t.z)), k); }
      camPiv.rotation.y = yaw; camHead.rotation.x = pit;
      const on = s ? s.led || 0 : 0; ledM.color.setRGB(10 * on, .3 * on, .15 * on); ledGlow.scale.setScalar(.001 + .13 * on);
    }
    function updateDay(t, s) {      // s: { sign: 0..1 how lit the sign is, shaft: 0..1 how strong the light through the door }
      const on = s && s.sign || 0, sb = on * (1 - .06 * hn(t * 23, 8)); signM.color.setRGB(.05 + 2.75 * sb, .05 + 2.75 * sb, .05 + 2.75 * sb); signL.intensity = 3 * sb; signGlow.visible = on > 0.5; signGlow.material.opacity = 0.06;
      { const p = flyerG.attributes.position; for (let i = 0; i < p.count; i++) { const x = fBase[i * 3], y = fBase[i * 3 + 1], u = x / FW + .5, v = (y + FH * .5) / FH; p.setZ(i, Math.pow(Math.abs(u - .5) * 2, 2.2) * -0.012 + (1 - ss((v - .45) / .5)) * (Math.sin(t * 3.1 + u * 4) * .004 + .012 * (1 - v))); } p.needsUpdate = true; flyerG.computeVertexNormals(); }
      const k = s && s.shaft != null ? s.shaft : 1; for (const [m, a] of shafts) m.material.opacity = a * k * (.9 + .1 * Math.sin(t * .7 + a * 90)); camPiv.rotation.y = 0.9; camHead.rotation.x = 0.62;
    }
    return { world, still, mirrors: [ground, pave], env, envDay, setDay, sun, sunIn, fillIn, get day() { return isDay; }, leaf, update, lampLights: shadowLights.filter(l => l[0] !== tubeL).map(l => l[0]), tubeL, rain: [rain, drips], camPiv, flyerAt: new V3(FX, FY, FZ), lamp: new V3(L1[0], L1[1], L1[2]), van, signText: SG.text };
  }

  return { render, mirrorize, buildExterior, setQuality, perf, get quality() { return qName; }, QUALS, U };
}
