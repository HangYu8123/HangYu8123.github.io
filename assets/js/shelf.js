/* ==========================================================================
   shelf.js — books that come off the shelf.
   Hover lifts a book. Click pulls it out, turns it to face you and opens it.
   Click the wall, the close button or press Esc to put it back. Tab reaches
   every spine; Enter activates it. #hashes open a volume directly.

   A book that leaves the shelf is rebuilt at its full reading size and only
   *looks* small at first (scaled down to match its place on the shelf), so
   when it lands in front of you every word and picture is drawn at the
   screen's real resolution instead of being a magnified miniature.
   ========================================================================== */
(function () {
  'use strict';

  var html = document.documentElement;
  html.classList.remove('no-js');

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var slots = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var books = slots.map(function (s) { return s.querySelector('.book'); }).filter(Boolean);
  var byId = {};
  books.forEach(function (b) { byId[b.getAttribute('data-book')] = b; });
  var veil = document.querySelector('.veil');
  var closeBtn = document.querySelector('.stage-close');
  var indexLinks = Array.prototype.slice.call(document.querySelectorAll('[data-book-link]'));

  /* every book throws a soft shadow on the wall behind it */
  slots.forEach(function (slot) {
    var cast = document.createElement('span');
    cast.className = 'cast';
    cast.setAttribute('aria-hidden', 'true');
    slot.insertBefore(cast, slot.firstChild);
  });

  var keyboard = false;    /* was the last input a keyboard? */
  window.addEventListener('keydown', function () { keyboard = true; }, true);
  window.addEventListener('pointerdown', function () { keyboard = false; }, true);

  var active = null;       /* the book that is off the shelf */
  var state = 'shelf';     /* shelf | cover | open */
  var unit = 1;
  var T = reduced ? { open: 0, close: 0, settle: 20, flat: 40 } : { open: 380, close: 520, settle: 900, flat: 1150 };

  /* Two-page books show their left page only on wide screens; on phones that content
     moves into the single visible page (and back again when the window grows). */
  function relocateLeftPages() {
    var mobile = window.innerWidth < 760;
    books.forEach(function (book) {
      var left = book.querySelector('.page-left');
      if (!left) return;
      var right = book.querySelector('.page:not(.cover-inside) .page-inner') || book.querySelector('.face.page .page-inner');
      var inside = book.querySelector('.cover-inside');
      if (!right || !inside) return;
      if (mobile && left.parentElement === inside) right.insertBefore(left, right.firstChild);
      else if (!mobile && left.parentElement !== inside) inside.appendChild(left);
    });
  }

  function setUnit() {
    /* Proportions after the reference shelf: the tallest book (396 units) stands about half the
       viewport tall, and the whole shelf (~888 units) spans at most 80% of the width. */
    var byHeight = (window.innerHeight * 0.491) / 396;   /* the ordinary books stand ≈ 49% of the viewport; Publications is taller */
    var byWidth = (window.innerWidth * 0.756) / 918;      /* shelf ≤ 76% of the viewport width */
    unit = Math.max(0.56, Math.min(byWidth, byHeight, 1.51));
    html.style.setProperty('--u', unit.toFixed(3));
    relocateLeftPages();
  }

  function clearTimers(book) { (book._timers || []).forEach(clearTimeout); book._timers = []; }
  function later(book, fn, ms) {
    var id = setTimeout(fn, ms);
    (book._timers = book._timers || []).push(id);
  }

  /* Change a book's geometry in one step, with no tweening. */
  function snap(book, fn) {
    book.classList.add('is-snapping');
    fn();
    void book.offsetWidth;
    book.classList.remove('is-snapping');
  }

  /* The book's size on the shelf, in CSS pixels (its slot carries the unit sizes). */
  function shelfSize(book) {
    var cs = getComputedStyle(book.parentElement);
    return {
      W: parseFloat(cs.getPropertyValue('--w')) * unit,
      H: parseFloat(cs.getPropertyValue('--h')) * unit,
      D: parseFloat(cs.getPropertyValue('--d')) * unit
    };
  }

  /* Rebuild the book at reading size where it stands, and aim it at the centre of the viewport.
     Sizes and the resting position are snapped to whole device pixels so the open pages are crisp. */
  function place(book) {
    var slot = book.parentElement;
    var r = slot.getBoundingClientRect();
    var m = shelfSize(book);
    var dpr = window.devicePixelRatio || 1;
    function px(v) { return Math.round(v * dpr) / dpr; }
    function even(v) { return Math.max(2, Math.round(v * dpr / 2) * 2) / dpr; }

    var vw = window.innerWidth, vh = window.innerHeight, mobile = vw < 760;
    var wide = book.classList.contains('two-page');       /* the publications spread uses nearly the whole screen */
    var s = mobile
      ? Math.min((vh * 0.88) / m.H, (vw * 0.94) / m.W)
      : Math.min((vh * (wide ? 0.97 : 0.86)) / m.H, (vw * (wide ? 0.97 : 0.92)) / (2 * m.W), 2.8);
    var W = even(m.W * s), H = even(m.H * s), D = even(m.D * s);

    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;      /* where the book stands on the shelf */
    var restLeft = px((vw - W) / 2), restTop = px((vh - H) / 2);   /* where it rests in front of you */
    var left = cx - W / 2, top = cy - H / 2;
    book.style.left = left + 'px';
    book.style.top = top + 'px';
    book.style.setProperty('--bw', W + 'px');
    book.style.setProperty('--bh', H + 'px');
    book.style.setProperty('--bd', D + 'px');
    book.style.setProperty('--s', (W / m.W).toFixed(5));
    book.style.setProperty('--tx', (restLeft - left).toFixed(3) + 'px');
    book.style.setProperty('--ty', (restTop - top).toFixed(3) + 'px');
  }

  /* How far hover has lifted and turned the book right now, so pinning it never jolts it. */
  function poseOf(book) {
    var lift = 0, yaw = 90;
    try {
      var b = getComputedStyle(book).transform, v = getComputedStyle(book.querySelector('.volume')).transform;
      if (b && b !== 'none') lift = new DOMMatrixReadOnly(b).m42 || 0;
      if (v && v !== 'none') yaw = Math.acos(Math.max(-1, Math.min(1, new DOMMatrixReadOnly(v).m33))) * 180 / Math.PI;
    } catch (e) { lift = 0; yaw = 90; }
    return { lift: lift, yaw: yaw };
  }

  /* Back to an ordinary shelf book. It settles in the plain shelf pose first, so a pointer
     that is already hovering lifts it with the usual animation instead of a jump. */
  function unpin(book) {
    snap(book, function () {
      book.classList.add('is-settling');
      book.classList.remove('is-fixed');
      book.classList.remove('has-depth');
      book.style.left = ''; book.style.top = '';
      ['--bw', '--bh', '--bd', '--s', '--lift', '--yaw', '--tx', '--ty'].forEach(function (p) { book.style.removeProperty(p); });
    });
    book.classList.remove('is-settling');
  }

  function markIndex(id) {
    indexLinks.forEach(function (a) {
      a.classList.toggle('is-current', a.getAttribute('data-book-link') === id);
    });
  }
  function spineOf(book) { return book.querySelector('.spine'); }

  function extract(book, andOpen) {
    if (active && active !== book) shelve(active, true);
    clearTimers(book);
    active = book; state = 'cover';
    if (!book.classList.contains('is-fixed')) {
      var pose = poseOf(book);
      snap(book, function () {                   /* same picture, now built at reading size */
        place(book);
        book.style.setProperty('--lift', pose.lift.toFixed(2) + 'px');
        book.style.setProperty('--yaw', pose.yaw.toFixed(2) + 'deg');
        book.classList.add('is-fixed');
        book.classList.add('has-depth');
      });
    }
    book.parentElement.classList.add('is-empty');
    html.classList.add('is-reading');
    book.classList.add('is-out');
    spineOf(book).setAttribute('aria-expanded', 'true');
    markIndex(book.getAttribute('data-book'));
    if (andOpen) later(book, function () { open(book); }, T.open);
  }

  function open(book) {
    if (active !== book) return;
    state = 'open';
    book.classList.add('is-open');
    later(book, function () {
      var p = book.querySelector('.page-inner');
      if (p) p.focus({ preventScroll: true });
    }, reduced ? 0 : 500);
    /* once the cover has swung round, lay the spread perfectly flat: no perspective, no resampling */
    later(book, function () { if (active === book && state === 'open') book.classList.add('is-flat'); }, T.flat);
  }

  function shelve(book, switching) {
    clearTimers(book);
    var wasOpen = book.classList.contains('is-open');
    book.classList.remove('is-flat');
    book.classList.remove('is-open');
    spineOf(book).setAttribute('aria-expanded', 'false');
    if (active === book) {
      active = null; state = 'shelf';
      html.classList.remove('is-reading');
      markIndex(null);
    }
    later(book, function () {
      book.style.setProperty('--lift', '0px');   /* fly home to the resting pose, not the hovered one */
      book.style.setProperty('--yaw', '90deg');
      book.classList.remove('is-out');
      book.parentElement.classList.remove('is-empty');
      later(book, function () {
        unpin(book);
        if (!switching && !active && keyboard) {
          spineOf(book).focus({ preventScroll: true });
        } else if (document.activeElement && document.activeElement.closest &&
                   document.activeElement.closest('.book') === book) {
          document.activeElement.blur();
        }
      }, T.settle);
    }, wasOpen ? T.close : 0);
    if (!switching && location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  function closeActive() { if (active) shelve(active, false); }

  /* ---- wiring ---------------------------------------------------------- */
  books.forEach(function (book) {
    book.addEventListener('click', function (e) {
      if (active !== book) {
        if (e.target.closest && e.target.closest('a')) return;
        extract(book, true);
        return;
      }
      if (state === 'cover') open(book);
    });
  });

  if (veil) veil.addEventListener('click', closeActive);
  if (closeBtn) closeBtn.addEventListener('click', closeActive);
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && active) { e.preventDefault(); closeActive(); }
  });

  indexLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('data-book-link'), book = byId[id];
      if (!book) return;
      e.preventDefault();
      history.replaceState(null, '', '#' + id);
      if (active === book) { if (state === 'cover') open(book); return; }
      extract(book, true);
    });
  });

  function openFromHash(delay) {
    var id = location.hash.replace(/^#/, ''), book = byId[id];
    if (!book || active === book) return;
    setTimeout(function () { if (active !== book) extract(book, true); }, delay);
  }
  window.addEventListener('hashchange', function () { openFromHash(0); });

  var resizeRaf = 0, resizeEnd = 0;
  window.addEventListener('resize', function () {
    html.classList.add('no-anim');                 /* resize every face at once, no tweening */
    clearTimeout(resizeEnd);
    resizeEnd = setTimeout(function () { html.classList.remove('no-anim'); }, 180);
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () {
      resizeRaf = 0;
      setUnit();
      books.forEach(function (book) {             /* the open book, and any still gliding home */
        if (book.classList.contains('is-fixed')) place(book);
      });
    });
  });

  setUnit();
  /* a deep link opens its book once the welcome animation has cleared */
  if (document.getElementById('intro')) {
    document.addEventListener('intro:done', function () { openFromHash(reduced ? 0 : 350); });
  } else {
    openFromHash(reduced ? 0 : 700);
  }
})();
