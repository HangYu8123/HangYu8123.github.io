/* ==========================================================================
   monet.js — paints the wall in the browser.
   A deterministic (seeded) impressionist study after Monet's water gardens:
   layered directional dabs with bristle lines and impasto ridges, lily pads,
   blossoms, a canvas weave and a soft vignette. Also generates two small
   tileable textures (brush grain, canvas weave) used on the books and paper,
   and a reduced copy of the painting used as the books' endpapers.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
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
  function vary(hex, rng, dh, ds, dl) {
    var rgb = hexToRgb(hex), c = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return [(c[0] + (rng() - 0.5) * dh + 1) % 1, clamp(c[1] + (rng() - 0.5) * ds, 0, 1), clamp(c[2] + (rng() - 0.5) * dl, 0, 1)];
  }
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

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

  /* 6x6 canvas weave, used both on the painting and as a CSS tile. */
  function weaveTile(lightA, darkA, size) {
    var S = size || 6;
    var c = document.createElement('canvas'); c.width = S; c.height = S;
    var ctx = c.getContext('2d');
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,' + lightA + ')';
    ctx.beginPath(); ctx.moveTo(0, 1.5); ctx.lineTo(S, 1.5); ctx.moveTo(0, S - 1.5); ctx.lineTo(S / 2, S - 1.5); ctx.stroke();
    ctx.strokeStyle = 'rgba(20,24,36,' + darkA + ')';
    ctx.beginPath(); ctx.moveTo(1.5, 0); ctx.lineTo(1.5, S); ctx.moveTo(S - 1.5, S / 2); ctx.lineTo(S - 1.5, S); ctx.stroke();
    return c;
  }

  /* 256x256 wrap-around brush grain: light and dark strokes on transparency. */
  function brushTile(rng) {
    var S = 256, c = document.createElement('canvas'); c.width = S; c.height = S;
    var ctx = c.getContext('2d');
    var offsets = [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]];
    for (var i = 0; i < 520; i++) {
      var x = rng() * S, y = rng() * S, len = 8 + rng() * 30, wid = 1.2 + rng() * 3.2;
      var t = rng();
      var ang = t < 0.62 ? Math.PI / 2 + (rng() - 0.5) * 0.28 : t < 0.84 ? (rng() - 0.5) * 0.28 : rng() * Math.PI;
      var light = rng() < 0.55;
      var a = light ? 0.03 + rng() * 0.06 : 0.02 + rng() * 0.045;
      var col = light ? 'rgb(255,255,255)' : 'rgb(20,24,36)';
      for (var o = 0; o < offsets.length; o++) simpleStroke(ctx, x + offsets[o][0], y + offsets[o][1], len, wid, ang, col, a);
    }
    return c;
  }

  function paintWall(canvas, rng) {
    var W = canvas.width, H = canvas.height;
    var ctx = canvas.getContext('2d');

    var ground = ctx.createLinearGradient(0, 0, 0, H);
    ground.addColorStop(0, '#e3e5ef');
    ground.addColorStop(0.42, '#cbd6dd');
    ground.addColorStop(1, '#a8bbb3');
    ctx.fillStyle = ground; ctx.fillRect(0, 0, W, H);

    /* broad, soft masses of colour first, the way an underpainting blocks in light and shade */
    var masses = [
      ['#b9c4dd', 0.0, 0.4], ['#d6d2e5', 0.0, 0.35], ['#e6e0ea', 0.0, 0.3], ['#aab9d3', 0.1, 0.5],
      ['#8fa9c4', 0.3, 0.75], ['#9fb7ad', 0.35, 0.8], ['#c9d5d2', 0.3, 0.7], ['#6f8fa9', 0.4, 0.85],
      ['#7f9a86', 0.6, 1.0], ['#5f7f88', 0.65, 1.0], ['#a9b99b', 0.6, 1.0], ['#4f6d84', 0.7, 1.0]
    ];
    for (var mi = 0; mi < 46; mi++) {
      var m = pick(masses, rng);
      var mx = rng() * W, my = (m[1] + rng() * (m[2] - m[1])) * H;
      var mr = 140 + rng() * 260, mc = vary(m[0], rng, 0.02, 0.1, 0.08);
      var rg = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      rg.addColorStop(0, hsla(mc, 0.55));
      rg.addColorStop(1, hsla(mc, 0));
      ctx.fillStyle = rg;
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }

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
      return 0.18 * Math.sin(x / 260 + y / 140) * (1 - (y / H) * 0.45)
        + 0.09 * Math.sin(x / 71 - y / 93)
        + 0.05 * Math.sin(y / 37);
    }
    function layer(n, lenMin, lenMax, widMin, widMax, alpha, jitter) {
      for (var i = 0; i < n; i++) {
        var x = rng() * (W + 200) - 100, y = rng() * (H + 100) - 50, yf = y / H;
        var len = lenMin + rng() * (lenMax - lenMin), wid = widMin + rng() * (widMax - widMin);
        var ang = flow(x, y) + (rng() - 0.5) * jitter;
        if (yf > 0.58 && rng() < 0.16) ang = Math.PI / 2 + (rng() - 0.5) * 0.18;   /* willow reflections */
        dab(ctx, x, y, len, wid, ang, vary(zoneColor(yf), rng, 0.03, 0.16, 0.12), alpha * (0.8 + rng() * 0.4), rng);
      }
    }
    layer(800, 140, 260, 26, 44, 0.3, 0.4);      /* underpainting */
    layer(2400, 70, 150, 9, 16, 0.46, 0.45);     /* body: long, thin water strokes */
    layer(1800, 24, 60, 5, 9, 0.5, 0.6);         /* detail */

    /* lily pads and blossoms */
    var clusters = [[0.16, 0.8], [0.68, 0.74], [0.42, 0.9], [0.86, 0.62]];
    var pads = ['#6f8d63', '#86a072', '#5d7a5a', '#7f9a6c', '#98ab7f'];
    var petals = ['#f2c9cf', '#efb6c3', '#f8e7ea', '#e79aa9', '#f6d9de'];
    for (var ci = 0; ci < clusters.length; ci++) {
      var cx = clusters[ci][0] * W, cy = clusters[ci][1] * H, count = 8 + Math.floor(rng() * 9);
      for (var i = 0; i < count; i++) {
        dab(ctx, cx + (rng() - 0.5) * W * 0.16, cy + (rng() - 0.5) * H * 0.08, 26 + rng() * 30, 9 + rng() * 8,
          (rng() - 0.5) * 0.2, vary(pick(pads, rng), rng, 0.03, 0.12, 0.1), 0.7, rng);
      }
      var blooms = 2 + Math.floor(rng() * 4);
      for (var b = 0; b < blooms; b++) {
        var bx = cx + (rng() - 0.5) * W * 0.13, by = cy + (rng() - 0.5) * H * 0.07;
        for (var p = 0; p < 4; p++) {
          dab(ctx, bx + (rng() - 0.5) * 10, by + (rng() - 0.5) * 5, 9 + rng() * 8, 4 + rng() * 3, (rng() - 0.5) * 1.2,
            vary(pick(petals, rng), rng, 0.02, 0.1, 0.08), 0.8, rng);
        }
        dab(ctx, bx, by, 5, 3.5, 0, [0.12, 0.7, 0.82], 0.9, rng);
      }
    }

    /* light on the water */
    var lights = ['#f6efe0', '#f3dfd4', '#eedfc4', '#dfe6f0', '#f0d7dc', '#fbf6ea'];
    for (var li = 0; li < 900; li++) {
      var lx = rng() * W, ly = rng() * H, lyf = ly / H;
      if (rng() > (lyf < 0.5 ? 0.85 : 0.55)) continue;
      dab(ctx, lx, ly, 10 + rng() * 22, 4 + rng() * 5, flow(lx, ly) + (rng() - 0.5) * 0.5,
        vary(pick(lights, rng), rng, 0.02, 0.1, 0.06), 0.55, rng);
    }

    /* canvas weave, a light wash so the shelf reads on top, and a vignette */
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = ctx.createPattern(weaveTile(0.5, 0.4), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(246,242,232,.12)'; ctx.fillRect(0, 0, W, H);
    var v = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.25, W / 2, H * 0.5, H * 0.95);
    v.addColorStop(0, 'rgba(30,40,60,0)');
    v.addColorStop(1, 'rgba(30,40,60,.26)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  function run() {
    var rng = mulberry32(8123);

    /* textures first: they are cheap and dress the books immediately */
    root.style.setProperty('--tile-brush', 'url("' + brushTile(rng).toDataURL('image/png') + '")');
    root.style.setProperty('--tile-weave', 'url("' + weaveTile(0.12, 0.08, 4).toDataURL('image/png') + '")');

    var canvas = document.querySelector('canvas.painting');
    if (!canvas) return;
    paintWall(canvas, rng);
    canvas.classList.add('is-ready');

    /* a reduced copy becomes the endpaper inside every cover */
    var small = document.createElement('canvas');
    small.width = 1200; small.height = 734;
    small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
    root.style.setProperty('--painting', 'url("' + small.toDataURL('image/jpeg', 0.78) + '")');
  }

  function start() {
    if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(run, 0); });
    else run();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
