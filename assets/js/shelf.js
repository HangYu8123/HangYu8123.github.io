/* ==========================================================================
   shelf.js — books that come off the shelf.
   Hover lifts a book. Click pulls it out and turns it to face you. Click
   again to open the cover. Click the wall, the close button or press Esc
   to put it back. Tab reaches every spine; Enter activates it. Index links
   and #hashes open a volume directly.
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

  var keyboard = false;    /* was the last input a keyboard? */
  window.addEventListener('keydown', function () { keyboard = true; }, true);
  window.addEventListener('pointerdown', function () { keyboard = false; }, true);

  var active = null;       /* the book that is off the shelf */
  var state = 'shelf';     /* shelf | cover | open */
  var T = reduced ? { open: 0, close: 0, settle: 20 } : { open: 380, close: 520, settle: 900 };

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
    var byHeight = (window.innerHeight * 0.364) / 396;   /* 70% of the earlier half-height shelf */
    var byWidth = (window.innerWidth * 0.56) / 888;
    var u = Math.max(0.56, Math.min(byWidth, byHeight, 1.12));
    html.style.setProperty('--u', u.toFixed(3));
    relocateLeftPages();
  }

  function clearTimers(book) { (book._timers || []).forEach(clearTimeout); book._timers = []; }
  function later(book, fn, ms) {
    var id = setTimeout(fn, ms);
    (book._timers = book._timers || []).push(id);
  }

  /* Pin the book where it stands, then aim it at the centre of the viewport. */
  function place(book) {
    var slot = book.parentElement;
    var r = slot.getBoundingClientRect();
    var W = book.offsetWidth, H = book.offsetHeight, D = slot.offsetWidth;
    var left = r.left + (D - W) / 2, top = r.top;
    book.style.left = left + 'px';
    book.style.top = top + 'px';

    var vw = window.innerWidth, vh = window.innerHeight, mobile = vw < 760;
    var s = mobile
      ? Math.min((vh * 0.88) / H, (vw * 0.94) / W)
      : Math.min((vh * 0.86) / H, (vw * 0.92) / (2 * W), 2.8);
    book.style.setProperty('--s', s.toFixed(4));
    book.style.setProperty('--tx', (vw / 2 - (left + W / 2)).toFixed(2) + 'px');
    book.style.setProperty('--ty', (vh / 2 - (top + H / 2)).toFixed(2) + 'px');
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
    book.classList.add('is-fixed');
    book.classList.add('has-depth');
    place(book);
    void book.offsetWidth;                       /* commit the pinned position first */
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
  }

  function shelve(book, switching) {
    clearTimers(book);
    var wasOpen = book.classList.contains('is-open');
    book.classList.remove('is-open');
    spineOf(book).setAttribute('aria-expanded', 'false');
    if (active === book) {
      active = null; state = 'shelf';
      html.classList.remove('is-reading');
      markIndex(null);
    }
    later(book, function () {
      book.classList.remove('is-out');
      later(book, function () {
        book.classList.remove('is-fixed');
        book.classList.remove('has-depth');
        book.style.left = ''; book.style.top = '';
        book.style.removeProperty('--tx'); book.style.removeProperty('--ty');
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
    setTimeout(function () { extract(book, true); }, delay);
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
      if (active) place(active);
    });
  });

  setUnit();
  openFromHash(reduced ? 0 : 700);
})();
