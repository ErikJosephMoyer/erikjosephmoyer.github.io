/* site.js - shared by every page.
   1. Embed mode (?embed=1 or framed): hides logos/headers/footers via CSS class, reports height to parent,
      forwards unhandled left/right keys and horizontal swipes to the parent so it can step to the next feature.
   2. Dropdowns: every <select> becomes the same custom dropdown (same filled caret, per-option font previews,
      type-ahead). The native <select> stays in the DOM so existing page code keeps working.
   3. PWA install helper (window.EM.install / EM.isInstalled). */
(function () {
  'use strict';
  var D = document, W = window, root = D.documentElement;

  /* ================= 1. EMBED MODE ================= */
  var EMB = false;
  try { EMB = /(^|[?&])embed=1(&|$)/.test(location.search) || W.self !== W.top; } catch (e) { EMB = true; }
  if (EMB) root.classList.add('embedded');

  function isTypingTarget(t) {
    if (!t || !t.tagName) return false;
    var n = t.tagName;
    return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable || (t.closest && t.closest('.dd-list'));
  }
  function hasFile() { try { return !!(W.hasActiveFile && W.hasActiveFile()); } catch (e) { return false; } }

  if (EMB) {
    var lastH = 0, raf = 0;
    var report = function () {
      raf = 0;
      if (!D.body) return;
      var h = Math.ceil(Math.max(D.body.offsetHeight, D.body.scrollHeight));
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      try { W.parent.postMessage({ type: 'em-height', h: h, path: location.pathname }, '*'); } catch (e) {}
    };
    var schedule = function () { if (!raf) raf = W.requestAnimationFrame(report); };
    var startObs = function () {
      if (!D.body) return;
      if (W.ResizeObserver) new ResizeObserver(schedule).observe(D.body);
      new MutationObserver(schedule).observe(D.body, { childList: true, subtree: true, attributes: true });
      W.addEventListener('load', schedule); W.addEventListener('resize', schedule);
      schedule(); setTimeout(schedule, 400); setTimeout(schedule, 1500);
    };
    if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', startObs); else startObs();

    /* parent tells us its viewport height so vh-based layouts do not feed back into the iframe size */
    W.addEventListener('message', function (e) {
      var d = e.data;
      if (d && d.type === 'em-vh' && d.vh) { root.style.setProperty('--pvh', (d.vh / 100) + 'px'); schedule(); }
    });
    try { W.parent.postMessage({ type: 'em-hello', path: location.pathname }, '*'); } catch (e) {}

    /* Unhandled left/right keys go to the parent (page handlers call preventDefault when they act on a file) */
    W.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (isTypingTarget(e.target) || hasFile()) return;
      e.preventDefault();
      try { W.parent.postMessage({ type: 'em-nav', dir: e.key === 'ArrowLeft' ? -1 : 1 }, '*'); } catch (x) {}
    });
    /* Horizontal swipes go to the parent unless a file is open (swipes may be page turns) */
    var sx = 0, sy = 0, sOK = false;
    D.addEventListener('touchstart', function (e) {
      sOK = e.touches.length === 1 && !isTypingTarget(e.target) && !(e.target.closest && e.target.closest('input,canvas,[data-noswipe],#ch-bar,#reader-pane'));
      if (sOK) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
    }, { passive: true });
    D.addEventListener('touchend', function (e) {
      if (!sOK || e.changedTouches.length !== 1 || hasFile()) return;
      var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8) {
        try { W.parent.postMessage({ type: 'em-nav', dir: dx > 0 ? -1 : 1 }, '*'); } catch (x) {}
      }
    }, { passive: true });
  }

  /* ================= 2. DROPDOWNS ================= */
  var all = [];
  var protoVal = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  var protoIdx = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'selectedIndex');
  var openDD = null;

  function optFont(o) { return (o.style && o.style.fontFamily) || o.getAttribute('data-font') || ''; }

  function enhance(sel) {
    if (sel._dd || sel.multiple || sel.size > 1 || !sel.parentNode) return;
    var cs = getComputedStyle(sel);
    var par = sel.parentNode, pcs = getComputedStyle(par);
    var wrap = D.createElement('div'); wrap.className = 'dd';
    var btn = D.createElement('button'); btn.type = 'button'; btn.className = 'dd-btn';
    btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    var label = D.createElement('span'); label.className = 'dd-label';
    var caret = D.createElement('span'); caret.className = 'dd-caret'; caret.setAttribute('aria-hidden', 'true');
    btn.appendChild(label); btn.appendChild(caret);
    var list = D.createElement('ul'); list.className = 'dd-list'; list.setAttribute('role', 'listbox'); list.hidden = true;

    /* carry layout from the native select to the wrapper */
    var inFlex = /flex/.test(pcs.display);
    if (inFlex) { wrap.style.flex = cs.flex; wrap.style.minWidth = '0'; }
    if (cs.marginTop !== '0px' || cs.marginBottom !== '0px' || cs.marginLeft !== '0px' || cs.marginRight !== '0px') wrap.style.margin = cs.margin;
    if (!inFlex && sel.offsetWidth && par.clientWidth && sel.offsetWidth < par.clientWidth * 0.8) { wrap.classList.add('dd-inline'); wrap.style.width = sel.offsetWidth + 'px'; }
    wrap.style.fontSize = cs.fontSize; wrap.style.fontFamily = cs.fontFamily;
    if (sel.style.display === 'none' || sel.hidden) wrap.classList.add('dd-hidden');

    par.insertBefore(wrap, sel);
    wrap.appendChild(btn); wrap.appendChild(list); wrap.appendChild(sel);
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    var st = { sel: sel, wrap: wrap, btn: btn, label: label, list: list, hl: -1, typed: '', typedT: 0, lastSig: '' };
    sel._dd = st; all.push(st);

    /* programmatic changes keep the label in sync */
    try {
      Object.defineProperty(sel, 'value', { configurable: true, get: function () { return protoVal.get.call(this); }, set: function (v) { protoVal.set.call(this, v); sync(st); } });
      Object.defineProperty(sel, 'selectedIndex', { configurable: true, get: function () { return protoIdx.get.call(this); }, set: function (v) { protoIdx.set.call(this, v); sync(st); } });
    } catch (e) {}
    new MutationObserver(function () { sync(st); if (!list.hidden) build(st); })
      .observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'disabled', 'hidden', 'class', 'selected'] });
    sel.addEventListener('change', function () { sync(st); });
    if (sel.form) sel.form.addEventListener('reset', function () { setTimeout(function () { sync(st); }, 0); });

    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); list.hidden ? open(st) : close(st); });
    btn.addEventListener('keydown', function (e) { onKey(st, e); });
    list.addEventListener('mousedown', function (e) { e.preventDefault(); });
    list.addEventListener('click', function (e) {
      var li = e.target.closest('.dd-item'); if (!li || li.classList.contains('dd-off')) return;
      choose(st, +li.getAttribute('data-i'));
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.dd-item'); if (li && !li.classList.contains('dd-off')) hilite(st, +li.getAttribute('data-i'), true);
    });
    sync(st);
  }

  function sync(st) {
    var sel = st.sel, o = sel.options[protoIdx.get.call(sel)];
    var txt = o ? o.text : '';
    if (st.label.textContent !== txt) st.label.textContent = txt;
    st.label.style.fontFamily = o ? optFont(o) : '';
    st.btn.classList.toggle('ph', !!o && o.value === '' && o.disabled);
    st.btn.disabled = sel.disabled;
    st.wrap.classList.toggle('dd-hidden', sel.style.display === 'none' || sel.hidden);
    if (sel.title) st.btn.title = sel.title;
    var al = sel.getAttribute('aria-label'); if (al) st.btn.setAttribute('aria-label', al);
  }

  function build(st) {
    var sel = st.sel, frag = D.createDocumentFragment(), cur = protoIdx.get.call(sel);
    st.list.textContent = '';
    for (var i = 0; i < sel.options.length; i++) {
      var o = sel.options[i], li = D.createElement('li');
      li.className = 'dd-item' + (o.disabled ? ' dd-off' : '');
      li.setAttribute('role', 'option'); li.setAttribute('data-i', i);
      li.setAttribute('aria-selected', i === cur ? 'true' : 'false');
      li.textContent = o.text;
      var f = optFont(o); if (f) li.style.fontFamily = f;
      frag.appendChild(li);
    }
    st.list.appendChild(frag);
    st.hl = cur;
  }

  function hilite(st, i, noScroll) {
    var items = st.list.children;
    if (st.hl >= 0 && items[st.hl]) items[st.hl].classList.remove('hl');
    st.hl = i;
    if (i >= 0 && items[i]) {
      items[i].classList.add('hl');
      if (!noScroll) {
        var it = items[i], l = st.list;
        if (it.offsetTop < l.scrollTop) l.scrollTop = it.offsetTop;
        else if (it.offsetTop + it.offsetHeight > l.scrollTop + l.clientHeight) l.scrollTop = it.offsetTop + it.offsetHeight - l.clientHeight;
      }
    }
  }

  function open(st) {
    if (st.sel.disabled) return;
    if (openDD && openDD !== st) close(openDD);
    build(st);
    st.list.hidden = false; st.wrap.classList.add('open'); st.btn.setAttribute('aria-expanded', 'true'); openDD = st;
    /* flip upward if there is no room below and more room above */
    st.wrap.classList.remove('up');
    var r = st.btn.getBoundingClientRect(), lh = Math.min(st.list.scrollHeight, 320);
    var below = (W.innerHeight - r.bottom), above = r.top;
    if (below < lh + 8 && above > below) st.wrap.classList.add('up');
    /* inside an auto-height iframe, make room so the list is not clipped */
    if (EMB && !st.wrap.classList.contains('up')) {
      var lb = st.list.getBoundingClientRect().bottom, bb = D.body.getBoundingClientRect().bottom;
      if (lb > bb) D.body.style.paddingBottom = Math.ceil(lb - bb + 24) + 'px';
    }
    hilite(st, protoIdx.get.call(st.sel));
  }
  function close(st) {
    if (!st || st.list.hidden) return;
    st.list.hidden = true; st.wrap.classList.remove('open'); st.btn.setAttribute('aria-expanded', 'false');
    if (openDD === st) openDD = null;
    if (EMB) D.body.style.paddingBottom = '';
  }
  function choose(st, i) {
    var sel = st.sel;
    if (i < 0 || i >= sel.options.length) return;
    var changed = protoIdx.get.call(sel) !== i;
    protoIdx.set.call(sel, i);
    sync(st); close(st); st.btn.focus({ preventScroll: true });
    if (changed) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function step(st, from, dir) {
    var n = st.sel.options.length;
    for (var i = from + dir; i >= 0 && i < n; i += dir) if (!st.sel.options[i].disabled) return i;
    return from;
  }
  function typeahead(st, ch) {
    var now = Date.now();
    st.typed = (now - st.typedT > 700 ? '' : st.typed) + ch.toLowerCase(); st.typedT = now;
    var n = st.sel.options.length, start = st.list.hidden ? protoIdx.get.call(st.sel) : st.hl;
    var single = st.typed.length > 1 && st.typed.split('').every(function (c) { return c === st.typed[0]; });
    var q = single ? st.typed[0] : st.typed;
    for (var k = 0; k < n; k++) {
      var i = (start + (st.typed.length === 1 || single ? 1 : 0) + k) % n, o = st.sel.options[i];
      if (!o.disabled && o.text.trim().toLowerCase().indexOf(q) === 0) return i;
    }
    return -1;
  }
  function onKey(st, e) {
    var k = e.key, isOpen = !st.list.hidden, cur = protoIdx.get.call(st.sel);
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (k === 'Tab') { close(st); return; }
    if (k === 'Escape') { if (isOpen) { e.preventDefault(); e.stopPropagation(); close(st); } return; }
    if (k === 'ArrowDown' || k === 'ArrowUp') {
      e.preventDefault(); e.stopPropagation();
      if (!isOpen) { open(st); return; }
      hilite(st, step(st, st.hl < 0 ? cur : st.hl, k === 'ArrowDown' ? 1 : -1)); return;
    }
    if (k === 'Home' || k === 'End') { if (isOpen) { e.preventDefault(); hilite(st, k === 'Home' ? step(st, -1, 1) : step(st, st.sel.options.length, -1)); } return; }
    if (k === 'Enter' || k === ' ') {
      if (k === ' ' && st.typed && Date.now() - st.typedT < 700) { /* space inside a typed phrase */ }
      else { e.preventDefault(); e.stopPropagation(); if (!isOpen) open(st); else choose(st, st.hl); return; }
    }
    if (k.length === 1 && /\S| /.test(k)) {
      e.stopPropagation();
      var i = typeahead(st, k);
      if (i >= 0) { e.preventDefault(); if (isOpen) hilite(st, i); else choose(st, i); }
    }
  }

  D.addEventListener('mousedown', function (e) { if (openDD && !openDD.wrap.contains(e.target)) close(openDD); }, true);
  D.addEventListener('touchstart', function (e) { if (openDD && !openDD.wrap.contains(e.target)) close(openDD); }, { passive: true, capture: true });
  W.addEventListener('blur', function () { if (openDD) close(openDD); });
  W.addEventListener('resize', function () { if (openDD) close(openDD); });

  function enhanceAll(scope) {
    var list = (scope || D).querySelectorAll('select');
    for (var i = 0; i < list.length; i++) { try { enhance(list[i]); } catch (e) { console.warn('dropdown enhance failed', e); } }
  }
  function boot() {
    enhanceAll();
    new MutationObserver(function (muts) {
      for (var m = 0; m < muts.length; m++) for (var a = 0; a < muts[m].addedNodes.length; a++) {
        var n = muts[m].addedNodes[a];
        if (n.nodeType === 1) { if (n.tagName === 'SELECT') enhance(n); else if (n.querySelector) enhanceAll(n); }
      }
    }).observe(D.body, { childList: true, subtree: true });
    setInterval(function () { for (var i = 0; i < all.length; i++) sync(all[i]); }, 600);
  }
  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot); else boot();

  /* ================= 3. PWA INSTALL HELPER ================= */
  var deferred = null, listeners = [];
  W.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; fire(); });
  W.addEventListener('appinstalled', function () { try { localStorage.setItem('pwa_installed', '1'); } catch (e) {} deferred = null; fire(); });
  function fire() { for (var i = 0; i < listeners.length; i++) { try { listeners[i](); } catch (e) {} } }
  function isInstalled() {
    try {
      if (localStorage.getItem('pwa_installed') === '1') return true;
      if (W.matchMedia && (W.matchMedia('(display-mode: standalone)').matches || W.matchMedia('(display-mode: window-controls-overlay)').matches)) return true;
      if (navigator.standalone === true) return true;
    } catch (e) {}
    return false;
  }
  if (navigator.getInstalledRelatedApps) {
    try { navigator.getInstalledRelatedApps().then(function (apps) { if (apps && apps.length) { try { localStorage.setItem('pwa_installed', '1'); } catch (e) {} fire(); } }).catch(function () {}); } catch (e) {}
  }
  function platformSteps() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return 'Tap the Share button, then choose \u201CAdd to Home Screen\u201D.';
    if (/Android/i.test(ua)) return 'Tap the browser menu (\u22EE), then choose \u201CInstall app\u201D or \u201CAdd to Home screen\u201D.';
    if (/Firefox/i.test(ua)) return 'Firefox on desktop cannot install web apps. Open this page in Chrome, Edge, or Safari.';
    if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg/i.test(ua)) return 'In the menu bar choose File, then \u201CAdd to Dock\u201D.';
    return 'Click the install icon at the right end of the address bar, or open the browser menu and choose \u201CInstall The Bibliotecher\u201D.';
  }
  function modal(withButton) {
    var old = D.getElementById('em-install-modal'); if (old) old.remove();
    var ov = D.createElement('div'); ov.id = 'em-install-modal';
    ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:20px';
    var box = D.createElement('div');
    box.style.cssText = 'background:#2a2a2a;color:#fff;border:1px solid #fff;border-radius:8px;max-width:420px;width:100%;padding:20px;text-align:center;font:16pt/1.2 "EB Garamond",serif';
    var h = D.createElement('div'); h.textContent = 'Install App'; h.style.cssText = 'font-size:20pt;margin:0 0 10px';
    var p = D.createElement('div'); p.textContent = platformSteps(); p.style.cssText = 'margin:0 0 16px;font-size:14pt;line-height:1.3';
    var row = D.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:center';
    function mk(t) { var b = D.createElement('button'); b.type = 'button'; b.textContent = t; b.style.cssText = 'background:#fff;color:#2a2a2a;border:none;font:16pt "EB Garamond",serif;padding:4px 18px;cursor:pointer;border-radius:4px'; return b; }
    var ok = mk('Close'); ok.onclick = function () { ov.remove(); };
    if (withButton) { var inst = mk('Install'); inst.onclick = function () { ov.remove(); nativePrompt(); }; row.appendChild(inst); }
    row.appendChild(ok);
    box.appendChild(h); box.appendChild(p); box.appendChild(row); ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    D.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { ov.remove(); D.removeEventListener('keydown', esc); } });
    D.body.appendChild(ov);
  }
  function nativePrompt() {
    var d = deferred; if (!d) return;
    d.prompt();
    d.userChoice.then(function (c) {
      if (c && c.outcome === 'accepted') { try { localStorage.setItem('pwa_installed', '1'); } catch (e) {} fire(); }
      deferred = null;
    });
  }
  W.EM = W.EM || {};
  W.EM.isInstalled = isInstalled;
  W.EM.canInstall = function () { return !!deferred; };
  W.EM.onInstallChange = function (fn) { listeners.push(fn); };
  W.EM.install = function () {
    if (isInstalled()) return;
    if (deferred) nativePrompt(); else modal(false);
  };
  W.EM.enhanceSelects = enhanceAll;
  W.EM.embedded = EMB;
})();
