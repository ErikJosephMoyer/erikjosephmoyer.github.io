/* embed.js - inline embedded features with prev/next navigation.
   Triggers are any element with [data-embed]:
     data-embed="image"   <a href="images/X.webp">          -> inline image
     data-embed="gizmo"   <a data-src="/tool/?embed=1">     -> inline tool (iframe)
     data-embed="player"  <a data-target="element-id">      -> existing player block (SoundCloud, Spotify...)
     data-embed="video"   <a data-target="element-id">      -> existing video block
     data-embed="bar"     <details data-src="/tool/?embed=1"> -> dropdown bar holding a tool (suite / app)
   Navigation: arrow buttons (placed at each element's vertical midpoint), Left/Right keys, horizontal swipes. */
(function () {
  'use strict';
  var W = window, D = document;
  var items = [], cur = -1, HEAD_GAP = 8;
  var SVG = {
    '-1': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    '1': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>'
  };

  function qsa(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function isTyping(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable || !!(t.closest && t.closest('.dd-list,#em-install-modal'));
  }
  function vh() { return W.innerHeight || D.documentElement.clientHeight; }

  /* ---------- build the item list in document order ---------- */
  function build() {
    items = qsa('[data-embed]').map(function (el, i) {
      var type = el.getAttribute('data-embed');
      var it = { i: i, el: el, type: type, box: null, frame: null, open: false, h: 0 };
      it.entry = type === 'bar' ? el : (el.closest('.pub-entry,.entry') || el);
      el._emItem = it;
      return it;
    });
    items.forEach(function (it) {
      if (it.type === 'player' || it.type === 'video') {
        var box = D.getElementById(it.el.getAttribute('data-target'));
        if (box) { it.box = box; box.classList.add('embed-box', it.type === 'video' ? 'embed-video' : 'embed-player'); box.style.display = ''; addArrows(it); it.frame = box.querySelector('iframe'); }
      } else if (it.type === 'bar') {
        var b = it.el.querySelector(':scope > .embed-box');
        if (b) { it.box = b; b.classList.add('gizmo-box'); addArrows(it); }
        it.el.addEventListener('toggle', function () { syncBar(it); });
        if (it.el.open) syncBar(it);
      }
    });
  }

  function addArrows(it) {
    [-1, 1].forEach(function (dir) {
      var b = D.createElement('button');
      b.type = 'button';
      b.className = 'nav-arrow nav-arrow-' + (dir < 0 ? 'prev' : 'next');
      b.setAttribute('aria-label', dir < 0 ? 'Previous' : 'Next');
      b.title = dir < 0 ? 'Previous (Left arrow)' : 'Next (Right arrow)';
      b.innerHTML = SVG[dir];
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); navigate(dir, it); });
      it.box.appendChild(b);
    });
    updateArrows(it);
  }
  function updateArrows(it) {
    if (!it.box) return;
    var p = it.box.querySelector(':scope > .nav-arrow-prev'), n = it.box.querySelector(':scope > .nav-arrow-next');
    if (p) p.classList.toggle('is-off', it.i === 0);
    if (n) n.classList.toggle('is-off', it.i === items.length - 1);
  }

  function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + String(sec).padStart(2, '0');
  }

  function setupPieceAudio(it, audioSrc, player) {
    var a = new Audio();
    a.preload = 'metadata';
    a.src = audioSrc;
    it.audio = a;

    var curSpan = player.querySelector('.time-cur');
    var totSpan = player.querySelector('.time-tot');
    var bar = player.querySelector('.progress-bar');
    var fill = player.querySelector('.progress-fill');
    var playBtn = player.querySelector('.play-btn');
    var playIcon = player.querySelector('.icon-play');
    var pauseIcon = player.querySelector('.icon-pause');
    var skipbBtn = player.querySelector('.btn-skipb');
    var skipfBtn = player.querySelector('.btn-skipf');

    function updateIcons() {
      if (a.paused) {
        if (playIcon) playIcon.style.display = '';
        if (pauseIcon) pauseIcon.style.display = 'none';
      } else {
        if (playIcon) playIcon.style.display = 'none';
        if (pauseIcon) pauseIcon.style.display = '';
      }
    }

    a.addEventListener('loadedmetadata', function () {
      if (totSpan) totSpan.textContent = fmtTime(a.duration);
    });

    a.addEventListener('timeupdate', function () {
      if (curSpan) curSpan.textContent = fmtTime(a.currentTime);
      if (a.duration && fill) {
        var pct = (a.currentTime / a.duration) * 100;
        fill.style.width = pct + '%';
      }
    });

    a.addEventListener('ended', function () {
      updateIcons();
      if (fill) fill.style.width = '0%';
      a.currentTime = 0;
      if (curSpan) curSpan.textContent = '0:00';
    });

    if (playBtn) {
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (a.paused) {
          items.forEach(function (other) {
            if (other !== it && other.audio && !other.audio.paused) {
              other.audio.pause();
              if (other.player) {
                var pI = other.player.querySelector('.icon-play');
                var paI = other.player.querySelector('.icon-pause');
                if (pI) pI.style.display = '';
                if (paI) paI.style.display = 'none';
              }
            }
          });
          a.play().catch(function () {});
        } else {
          a.pause();
        }
        updateIcons();
      });
    }

    if (skipbBtn) {
      skipbBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        a.currentTime = Math.max(0, a.currentTime - 10);
      });
    }

    if (skipfBtn) {
      skipfBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        a.currentTime = Math.min(a.duration || 0, a.currentTime + 10);
      });
    }

    if (bar) {
      bar.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!a.duration) return;
        var rect = bar.getBoundingClientRect();
        var clickX = e.clientX - rect.left;
        var pct = Math.max(0, Math.min(1, clickX / rect.width));
        a.currentTime = pct * a.duration;
      });
    }
  }

  /* ---------- lazily create boxes ---------- */
  function ensureBox(it) {
    if (it.box) return it.box;
    var box = D.createElement('div');
    if (it.type === 'image') {
      box.className = 'embed-box image-box';

      var sec = it.entry && it.entry.closest && it.entry.closest('.section-content');
      var h2 = sec && sec.previousElementSibling;
      var secId = h2 ? (h2.id || '').toLowerCase() : '';
      var hasAudio = ['poetry', 'fiction', 'nonfiction', 'humor'].indexOf(secId) >= 0 &&
                     (it.entry.textContent || '').indexOf('Forthcoming') < 0;

      if (hasAudio) {
        var href = it.el.getAttribute('href') || '';
        var base = href.replace(/^.*\/|\.[^.]+$/g, '');
        var audioSrc = '/audio/' + base + '.mp3';

        var player = D.createElement('div');
        player.className = 'piece-player';
        player.innerHTML =
          '<div class="time-progress-row">' +
            '<span class="time-cur">0:00</span>' +
            '<div class="progress-bar"><div class="progress-fill"></div></div>' +
            '<span class="time-tot">0:00</span>' +
          '</div>' +
          '<div class="btn-row">' +
            '<button type="button" class="audio-btn btn-skipb" title="Back 10s">' +
              '<svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>' +
            '</button>' +
            '<button type="button" class="audio-btn play-btn" title="Play">' +
              '<svg class="icon-play" viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19"/></svg>' +
              '<svg class="icon-pause" viewBox="0 0 24 24" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
            '</button>' +
            '<button type="button" class="audio-btn btn-skipf" title="Forward 10s">' +
              '<svg viewBox="0 0 24 24"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/></svg>' +
            '</button>' +
          '</div>';

        box.appendChild(player);
        it.player = player;
        setupPieceAudio(it, audioSrc, player);
      }

      var img = D.createElement('img');
      img.className = 'inline-poem-img';
      img.alt = (it.el.textContent || '').trim() || it.el.getAttribute('alt') || 'Image';
      img.addEventListener('click', function () { closeItem(it); });
      box.appendChild(img); it.img = img;
    } else if (it.type === 'gizmo') {
      box.className = 'embed-box gizmo-box';
    }
    it.entry.parentNode.insertBefore(box, it.entry.nextSibling);
    it.box = box; addArrows(it);
    return box;
  }

  /* ---------- sizing ---------- */
  function capPx(it) {
    /* never taller than 65% of the viewport, and always leave room for the text entry above it */
    var v = vh(), entryH = it.entry && it.entry !== it.el ? it.entry.offsetHeight : 0;
    var playerH = it.player ? it.player.offsetHeight : 0;
    var c = Math.min(v * 0.65, v - entryH - playerH - 40);
    return Math.max(220, Math.floor(c));
  }
  function applySize(it) {
    if (!it.open || !it.box) return;
    if (it.type === 'image' && it.img) it.img.style.maxHeight = Math.min(capPx(it), 1000) + 'px';
    if ((it.type === 'gizmo' || it.type === 'bar') && it.frame) {
      var pad = 28 + 2;
      var cap = Math.max(200, capPx(it) - pad);
      it.frame.style.height = Math.min(it.h || 320, cap) + 'px';
      it.frame.style.overflowY = (it.h && it.h > cap) ? 'auto' : 'hidden';
      it.frame.setAttribute('scrolling', (it.h && it.h > cap) ? 'yes' : 'no');
    }
  }
  function tellVh(it) {
    try { if (it.frame && it.frame.contentWindow) it.frame.contentWindow.postMessage({ type: 'em-vh', vh: vh() }, '*'); } catch (e) {}
  }

  /* ---------- open / close ---------- */
  function loadFrame(it, src) {
    if (!it.frame) {
      var f = D.createElement('iframe');
      f.className = 'gizmo-frame';
      f.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; clipboard-write; microphone; camera');
      f.setAttribute('title', (it.el.textContent || '').trim() || 'Embedded tool');
      f.addEventListener('load', function () { tellVh(it); });
      it.frame = f;
      var anchor = it.box.querySelector('.nav-arrow');
      it.box.insertBefore(f, anchor);
      f.src = src;
    }
  }
  function load(it) {
    if (it.type === 'image') {
      var href = it.el.getAttribute('href');
      if (it.img && it.img.getAttribute('src') !== href) it.img.src = href;
    } else if (it.type === 'gizmo') {
      loadFrame(it, it.el.getAttribute('data-src'));
    } else if (it.type === 'bar') {
      loadFrame(it, it.el.getAttribute('data-src'));
    } else if (it.type === 'player' && it.frame) {
      var o = it.frame.getAttribute('data-original-src'); if (o && it.frame.getAttribute('src') !== o) it.frame.src = o;
    } else if (it.type === 'video' && it.frame) {
      var ov = it.frame.getAttribute('data-original-src') || it.frame.getAttribute('src');
      if (!it.frame.getAttribute('data-original-src')) it.frame.setAttribute('data-original-src', ov);
      if (it.frame.getAttribute('src') !== ov) it.frame.src = ov;
    }
  }
  function unload(it) {
    if (it.type === 'player' || it.type === 'video') { if (it.frame) it.frame.src = ''; }
    else if ((it.type === 'gizmo' || it.type === 'bar') && it.frame) {
      try { var w = it.frame.contentWindow; if (w && w.emPause) w.emPause(); } catch (e) {}
    }
    if (it.audio && !it.audio.paused) {
      it.audio.pause();
      if (it.player) {
        var pIcon = it.player.querySelector('.icon-play');
        var paIcon = it.player.querySelector('.icon-pause');
        if (pIcon) pIcon.style.display = '';
        if (paIcon) paIcon.style.display = 'none';
      }
    }
  }
  function log(it) {
    if (!W.logAction) return;
    try {
      if (it.type === 'player') W.logAction('music', it.el.getAttribute('data-target'));
      else if (it.type === 'video') W.logAction('video', it.el.getAttribute('data-target'));
      else if (it.type === 'gizmo' || it.type === 'bar') W.logAction('gizmo', (it.el.textContent || '').trim().slice(0, 60) || it.el.getAttribute('data-src'));
      else {
        var sec = it.entry.closest('.section-content'), h = sec && sec.previousElementSibling;
        var cat = h ? (h.id || h.textContent.replace(/[\u25BE\u25BC]/g, '').trim().toLowerCase()) : 'content';
        W.logAction(cat, (it.el.textContent || '').trim() || it.el.getAttribute('href'));
      }
    } catch (e) {}
  }

  function lastOpen() {
    for (var i = items.length - 1; i >= 0; i--) if (items[i].open) return i;
    return -1;
  }
  function closeOthers(except) {
    items.forEach(function (o) { if (o !== except && o.open && o.type !== 'bar') closeItem(o, true); });
  }
  function openItem(it) {
    if (it.open) return;
    if (it.type !== 'bar') closeOthers(it);
    var box = ensureBox(it);
    it.open = true; cur = it.i;
    box.classList.add('is-open');
    load(it); updateArrows(it); applySize(it); tellVh(it);
    scrollToEntry(it);
    log(it);
  }
  function closeItem(it, quiet) {
    if (!it.open) return;
    it.open = false;
    if (it.box) it.box.classList.remove('is-open');
    unload(it);
    if (cur === it.i) cur = lastOpen();
    if (!quiet) updateAllArrows();
  }
  function updateAllArrows() { items.forEach(updateArrows); }
  function toggle(it) { it.open ? closeItem(it) : openItem(it); }

  /* dropdown-bar items (<details>): native toggle drives state */
  function syncBar(it) {
    var isOpen = it.el.open;
    if (isOpen && !it.open) {
      it.open = true; cur = it.i;
      if (it.box) { it.box.classList.add('is-open'); load(it); applySize(it); tellVh(it); }
      updateArrows(it); log(it);
    } else if (!isOpen && it.open) {
      it.open = false; unload(it);
      if (cur === it.i) cur = lastOpen();
    }
  }
  function openBar(it) { it.el.open = true; syncBar(it); }
  function closeBar(it) { it.el.open = false; syncBar(it); }

  function navigate(dir, from) {
    var f = from || items[cur];
    if (!f) return;
    var t = items[f.i + dir];
    if (!t) return;
    if (f.type === 'bar') { closeBar(f); }
    else closeItem(f, true);
    if (t.type === 'bar') { openBar(t); scrollToEntry(t); }
    else openItem(t);
    updateAllArrows();
  }

  /* ---------- scrolling: always land on the text entry (thumbnail + text) above the embedded element ---------- */
  function ensureSectionOpen(el) {
    var sec = el.closest && el.closest('.section-content');
    if (sec && sec.classList.contains('collapsed')) {
      var h = sec.previousElementSibling;
      if (W.toggleSection && h) W.toggleSection(h);
      else { sec.classList.remove('collapsed'); if (h) h.classList.remove('collapsed'); }
    }
  }
  function scrollToEntry(it) {
    var target = it.entry || it.el;
    ensureSectionOpen(target);
    var go = function (smooth) {
      var y = target.getBoundingClientRect().top + W.pageYOffset - HEAD_GAP;
      W.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
    };
    go(true);
    /* correct any drift caused by layout shifts while the smooth scroll runs */
    [650, 1500].forEach(function (ms) {
      setTimeout(function () {
        var d = target.getBoundingClientRect().top - HEAD_GAP;
        if (Math.abs(d) > 3 && it.open) go(false);
      }, ms);
    });
  }

  /* ---------- events ---------- */
  D.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-embed]');
    if (!a || !a._emItem || a._emItem.type === 'bar') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    toggle(a._emItem);
  });

  function forwardKey(it, e) {
    try {
      var d = it.frame && it.frame.contentDocument;
      if (d) d.dispatchEvent(new KeyboardEvent('keydown', { key: e.key, code: e.code, bubbles: true, cancelable: true }));
    } catch (x) {}
  }
  function frameHasFile(it) {
    try { return !!(it.frame && it.frame.contentWindow && it.frame.contentWindow.hasActiveFile && it.frame.contentWindow.hasActiveFile()); } catch (e) { return false; }
  }
  D.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isTyping(e.target) || cur < 0) return;
    if (e.key === 'Escape') { var o = items[cur]; if (o && o.type !== 'bar') closeItem(o); return; }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    var it = items[cur];
    if (!it || !it.open) return;
    if ((it.type === 'gizmo' || it.type === 'bar') && frameHasFile(it)) { e.preventDefault(); forwardKey(it, e); return; }
    if (it.audio && !it.audio.paused) {
      e.preventDefault();
      var diff = e.key === 'ArrowLeft' ? -10 : 10;
      it.audio.currentTime = Math.max(0, Math.min(it.audio.duration || 0, it.audio.currentTime + diff));
      return;
    }
    e.preventDefault();
    navigate(e.key === 'ArrowLeft' ? -1 : 1, it);
  });

  var sx = 0, sy = 0, sOK = false;
  D.addEventListener('touchstart', function (e) {
    sOK = cur >= 0 && e.touches.length === 1 && !isTyping(e.target) && !(e.target.closest && e.target.closest('input,[data-noswipe]'));
    if (sOK) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
  }, { passive: true });
  D.addEventListener('touchend', function (e) {
    if (!sOK || cur < 0 || e.changedTouches.length !== 1) return;
    var it = items[cur]; if (!it || !it.open || !it.box) return;
    var r = it.box.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh()) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if ((it.type === 'gizmo' || it.type === 'bar') && frameHasFile(it)) return;
      navigate(dx > 0 ? -1 : 1, it);
    }
  }, { passive: true });

  W.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || typeof d !== 'object' || !d.type) return;
    var it = null;
    for (var i = 0; i < items.length; i++) if (items[i].frame && items[i].frame.contentWindow === e.source) { it = items[i]; break; }
    if (!it) return;
    if (d.type === 'em-height') { it.h = d.h; applySize(it); }
    else if (d.type === 'em-hello') { tellVh(it); }
    else if (d.type === 'em-nav') { if (it.open) navigate(d.dir, it); }
  });
  var rT = 0;
  W.addEventListener('resize', function () {
    clearTimeout(rT);
    rT = setTimeout(function () { items.forEach(function (it) { if (it.open) { applySize(it); tellVh(it); } }); }, 80);
  });

  W.Embed = {
    items: function () { return items; },
    current: function () { return cur; },
    open: function (i) { if (items[i]) { items[i].type === 'bar' ? openBar(items[i]) : openItem(items[i]); } },
    close: function (i) { if (items[i]) { items[i].type === 'bar' ? closeBar(items[i]) : closeItem(items[i]); } },
    navigate: navigate,
    openAllBars: function () { items.forEach(function (it) { if (it.type === 'bar') openBar(it); }); updateAllArrows(); },
    closeAllBars: function () { items.forEach(function (it) { if (it.type === 'bar') closeBar(it); }); updateAllArrows(); },
    allBarsOpen: function () { var b = items.filter(function (i) { return i.type === 'bar'; }); return b.length > 0 && b.every(function (i) { return i.el.open; }); },
    allBarsClosed: function () { return items.filter(function (i) { return i.type === 'bar'; }).every(function (i) { return !i.el.open; }); }
  };

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', build); else build();
})();
