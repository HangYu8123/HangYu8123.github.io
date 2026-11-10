/* ==========================================================================
   intro.js — the welcome: "I am a Doctor now!"
   For three seconds a garden is painted in oils, stroke by stroke, with the
   same loaded brush that paints the wall (window.Monet from monet.js):
   wisteria comes down from the top corners, a flower bed of poppies, peonies,
   irises and daisies grows up from the bottom, and petals are thrown like
   confetti. Then it lifts away to show the shelf.

   Click, tap or press a key to skip. With reduced motion the finished garden
   is simply shown, still, for the same three seconds.
   ========================================================================== */
(function () {
  'use strict';

  var el = document.getElementById('intro');
  if (!el) return;

  /* how long the celebration stays up: 3 s, or data-seconds="…" on the #intro element */
  var HOLD = (parseFloat(el.getAttribute('data-seconds')) || 3) * 1000;
  var FADE = 650;          /* then it dissolves into the site (matches the CSS transition) */

  var root = document.documentElement;
  var M = window.Monet;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finished = false, raf = 0, holdTimer = 0;

  root.classList.add('intro-on');
  el.style.animation = 'none';          /* the script is alive, so the CSS safety net is not needed */

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(holdTimer);
    el.classList.add('is-leaving');
    root.classList.remove('intro-on');
    var ev;
    try { ev = new Event('intro:done'); } catch (e) { ev = document.createEvent('Event'); ev.initEvent('intro:done', false, false); }
    document.dispatchEvent(ev);
    setTimeout(function () {
      if (raf) cancelAnimationFrame(raf);
      if (el.parentNode) el.parentNode.removeChild(el);
    }, FADE + 80);
  }
  el.addEventListener('pointerdown', finish);
  window.addEventListener('keydown', function onKey() {
    window.removeEventListener('keydown', onKey);
    finish();
  });

  var paint = el.querySelector('.intro-paint'), air = el.querySelector('.intro-petals');
  if (!M || !paint || !air || !paint.getContext) {     /* no brush: show the words alone */
    el.classList.add('is-on');
    holdTimer = setTimeout(finish, HOLD);
    return;
  }

  /* ---- canvas ------------------------------------------------------------ */
  var vw = el.clientWidth || window.innerWidth, vh = el.clientHeight || window.innerHeight;
  var d = Math.min(window.devicePixelRatio || 1, 2);
  if (vw * vh * d * d > 5e6) d = Math.sqrt(5e6 / (vw * vh));
  paint.width = air.width = Math.round(vw * d);
  paint.height = air.height = Math.round(vh * d);
  var pc = paint.getContext('2d'), ac = air.getContext('2d');
  pc.scale(d, d); ac.scale(d, d);

  var rng = M.rng(20261110);
  var f = M.clamp(Math.min(vw, vh) / 820, 0.62, 1.45);      /* brush size follows the screen */
  var portrait = vw < vh * 0.8;
  var TAU = Math.PI * 2;
  function rnd(a, b) { return a + rng() * (b - a); }

  /* the words, and the clearing kept around them */
  var tr = el.querySelector('.intro-text').getBoundingClientRect(), er = el.getBoundingClientRect();
  var text = {
    cx: tr.left - er.left + tr.width / 2, cy: tr.top - er.top + tr.height / 2,
    hw: tr.width / 2 + 26 * f, hh: tr.height / 2 + 30 * f
  };
  function inClearing(x, y, pad) {
    return Math.abs(x - text.cx) < text.hw + pad && Math.abs(y - text.cy) < text.hh + pad;
  }

  /* ---- the score: every stroke, with the moment it is laid ---------------- */
  var ops = [];
  function stroke(t, x, y, len, wid, ang, hex, alpha, dh, ds, dl) {
    ops.push({ t: t, x: x, y: y, len: len, wid: wid, ang: ang, a: alpha,
      c: M.vary(hex, rng, dh === undefined ? 0.03 : dh, ds === undefined ? 0.12 : ds, dl === undefined ? 0.1 : dl) });
  }

  /* 1. air and light: a pale sky, a cream middle, soft green below */
  var SKY = ['#cfd3ea', '#dcd6ec', '#e9e2ee', '#c3d0e6', '#f3e6e2', '#d9e2f0'];
  var MID = ['#f3eddc', '#f6ecd4', '#eef0e2', '#f4e3dc', '#e8eee6', '#f7f1e4'];
  var LOW = ['#b9cdaa', '#a8c0a0', '#c9d8b4', '#9fb99a', '#d5dcb8', '#b3c9b8'];
  function airColour(yf) { return M.pick(yf < 0.36 ? SKY : yf > 0.64 ? LOW : MID, rng); }
  var washes = Math.round(M.clamp(vw * vh / (f * f * 5600), 90, 300));
  for (var i = 0; i < washes; i++) {
    var wx = rnd(-40, vw + 40), wy = rnd(-20, vh + 20);
    stroke(rnd(0, 380), wx, wy, rnd(110, 240) * f, rnd(26, 46) * f, 0.12 * Math.sin(wx / 210 + wy / 130) + rnd(-0.28, 0.28),
      airColour(wy / vh), 0.3, 0.02, 0.1, 0.07);
  }
  var body = Math.round(M.clamp(vw * vh / (f * f * 1500), 260, 1100));
  for (i = 0; i < body; i++) {                         /* the body of the paint: shorter, thicker touches */
    wx = rnd(-20, vw + 20); wy = rnd(-10, vh + 10);
    stroke(rnd(120, 500), wx, wy, rnd(38, 92) * f, rnd(9, 16) * f, 0.14 * Math.sin(wx / 160 - wy / 120) + rnd(-0.4, 0.4),
      airColour(wy / vh), 0.36, 0.03, 0.14, 0.08);
  }
  for (i = 0; i < body * 0.6; i++) {
    wx = rnd(0, vw); wy = rnd(0, vh);
    stroke(rnd(260, 530), wx, wy, rnd(16, 40) * f, rnd(5, 8.5) * f, 0.16 * Math.sin(wx / 120 + wy / 90) + rnd(-0.55, 0.55),
      airColour(wy / vh), 0.4, 0.03, 0.16, 0.09);
  }
  /* a pool of light behind the words */
  ops.push({ t: 540, glow: true });

  /* 2. the flower bed: low in the middle, climbing at the sides, like a frame */
  function bedHeight(xf) {
    var edge = Math.abs(xf - 0.5) * 2;
    var base = portrait ? 0.19 + 0.12 * Math.pow(edge, 2) : 0.17 + 0.34 * Math.pow(edge, 2.3);
    return vh * (base + 0.018 * Math.sin(xf * 23) + 0.012 * Math.sin(xf * 57 + 1));
  }
  var REDS = ['#d9482b', '#e2603a', '#c93a2f', '#ef7f5a', '#d6553f'];
  var PINKS = ['#f2c9cf', '#efb6c3', '#f8e7ea', '#e79aa9', '#f6d9de', '#e88ea8'];
  var VIOLETS = ['#6f63b5', '#8a78c9', '#5a55a0', '#a493d6', '#7a6cc0'];
  var YELLOWS = ['#f0c84a', '#e9b53a', '#f6dd7a', '#f3d05e'];
  var WHITES = ['#fbf6ea', '#f6efe0', '#f3ece6'];
  var GREENS = ['#5d7a5a', '#6f8d63', '#86a072', '#98ab7f', '#4f6f5e', '#7fa08a', '#a6b884'];
  var DEEP = ['#3f5c4a', '#4f6f5e', '#48664f', '#3a5a52', '#55735a', '#46626a'];
  var SUNLIT = ['#b9cf8e', '#cfdc9a', '#a6c486', '#d9e2a6', '#c2d49a'];
  var MEADOW = REDS.concat(REDS, PINKS, VIOLETS, YELLOWS, WHITES);

  /* foliage is laid the way it would be in oils: dark masses, then leaves, then light */
  var bedArea = 0;
  for (i = 0; i < 20; i++) bedArea += bedHeight((i + 0.5) / 20) * vw / 20;
  function foliage(n, power, t0, t1, lenMin, lenMax, widMin, widMax, cols, alpha, spread, reach) {
    for (var k = 0; k < n; k++) {
      var xf = rng(), x = xf * vw, top = bedHeight(xf) * reach;
      var up = Math.pow(rng(), power) * top, y = vh - up;
      if (inClearing(x, y, 4 * f)) continue;
      stroke(t0 + (t1 - t0) * (up / (vh * 0.5)) + rnd(0, 220), x, y, rnd(lenMin, lenMax) * f, rnd(widMin, widMax) * f,
        -Math.PI / 2 + rnd(-spread, spread) + (xf - 0.5) * 0.5, M.pick(cols, rng), alpha, 0.04, 0.16, 0.12);
    }
  }
  var bedUnit = bedArea / (f * f);
  foliage(Math.round(bedUnit / 300), 1.5, 90, 700, 20, 42, 9, 15, DEEP, 0.72, 1.1, 0.94);
  foliage(Math.round(bedUnit / 210), 1.25, 240, 1150, 20, 50, 5, 9.5, GREENS, 0.68, 0.6, 1.04);
  foliage(Math.round(bedUnit / 420), 1.0, 620, 1500, 10, 24, 3, 5.5, SUNLIT, 0.7, 0.8, 1.0);
  /* and a scatter of colour through it: the far flowers are only touches of paint */
  var touches = Math.round(bedUnit / 620);
  for (i = 0; i < touches; i++) {
    var sxf = rng(), sx0 = sxf * vw, sup = (0.25 + 0.78 * rng()) * bedHeight(sxf), sy0 = vh - sup;
    if (inClearing(sx0, sy0, 8 * f)) continue;
    stroke(900 + 1100 * (1 - Math.abs(sxf - 0.5) * 2) + rnd(0, 300), sx0, sy0, rnd(6, 11) * f, rnd(4.5, 7.5) * f, rnd(0, TAU),
      M.pick(MEADOW, rng), 0.85, 0.03, 0.14, 0.1);
  }

  /* 3. flowers */

  function stem(t, x, y, r) {
    var n = 3 + Math.floor(rng() * 2), lean = rnd(-0.18, 0.18);
    for (var k = 0; k < n; k++) {
      stroke(t - 150 + k * 26, x + lean * (k + 1) * 9 * f, y + r * 0.7 + (k + 0.5) * 13 * f, 17 * f, 2.6 * f,
        Math.PI / 2 + lean, M.pick(['#4f6f5e', '#5d7a5a', '#6f8d63'], rng), 0.8);
    }
  }
  function poppy(t, x, y, r) {
    var n = 5, a0 = rng() * TAU, cols = REDS;
    for (var k = 0; k < n; k++) {
      var a = a0 + k / n * TAU + rnd(-0.2, 0.2);
      stroke(t + k * 34, x + Math.cos(a) * r * 0.44, y + Math.sin(a) * r * 0.38, r * 1.02, r * 0.76, a, M.pick(cols, rng), 0.9, 0.03, 0.12, 0.1);
    }
    stroke(t + n * 34 + 20, x - r * 0.18, y - r * 0.24, r * 0.5, r * 0.26, rnd(-0.6, 0.2), '#f4a184', 0.75, 0.02, 0.08, 0.06);
    stroke(t + n * 34 + 50, x, y, r * 0.38, r * 0.32, rnd(0, TAU), '#33263a', 0.92, 0.02, 0.06, 0.05);
  }
  function peony(t, x, y, r) {
    var a0 = rng() * TAU, k, a;
    for (k = 0; k < 7; k++) {
      a = a0 + k / 7 * TAU + rnd(-0.18, 0.18);
      stroke(t + k * 26, x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.46, r * 0.92, r * 0.56, a, M.pick(PINKS, rng), 0.9, 0.02, 0.1, 0.08);
    }
    for (k = 0; k < 5; k++) {
      a = a0 + 0.4 + k / 5 * TAU + rnd(-0.2, 0.2);
      stroke(t + 190 + k * 26, x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.2, r * 0.6, r * 0.42, a, M.pick(['#f8e7ea', '#f6d9de', '#fbf1f0'], rng), 0.92, 0.02, 0.08, 0.05);
    }
    stroke(t + 340, x, y, r * 0.3, r * 0.26, rnd(0, TAU), '#f0c84a', 0.95, 0.02, 0.1, 0.06);
  }
  function iris(t, x, y, r) {
    var k, a;
    for (k = 0; k < 3; k++) {                         /* standards */
      a = -Math.PI / 2 + (k - 1) * 0.5;
      stroke(t + k * 36, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 1.08, r * 0.48, a, M.pick(VIOLETS, rng), 0.9, 0.03, 0.12, 0.1);
    }
    for (k = 0; k < 3; k++) {                         /* falls */
      a = Math.PI / 2 + (k - 1) * 0.95;
      stroke(t + 110 + k * 36, x + Math.cos(a) * r * 0.46, y + Math.sin(a) * r * 0.4, r * 0.9, r * 0.5, a, M.pick(VIOLETS, rng), 0.9, 0.03, 0.12, 0.12);
    }
    stroke(t + 240, x, y + r * 0.3, r * 0.42, r * 0.16, Math.PI / 2, '#f3d05e', 0.95, 0.02, 0.08, 0.05);
  }
  function daisy(t, x, y, r) {
    var n = 9, a0 = rng() * TAU, cols = rng() < 0.55 ? YELLOWS : WHITES;
    for (var k = 0; k < n; k++) {
      var a = a0 + k / n * TAU + rnd(-0.1, 0.1);
      stroke(t + k * 20, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.46, r * 0.8, r * 0.27, a, M.pick(cols, rng), 0.92, 0.02, 0.1, 0.06);
    }
    stroke(t + n * 20 + 20, x, y, r * 0.4, r * 0.34, rnd(0, TAU), cols === WHITES ? '#e9b53a' : '#a8642a', 0.95, 0.02, 0.1, 0.06);
  }
  var KINDS = [poppy, poppy, poppy, peony, peony, iris, iris, daisy, daisy, daisy];

  var flowers = Math.round(M.clamp(vw / (25 * f), 12, 80));
  for (i = 0; i < flowers; i++) {
    var fx = M.clamp((i + 0.5 + rnd(-0.42, 0.42)) / flowers, 0.01, 0.99);
    var edge = Math.abs(fx - 0.5) * 2, bed = bedHeight(fx);
    var rows = edge > 0.4 || portrait ? 2 : 1;         /* the tall sides carry a second tier */
    for (var row = 0; row < rows; row++) {
      var r = rnd(14, 27) * f * (0.85 + 0.5 * edge) * (portrait ? 1.15 : 1);
      var x = fx * vw + rnd(-8, 8) * f;
      var y = vh - bed * (row === 0 ? rnd(0.72, 1.06) : rnd(0.3, 0.6));
      if (inClearing(x, y, r)) y = text.cy + text.hh + r * 1.2;
      if (y > vh - r * 0.6) y = vh - r * 0.6 - rnd(0, 10) * f;
      var t0 = 620 + 1150 * (1 - edge) + rnd(0, 240) + row * 120;   /* the sides bloom first, the middle last */
      stem(t0, x, y, r);
      M.pick(KINDS, rng)(t0, x, y, r);
    }
  }

  /* 4. wisteria, coming down from the top corners */
  var LILACS = ['#b9a6dc', '#a48fd0', '#8f7bc4', '#cdbfe8', '#7d6bb5', '#c4b2e6'];
  var span = vw * (portrait ? 0.4 : 0.33);
  var racemes = Math.round(M.clamp(span / (54 * f), 2, 8));
  [0, 1].forEach(function (side) {
    function sx(v) { return side === 0 ? v : vw - v; }
    for (var b = 0; b < span + 30 * f; b += rnd(24, 34) * f) {              /* the bough */
      stroke(110 + (b / span) * 260 + rnd(0, 60), sx(b), rnd(3, 13) * f * (1 + 0.6 * (1 - b / span)), rnd(34, 52) * f, rnd(5, 8) * f,
        rnd(-0.2, 0.2), M.pick(['#6b5642', '#7a6248', '#5c4a3a'], rng), 0.82, 0.02, 0.08, 0.08);
    }
    var leaves = Math.round(span / (7 * f));
    for (var l = 0; l < leaves; l++) {
      var lx = rnd(0, span + 20 * f);
      stroke(200 + (lx / span) * 320 + rnd(0, 180), sx(lx), rnd(0, 58) * f * (1.15 - 0.5 * lx / span), rnd(14, 26) * f, rnd(4, 7) * f,
        rnd(0.5, 2.6), M.pick(GREENS, rng), 0.7, 0.04, 0.16, 0.12);
    }
    for (var j = 0; j < racemes; j++) {
      var cx = (j + 0.5 + rnd(-0.3, 0.3)) / racemes * span;
      var L = Math.min(rnd(120, 250) * f * (1 - 0.45 * j / racemes), vh * 0.42);
      var y0 = rnd(4, 22) * f, n = Math.round(L / (6.2 * f));
      for (var k = 0; k < n; k++) {
        var tf = k / n, half = 19 * f * Math.pow(1 - tf, 0.75) + 2 * f;
        for (var twice = 0; twice < 2; twice++) {
          stroke(300 + j * 80 + tf * 880 + rnd(0, 70), sx(cx + rnd(-half, half)), y0 + tf * L + rnd(-3, 3) * f,
            rnd(9, 15) * f * (1 - 0.35 * tf), rnd(6, 9.5) * f * (1 - 0.35 * tf), rnd(0.6, 2.5),
            M.pick(LILACS, rng), 0.86, 0.03, 0.14, 0.1);
        }
      }
    }
  });

  ops.sort(function (a, b) { return a.t - b.t; });

  function lay(op) {
    if (op.glow) {
      var gr = Math.max(text.hw * 1.35, text.hh * 2.4);
      pc.save();
      pc.translate(text.cx, text.cy);
      pc.scale(1, Math.min(1, (text.hh * 2.3) / gr));
      var g = pc.createRadialGradient(0, 0, gr * 0.15, 0, 0, gr);
      g.addColorStop(0, 'rgba(251,247,236,.9)');
      g.addColorStop(0.55, 'rgba(251,247,236,.6)');
      g.addColorStop(1, 'rgba(251,247,236,0)');
      pc.fillStyle = g;
      pc.beginPath(); pc.arc(0, 0, gr, 0, TAU); pc.fill();
      pc.restore();
      return;
    }
    M.dab(pc, op.x, op.y, op.len, op.wid, op.ang, op.c, op.a, rng);
  }

  /* ---- petals in the air -------------------------------------------------- */
  var CONFETTI = ['#f2c9cf', '#efb6c3', '#e79aa9', '#f8e7ea', '#cdbfe8', '#a48fd0', '#f6dd7a', '#ef7f5a', '#fbf6ea', '#d9482b'];
  var petals = [];
  function petal(born, x, y, vx, vy, burst) {
    petals.push({ born: born, x: x, y: y, vx: vx, vy: vy, burst: burst, rot: rng() * TAU, vr: rnd(-4, 4),
      size: rnd(5.5, 10.5) * f, sway: rng() * TAU, c: M.hsla(M.vary(M.pick(CONFETTI, rng), rng, 0.02, 0.1, 0.06), 1) });
  }
  if (!reduced) {
    var falling = Math.round(M.clamp(vw / 24, 16, 70)), burst = Math.round(M.clamp(vw / 26, 16, 56));
    for (i = 0; i < falling; i++) petal(rnd(450, 2500), rnd(0, vw), -14 * f, rnd(-26, 26) * f, rnd(120, 250) * f, false);
    for (i = 0; i < burst; i++) {                      /* a handful thrown up from behind the words */
      var ba = -Math.PI / 2 + rnd(-1.35, 1.35), sp = rnd(300, 720) * f;
      petal(880 + rnd(0, 150), text.cx + rnd(-0.5, 0.5) * text.hw, text.cy + rnd(-0.2, 0.4) * text.hh, Math.cos(ba) * sp, Math.sin(ba) * sp, true);
    }
  }
  function drawPetals(t, dt) {
    ac.clearRect(0, 0, vw, vh);
    for (var k = 0; k < petals.length; k++) {
      var p = petals[k];
      if (t < p.born || p.y > vh + 30) continue;
      if (p.burst) {
        p.vy += 620 * f * dt;                          /* thrown, then gravity takes over */
        p.vx *= Math.pow(0.22, dt); p.vy = Math.min(p.vy, 300 * f);
      }
      p.sway += dt * 2.6;
      p.x += (p.vx + Math.sin(p.sway) * 34 * f) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      var flip = 0.45 + 0.55 * Math.abs(Math.sin(p.sway * 0.9));   /* turning over as it falls */
      ac.save();
      ac.translate(p.x, p.y); ac.rotate(p.rot);
      ac.globalAlpha = Math.min(1, (t - p.born) / 160) * 0.95;
      ac.fillStyle = p.c;
      ac.beginPath(); ac.ellipse(0, 0, p.size, p.size * 0.56 * flip, 0, 0, TAU); ac.fill();
      ac.globalAlpha *= 0.5;
      ac.strokeStyle = 'rgba(255,252,240,.9)'; ac.lineWidth = Math.max(0.8, p.size * 0.12);
      ac.beginPath(); ac.moveTo(-p.size * 0.6, -p.size * 0.12 * flip); ac.lineTo(p.size * 0.5, -p.size * 0.16 * flip); ac.stroke();
      ac.restore();
    }
  }

  /* ---- play ---------------------------------------------------------------- */
  /* the ground coat, so the very first frame is already a canvas */
  var ground = pc.createLinearGradient(0, 0, 0, vh);
  ground.addColorStop(0, '#dfe2ee'); ground.addColorStop(0.5, '#f1ecdc'); ground.addColorStop(1, '#c5d2b6');
  pc.fillStyle = ground; pc.fillRect(0, 0, vw, vh);

  function play() {
    if (finished) return;
    if (reduced) {
      for (var k = 0; k < ops.length; k++) lay(ops[k]);
      el.classList.add('is-on');
      holdTimer = setTimeout(finish, HOLD);
      return;
    }
    var start = performance.now(), last = start, next = 0, shown = false;
    holdTimer = setTimeout(finish, HOLD);
    function reveal() { if (!shown) { shown = true; el.classList.add('is-on'); } }
    /* bring the words in once their typeface is ready (but never later than 0.8 s) */
    var fontReady = false;
    if (document.fonts && document.fonts.load) {
      document.fonts.load('italic 500 1em "Cormorant Garamond"').then(function () { fontReady = true; }, function () { fontReady = true; });
    } else { fontReady = true; }
    function frame(now) {
      var t = now - start, dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (next < ops.length && ops[next].t <= t) lay(ops[next++]);
      drawPetals(t, dt);
      if ((t > 380 && fontReady) || t > 800) reveal();
      if (el.parentNode) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  /* if the tab opens in the background, wait until someone is actually looking */
  if (document.hidden) {
    document.addEventListener('visibilitychange', function onShow() {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onShow);
      play();
    });
  } else {
    play();
  }
})();
