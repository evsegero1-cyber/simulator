/* UI-ядро: иконки, модальные окна, уведомления, анимация чисел, общие компоненты */
var MS = globalThis.MS = globalThis.MS || {};

MS.ui = (function () {
  const U = MS.util;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = U.esc;

  const IC = {
    dash: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
    sits: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    fin: '<path d="M12 2v20M17 6.5c0-1.9-2.2-3.5-5-3.5S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5S14.8 17 12 17s-5-1.6-5-3.5"/>',
    staff: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.5 3.3-5.5 6.5-5.5s5.8 2 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.6c2.6.2 4.4 2 5 4.9"/>',
    prod: '<path d="M3 21V9l6 4V9l6 4V4h6v17z"/><path d="M7 17h2M12 17h2M17 17h2"/>',
    mkt: '<path d="M3 11v3l12 5V6L3 11z"/><path d="M15 9a3 3 0 010 6M6 14.5V19h3v-3.5"/>',
    strat: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    journal: '<path d="M5 3h12a2 2 0 012 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 012-2z"/><path d="M9 8h6M9 12h6"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z"/><path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    manage: '<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>',
    next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', check: '<path d="M5 12l5 5L20 7"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8M8 21v-7h8v7"/>',
    play: '<path d="M7 4l13 8-13 8z"/>', folder: '<path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    manufacturing: '<path d="M3 21V10l6 3V9l6 3V5h6v16z"/>',
    trade: '<path d="M3 4h2l2.4 11.2a2 2 0 002 1.6h7.7a2 2 0 002-1.5L21 8H6"/><circle cx="10" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    construction: '<path d="M2 20h20M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',
    it: '<path d="M8 8l-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>',
    food: '<path d="M7 3v8a3 3 0 003 3v7M10 3v6M4 3v6a3 3 0 003 3M17 3c-2 2-2 6 0 8v10"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>'
  };
  const icon = (n, cls) => '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (IC[n] || IC.info) + '</svg>';

  /* ---------- Уведомления ---------- */
  function toast(text, tone) {
    let w = $('.toast-wrap'); if (!w) { w = document.createElement('div'); w.className = 'toast-wrap'; document.body.appendChild(w); }
    const t = document.createElement('div'); t.className = 'toast ' + (tone || ''); t.textContent = text; w.appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
    if (tone === 'bad') vibrate(30);
  }
  function vibrate(ms) { try { if (MS.store.prefs().haptics && navigator.vibrate) navigator.vibrate(ms); } catch (e) { } }

  /* ---------- Модальные окна (стек) ---------- */
  const stack = [];
  function modal(opts) {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '"><div class="modal-h">' + (opts.icon ? opts.icon : '') + '<h2>' + opts.title + '</h2><button class="btn ghost sm" data-close>' + icon('close') + '</button></div><div class="modal-b">' + (opts.body || '') + '</div>' + (opts.foot ? '<div class="modal-f">' + opts.foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov);
    const m = { el: ov, close: () => { ov.remove(); const i = stack.indexOf(m); if (i >= 0) stack.splice(i, 1); if (opts.onClose) opts.onClose(); } };
    ov.addEventListener('click', e => {
      if (e.target === ov && !opts.sticky) return m.close();
      if (e.target.closest('[data-close]')) return m.close();
      const a = e.target.closest('[data-m]');
      if (a && opts.actions && opts.actions[a.dataset.m]) opts.actions[a.dataset.m](a, m);
    });
    ov.addEventListener('input', e => { if (opts.onInput) opts.onInput(e, m); });
    ov.addEventListener('change', e => { if (opts.onChange) opts.onChange(e, m); });
    stack.push(m);
    if (opts.onOpen) opts.onOpen(m);
    MS.app && MS.app.hydrate(ov);
    return m;
  }
  function closeTop() { const m = stack[stack.length - 1]; if (m) { m.close(); return true; } return false; }
  function closeAll() { while (stack.length) stack[stack.length - 1].close(); }
  function confirm(title, text, okText, cb, danger) {
    modal({ title, body: '<p>' + text + '</p>', foot: '<button class="btn" data-close>Отмена</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-m="ok">' + (okText || 'OK') + '</button>', actions: { ok: (a, m) => { m.close(); cb(); } } });
  }

  /* ---------- Анимация чисел ---------- */
  function animateNumbers(root) {
    if (!MS.store.prefs().anim) return;
    $$('[data-anim]', root).forEach(el => {
      const to = parseFloat(el.dataset.anim), from = parseFloat(el.dataset.from);
      const fmt = el.dataset.fmt;
      if (isNaN(from) || isNaN(to) || from === to) return;
      const t0 = performance.now(), dur = 900;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = fmtv(from + (to - from) * e, fmt);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      const card = el.closest('.kpi'); if (card) card.classList.add('flash');
    });
  }
  function fmtv(v, f) {
    switch (f) {
      case 'money': return U.money(v);
      case 'pct': return U.pct(v);
      case 'pct0': return U.pct(v, 0);
      case 'int': return U.num(v);
      case 'd1': return U.num(v, 1);
      default: return U.num(v);
    }
  }

  /* ---------- Компоненты ---------- */
  function delta(v, f, invert) {
    if (v == null || isNaN(v) || Math.abs(v) < 1e-9) return '<span class="dim">без изменений</span>';
    const good = invert ? v < 0 : v > 0;
    return '<span class="' + (good ? 'good' : 'bad') + '">' + (v > 0 ? '▲ ' : '▼ ') + fmtv(Math.abs(v), f) + '</span>';
  }
  function factors(list, opts) {
    opts = opts || {};
    const max = Math.max(0.0001, ...list.map(x => Math.abs(x.v)));
    return list.filter(x => opts.all || Math.abs(x.v) > 1e-6).map(x => {
      const pos = x.v >= 0, w = Math.abs(x.v) / max * 50;
      const val = x.fmt === 'pct' ? U.signed(x.v * 100, v => U.num(v, 1) + '%') : x.fmt === 'units' ? U.num(x.v) : U.signed(x.v, v => U.num(v, opts.d != null ? opts.d : 1));
      const tag = x.g === 'h' ? ' <span class="chip tiny" title="Гигиенический фактор">гигиена</span>' : x.g === 'm' ? ' <span class="chip accent tiny" title="Мотиватор">мотиватор</span>' : '';
      return '<div class="factor"><span>' + esc(x.l) + tag + '</span><b class="' + (x.fmt === 'units' ? '' : pos ? 'good' : 'bad') + '">' + val + '</b>' +
        (x.fmt === 'units' ? '' : '<div class="fbar"><i style="left:' + (pos ? 50 : 50 - w) + '%;width:' + w + '%;background:' + (pos ? 'var(--good)' : 'var(--bad)') + '"></i></div>') + '</div>';
    }).join('');
  }
  function seg(name, options, cur, arg) {
    return '<div class="seg">' + options.map(o => '<button data-act="' + name + '" data-v="' + o.v + '"' + (arg ? ' data-arg="' + arg + '"' : '') + ' class="' + (String(o.v) === String(cur) ? 'on' : '') + '">' + o.l + '</button>').join('') + '</div>';
  }
  function range(name, min, max, step, val, arg) {
    const p = (val - min) / (max - min) * 100;
    return '<input type="range" data-input="' + name + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"' + (arg ? ' data-arg="' + arg + '"' : '') + ' style="--p:' + p + '%">';
  }
  function bar(v, color, lg) { return '<div class="bar ' + (lg ? 'lg' : '') + '"><i style="width:' + U.clamp(v, 0, 1) * 100 + '%;' + (color ? 'background:' + color : '') + '"></i></div>'; }
  function toneOf(v, good, bad, invert) {
    if (invert) return v <= good ? 'good' : v >= bad ? 'bad' : 'warn';
    return v >= good ? 'good' : v <= bad ? 'bad' : 'warn';
  }
  function theoryChips(ids) {
    return (ids || []).map(id => MS.THEORY[id] ? '<span class="chip accent th-chip" data-act="theory" data-arg="' + id + '">' + icon('library', '') .replace('<svg', '<svg style="width:13px;height:13px"') + esc(MS.THEORY[id].title) + '</span>' : '').join(' ');
  }
  function openTheory(id) {
    const t = MS.THEORY[id]; if (!t) return;
    modal({ title: t.title, body: '<div class="muted small mb8">' + esc(t.author) + '</div><p><b>' + esc(t.short) + '</b></p><p>' + esc(t.text) + '</p><div class="hint mt12">' + icon('bulb').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px;margin-right:6px"') + esc(t.game) + '</div>' });
  }
  function empty(text, ic) { return '<div class="empty">' + icon(ic || 'info') + '<div>' + text + '</div></div>'; }

  return { $, $$, esc, icon, toast, vibrate, modal, closeTop, closeAll, confirm, animateNumbers, fmtv, delta, factors, seg, range, bar, toneOf, theoryChips, openTheory, empty, stack };
})();
