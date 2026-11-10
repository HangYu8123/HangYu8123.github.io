/* ==========================================================================
   monet.js — paints the site in the browser.
   A deterministic (seeded) impressionist study after Monet's water gardens:
   layered directional dabs with bristle lines and impasto ridges, lily pads,
   blossoms, a canvas weave and a soft vignette.

   Everything is painted at the screen's real pixel density, so it stays sharp
   on HiDPI displays, at any browser zoom and at any window size:
     - the wall (repainted when the window changes size);
     - one oil-painted jacket per book (spine + front board), in the book's
       own colours, with its band laid in as a strip of water;
     - the plank, a sheet of paper grain, and the endpaper inside every cover.
   The work is done in short slices so the page never freezes while it paints.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var VW = 1800, VH = 1100;            /* the wall's own coordinate space; it covers the viewport */

  /* ---- small helpers ---------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function dpr() { return Math.max(1, window.devicePixelRatio || 1); }
  function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }
  function hsla(c, a) {
    return 'hsla(' + (c[0] * 360).toFixed(1) + ',' + (c[1] * 100).toFixed(1) + '%,' + (c[2] * 100).toFixed(1) + '%,' + a + ')';
  }
  function varyRgb(rgb, rng, dh, ds, dl) {
    var c = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return [(c[0] + (rng() - 0.5) * dh + 1) % 1, clamp(c[1] + (rng() - 0.5) * ds, 0, 1), clamp(c[2] + (rng() - 0.5) * dl, 0, 1)];
  }
  function vary(hex, rng, dh, ds, dl) { return varyRgb(hexToRgb(hex), rng, dh, ds, dl); }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  /* Any CSS colour → [r, g, b, a], by letting a canvas normalise it. */
  var probe = makeCanvas(1, 1).getContext('2d');
  function parseColor(str) {
    str = (str || '').trim();
    if (!str) return null;
    probe.fillStyle = '#000'; probe.fillStyle = str;
    var v = probe.fillStyle;
    if (v.charAt(0) === '#') { var c = hexToRgb(v); return [c[0], c[1], c[2], 1]; }
    var m = v.match(/[\d.]+/g) || [0, 0, 0, 1];
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
  }

  /* ---- brushwork -------------------------------------------------------- */
  /* One loaded brush stroke: tapered body, bristle lines, impasto ridge. */
  function dab(ctx, x, y, len, wid, ang, hsl, alpha, rng) {
    var r = wid / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = hsla(hsl, 1);
    ctx.beginPath();
    ctx.moveTo(-len / 2 + r, -r);
    ctx.lineTo(len / 2 - r, -r);
    ctx.quadraticCurveTo(len / 2 + r * 0.25, -r, len / 2, 0);
    ctx.quadraticCurveTo(len / 2 + r * 0.25, r, len / 2 - r, r);
    ctx.lineTo(-len / 2 + r, r);
    ctx.quadraticCurveTo(-len / 2 - r * 0.25, r, -len / 2, 0);
    ctx.quadraticCurveTo(-len / 2 - r * 0.25, -r, -len / 2 + r, -r);
    ctx.closePath();
    ctx.fill();

    var n = Math.max(1, Math.round(wid / 3.4));
    ctx.lineWidth = Math.max(0.5, wid * 0.07);
    for (var k = 0; k < n; k++) {
      var yy = -r + (k + 0.5) * wid / n + (rng() - 0.5) * wid * 0.1;
      var light = (k % 2) === 0;
      ctx.strokeStyle = light ? 'rgba(255,255,255,.6)' : 'rgba(30,32,48,.4)';
      ctx.globalAlpha = alpha * (light ? 0.34 : 0.22);
      ctx.beginPath();
      ctx.moveTo(-len / 2 + r * 0.6, yy);
      ctx.lineTo(len / 2 - r * 0.6, yy + (rng() - 0.5) * wid * 0.08);
      ctx.stroke();
    }
    var ridge = Math.max(0.6, wid * 0.16);
    ctx.lineWidth = ridge;
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = 'rgba(255,252,240,.65)';
    ctx.beginPath(); ctx.moveTo(-len / 2 + r, -r + ridge * 0.6); ctx.lineTo(len / 2 - r, -r + ridge * 0.6); ctx.stroke();
    ctx.globalAlpha = alpha * 0.4;
    ctx.strokeStyle = 'rgba(20,24,40,.55)';
    ctx.beginPath(); ctx.moveTo(-len / 2 + r, r - ridge * 0.6); ctx.lineTo(len / 2 - r, r - ridge * 0.6); ctx.stroke();
    ctx.restore();
  }

  function simpleStroke(ctx, x, y, len, wid, ang, color, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = wid; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-len / 2, 0); ctx.lineTo(len / 2, 0); ctx.stroke();
    ctx.restore();
  }

  /* A canvas weave of S×S device pixels; the threads scale with S. */
  function weaveTile(lightA, darkA, S) {
    S = Math.max(4, Math.round(S || 6));
    var t = Math.max(1, Math.round(S / 6)), o = t * 1.5;
    var c = makeCanvas(S, S), ctx = c.getContext('2d');
    ctx.lineWidth = t;
    ctx.strokeStyle = 'rgba(255,255,255,' + lightA + ')';
    ctx.beginPath(); ctx.moveTo(0, o); ctx.lineTo(S, o); ctx.moveTo(0, S - o); ctx.lineTo(S / 2, S - o); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,24,36,' + darkA + ')';
    ctx.beginPath(); ctx.moveTo(o, 0); ctx.lineTo(o, S); ctx.moveTo(S - o, S / 2); ctx.lineTo(S - o, S); ctx.stroke();
    return c;
  }
  function weave(ctx, W, H, lightA, darkA, S) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = ctx.createPattern(weaveTile(lightA, darkA, S), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  /* ---- time-sliced work queue ------------------------------------------ */
  var queue = [], ticking = false;
  function schedule(gen, done) {
    var job = { gen: gen, done: done, cancelled: false };
    queue.push(job);
    if (!ticking) { ticking = true; setTimeout(tick, 0); }
    return job;
  }
  function tick() {
    /* paint in thin slices while the welcome animation is on screen, thicker ones afterwards */
    var budget = root.classList.contains('intro-on') ? 6 : 12;
    var t0 = performance.now();
    while (queue.length) {
      var job = queue[0];
      if (job.cancelled) { queue.shift(); continue; }
      var step = job.gen.next();
      if (step.done) { queue.shift(); if (job.done) job.done(); }
      if (performance.now() - t0 > budget) break;
    }
    if (queue.length) setTimeout(tick, 0);
    else ticking = false;
  }

  /* Hand a finished canvas to CSS as a custom property (a blob URL where possible). */
  function setVar(el, name, canvas, type, quality) {
    function apply(url) {
      var key = '_monet' + name, old = el[key];
      function swap() {
        el.style.setProperty(name, 'url("' + url + '")');
        el[key] = url;
        if (old && old.indexOf('blob:') === 0) setTimeout(function () { URL.revokeObjectURL(old); }, 4000);
      }
      var img = new Image();               /* decode first, so the swap never flashes */
      img.onload = swap; img.onerror = swap;
      img.src = url;
    }
    if (canvas.toBlob && window.URL && URL.createObjectURL) {
      canvas.toBlob(function (blob) {
        apply(blob ? URL.createObjectURL(blob) : canvas.toDataURL(type, quality));
      }, type, quality);
    } else {
      apply(canvas.toDataURL(type, quality));
    }
  }

  /* ---- the wall --------------------------------------------------------- */
  function* paintWall(ctx, W, H, rng) {
    /* map the 1800×1100 study onto the canvas the way object-fit: cover would */
    var k = Math.max(W / VW, H / VH);
    ctx.setTransform(k, 0, 0, k, (W - VW * k) / 2, (H - VH * k) / 2);

    var ground = ctx.createLinearGradient(0, 0, 0, VH);
    ground.addColorStop(0, '#e3e5ef');
    ground.addColorStop(0.42, '#cbd6dd');
    ground.addColorStop(1, '#a8bbb3');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, VW, VH);

    /* broad, soft masses of colour first, the way an underpainting blocks in light and shade */
    var masses = [
      ['#b9c4dd', 0.0, 0.4], ['#d6d2e5', 0.0, 0.35], ['#e6e0ea', 0.0, 0.3], ['#aab9d3', 0.1, 0.5],
      ['#8fa9c4', 0.3, 0.75], ['#9fb7ad', 0.35, 0.8], ['#c9d5d2', 0.3, 0.7], ['#6f8fa9', 0.4, 0.85],
      ['#7f9a86', 0.6, 1.0], ['#5f7f88', 0.65, 1.0], ['#a9b99b', 0.6, 1.0], ['#4f6d84', 0.7, 1.0]
    ];
    for (var mi = 0; mi < 46; mi++) {
      var m = pick(masses, rng);
      var mx = rng() * VW, my = (m[1] + rng() * (m[2] - m[1])) * VH;
      var mr = 140 + rng() * 260, mc = vary(m[0], rng, 0.02, 0.1, 0.08);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      rg.addColorStop(0, hsla(mc, 0.55));
      rg.addColorStop(1, hsla(mc, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    yield;

    var zones = [
      { lo: -0.1, hi: 0.45, cols: ['#c7cee3', '#b9c4dd', '#d6d2e5', '#e3dfe9', '#aab9d3', '#eee8dd', '#c2cfe0', '#d9cfe0'] },
      { lo: 0.28, hi: 0.78, cols: ['#8fa9c4', '#7f9bb8', '#a4bcc8', '#9fb7ad', '#6f8fa9', '#c9d5d2', '#b4c6cf', '#89a7b7'] },
      { lo: 0.6, hi: 1.1, cols: ['#7f9a86', '#5f7f88', '#8aa39a', '#4f6d84', '#a9b99b', '#6b8a7a', '#3f5c72', '#7c9aa6'] }
    ];
    function zoneColor(yf) {
      var cands = [];
      for (var i = 0; i < zones.length; i++) if (yf >= zones[i].lo && yf <= zones[i].hi) cands.push(zones[i]);
      var z = cands.length ? pick(cands, rng) : zones[1];
      return pick(z.cols, rng);
    }
    function flow(x, y) {
      return 0.18 * Math.sin(x / 260 + y / 140) * (1 - (y / VH) * 0.45)
        + 0.09 * Math.sin(x / 71 - y / 93)
        + 0.05 * Math.sin(y / 37);
    }
    function* layer(n, lenMin, lenMax, widMin, widMax, alpha, jitter) {
      for (var i = 0; i < n; i++) {
        var x = rng() * (VW + 200) - 100, y = rng() * (VH + 100) - 50, yf = y / VH;
        var len = lenMin + rng() * (lenMax - lenMin), wid = widMin + rng() * (widMax - widMin);
        var ang = flow(x, y) + (rng() - 0.5) * jitter;
        if (yf > 0.58 && rng() < 0.16) ang = Math.PI / 2 + (rng() - 0.5) * 0.18;   /* willow reflections */
        dab(ctx, x, y, len, wid, ang, vary(zoneColor(yf), rng, 0.03, 0.16, 0.12), alpha * (0.8 + rng() * 0.4), rng);
        if (i % 24 === 23) yield;
      }
    }
    yield* layer(800, 140, 260, 26, 44, 0.3, 0.4);      /* underpainting */
    yield* layer(2400, 70, 150, 9, 16, 0.46, 0.45);     /* body: long, thin water strokes */
    yield* layer(1800, 24, 60, 5, 9, 0.5, 0.6);         /* detail */

    /* lily pads and blossoms */
    var clusters = [[0.16, 0.8], [0.68, 0.74], [0.42, 0.9], [0.86, 0.62]];
    var pads = ['#6f8d63', '#86a072', '#5d7a5a', '#7f9a6c', '#98ab7f'];
    var petals = ['#f2c9cf', '#efb6c3', '#f8e7ea', '#e79aa9', '#f6d9de'];
    for (var ci = 0; ci < clusters.length; ci++) {
      var cx = clusters[ci][0] * VW, cy = clusters[ci][1] * VH, count = 8 + Math.floor(rng() * 9);
      for (var i = 0; i < count; i++) {
        dab(ctx, cx + (rng() - 0.5) * VW * 0.16, cy + (rng() - 0.5) * VH * 0.08, 26 + rng() * 30, 9 + rng() * 8,
          (rng() - 0.5) * 0.2, vary(pick(pads, rng), rng, 0.03, 0.12, 0.1), 0.7, rng);
      }
      var blooms = 2 + Math.floor(rng() * 4);
      for (var b = 0; b < blooms; b++) {
        var bx = cx + (rng() - 0.5) * VW * 0.13, by = cy + (rng() - 0.5) * VH * 0.07;
        for (var p = 0; p < 4; p++) {
          dab(ctx, bx + (rng() - 0.5) * 10, by + (rng() - 0.5) * 5, 9 + rng() * 8, 4 + rng() * 3, (rng() - 0.5) * 1.2,
            vary(pick(petals, rng), rng, 0.02, 0.1, 0.08), 0.8, rng);
        }
        dab(ctx, bx, by, 5, 3.5, 0, [0.12, 0.7, 0.82], 0.9, rng);
      }
      yield;
    }

    /* light on the water */
    var lights = ['#f6efe0', '#f3dfd4', '#eedfc4', '#dfe6f0', '#f0d7dc', '#fbf6ea'];
    for (var li = 0; li < 900; li++) {
      var lx = rng() * VW, ly = rng() * VH, lyf = ly / VH;
      if (rng() > (lyf < 0.5 ? 0.85 : 0.55)) continue;
      dab(ctx, lx, ly, 10 + rng() * 22, 4 + rng() * 5, flow(lx, ly) + (rng() - 0.5) * 0.5,
        vary(pick(lights, rng), rng, 0.02, 0.1, 0.06), 0.55, rng);
      if (li % 40 === 39) yield;
    }

    /* a fine canvas weave (a whole number of real pixels, so it never shimmers), a light wash
       so the shelf reads on top, and a vignette */
    weave(ctx, W, H, 0.34, 0.27, clamp(Math.round(4 * dpr()), 4, 12));
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(246,242,232,.12)'; ctx.fillRect(0, 0, VW, VH);
    var v = ctx.createRadialGradient(VW / 2, VH * 0.42, VH * 0.25, VW / 2, VH * 0.5, VH * 0.95);
    v.addColorStop(0, 'rgba(30,40,60,0)');
    v.addColorStop(1, 'rgba(30,40,60,.26)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, VW, VH);
  }

  var wallW = 0, wallH = 0, wallJob = null;
  function wallSize(canvas) {
    var r = canvas.getBoundingClientRect(), d = dpr();
    var w = Math.round((r.width || window.innerWidth) * d), h = Math.round((r.height || window.innerHeight) * d);
    var cap = 9e6;                                   /* plenty for a 4K screen; keeps memory sane beyond that */
    if (w * h > cap) { var f = Math.sqrt(cap / (w * h)); w = Math.round(w * f); h = Math.round(h * f); }
    return { w: w, h: h };
  }
  function hangWall() {
    var canvas = document.querySelector('canvas.painting');
    if (!canvas) return;
    var size = wallSize(canvas);
    if (!size.w || !size.h) return;
    if (wallJob) wallJob.cancelled = true;
    var off = makeCanvas(size.w, size.h), ctx = off.getContext('2d');
    var rng = mulberry32(8123);
    for (var i = 0; i < 4680; i++) rng();            /* same stretch of the sequence the wall has always been painted from */
    wallJob = schedule(paintWall(ctx, size.w, size.h, rng), function () {
      wallJob = null;
      canvas.width = size.w; canvas.height = size.h;
      canvas.getContext('2d').drawImage(off, 0, 0);
      canvas.classList.add('is-ready');
      wallW = size.w; wallH = size.h;

      /* a copy becomes the endpaper inside every cover */
      var f = Math.min(1, 2200 / size.w), paper = off;
      if (f < 1) {
        paper = makeCanvas(size.w * f, size.h * f);
        paper.getContext('2d').drawImage(off, 0, 0, paper.width, paper.height);
      }
      setVar(root, '--painting', paper, 'image/jpeg', 0.86);
    });
  }

  /* ---- small tiles: paper grain and the plank --------------------------- */
  var tileDpr = 0;
  function paperTile(rng, n) {
    var c = makeCanvas(n, n), ctx = c.getContext('2d');
    var img = ctx.createImageData(n, n), d = img.data;
    for (var i = 0; i < n * n; i++) {
      var v = rng(), light = v > 0.5, o = i * 4;
      d[o] = light ? 255 : 46; d[o + 1] = light ? 252 : 40; d[o + 2] = light ? 244 : 30;
      d[o + 3] = Math.round(Math.abs(v - 0.5) * 2 * 20);
    }
    ctx.putImageData(img, 0, 0);
    var s = n / 128, offs = [[0, 0], [n, 0], [-n, 0], [0, n], [0, -n]];
    for (var f = 0; f < 46; f++) {                  /* a few paper fibres, wrapped so the tile repeats cleanly */
      var x = rng() * n, y = rng() * n, len = (4 + rng() * 12) * s, ang = rng() * Math.PI;
      var col = rng() < 0.6 ? 'rgb(255,253,246)' : 'rgb(70,58,40)', a = 0.02 + rng() * 0.035;
      for (var k = 0; k < offs.length; k++) simpleStroke(ctx, x + offs[k][0], y + offs[k][1], len, 0.7 * s, ang, col, a);
    }
    return c;
  }
  function woodTile(rng, q) {
    var TW = 512, TH = 32, c = makeCanvas(TW * q, TH * q), ctx = c.getContext('2d');
    ctx.setTransform(q, 0, 0, q, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, TH);
    g.addColorStop(0, '#cfae79'); g.addColorStop(0.5, '#b58f58'); g.addColorStop(1, '#94713f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, TW, TH);
    var cols = ['#c8a46c', '#b58d55', '#d8b983', '#a27c46', '#8e6a3a', '#e2c796', '#bb9a6b', '#9a8160'];
    for (var i = 0; i < 150; i++) {
      var x = rng() * TW, y = rng() * TH, len = 50 + rng() * 150, wid = 3 + rng() * 6;
      var ang = (rng() - 0.5) * 0.05, col = vary(pick(cols, rng), rng, 0.02, 0.12, 0.1), a = 0.45 + rng() * 0.2;
      /* the same stroke three times over (same seed), so the tile wraps without a seam */
      for (var o = -1; o <= 1; o++) dab(ctx, x + o * TW, y, len, wid, ang, col, a, mulberry32(i + 1));
    }
    for (var j = 0; j < 26; j++) {                  /* a little grain */
      var gx = rng() * TW, gy = rng() * TH, gl = 30 + rng() * 120, ga = 0.1 + rng() * 0.12;
      for (var w = -1; w <= 1; w++) simpleStroke(ctx, gx + w * TW, gy, gl, 0.8, (rng() - 0.5) * 0.02, 'rgb(74,50,22)', ga);
    }
    return c;
  }
  function makeTiles() {
    var d = dpr(), rng = mulberry32(417);
    tileDpr = d;
    var n = Math.min(512, Math.round(128 * d));
    setVar(root, '--tile-paper', paperTile(rng, n), 'image/png');
    root.style.setProperty('--tile-paper-size', (n / d) + 'px');   /* exactly n device pixels: no resampling */
    setVar(root, '--tile-wood', woodTile(rng, clamp(d * 1.5, 1.5, 3)), 'image/jpeg', 0.9);
  }

  /* ---- book jackets ----------------------------------------------------- */
  var LIGHT_ACCENTS = ['#aab9d3', '#c9b9dc', '#b7cbb9', '#ecc9cf', '#eedfc4', '#d8dfeb'].map(hexToRgb);
  var DARK_ACCENTS = ['#3f5c8a', '#5a6fa8', '#2f4a6a', '#6b5fa0', '#4f7a8a', '#314a78'].map(hexToRgb);
  var GLINTS = ['#f6efe0', '#f3dfd4', '#eedfc4', '#dfe6f0', '#fbf6ea'];
  var PADS = ['#6f8d63', '#86a072', '#5d7a5a', '#7f9a6c'];
  var PETALS = ['#f2c9cf', '#efb6c3', '#f8e7ea', '#e79aa9', '#f6d9de'];

  /* The jacket is one painting, spine then front board, measured in the book's own units. */
  function* paintJacket(ctx, spec, q, rng) {
    var d = spec.d, w = spec.w, h = spec.h, W = d + w;
    var base = spec.base, hsl = rgbToHsl(base[0], base[1], base[2]);
    var dark = hsl[2] < 0.36, light = hsl[2] > 0.8;
    ctx.setTransform(q, 0, 0, q, 0, 0);
    ctx.fillStyle = 'rgb(' + base[0] + ',' + base[1] + ',' + base[2] + ')';
    ctx.fillRect(0, 0, W, h);

    for (var mi = 0; mi < 12; mi++) {               /* tonal masses under the strokes */
      var mx = rng() * W, my = rng() * h, mr = 50 + rng() * 120;
      var mc = varyRgb(base, rng, 0.02, 0.1, dark ? 0.14 : 0.1);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      rg.addColorStop(0, hsla(mc, 0.42)); rg.addColorStop(1, hsla(mc, 0));
      ctx.fillStyle = rg; ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }

    function colour() {
      var c = base;
      if (dark || light) {
        if (rng() < 0.2) c = mix(base, pick(dark ? DARK_ACCENTS : LIGHT_ACCENTS, rng), 0.3 + rng() * 0.3);
        return varyRgb(c, rng, 0.03, 0.14, dark ? 0.13 : 0.08);
      }
      return varyRgb(c, rng, 0.07, 0.2, 0.14);
    }
    /* each binding is brushed in its own direction */
    var lean = spec.mat === 'vellum' ? 0 : spec.mat === 'matte' ? 1.12 : Math.PI / 2;
    function flow(x, y) { return lean + 0.2 * Math.sin(x / 37 + y / 90) + 0.12 * Math.sin(y / 23 - x / 51); }
    function* strokes(n, lenMin, lenMax, widMin, widMax, alpha, jitter) {
      for (var i = 0; i < n; i++) {
        var x = rng() * (W + 40) - 20, y = rng() * (h + 40) - 20;
        dab(ctx, x, y, lenMin + rng() * (lenMax - lenMin), widMin + rng() * (widMax - widMin),
          flow(x, y) + (rng() - 0.5) * jitter, colour(), alpha * (0.8 + rng() * 0.4), rng);
        if (i % 30 === 29) yield;
      }
    }
    var A = W * h, fine = spec.mat === 'cloth' ? 1.3 : 1;
    yield* strokes(Math.round(A / 1000), 46, 96, 11, 19, 0.34, 0.35);
    yield* strokes(Math.round(A / 300 * fine), 18, 46, 5, 9, 0.44, 0.5);
    yield* strokes(Math.round(A / 520 * fine), 8, 20, 2.6, 4.6, 0.42, 0.8);

    if (spec.band && spec.bandH > 0) {              /* the band: a strip of water along the foot of the jacket */
      var y0 = h * (1 - spec.bandH), bh = h - y0;
      var band = mix(base, spec.band, spec.band[3]), bhsl = rgbToHsl(band[0], band[1], band[2]);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgb(' + Math.round(band[0]) + ',' + Math.round(band[1]) + ',' + Math.round(band[2]) + ')';
      ctx.fillRect(0, y0 + 2, W, bh);
      var bn = Math.round(W * bh / 170);
      for (var bi = 0; bi < bn; bi++) {
        dab(ctx, rng() * (W + 30) - 15, y0 + 4 + rng() * bh, 16 + rng() * 36, 5 + rng() * 5, (rng() - 0.5) * 0.22,
          varyRgb(band, rng, 0.035, 0.16, bhsl[2] < 0.36 ? 0.13 : 0.09), 0.55, rng);
        if (bi % 30 === 29) yield;
      }
      for (var ex = -8; ex < W + 8; ex += 11 + rng() * 6) {   /* a hand-laid edge instead of a ruled line */
        dab(ctx, ex, y0 + 1 + (rng() - 0.5) * 3.5, 18 + rng() * 16, 5 + rng() * 3, (rng() - 0.5) * 0.18,
          varyRgb(band, rng, 0.03, 0.12, 0.08), 0.85, rng);
      }
      for (var gi = 0; gi < W / 20; gi++) {          /* light on the water */
        dab(ctx, rng() * W, y0 + 6 + rng() * (bh - 8), 6 + rng() * 9, 2 + rng() * 1.6, (rng() - 0.5) * 0.3,
          vary(pick(GLINTS, rng), rng, 0.02, 0.1, 0.06), 0.5, rng);
      }
      if (bh > 44) {                                 /* and a few lilies, mostly on the front board */
        var spots = [], lilies = 2 + Math.floor(rng() * 3);
        for (var s = 0; s < lilies; s++) spots.push([d + w * (0.14 + rng() * 0.74), y0 + bh * (0.3 + rng() * 0.5)]);
        if (d >= 70) spots.push([d * (0.3 + rng() * 0.4), y0 + bh * (0.45 + rng() * 0.3)]);
        for (var li = 0; li < spots.length; li++) {
          var lx = spots[li][0], ly = spots[li][1];
          for (var p = 0; p < 3; p++) {
            dab(ctx, lx + (rng() - 0.5) * 16, ly + 2 + (rng() - 0.5) * 5, 13 + rng() * 9, 5 + rng() * 2.5, (rng() - 0.5) * 0.2,
              vary(pick(PADS, rng), rng, 0.03, 0.12, 0.1), 0.75, rng);
          }
          for (var t = 0; t < 4; t++) {
            dab(ctx, lx + (rng() - 0.5) * 6, ly - 1 + (rng() - 0.5) * 3, 6 + rng() * 4, 2.8 + rng() * 1.6, (rng() - 0.5) * 1.2,
              vary(pick(PETALS, rng), rng, 0.02, 0.1, 0.08), 0.85, rng);
          }
          dab(ctx, lx, ly - 1, 3.2, 2.2, 0, [0.12, 0.7, 0.8], 0.9, rng);
        }
      }
      yield;
    }

    ctx.globalAlpha = 1;
    if (spec.mat === 'cloth') weave(ctx, W * q, h * q, 0.7, 0.55, 2.4 * q);            /* book cloth */
    else if (spec.mat === 'vellum') { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(0, 0, W, h); }
    else weave(ctx, W * q, h * q, 0.3, 0.22, 2.4 * q);                                  /* a breath of canvas */
  }

  var jacketQ = 0;
  function jacketScale() {
    var u = parseFloat(getComputedStyle(root).getPropertyValue('--u')) || 1;
    return clamp(u * dpr() * 1.15, 1, 2.6);         /* a touch above shelf size, so a lifted cover still reads */
  }
  function paintJackets() {
    var slots = document.querySelectorAll('.slot'), q = jacketScale();
    jacketQ = q;
    Array.prototype.forEach.call(slots, function (slot, index) {
      var cs = getComputedStyle(slot), book = slot.querySelector('.book');
      var base = parseColor(cs.getPropertyValue('--base'));
      if (!book || !base) return;
      var mat = (book.className.match(/\bm-(\w+)/) || [])[1] || 'paper';
      var spec = {
        d: parseFloat(cs.getPropertyValue('--d')), w: parseFloat(cs.getPropertyValue('--w')), h: parseFloat(cs.getPropertyValue('--h')),
        base: base, band: parseColor(cs.getPropertyValue('--band')),
        bandH: (parseFloat(cs.getPropertyValue('--band-h')) || 0) / 100, mat: mat
      };
      if (!(spec.d > 0 && spec.w > 0 && spec.h > 0)) return;
      if (slot._monetJob) slot._monetJob.cancelled = true;
      var c = makeCanvas((spec.d + spec.w) * q, spec.h * q);
      slot._monetJob = schedule(paintJacket(c.getContext('2d'), spec, q, mulberry32(977 + index * 131)), function () {
        slot._monetJob = null;
        setVar(slot, '--jacket', c, 'image/jpeg', 0.9);
      });
    });
  }

  /* ---- start, and keep everything sharp when the window changes --------- */
  function refresh() {
    var canvas = document.querySelector('canvas.painting');
    if (canvas) {
      var size = wallSize(canvas);
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      var dw = Math.abs(size.w - wallW), dh = Math.abs(size.h - wallH);
      /* phones resize the viewport as their toolbars slide; only a real change is worth a repaint there */
      if (dw > 2 || (touch ? dh > wallH * 0.14 : dh > 2)) hangWall();
    }
    if (dpr() !== tileDpr) makeTiles();
    var q = jacketScale();
    if (q > jacketQ * 1.2 || q < jacketQ * 0.6) paintJackets();
  }

  function run() {
    makeTiles();
    hangWall();
    paintJackets();
    var timer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(refresh, 260);
    });
  }

  /* the welcome animation paints with the same brush */
  window.Monet = { rng: mulberry32, dab: dab, vary: vary, hsla: hsla, pick: pick, clamp: clamp };

  /* wait for shelf.js to size the books (it sets --u) before measuring anything */
  var started = false;
  function start() { if (started) return; started = true; setTimeout(run, 0); }
  if (document.readyState === 'complete') start();
  else { document.addEventListener('DOMContentLoaded', start); setTimeout(start, 1500); }
})();
