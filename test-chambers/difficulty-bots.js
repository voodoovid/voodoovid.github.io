/* Test Chambers: the Difficulty Check robots (v8.40, Batch J step 1, Nov 25, 2026; v8.46 adds Water Feature's three robots, which the page does not show: it stops at room 38).
   Used by difficulty.html, which loads the game in a hidden frame with ?diffcheck (no frame loop, no lift rides, its own saves) and
   drives it one physics step at a time. One file for the page and for the headless runs, so both run the same robots.
   - DIFF_BOTS.install(win): puts the robot's hands, B, into the game's window (walk, aim, fire, use, step...).
   - solve[room]: a real solving robot. A STEP is one portal shot, one grab or drop (or press), or one trip through a portal or on a pad.
     Walking is not a step. B.stops records where the robot stood for each step (the Choices column looks from there).
   - shortcut[room]: a robot that tries a way round the puzzle. `skipped: true` means it got out without solving the room.
     (Mirror Test's checks the opposite: `ok: true` means the door held while the sentry worked.)
   - first[room] (v8.45): a robot that tries the obvious plan. Green when the plan fails and the room can still be finished without restarting. */
(function (root) {
  function install(win) {
    win.B = (() => {
      const T = () => win.__tc;
      const B = { t: 0, log: [], steps: 0, shots: [], stops: [] };
      B.load = (name) => {
        const tc = T(), i = tc.names.indexOf(name); if (i < 0) throw new Error('no room ' + name);
        tc.startLevel(i, true); tc.state = 'play'; B.t = 0; B.steps = 0; B.log = []; B.shots = []; B.stops = [];
        tc.player.hp = 100; tc.run.sinceHit = 99; tc.run.deaths = 0;
        return i;
      };
      B.pl = () => T().player;
      B.at = () => { const p = T().player.p; return [+p.x.toFixed(2), +(p.y - 0.9).toFixed(2), +p.z.toFixed(2)]; };
      B.P = c => [c.p.x, c.p.y, c.p.z].map(v => +v.toFixed(2));
      B.count = label => { B.steps++; B.log.push(label); B.stop(); };
      B.stop = () => { const p = T().player.p; B.stops.push([p.x, p.y + 0.7, p.z]); };
      B.step = (sec, until) => {
        const tc = T(), dt = 1 / 120; let n = Math.round(sec / dt);
        for (let k = 0; k < n; k++) {
          if (tc.state === 'done' || tc.state === 'results') return 'done';
          tc.physicsStep(dt); B.t += dt;
          if (k % 2) {
            tc.hazards(dt * 2, B.t);
            tc.run.sinceHit = (tc.run.sinceHit || 0) + dt * 2;
            if (tc.state === 'play' && tc.run.sinceHit > 3) tc.player.hp = Math.min(100, tc.player.hp + 28 * dt * 2);
          }
          if (k % 4 === 0 && tc.Items && tc.Items.tick) try { tc.Items.tick(dt * 4); } catch (e) {}
          if (until && until()) return 'until';
        }
        return tc.state;
      };
      B.aim = (x, y, z) => {
        const p = T().player, e = [p.p.x, p.p.y + 0.7, p.p.z], d = [x - e[0], y - e[1], z - e[2]], l = Math.hypot(...d);
        p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.asin(d[1] / l);
      };
      B.face = (x, z) => { const p = T().player; p.yaw = Math.atan2(-(x - p.p.x), -(z - p.p.z)); p.pitch = 0; };
      B.fire = (idx, x, y, z) => {
        const tc = T(); B.stop(); B.aim(x, y, z); const before = tc.portals[idx].on && tc.portals[idx].o.clone();
        tc.firePortal(idx); B.step(0.3);
        const P = tc.portals[idx], ok = P.on && (!before || P.o.distanceTo(before) > 0.01);
        B.steps++; B.log.push('shot ' + (idx ? 'orange' : 'blue') + ' ' + (ok ? 'ok' : 'FAIL') + ' @' + (P.on ? [P.o.x, P.o.y, P.o.z].map(v => v.toFixed(1)).join(',') : '-'));
        if (ok) B.shots.push([P.o.x, P.o.y, P.o.z]);
        return ok;
      };
      B.walk = (x, z, o = {}) => {
        const tc = T(), p = tc.player, lim = o.time || 12; let t = 0;
        const r = o.r || 0.25;
        while (t < lim) {
          const dx = x - p.p.x, dz = z - p.p.z, d = Math.hypot(dx, dz);
          if (d < r) break;
          const want = Math.atan2(-dx, -dz);
          if (o.look === undefined) { p.yaw = want; tc.inp.fwd = Math.min(o.max || 1, d * 1.5 + 0.15); tc.inp.right = 0; }
          else { if (Array.isArray(o.look)) B.aim(...o.look); else if (o.look && o.look.p) B.aim(o.look.p.x, o.look.p.y + 0.2, o.look.p.z);
            const rel = want - p.yaw, s = Math.min(1, d * 1.5 + 0.15); tc.inp.fwd = Math.cos(rel) * s; tc.inp.right = -Math.sin(rel) * s;
          }
          if (o.jump && p.ground && t > (o.jumpAt || 0)) tc.inp.jumpQ = true;
          const st = B.step(1 / 30); t += 1 / 30;
          if (st === 'done' || st === 'dead' || tc.state === 'dead') break;
          if (o.until && o.until()) break;
        }
        tc.inp.fwd = tc.inp.right = 0; B.step(0.15);
        return tc.state;
      };
      B.hold = (fwd, right, sec, jump) => { const tc = T(); tc.inp.fwd = fwd; tc.inp.right = right; if (jump) tc.inp.jumpQ = true; const s = B.step(sec); tc.inp.fwd = tc.inp.right = 0; return s; };
      B.use = (label) => { const tc = T(); B.stop(); tc.useAction(); B.step(0.2); B.steps++; B.log.push('use ' + (label || '')); };
      B.deaths = () => T().run.deaths || 0;
      B.state = () => T().state;
      B.world = () => T().world;
      B.door = (id = 'd1') => { const d = T().world.doors.find(d => d.id === id); return d && +d.t.toFixed(2); };
      B.held = () => { const w = T().world; return [...w.cubes, ...(w.sentries || [])].find(c => c.held) || null; };
      // walk slowly toward (x, z) until `until` (a portal trip), then settle
      B.into = (x, z, until, sp = 0.5, max = 4) => { const tc = T(); B.face(x, z); tc.inp.fwd = sp; B.step(max, until); tc.inp.fwd = 0; B.step(0.8); };
      B.res = (r) => Object.assign(r, { state: B.state(), deaths: B.deaths(), steps: B.steps, log: B.log, hp: Math.round(B.pl().hp) });
      return B;
    })();
  }
  const solve = {
    "Doorway": function (B, tc) {
      const r = { tr: [] }; B.load('Doorway'); B.step(0.5); const pl = B.pl();
      B.walk(2.2, 3); B.walk(4.2, 1.6, { jump: true, time: 3 }); r.over = B.at();
      B.walk(5.5, 1.0); r.near = B.at();
      B.face(5.5, -2); tc.inp.fwd = 0.6; for (let i = 0; i < 20; i++) { B.step(0.1); r.tr.push(B.at().join(',')); if (pl.p.x > 12) break; } tc.inp.fwd = 0;
      B.count('walk through the held portals'); B.step(0.5); r.out = B.at();
      B.walk(20, 5); B.walk(26, 5, { time: 5 }); return B.res(r);
    },
    "One Way": function (B, tc) {
      const r = {}; B.load('One Way'); B.step(0.5);
      r.a = B.fire(0, 5.5, 1.2, 0.05);
      B.walk(5.5, 1.2); B.walk(5.5, -0.5, { time: 2, until: () => B.pl().p.x > 12 }); B.count('walk through'); B.step(0.5); r.out = B.at();
      B.walk(22, 5); B.walk(28, 5, { time: 5 }); return B.res(r);
    },
    "Line Of Sight": function (B, tc) {
      const r = {}; B.load('Line Of Sight'); B.step(0.5);
      B.walk(9, 5); r.a = B.fire(1, 20.35, 1.4, 1.9); r.b = B.fire(0, 6.5, 1.2, 0.05);
      B.walk(6.5, 1.2); B.walk(6.5, -0.5, { time: 2, until: () => B.pl().p.x > 13 }); B.count('walk through'); B.step(0.5); r.out = B.at();
      B.walk(20, 5); B.walk(26, 5, { time: 5 }); return B.res(r);
    },
    "Delivery": function (B, tc) {
      const r = {}; B.load('Delivery'); B.step(0.5); const c = B.world().cubes[0], pl = B.pl();
      B.walk(8, 8.4); r.a = B.fire(1, 0.05, 1.2, 8.4); B.walk(5, 3); r.b = B.fire(0, 5, 0.02, 4.6);
      B.into(5, 6, () => pl.p.x < 4.2 && pl.p.z > 6.6); B.count('through the floor into the cube room'); r.in = B.at();
      B.walk(c.p.x + 1.1, c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.face(-3, 8.4); tc.inp.fwd = 0.5; B.step(4, () => pl.p.x > 4.5); B.face(8, 2.5); tc.inp.fwd = 1; B.step(0.7); tc.inp.fwd = 0; B.step(0.5); B.count('back out with it'); r.back = B.at(); r.held1 = !!B.held();
      B.walk(7, 4); r.c = B.fire(1, 20, 1.2, 0.05); r.d = B.fire(0, 7, 1.2, 0.05);
      B.walk(7, 2); B.into(7, -3, () => pl.p.x > 15); B.walk(20, 4); B.face(22, 6); tc.inp.fwd = 1; B.step(0.6); tc.inp.fwd = 0; B.step(0.4); B.count('across the pit'); r.over = B.at(); r.held2 = !!B.held();
      B.walk(20, 6.4); B.aim(20, 0.2, 5); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      B.walk(23, 5); B.walk(28, 5, { time: 5 }); return B.res(r);
    },
    "Drop Box": function (B, tc) {
      const r = {}; B.load('Drop Box'); B.step(0.5); const c = B.world().cubes[0];
      B.walk(17, 4); r.a = B.fire(1, 17, 2.49, 8.3);
      B.walk(c.p.x + 1.1, c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      B.walk(6, 3.4, { look: [6, 0, 5] }); B.aim(6, 0.1, 4.9); B.step(0.3); B.use('drop the crate into the held floor portal'); B.step(2); r.c = B.P(c); r.door = B.door();
      B.walk(23, 5); B.walk(30, 5, { time: 5 }); return B.res(r);
    },
    "Freefall": function (B, tc) {
      const r = {}; B.load('Freefall'); B.step(0.5); const pl = B.pl();
      B.walk(5, 3.2, { r: 0.08 }); r.a = B.fire(0, 5, 0.02, 6.2); r.b = B.fire(1, 0.05, 9, 7); B.face(5, 9); tc.inp.fwd = 0.3; B.step(2, () => !pl.ground && pl.p.y < 13.9); tc.inp.fwd = 0; pl.v.set(0, pl.v.y, 1.2);
      B.step(3, () => pl.p.x > 1 && pl.v.x > 5); B.count('fall into the floor, fly across'); B.step(3); r.land = B.at();
      B.walk(30, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Lift": function (B, tc) {
      const r = {}; B.load('Lift'); B.step(0.5); const pl = B.pl();
      B.walk(2.8, 4, { r: 0.08 }); r.a = B.fire(0, 4.8, 0.02, 4); r.b = B.fire(1, 8.4, 3.02, 4); B.face(9, 4); tc.inp.fwd = 0.3; B.step(2, () => !pl.ground && pl.p.y < 7.9); tc.inp.fwd = 0; pl.v.set(1.9, pl.v.y, 0);
      B.step(3, () => pl.v.y > 5 && pl.p.y > 3); B.count('fall into the floor, rise out of the block'); pl.v.x = 1.6; B.step(2.5); r.land = B.at();
      B.walk(17, 4, { time: 5 }); return B.res(r);
    },
    "Special Delivery": function (B, tc) {
      const r = {}; B.load('Special Delivery'); B.step(0.5); const pl = B.pl(), c = B.world().cubes[0];
      B.walk(5, 3.2, { r: 0.08 }); r.a = B.fire(0, 5, 0.02, 6.2); r.b = B.fire(1, 0.05, 9, 7);
      B.walk(5.4, 1.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(5, 3.2, { r: 0.08 }); B.face(5, 9); pl.pitch = 0; tc.inp.fwd = 0.3; B.step(2, () => !pl.ground && pl.p.y < 13.9); tc.inp.fwd = 0; pl.v.set(0, pl.v.y, 1.2);
      B.step(3, () => pl.p.x > 1 && pl.v.x > 5); B.count('fall with the crate, fly across'); B.step(3); r.land = B.at(); r.held2 = !!B.held(); r.c = B.P(c);
      B.walk(24.8, 6); B.aim(26, 0.2, 6); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      r.c2 = B.P(c); B.walk(25, 8.5); B.walk(29, 8); B.walk(30, 6); r.p30 = B.at(); B.walk(36, 6, { time: 5 }); r.end = B.at(); r.doors = B.world().doors.map(d => d.id + ':' + d.t.toFixed(2) + ':' + d.box.min.map(v=>v.toFixed(1)) + '>' + d.box.max.map(v=>v.toFixed(1))); r.plates = B.world().plates.map(p => JSON.stringify(Object.keys(p))); return B.res(r);
    },
    "Redirect": function (B, tc) {
      const r = {}; B.load('Redirect'); B.step(0.5); const pl = B.pl();
      B.walk(8, 6); r.a = B.fire(0, 14.95, 1.5, 2); r.b = B.fire(1, 0.05, 1.5, 10); B.step(1.5); r.d0 = B.door('d0');
      B.walk(14, 6); B.walk(17.5, 6); B.walk(20, 8); r.c = B.fire(1, 16.05, 1.5, 10); B.step(1.5); r.d1 = B.door('d1');
      B.walk(28, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Sentry Duty": function (B, tc) {
      const r = {}; B.load('Sentry Duty'); B.step(0.5); const c = B.world().cubes[0];
      B.walk(c.p.x - 1.1, c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      for (const [x, z] of [[7, 11.4], [14.5, 11.4], [14.6, 4.6], [19, 4.2], [21, 2.4]]) B.walk(x, z);
      B.walk(26, 3.2); B.aim(27, 0.2, 2.5); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      B.walk(28.5, 6); B.walk(34, 6, { time: 5 }); r.hpMin = 0; return B.res(r);
    },
    "Heavy Lifting": function (B, tc) {
      const r = {}; B.load('Heavy Lifting'); B.step(0.5); const pl = B.pl(), w = B.world(), c = w.cubes[0], S = w.sentries[0];
      B.walk(24, 10); r.a = B.fire(0, 26, 1.2, 11.95);
      B.walk(26, 10.8); B.into(26, 14, () => pl.p.z < 6); B.count('through the held doorway'); r.in = B.at();
      B.walk(S.p.x + 1.2, S.p.z); B.aim(S.p.x, S.p.y + 0.3, S.p.z); B.use('pick up the sentry'); r.heldS = !!B.held();
      B.walk(22, 2.6); B.face(22, -5); B.step(0.3); B.use('put it on a plate, facing the wall'); B.step(2); r.S = S.state + ' ' + B.P(S);
      B.walk(c.p.x + 1.2, c.p.z + 0.5); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      B.walk(20.8, 4.5); B.aim(22, 0.2, 4.5); B.step(0.3); B.use('put on the second plate'); B.step(1); r.door = B.door();
      B.walk(27, 3); B.walk(34, 3, { time: 5 }); return B.res(r);
    },
    "Air Mail": function (B, tc) {
      const r = {}; B.load('Air Mail'); B.step(0.5); const pl = B.pl(), c = B.world().cubes[0];
      B.walk(c.p.x - 1.1, c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      B.walk(3, 6, { look: [6, 1, 6] }); B.face(8, 6); tc.inp.fwd = 0.6; B.step(1.5, () => pl.p.y > 1.2); tc.inp.fwd = 0; B.count('ride the pad with the crate'); B.step(2.5); r.isl = B.at(); r.held = !!B.held();
      B.walk(20, 4.2, { look: [20, 0, 2.6] }); B.aim(20, 0.3, 2.6); B.step(0.3); B.use('drop the crate on the second pad'); B.step(3); r.c = B.P(c); r.door = B.door();
      B.walk(26, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Reset": function (B, tc) {
      const r = {}; B.load('Reset'); B.step(0.5); const pl = B.pl(), c = B.world().cubes[0];
      B.walk(9, 7); r.a = B.fire(1, 18, 0.02, 7.2); r.b = B.fire(0, 8, 1.2, 0.05);
      B.walk(c.p.x + 1.1, c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      B.walk(8, 1.6); B.face(8, -3); tc.inp.fwd = 0.5; B.step(4, () => pl.p.x > 15); B.face(18, 10.5); tc.inp.fwd = 1; B.step(0.6); tc.inp.fwd = 0; B.step(0.6); B.count('through the wall, out of the far floor'); r.far = B.at(); r.held = !!B.held();
      B.walk(20.8, 9.4); B.walk(22, 7.3, { look: [22, 0, 6] }); B.aim(22, 0.2, 6); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      B.walk(25, 9); B.walk(28, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Scales": function (B, tc) {
      const r = {}; B.load('Scales'); B.step(0.5); const pl = B.pl(), w = B.world();
      r.cams = (w.cams || []).map(k => Object.keys(k).join(',')).slice(0, 1);
      B.walk(8, 7); r.a = B.fire(0, 12, 5.3, 13.95); B.step(2.5);
      const k = (w.camProps || [])[0]; r.k = k && B.P(k);
      if (k) { B.walk(k.p.x, k.p.z - 1.2); B.aim(k.p.x, k.p.y, k.p.z); B.use('pick up the camera'); }
      r.held = !!(k && k.held);
      B.walk(16, 4); r.b = B.fire(1, 23.5, 6, 0.05); r.c = B.fire(0, 15, 0.02, 2.5);
      B.walk(15, 4.2); B.face(15, 0); pl.pitch = 0; tc.inp.fwd = 0.4; B.step(3, () => pl.p.x > 20); tc.inp.fwd = 0; B.step(1.5); B.count('fall in, out high over the ledge'); r.up = B.at(); r.held2 = !!(k && k.held);
      B.walk(24.4, 9.8, { look: [24.4, 4, 11.5] }); B.aim(24.4, 4.2, 11.5); B.step(0.3); B.use('put it on the scale'); B.step(1); r.door = B.door();
      B.walk(25, 7); B.walk(30, 7, { time: 5 }); return B.res(r);
    },
    "Upside": function (B, tc) {
      const r = {}; B.load('Upside'); B.step(0.5); const pl = B.pl(), c = B.world().cubes[0];
      B.walk(11, 6); r.a = B.fire(0, 16, 7.98, 6); r.b = B.fire(1, 0.05, 1.5, 9);
      B.walk(9, 4); B.walk(9, 6, { time: 2 }); B.count('step on the gravity panel'); B.step(3); r.c = B.P(c);
      B.walk(9, 3); B.step(2); r.c2 = B.P(c);
      B.walk(c.p.x + (c.p.x < 2 ? 1.1 : -1.1), c.p.z); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(13, 2.5); B.walk(20, 2.5); B.walk(21.8, 6, { look: [23, 0, 6] }); B.aim(23, 0.2, 6); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      B.walk(24.5, 9); B.walk(26, 6); B.walk(32, 6, { time: 5 }); return B.res(r);
    },
    "Mirror Test": function (B, tc) {
      const r = {}; B.load('Mirror Test'); B.step(0.5); const S = B.world().sentries[0];
      r.a = B.fire(0, 16.5, 1.4, 0.05); r.b = B.fire(1, 28.5, 1.4, 11.95);
      B.step(12, () => S.state !== 'on');      // (waiting while it shoots itself is not a step) r.S = S.state; r.door = B.door(); r.t = +B.t.toFixed(1);
      B.walk(26, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    // ---- v8.45 (Batch J step 5): rooms 31 to 38
    "Walkway": function (B, tc) {
      const r = {}; B.load('Walkway'); B.step(0.5); const w = B.world(), c = w.cubes[0];
      B.walk(5, 6); r.A = B.fire(0, 6, 1.2, 11.95); r.B = B.fire(1, 0.05, 1.2, 3); B.step(0.5);
      B.walk(5, 3); B.walk(19.6, 3, { time: 8 }); B.walk(19.6, 0.8); B.walk(21.8, 0.8); B.walk(22, 4.4); r.pier = B.at();
      r.A2 = B.fire(0, 20.85, 1.2, 2.5); B.step(0.5);                                             // the blue end moves to where the second light lands
      B.walk(21.8, 0.8); B.walk(19.6, 0.8); B.walk(19.6, 3); B.walk(5, 3, { time: 8 });
      B.walk(3.9, 8.3); B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate off the meter'); r.held = !!B.held(); B.step(0.5); r.firstLightOut = !w.walks[0].segs.length;
      B.walk(5, 3); B.walk(19.6, 3, { time: 8 }); B.walk(19.6, 0.8); B.walk(21.8, 0.8); B.walk(21.8, 4.6); B.walk(23.1, 4.65);
      r.X2 = B.fire(1, 20.85, 1.2, 4.65); B.step(0.5); B.walk(35.5, 4.65, { time: 8 }); r.far = B.at();
      B.walk(34.8, 10.6); r.X3 = B.fire(1, 37.55, 1.2, 10.6); B.step(0.5); B.walk(27.5, 10.6, { time: 8 }); r.shelf = B.at(); r.held2 = !!B.held();
      B.walk(25.6, 10.4); B.aim(24.4, 0.3, 10.2); B.step(0.3); B.use('put it on the button'); B.step(1); r.door = B.door();
      B.walk(26, 11); B.walk(26, 15.5, { time: 5 }); return B.res(r);
    },
    "Updraft": function (B, tc) {
      const r = {}; B.load('Updraft'); B.step(0.5); const w = B.world(), c = w.cubes[0], pl = B.pl();
      B.walk(6, 8); r.a = B.fire(0, 3, 11.95, 10.5); r.b = B.fire(1, 14, 9, 11.95); B.step(0.5);
      B.walk(c.p.x + 1.1, c.p.z - 0.3); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(4.6, 9.6); B.aim(3, 1.0, 10.5); B.step(0.4); B.use('let the stream take the crate'); B.step(10, () => c.p.z < 1.9); r.cIn = B.P(c);
      B.walk(3, 10.5, { time: 3, until: () => !pl.ground }); B.count('ride the stream up to the cell window'); B.step(12, () => pl.p.z < 3.6 && pl.p.y > 8); B.step(1.5); r.window = B.at();
      r.c = B.fire(1, 26.4, 4.05, 1.9); B.step(4); r.fell = B.at(); r.door = B.door();
      B.walk(6, 8); B.walk(3, 10.5, { time: 4, until: () => !pl.ground }); B.count('ride it again, out of the ledge floor'); B.step(12, () => pl.p.x > 20); B.step(1.5);
      B.walk(28.5, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Primer": function (B, tc) {
      const r = {}; B.load('Primer'); B.step(2.5); const w = B.world(), c = w.cubes[0], pl = B.pl();
      B.walk(7, 8); r.a = B.fire(0, 4, 0.05, 9); B.walk(11.4, 3.6); r.b = B.fire(1, 10.05, 6, 0.8); B.step(4);      // a high throw from the pillar: the tall slab
      r.c = B.fire(1, 21.25, 7.2, 1.55); B.step(4);                                                    // from the tall slab: the block
      r.d = B.fire(1, 21.6, 4.2, 10.45); B.step(0.5);
      B.walk(6.2, 9); B.into(4, 9, () => pl.p.x > 15, 0.5, 4); B.count('into the floor, out of the block, down into the pocket'); B.step(1); r.pocket = B.at();
      B.walk(c.p.x + 0.2, c.p.z + 1.2); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(19.5, 6); r.e = B.fire(1, 23.9, 4.2, 10.45); r.f = B.fire(0, 21.25, 1.2, 1.55);
      B.walk(21.25, 3.2); B.into(21.25, 0, () => pl.p.y > 2.5, 0.5, 4); B.count('through the slab onto the ledge'); B.step(0.6); r.ledge = B.at(); r.held2 = !!B.held();
      B.walk(25, 8); B.walk(27, 4.4); B.aim(27, 3.3, 3); B.step(0.3); B.use('put on the button'); B.step(1); r.door = B.door();
      B.walk(28.5, 6); B.walk(34, 6, { time: 5 }); return B.res(r);
    },
    "Crate Seven": function (B, tc) {
      const r = {}; B.load('Crate Seven'); B.step(0.5); const w = B.world(), c = w.cubes[0], pl = B.pl();
      B.walk(8, 7); r.far = B.fire(1, 25.95, 1.2, 6); r.near = B.fire(0, 6.75, 1.2, 11.95);
      B.walk(4.6, 7.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(6.75, 10.6); B.walk(6.75, 12.4, { time: 2, until: () => pl.p.x > 20 }); B.count('through the wall with the crate'); B.step(0.3); r.held2 = !!B.held();
      B.walk(21.4, 4.4); B.aim(20, 0.3, 4.4); B.step(0.3); B.use('put on the first slow button'); B.step(0.3);
      B.walk(18.5, 8.6); r.up = B.fire(0, 27.75, 3.95, 11.95);
      B.walk(20, 7.6, { r: 0.15 }); B.step(3.8); r.charged = B.door();
      B.walk(24.5, 6); B.walk(26.5, 6, { time: 2, until: () => pl.p.y > 3 }); B.count('through the foot of the ledge, out on top'); B.step(0.2); r.ledge = B.at();
      B.walk(29, 6); B.walk(34, 6, { time: 3 }); return B.res(r);
    },
    "The Last Word": function (B, tc) {
      const r = {}; B.load('The Last Word'); B.step(0.5); const w = B.world(), c = w.cubes[0], S = w.sentries[0], pl = B.pl();
      B.walk(12, 4.9); B.walk(15, 4.9); B.walk(17, 0.6); B.walk(27.6, 0.6); B.walk(27.6, 6.5); B.walk(26.9, 8.0);
      B.aim(S.p.x, S.p.y, S.p.z); B.use('pick up the sentry from behind'); r.heldS = B.held() === S;
      B.walk(33, 2.2, { max: 0.7 }); B.aim(33, 0.8, 0); B.step(0.3); B.use('park it facing a wall'); B.step(3);
      B.walk(27, 5); B.walk(15, 6); B.walk(12, 6); B.walk(5, 2.43);
      r.f1 = B.fire(1, 25.95, 1.2, 10.75); r.n2 = B.fire(0, 5.75, 1.2, 0.05);
      B.walk(4.3, 2.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); r.held = !!B.held();
      B.walk(5.75, 1.6); B.walk(5.75, -0.5, { time: 2, until: () => pl.p.x > 20 }); B.count('through the wall into the cell'); B.step(0.3); r.held2 = !!B.held();
      B.aim(24.3, 0.3, 9.9); B.step(0.3); B.use('crate on the button'); B.step(0.6);
      B.walk(25.2, 10.75); B.walk(26.5, 10.75, { time: 2, until: () => pl.p.x < 10 }); B.count('back out of the cell'); B.step(0.3);
      B.walk(11, 6); B.walk(16, 6);
      B.walk(21.5, 9.5); r.b1 = B.fire(0, 25.95, 1.4, 10.75); B.walk(17, 6.9); r.b2 = B.fire(1, 0.05, 1.2, 8); B.step(1); r.door = B.door();
      B.walk(34, 6); B.walk(40, 6, { time: 4 }); return B.res(r);
    },
    "Cold Storage": function (B, tc) {
      const r = {}; B.load('Cold Storage'); B.step(0.5); const w = B.world(), S = w.sentries[0], F = w.cubes[0], pl = B.pl();
      B.walk(5, 9.0); B.aim(S.p.x, S.p.y, S.p.z); B.use('pick up the sentry from behind'); r.held = !!B.held();
      B.walk(8.5, 9.5, { r: 0.15 }); B.count('stand on the pump button: the float comes back');
      r.a = B.fire(0, 0.05, 1.3, 5.75); B.walk(11.6, 8.4); r.booth = B.fire(1, 13.55, 2.2, 4.0); B.step(5);
      B.walk(1.2, 5.75); B.walk(-0.5, 5.75, { time: 2, until: () => pl.p.x > 10 }); B.count('through the wall into the booth'); B.step(0.4);
      B.walk(13.15, 2.95, { r: 0.1 }); B.aim(13.15, 0.9, 1.3); B.step(0.5); B.use('set the sentry on the float, facing the wall'); B.step(1.5);
      B.walk(13.15, 3.8); B.walk(14.2, 3.8, { time: 2, until: () => pl.p.x < 5 }); B.count('back out of the booth'); B.step(0.4);
      B.walk(8.5, 9.5, { r: 0.15 }); B.count('the pump button again: the float goes over');
      B.walk(14, 10.5); B.walk(18, 10.5); B.walk(25, 8.5); B.walk(28, 5); B.walk(28, 1.2);
      B.step(8, () => F.p.x > 21.1); B.step(0.5); B.walk(23.2, 1.2); r.hpDock = Math.round(pl.hp);
      B.aim(S.p.x, S.p.y, S.p.z); B.use('lift the sentry off'); r.held2 = !!B.held();
      B.walk(27.6, 1.2); B.walk(28, 8.2, { look: [28, 1, 20] }); B.aim(29, 0.3, 9.5); B.step(0.3); B.use('sentry on the button'); B.step(1); r.door = B.door();
      B.walk(31, 6); B.walk(38, 6, { time: 5 }); return B.res(r);
    },
    "Retrieval": function (B, tc) {
      const r = {}; B.load('Retrieval'); B.step(0.5); const w = B.world(), c = w.cubes[0], pl = B.pl();
      B.walk(4, 9); r.s1 = B.fire(0, 6, 1.1, 11.95); r.s2 = B.fire(1, 0.05, 1.1, 9); B.step(0.5);
      B.walk(3, 9); B.walk(16, 9, { time: 6 }); B.walk(19.5, 9, { time: 4 }); r.cell = B.at();
      B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate'); r.held = !!B.held();
      B.walk(20, 8.6); r.s3 = B.fire(0, 18.05, 1.1, 10.4); B.walk(20.3, 9); r.s4 = B.fire(1, 0.05, 1.1, 9);
      B.walk(19.2, 10.4); B.walk(17.5, 10.4, { time: 2, until: () => pl.p.x < 6 }); B.count('out through the cell wall with the crate'); B.step(0.4); r.held2 = !!B.held();
      B.walk(4, 6); r.s5 = B.fire(0, 6, 1.1, 11.95); r.s6 = B.fire(1, 0.05, 1.1, 3); B.step(0.5);
      B.walk(3, 3); B.walk(29.5, 3, { time: 8 }); r.held3 = !!B.held();
      B.walk(30.2, 8.4); B.aim(31, 0.3, 9.6); B.step(0.3); B.use('crate on the button'); B.step(1); r.door = B.door();
      B.walk(32, 6); B.walk(37, 6, { time: 5 }); return B.res(r);
    },
    "Gauntlet": function (B, tc) {
      const r = {}; B.load('Gauntlet'); B.step(0.5); const w = B.world(), c = w.cubes[0], [S1, S2, S3] = w.sentries, pl = B.pl();
      B.walk(3, 7.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate'); B.walk(4.6, 6); B.aim(6, 0.6, 6); B.step(0.4); B.use('crate onto the pad'); B.step(3); r.S1 = S1.state;
      B.walk(6, 6, { time: 3, until: () => !pl.ground }); B.count('ride the pad'); B.step(2.2); r.terrace = B.at();
      B.walk(21.75, 3.6); r.s1 = B.fire(0, 21.75, 4.2, 0.05); B.walk(21.2, 4.3); r.s2 = B.fire(1, 39.95, 1.2, 9.3);
      B.walk(21.75, 2); B.walk(21.75, -0.5, { time: 3, until: () => pl.p.x > 30 }); B.count('through the terrace wall, out behind the pair'); B.step(0.4);
      B.walk(34.2, 5.0); B.aim(S2.p.x, S2.p.y, S2.p.z); B.use('take a sentry from behind'); r.gotS2 = !!B.held();
      B.walk(34.6, 2.9, { look: [34.6, 1, -20] }); B.aim(34.6, 0.5, 1.3); B.step(0.3); B.use('sentry on a button'); B.step(0.5);
      B.walk(35.5, 5); B.walk(34.2, 7.6); B.aim(S3.p.x, S3.p.y, S3.p.z); B.use('take the other'); r.gotS3 = !!B.held();
      B.walk(36.8, 2.9, { look: [36.8, 1, -20] }); B.aim(36.8, 0.5, 1.3); B.step(0.3); B.use('sentry on the other button'); B.step(0.5);
      B.walk(38, 6); B.walk(38.5, 9.35); B.walk(40.5, 9.35, { time: 3, until: () => pl.p.x < 30 }); B.count('back up to the terrace'); B.step(0.4);
      B.walk(21, 9); r.s3 = B.fire(0, 14, 1.2, 11.95); B.step(1); r.lit = !!w.receivers[0].lit;
      B.walk(23, 5.3); B.walk(26, 5.3, { time: 4 }); B.step(0.5); B.walk(34, 4.6);
      B.walk(37.5, 3); B.walk(44, 3, { time: 5 }); return B.res(r);
    },
    // v8.46: Water Feature [50]. Blue in the basin under the long fall, orange on the high panel, wait for the pond and the crate, then take the same fall
    "Water Feature": function (B, tc) {
  const r = {}; B.load('Water Feature'); B.step(0.5); const pl = B.pl(), W = B.world(), pond = W.pools[0], crate = W.cubes[0];
  B.walk(4.5, 6); r.blue = B.fire(0, 6.35, 0, 2.5);
  B.walk(12, 8); B.walk(22.3, 6.2); r.orange = B.fire(1, 20.5, 4.8, 2.5);
  let t = 0; while (t < 40 && !(pond.full && crate.p.x < 23.5 && crate.p.y < -0.2 && Math.hypot(crate.v.x, crate.v.z) < 0.3)) { B.step(0.25); t += 0.25; } r.fillWait = t; r.crate = B.P(crate); r.level = +pond.y.toFixed(2);
  B.walk(21.3, 12.4); B.aim(crate.p.x, crate.p.y, crate.p.z); B.use('take the crate'); r.held = !!B.held();
  B.walk(6.2, 8.5); B.walk(6.4, 5.8); B.walk(19.6, 5.8, { time: 14 }); r.top = B.at();
  B.walk(19.6, 4.4); B.walk(11.8, 4.4); B.walk(10.2, 2.5); r.bowl = B.at();
  B.face(0, 2.5); tc.inp.fwd = 0.7; B.step(6, () => pl.p.x > 21); tc.inp.fwd = 0; B.count('the fall through both portals');
  B.step(2.5); r.landed = B.at(); r.held2 = !!B.held();
  B.walk(29.6, 9.6); B.aim(29.6, 0.7, 11.6); B.step(0.3); B.use('crate on the button'); B.step(1); r.door = B.door('d1'); r.cr2 = B.P(crate);
  B.walk(32.5, 12.5); B.walk(32.5, 17.5, { time: 6 }); return B.res(r);
    }
  };
  const shortcut = {
    // v8.46: Water Feature. A running jump from the bank, and one from the top pond step, toward the deck. `skipped` if either gets there
    "Water Feature": { what: "running jumps across the pond, from the gap in the balustrade and from the top step", run: function (B, tc) {
      const pl = B.pl(), r = { tries: [] }, tp = (x, y, z) => { pl.p.set(x, y + 0.92, z); pl.v.set(0, 0, 0); B.step(1 / 120); pl.p.set(x, y + 0.92, z); pl.v.set(0, 0, 0); B.step(0.3); };
      B.load('Water Feature'); B.step(0.5);
      for (const [sx, sz, jx] of [[20.5, 11.4, 23.4], [20.5, 11.4, 23.75], [20.5, 11.4, 23.9], [20.5, 11.4, 24.0], [24.3, 11.85, 24.6], [24.3, 11.85, 24.88]]) {
        tp(sx, 0, sz); B.face(40, sz); tc.inp.fwd = 1; let jumped = false;
        for (let k = 0; k < 360; k++) { if (!jumped && pl.p.x > jx) { tc.inp.jumpQ = true; jumped = true; } B.step(1 / 120); if (jumped && pl.ground && k > 60) break; }
        tc.inp.fwd = 0; B.step(1.5); r.tries.push(B.at()); if (pl.p.x > 27.9 && pl.p.y > 1.4) r.skipped = true;
      }
      r.steps = r.tries.length; return r; } },
    "Delivery": { what: "Grab the crate through the cube room\u2019s window and back away: it comes out through the window, and the room is done without ever going in.", run: function (B, tc) {
      const r = {}; B.load('Delivery'); B.step(0.5); const c = B.world().cubes[0], pl = B.pl();
      B.walk(4.6, 8.4, { r: 0.05 }); r.at = B.at(); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab the crate through the window'); r.held = !!B.held();
      B.aim(2, 1.9, 8.4); B.step(0.6); r.cWin = B.P(c); tc.inp.fwd = -0.5; B.step(1.5); tc.inp.fwd = 0; r.out = !!B.held() && c.p.x > 4.5; r.cOut = B.P(c); B.walk(7, 4);
      B.walk(7, 2); r.c = B.fire(1, 20, 1.2, 0.05); r.d = B.fire(0, 7, 1.2, 0.05); B.into(7, -3, () => pl.p.x > 15); B.walk(20, 4); r.held2 = !!B.held();
      B.walk(20, 6.4); B.aim(20, 0.2, 5); B.step(0.3); B.use('put on the button'); B.step(1);
      B.walk(23, 5); B.walk(28, 5, { time: 5 }); r.skipped = B.state() === 'done' && B.deaths() === 0; return B.res(r);
    } },
    "Mirror Test": { ok: true, what: "With the sentry still working, stand at the exit: the door must stay shut until it is finished, then let you out.", run: function (B, tc) {
      const r = {}; B.load('Mirror Test'); B.step(0.5); const pl = B.pl(), S = B.world().sentries[0];
      B.fire(0, 16.5, 1.4, 0.05); B.fire(1, 28.5, 1.4, 11.95);
      pl.p.set(29.2, 0.9, 6); pl.v.set(0, 0, 0); B.face(34, 6); tc.inp.fwd = 1; B.step(0.4, () => S.state !== 'on'); tc.inp.fwd = 0;
      r.Son = S.state === 'on'; r.doorWhileOn = B.door(); r.leftWhileOn = B.state() === 'done' && r.Son;
      B.step(10, () => S.state !== 'on'); B.walk(34, 6, { time: 4 }); r.leftAfter = B.state() === 'done';
      r.ok = r.Son && !r.leftWhileOn && r.leftAfter; return B.res(r);
    } }
    ,"Walkway": { what: "Stand on the meter yourself with the crate in your hands, set the walkway, and step off towards it: the light must go out as you leave the plate.", run: function (B, tc) {
      const r = {}; B.load('Walkway'); B.step(0.5); const w = B.world(), c = w.cubes[0];
      B.walk(3.9, 8.3); B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate'); B.walk(3, 9, { r: 0.1 }); B.step(0.5); r.onPlate = w.plates[0].pressed;
      B.fire(0, 6, 1.2, 11.95); B.fire(1, 0.05, 1.2, 3); B.step(0.5); r.litOnPlate = w.walks[0].segs.length > 1;
      B.walk(5, 5); B.step(0.3); r.litOff = w.walks[0].segs.length > 1; r.skipped = r.litOff; return B.res(r);
    } }
  };

  /* ---------- v8.45 (Batch J step 5): the obvious plan. Each robot tries the plan you make at the doorway.
     `failed`: the plan did not finish the room. `recovered`: you can still carry on without restarting (after a death, the room is as it was).
     `died`: the plan got you killed. The plan only allows that where a sentry does it. ---------- */
  const first = {
    // v8.46: Water Feature. The obvious plan: a portal in the top bowl, at your feet on the roof, under the spout
    "Water Feature": { what: "a portal in the top bowl: the water dribbles out of the panel onto the paving, and the long fall stops", run: function (B, tc) {
      const r = {}; B.load('Water Feature'); B.step(0.5); const W = B.world(), pond = W.pools[0], sp = id => W.sprayers.find(s => s.id === id);
      B.walk(12, 8); B.walk(22.3, 6.2); r.o = B.fire(1, 20.5, 4.8, 2.5);
      B.walk(6.2, 8.5); B.walk(6.4, 5.8); B.walk(19.6, 5.8, { time: 14 }); B.walk(19.6, 4.4); B.walk(12.5, 4.4); r.b = B.fire(0, 9.8, 6, 2.5);
      B.step(30); const e = sp('spout').end; r.lands = e && +(e.x - 20.5).toFixed(2); r.where = sp('spout').endKind; r.longFall = sp('fall').on; r.failed = pond.got === 0 && r.where === 'drain';
      B.walk(19.6, 4.4); B.walk(19.6, 5.8); B.walk(6.4, 5.8, { time: 14 }); B.walk(4.5, 6.5); B.fire(0, 6.35, 0, 2.5); let t = 0; while (t < 40 && !pond.full) { B.step(0.5); t += 0.5; }
      r.recovered = pond.full; r.died = B.deaths() > 0; return r; } },
    "Walkway": { what: "Set the walkway to the pier and pick up the crate to take it across. The crate is the light’s meter: the walkway goes out under your nose. Put it back and the light returns.", run: function (B, tc) {
      const r = {}; B.load('Walkway'); B.step(0.5); const w = B.world(), c = w.cubes[0], lit = () => w.walks[0].segs.length > 1;
      B.walk(5, 6); B.fire(0, 6, 1.2, 11.95); B.fire(1, 0.05, 1.2, 3); B.step(0.5); r.bridge0 = lit();
      B.walk(4.4, 7.9); B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate'); B.step(0.6); r.bridge1 = lit(); r.failed = r.bridge0 && !r.bridge1 && B.state() !== 'done';
      B.aim(3, 0.3, 9); B.step(0.3); B.use('put it back'); B.step(1.2); r.recovered = lit() && B.state() === 'play'; r.died = B.deaths() > 0; return B.res(r);
    } },
    "Updraft": { what: "Ride the stream yourself to see where it goes. It pins you against the cell window: the crate fits through, you do not. Move a portal and you drop back to the floor.", run: function (B, tc) {
      const r = {}; B.load('Updraft'); B.step(0.5); const pl = B.pl();
      B.walk(6, 8); B.fire(0, 3, 11.95, 10.5); B.fire(1, 14, 9, 11.95); B.step(0.5);
      B.walk(3, 10.5, { time: 3, until: () => !pl.ground }); B.count('ride the stream'); B.step(12, () => pl.p.z < 3.6 && pl.p.y > 8); B.step(2.5); r.pinned = B.at();
      r.failed = pl.p.z > 2.4 && B.door() === 0 && B.state() !== 'done';
      B.fire(1, 20.55, 9, 5); B.step(4); r.down = B.at(); r.recovered = B.state() === 'play' && pl.hp > 0 && pl.p.y < 2; r.died = B.deaths() > 0; return B.res(r);
    } },
    "Primer": { what: "Prime the low slab, the nearest bare board across the acid. From it no other bare board can be reached, and the ledge stays out of reach. A higher throw from the pillar still primes the tall slab afterwards.", run: function (B, tc) {
      const r = {}; B.load('Primer'); B.step(2.5); const w = B.world(), box = x => w.lv.boxes.find(b => Math.abs(b.min[0] - x) < 0.01 && b.min[1] === 0 && b.min[2] === 0);
      B.walk(7, 8); B.fire(0, 4, 0.05, 9); B.walk(11.4, 3.6); B.fire(1, 10.05, 3, 0.8); B.step(5); r.low = !!box(18.3).portal; r.tall = !!box(20.5).portal;
      const block = w.lv.boxes.find(b => Math.abs(b.min[0] - 20.5) < 0.01 && b.min[1] === 3); r.block = !!block.portal;
      B.fire(1, 18.25, 1.3, 0.8); B.step(5); r.blockAfter = !!block.portal; r.tallAfter = !!box(20.5).portal;      // the throw from the low slab goes back over the acid
      r.failed = r.low && !r.tallAfter && !r.blockAfter && B.state() !== 'done';
      B.fire(1, 10.05, 6, 0.8); B.step(5); r.recovered = !!box(20.5).portal && B.state() === 'play'; r.died = B.deaths() > 0; return B.res(r);
    } },
    "Crate Seven": { what: "Charge both slow buttons, then take the crate lift at the foot of the ledge. It is right there, and it needs no portal. It is also slower than the door: the door is shut before you are up. Drop down and do it again by portal.", run: function (B, tc) {
      const r = {}; B.load('Crate Seven'); B.step(0.5); const c = B.world().cubes[0], pl = B.pl();
      B.walk(8, 7); B.fire(1, 25.95, 1.2, 6); B.fire(0, 6.75, 1.2, 11.95);
      B.walk(4.6, 7.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate');
      B.walk(6.75, 10.6); B.walk(6.75, 12.4, { time: 2, until: () => pl.p.x > 20 }); B.count('through'); B.step(0.3);
      B.walk(21.4, 4.4); B.aim(20, 0.3, 4.4); B.step(0.3); B.use('put on the first slow button'); B.step(0.3);
      B.walk(18.5, 8.6); B.fire(0, 27.75, 3.95, 11.95);
      B.walk(20, 7.6, { r: 0.15 }); B.step(3.8); const t0 = B.t;
      B.walk(24.9, 2.2, { time: 4, r: 0.1, until: () => pl.p.y > 1.3 }); B.count('the crate lift'); B.step(10, () => pl.p.y - 0.9 > 3.0);
      tc.inp.fwd = 1; B.face(29, 2.2); B.step(0.6); tc.inp.fwd = 0; r.up = B.at(); r.secs = +(B.t - t0).toFixed(1); r.doorWhenUp = B.door();
      B.walk(28.5, 6); B.walk(34, 6, { time: 3 }); r.failed = B.state() !== 'done';
      B.walk(24.5, 6); B.step(0.5); B.walk(20, 7.6, { r: 0.15 }); B.step(3.8); B.walk(24.5, 6); B.walk(26.5, 6, { time: 2, until: () => pl.p.y > 3 }); B.step(0.2); B.walk(29, 6); B.walk(34, 6, { time: 3 });
      r.recovered = B.state() === 'done'; r.died = B.deaths() > 0; return B.res(r);
    } },
    "The Last Word": { what: "Shoot the cell’s panel from the start, and carry the crate through the doorway. The sentry by the cell jams the panel, and the field in the doorway sends the crate back to where it started.", run: function (B, tc) {
      const r = {}; B.load('The Last Word'); B.step(0.5); const c = B.world().cubes[0], pl = B.pl();
      B.walk(5, 2.43); r.cellPanel = B.fire(1, 25.95, 1.2, 10.75);
      B.walk(4.3, 2.8); B.aim(c.p.x, c.p.y, c.p.z); B.use('grab crate'); B.walk(11, 6); B.walk(16, 6); r.stillHeld = !!B.held(); r.c = B.P(c);
      r.failed = !r.cellPanel && !r.stillHeld && B.state() !== 'done'; r.recovered = B.state() === 'play' && pl.hp > 50 && Math.abs(c.p.x - 4) < 0.5; r.died = B.deaths() > 0; return B.res(r);
    } },
    "Cold Storage": { what: "Put the sentry on the float through the hatch on the bank, the way the room shows you. It rides across looking down the slip, and shoots you as you come to lift it off. The pump brings it back.", sentry: true, run: function (B, tc) {
      const r = {}; B.load('Cold Storage'); B.step(0.5); const w = B.world(), S = w.sentries[0], F = w.cubes[0], pl = B.pl();
      B.walk(5, 9.0); B.aim(S.p.x, S.p.y, S.p.z); B.use('pick up the sentry');
      B.walk(8.5, 9.5, { r: 0.15 }); B.count('pump'); B.step(0.3);
      B.walk(10.2, 1.2, { r: 0.1 }); B.step(8); B.face(13, 1.2); B.walk(11.42, 1.2, { r: 0.05, time: 2, look: [14, 0.9, 1.2] }); B.aim(13.1, 0.3, 1.2); B.step(0.5); B.use('sentry through the hatch'); B.step(2); r.onFloat = Math.abs(S.p.x - F.p.x) < 0.8;
      B.walk(8.5, 9.5, { r: 0.15 }); B.count('pump');
      B.walk(14, 10.5); B.walk(18, 10.5); B.walk(25, 8.5); B.walk(28, 5); B.step(9, () => F.p.x > 21.0); B.step(0.5);
      let minHp = 100; B.walk(28, 1.2, { time: 3 }); tc.inp.fwd = 1; B.face(23.2, 1.2); for (let i = 0; i < 40 && pl.p.x > 23.4 && tc.state === 'play'; i++) { B.step(0.1); minHp = Math.min(minHp, pl.hp); } tc.inp.fwd = 0;
      B.step(1.5); minHp = Math.min(minHp, pl.hp); r.minHp = Math.round(minHp); r.died = B.deaths() > 0 || tc.state === 'dead'; r.failed = (r.died || minHp < 60) && B.state() !== 'done';
      B.step(3);                                                                                   // (after a death you are back at the start)
      if (pl.p.x > 16) { B.walk(28, 1.2); B.walk(28, 5); B.walk(25, 8.5); B.walk(18, 10.5); B.walk(14, 10.5); }
      B.walk(8.5, 9.5, { r: 0.15 }); B.count('pump: bring it back'); B.step(0.3); B.walk(10.2, 1.2, { r: 0.1 }); B.step(9, () => F.p.x < 13.3); B.step(1);
      B.walk(11.42, 1.2, { r: 0.05, time: 2 }); B.aim(S.p.x, S.p.y, S.p.z); B.use('take the sentry back off, from behind'); r.recovered = B.held() === S && B.state() === 'play'; return B.res(r);
    } },
    "Retrieval": { what: "Walk the light to the cell, pick up the crate, and carry it back out the way you came in. The field in the doorway sends the crate back to where it sat (and has already closed your portals). The cell’s own panel still gets you out.", run: function (B, tc) {
      const r = {}; B.load('Retrieval'); B.step(0.5); const c = B.world().cubes[0], pl = B.pl();
      B.walk(4, 9); B.fire(0, 6, 1.1, 11.95); B.fire(1, 0.05, 1.1, 9); B.step(0.5);
      B.walk(3, 9); B.walk(16, 9, { time: 6 }); B.walk(19.5, 9, { time: 4 }); B.aim(c.p.x, c.p.y, c.p.z); B.use('take the crate');
      B.walk(18.6, 9); B.walk(17.25, 9, { time: 3, r: 0.1 }); r.stillHeld = !!B.held(); r.c = B.P(c); r.failed = !r.stillHeld && c.p.x > 20 && B.state() !== 'done';
      B.walk(19.5, 9, { time: 4 }); B.fire(0, 18.05, 1.1, 10.4); B.walk(20.3, 9); B.fire(1, 0.05, 1.1, 9);
      B.walk(19.2, 10.4); B.walk(17.5, 10.4, { time: 2, until: () => pl.p.x < 6 }); B.count('out by the cell’s own panel'); B.step(0.4); r.recovered = pl.p.x < 6 && B.state() === 'play'; r.died = B.deaths() > 0; return B.res(r);
    } },
    "Gauntlet": { what: "Step on the launch pad. A sentry stands on the spot where it lands you. (This is a death by sentry, which the plan allows; you start the room again with everything where it was.)", sentry: true, run: function (B, tc) {
      const r = {}; B.load('Gauntlet'); B.step(0.5); const pl = B.pl(), c = B.world().cubes[0];
      B.walk(6, 6, { time: 3, until: () => !pl.ground }); B.count('ride the pad'); for (let i = 0; i < 60 && tc.state === 'play'; i++) B.step(0.1);
      r.died = tc.state === 'dead' || B.deaths() > 0; r.failed = r.died; B.step(3); r.recovered = B.state() === 'play' && pl.p.x < 5 && Math.abs(c.p.x - 3) < 0.5; return B.res(r);
    } }
  };

  /* ---------- the plan (Batch J, approved Nov 25, 2026, with the early-room amendment) ---------- */
  const PLAN = {
    acts: [[1, 8, "Act 1, Opening"], [9, 15, "Act 2, Mechanics"], [16, 23, "Act 3, Combinations"], [24, 30, "Act 4, Momentum"], [31, 38, "Act 5, Multi-step"]],
    exams: [8, 15, 23, 30, 38],                                            // each act's last room: the room after it is compared with the room before it
    // the first room for a new device or a new idea may take one step fewer than the room before it, never more
    fresh: { 4: "the crate", 5: "things go through a portal without you", 6: "speed through portals", 9: "the laser", 10: "sentries", 12: "launch pads", 13: "the reset field", 14: "the camera scale", 15: "the gravity panel" },
    change: (() => { const c = {}; for (let i = 1; i <= 38; i++) c[i] = "Choice pass"; for (const i of [1, 2, 3, 4, 11, 13, 14, 15]) c[i] = "Keep"; for (const i of [8, 10, 16, 17, 18, 19, 23, 24, 25, 27, 30, 31]) c[i] = "Rework"; return c; })(),
    // the plan's step targets after the work (section 4 and 6). The plan counted steps from the build notes; this page counts its own way (see the page), so these are a guide
    target: [0, 1, 2, 2, 5, 4, 4, 4, 7, 4, 5, 5, 4, 4, 5, 5, 6, 7, 7, 7, 6, 2, 6, 10, 6, 7, 6, 5, 5, 6, 8, 8, 7, 8, 7, 8, 8, 8, 10],
    // v8.45 (Batch J step 5): the written reason for each fall in steps from room 16 on (the Curve column shows them amber, not red)
    fall: { 34: "Crate Seven is a timing room: its difficulty is the three-second door and the wrong way up, not the number of steps. The plan listed this fall.",
      37: "Retrieval takes one step fewer than Cold Storage, whose count includes two presses of the pump button. The plan lists both rooms at 8." },
    // v8.45 (Batch J step 5): two of the five tests cannot be measured by a robot. The room's builder writes down whether it passes each, and why.
    // A room that reaches its number of tests (4 in Act 5) is not marked red for a test it does not need
    judged: {
      31: { order: "Taking the crate first puts the light out. The blue end has to move to the second light before the crate leaves its plate.", second: "The crate is the light's meter and then the door's weight. The walkway to the pier is carried by the first light and then by the second." },
      32: { order: null, second: "The stream carries the crate into the cell, then carries you up to the window to look, then carries you out of the ledge floor." },
      33: { order: "The first board you prime decides which boards can be reached next. The low slab, the nearest, leads nowhere.", second: "The portal under the nozzle feeds the paint and then is your own way across. The block takes one portal over the pocket and another over the ledge." },
      34: { order: "The way up has to be open before you step off the second slow button: after that there are three seconds.", second: "The panel at the foot of the ledge brings the crate across, and then is your way up." },
      35: { order: "The sentry has to be carried off before the cell's panel will take a portal. The crate has to go in before the light, because the light can only be set from the far side.", second: "The cell's one panel takes the crate in, lets you back out, and then carries the light." },
      36: { order: null, second: "The pump button runs the float both ways. The sentry is the passenger and then the door's weight." },
      37: { order: "The crate has to leave the cell by its own panel before the light is sent to the far bank: the cell's field closes whatever portals you had.", second: "The same landing panel carries both walkways. The back-wall panel is the first walkway and then the crate's way out." },
      38: { order: "The crate rides the pad before you do. Both sentries go on the buttons before you give up the portal that took you behind them.", second: "The crate is a missile, not a weight. The sentries are the weights. The terrace portal is your way down and then the light's way across." }
    },
    minTests: i => i < 16 ? 0 : i < 31 ? 3 : 4
  };
  const actOf = i => PLAN.acts.findIndex(a => i >= a[0] && i <= a[1]);

  /* ---------- measuring a room as built (all from the game's own world after B.load) ---------- */
  // every white surface: one face of a white box, clipped to the room's air, at least 0.25 square metres
  function whiteFaces(lv) {
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    const dk = lv.dock, behind = a => dk && (dk.sg > 0 ? a[dk.ax + 3] <= dk.wall + 0.03 : a[dk.ax] >= dk.wall - 0.03);      // the lift car's alcove behind the start is not the room
    const airs = lv.air.filter(a => !behind(a));
    for (const a of airs) { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], a[k] - 0.05); hi[k] = Math.max(hi[k], a[k + 3] + 0.05); } }
    const F = [];
    lv.boxes.forEach((b, bi) => { if (!b.portal && b.mat !== "bare") return;      // v8.45: bare board (Primer) is a surface you choose between, the same as white
      for (let a = 0; a < 3; a++) for (const sg of [-1, 1]) {
        const pl = sg > 0 ? b.max[a] : b.min[a]; if (pl < lo[a] || pl > hi[a]) continue;
        const u = (a + 1) % 3, v = (a + 2) % 3, u0 = Math.max(b.min[u], lo[u]), u1 = Math.min(b.max[u], hi[u]), v0 = Math.max(b.min[v], lo[v]), v1 = Math.min(b.max[v], hi[v]);
        if (u1 - u0 < 0.3 || v1 - v0 < 0.3 || (u1 - u0) * (v1 - v0) < 0.25) continue;
        const c = [0, 0, 0]; c[a] = pl + sg * 0.06; c[u] = (u0 + u1) / 2; c[v] = (v0 + v1) / 2;
        if (!airs.some(q => c[0] > q[0] && c[0] < q[3] && c[1] > q[1] && c[1] < q[4] && c[2] > q[2] && c[2] < q[5])) {      // the face must look into the room (not flush with a wall), checked at its middle and its corners
          const hit = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]].some(([fu, fv]) => { c[u] = u0 + (u1 - u0) * fu; c[v] = v0 + (v1 - v0) * fv; return airs.some(q => c[0] > q[0] && c[0] < q[3] && c[1] > q[1] && c[1] < q[4] && c[2] > q[2] && c[2] < q[5]); });
          if (!hit) continue; }
        F.push({ id: bi + ":" + a + sg, a, sg, pl, u, v, u0, u1, v0, v1 });
      } });
    return F;
  }
  function lineClear(tc, lv, e, p) { const d = [p[0] - e[0], p[1] - e[1], p[2] - e[2]], L = Math.hypot(...d); if (L < 0.05) return true; const n = d.map(x => x / L), h = tc.dbg.lvRay(lv, e, n, L + 0.05); return !h || h.t >= L - 0.04; }
  function faceSeen(tc, lv, f, e) {
    if (f.sg * (e[f.a] - f.pl) <= 0.05) return false;
    for (const fu of [1 / 6, 1 / 2, 5 / 6]) for (const fv of [1 / 6, 1 / 2, 5 / 6]) {
      const p = [0, 0, 0]; p[f.a] = f.pl + f.sg * 0.01; p[f.u] = f.u0 + (f.u1 - f.u0) * fu; p[f.v] = f.v0 + (f.v1 - f.v0) * fv;
      if (lineClear(tc, lv, e, p)) return true;
    }
    return false;
  }
  function faceAt(F, p) { let best = null, bd = 0.12; for (const f of F) { const d = Math.abs(p[f.a] - f.pl); if (d < bd && p[f.u] > f.u0 - 0.6 && p[f.u] < f.u1 + 0.6 && p[f.v] > f.v0 - 0.6 && p[f.v] < f.v1 + 0.6) { bd = d; best = f; } } return best; }
  // one room: what the start shows, what each stop shows, the exit's shape, timing windows, the exit door
  function measure(win, name, sol) {
    const tc = win.__tc, B = win.B; B.load(name); B.step(0.3);
    const w = tc.world, lv = w.lv, F = whiteFaces(lv), st = lv.start.pos, eye0 = [st[0], st[1] + 1.6, st[2]];
    const out = { white: F.length, seen0: F.filter(f => faceSeen(tc, lv, f, eye0)).length };
    const own = q => !/^(den|cover|lock|card)/.test(String([].concat(q.door || q.ev || "")[0]));      // v8.45: a button, receiver or switch that works a den or a secret is not one of the room's goals
    // the panels and goals the solving robot needed
    if (sol && sol.shots) {
      const need = new Map(); for (const p of sol.shots.concat((lv.held || []).map(h => h.pos))) { const f = faceAt(F, p); if (f) need.set(f.id, f); }      // (a portal the facility holds open counts as a panel you need)
      const goals = [...(lv.plates || []).filter(own).map(p => [p.pos[0], p.pos[1] + 0.15, p.pos[2]]), ...(lv.receivers || []).filter(own).map(r => r.pos), [(lv.exit.min[0] + lv.exit.max[0]) / 2, lv.exit.min[1] + 1.2, (lv.exit.min[2] + lv.exit.max[2]) / 2]];
      const pSeen = [...need.values()].filter(f => faceSeen(tc, lv, f, eye0)).length, gSeen = goals.filter(g => lineClear(tc, lv, eye0, g)).length;
      out.needed = need.size + goals.length; out.neededSeen = pSeen + gSeen; out.panels = need.size;
    }
    // what each stop shows: the robot's stops, or the room's own route spots where there is no robot yet
    const stops = sol && sol.stops && sol.stops.length ? sol.stops : [eye0].concat((lv.route || []).map(r => [r[0], r[1] + 1.6, r[2]]));
    out.stopsFrom = sol && sol.stops && sol.stops.length ? "robot" : lv.route && lv.route.length ? "route" : "start";
    out.stopCounts = stops.map(e => F.filter(f => faceSeen(tc, lv, f, e)).length);
    // shape: is the exit straight ahead in the far end wall?
    const R = tc.dbg.hallOf(lv), ex = lv.exit;
    out.side = !!lv.exitSide; out.farEnd = !lv.exitSide && ex.min[0] >= R.x1 - 0.01 && st[0] < R.x0 + 0.3 * R.L;      // the exit in the far end wall, the start at the other end
    // timing windows: plates and switches that stay down for a while, and presses that must all be up at once
    const win_ = [];
    for (const p of (lv.plates || []).filter(own)) if (p.hold) win_.push(["a button stays down", p.hold]);
    for (const s of (lv.switches || []).filter(own)) if (s.hold) win_.push(["a switch stays on", s.hold]);
    if ((lv.doors || []).some(d => d.presses) && w.crushers && w.crushers.length) {
      let best = 0, run = 0; for (let k = 0; k < 900; k++) { B.step(1 / 60); if (w.crushers.every(c => c.s < 0.35)) { run += 1 / 60; best = Math.max(best, run); } else run = 0; }
      win_.push(["all the presses are up", +best.toFixed(2)]);
    }
    out.windows = win_;
    // the exit door: a room with sentries needs a real door on its exit, or a run past them gets out
    const ec = [(ex.min[0] + ex.max[0]) / 2, (ex.min[2] + ex.max[2]) / 2];
    const ed = w.doors.filter(d => d.id !== "lift" && Math.hypot((d.min0[0] + d.max0[0]) / 2 - ec[0], (d.min0[2] + d.max0[2]) / 2 - ec[1]) < 4.5 && !d.hide);
    out.exitDoor = ed.length ? (ed.every(d => d.auto) ? "auto" : "real") : "none";
    out.sentries = (w.sentries || []).length;
    out.dock = !!lv.dock;
    return out;
  }
  // run a solving robot and keep what the page needs
  function runSolve(win, name) {
    const fn = solve[name]; if (!fn) return null;
    let r; try { r = fn(win.B, win.__tc); } catch (e) { return { error: String(e && e.message || e) }; }
    const B = win.B, shots = B.shots.map(p => p.slice()), stops = B.stops.map(p => p.slice());
    return { done: r.state === "done", deaths: r.deaths, steps: r.steps, log: r.log.slice(), hp: r.hp,
      nShots: r.log.filter(l => /^shot .* ok/.test(l)).length, nUse: r.log.filter(l => /^use/.test(l)).length, shots, stops };
  }
  function runShortcut(win, name) {
    const s = shortcut[name]; if (!s) return null;
    let r; try { r = s.run(win.B, win.__tc); } catch (e) { return { error: String(e && e.message || e), what: s.what }; }
    return { what: s.what, hole: s.ok ? !r.ok : !!r.skipped, steps: r.steps };
  }
  // v8.45: run a room's obvious-plan robot
  function runFirst(win, name) {
    const f = first[name]; if (!f) return null;
    let r; try { r = f.run(win.B, win.__tc); } catch (e) { return { error: String(e && e.message || e), what: f.what }; }
    return { what: f.what, failed: !!r.failed, recovered: !!r.recovered, died: !!r.died, sentry: !!f.sentry, raw: r };
  }
  root.DIFF_BOTS = { install, solve, shortcut, first, PLAN, actOf, measure, runSolve, runShortcut, runFirst, whiteFaces };
})(typeof window !== "undefined" ? window : globalThis);
