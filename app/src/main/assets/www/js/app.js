/* Приложение: каркас, навигация, обработка действий, ход месяца */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.app = (function () {
  const U = MS.util, ui = MS.ui;
  const app = { route: 'dash', manageTab: 'fin', prevRec: null, animate: false };
  const NAV = [
    { r: 'dash', l: 'Панель', ic: 'dash' },
    { r: 'sits', l: 'Ситуации', ic: 'sits' },
    { sep: true },
    { r: 'fin', l: 'Финансы', ic: 'fin' },
    { r: 'staff', l: 'Персонал', ic: 'staff' },
    { r: 'prod', l: 'Производство', ic: 'prod' },
    { r: 'mkt', l: 'Маркетинг и рынок', ic: 'mkt' },
    { r: 'strat', l: 'Стратегия', ic: 'strat' },
    { sep: true },
    { r: 'reports', l: 'Отчёты и оценка', ic: 'reports' },
    { r: 'journal', l: 'Журнал событий', ic: 'journal' },
    { r: 'library', l: 'Теория менеджмента', ic: 'library' },
    { r: 'menu', l: 'Меню и сохранения', ic: 'menu' }
  ];
  const MANAGE = ['fin', 'staff', 'prod', 'mkt', 'strat'];
  const BOTTOM = [
    { r: 'dash', l: 'Панель', ic: 'dash' }, { r: 'sits', l: 'Ситуации', ic: 'sits' }, { r: 'manage', l: 'Управление', ic: 'manage' },
    { r: 'reports', l: 'Отчёты', ic: 'reports' }, { r: 'menu', l: 'Ещё', ic: 'menu' }
  ];
  const S = () => MS.game.s;
  const root = () => document.getElementById('app');

  function init() {
    applyPrefs();
    const last = MS.store.last();
    render();
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    window.addEventListener('resize', debounce(() => { if (S()) hydrateCharts(); }, 200));
    return last;
  }
  function applyPrefs() { document.body.classList.toggle('noanim', !MS.store.prefs().anim); }

  function render() {
    if (!S() || app.route === 'start') return renderStart();
    renderShell();
  }
  function renderStart() {
    app.route = 'start';
    root().innerHTML = MS.screens.start.render();
    hydrate(root());
  }
  function renderShell() {
    const s = S(); const I = MS.model.ind(s);
    const pend = s.pending.length;
    const isManage = MANAGE.includes(app.route);
    root().innerHTML =
      '<div class="shell"><aside class="side"><div class="brand"><div class="brand-logo">УС</div><div><div class="brand-t">Управленческий<br>симулятор</div></div></div>' +
      NAV.map(n => n.sep ? '<div class="nav-sep"></div>' : '<button class="nav-i ' + (app.route === n.r ? 'on' : '') + '" data-act="go" data-arg="' + n.r + '">' + ui.icon(n.ic) + '<span>' + n.l + '</span>' + (n.r === 'sits' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</button>').join('') +
      '<div style="margin-top:auto;padding-top:12px">' + turnButton(s, true) + '</div></aside>' +
      '<div class="main"><header class="top">' +
      (app.route !== 'dash' ? '<button class="btn ghost sm" data-act="go" data-arg="dash" style="padding:6px">' + ui.icon('back') + '</button>' : '') +
      '<div class="grow" style="min-width:0"><div class="top-title">' + ui.esc(s.company.name) + '</div><div class="top-sub">' + U.dateLabel(s.turn) + ' · ' + I.short + (s.status !== 'active' ? ' · <span class="bad">игра окончена</span>' : '') + '</div></div>' +
      '<div class="top-cash"><div class="tiny muted">Баланс</div><div class="v ' + (s.cash < 0 ? 'bad' : '') + '">' + U.money(s.cash) + '</div></div>' +
      '</header><div class="content" id="content"></div></div></div>' +
      '<nav class="bottom">' + BOTTOM.map(b => { const on = b.r === app.route || (b.r === 'manage' && isManage) || (b.r === 'reports' && app.route === 'journal') || (b.r === 'menu' && app.route === 'library'); return '<button class="' + (on ? 'on' : '') + '" data-act="go" data-arg="' + b.r + '">' + ui.icon(b.ic) + '<span>' + b.l + '</span>' + (b.r === 'sits' && pend ? '<span class="badge">' + pend + '</span>' : '') + '</button>'; }).join('') + '</nav>' +
      '<div class="fab">' + turnButton(s) + '</div>';
    renderContent();
  }
  function turnButton(s, block) {
    if (s.status !== 'active') return '<button class="btn primary ' + (block ? 'block' : '') + '" data-act="final">' + ui.icon('reports') + 'Итоговая оценка</button>';
    return '<button class="btn turn-btn lg ' + (block ? 'block' : '') + '" data-act="endTurn">Следующий месяц ' + ui.icon('next') + '</button>';
  }
  function renderContent(keepScroll) {
    const el = document.getElementById('content'); if (!el) return render();
    const sc = MS.screens[app.route]; if (!sc) { app.route = 'dash'; return renderContent(); }
    const y = window.scrollY;
    let html = '';
    if (MANAGE.includes(app.route)) html += '<div class="tabs">' + MANAGE.map(r => '<button class="tab ' + (r === app.route ? 'on' : '') + '" data-act="go" data-arg="' + r + '">' + MS.screens[r].title + '</button>').join('') + '</div>';
    html += sc.render(S(), app);
    el.innerHTML = '<div class="fade-in">' + html + '</div>';
    hydrate(el);
    if (app.animate) { ui.animateNumbers(el); app.animate = false; }
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  function rerender() {
    if (!S() || app.route === 'start') return renderStart();
    // обновить шапку и контент, сохранив прокрутку
    const y = window.scrollY; renderShell(); window.scrollTo(0, y);
  }

  /* Графики и динамические элементы */
  function hydrate(el) {
    hydrateCharts(el);
    ui.$$('input[type=range]', el).forEach(r => setRangeFill(r));
  }
  function hydrateCharts(el) {
    const sc = MS.screens[app.route] || MS.screens.start;
    const cfgs = sc && sc.charts && S() ? sc.charts(S(), app) : {};
    ui.$$('[data-chart]', el || document).forEach(c => {
      const key = c.dataset.chart;
      const cfg = (app.modalCharts && app.modalCharts[key]) || cfgs[key];
      if (cfg) MS.charts.render(c, cfg);
    });
  }
  function setRangeFill(r) { const p = (r.value - r.min) / (r.max - r.min) * 100; r.style.setProperty('--p', p + '%'); }

  /* ---------- Делегирование событий ---------- */
  function handler(kind, name) {
    const sc = MS.screens[app.route];
    if (sc && sc[kind] && sc[kind][name]) return sc[kind][name];
    if (app.route === 'start' && MS.screens.start[kind] && MS.screens.start[kind][name]) return MS.screens.start[kind][name];
    return null;
  }
  function onClick(e) {
    const a = e.target.closest('[data-act]'); if (!a) return;
    if (a.tagName === 'A') e.preventDefault();
    if (a.closest('.ov') && !a.closest('[data-global]') && a.dataset.act !== 'theory' && a.dataset.act !== 'go' && !a.closest('.ov').dataset.screenActs) return;
    const name = a.dataset.act;
    if (GLOBAL[name]) { GLOBAL[name](a); return; }
    const h = handler('act', name);
    if (h) {
      const res = h(a, S(), app);
      if (res && res.ok === false) ui.toast(res.msg, 'bad');
      else if (res && res.msg) ui.toast(res.msg, 'good');
      if (res !== 'keep') { if (S()) MS.game.autosave(); rerender(); }
    }
  }
  function onInput(e) {
    const t = e.target; if (t.type === 'range') setRangeFill(t);
    const name = t.dataset && t.dataset.input; if (!name) return;
    const h = handler('input', name); if (h) h(t, S(), app);
  }
  function onChange(e) {
    const t = e.target; const name = t.dataset && (t.dataset.input || t.dataset.change); if (!name) return;
    const h = handler('change', name);
    if (h) { const res = h(t, S(), app); if (res && res.ok === false) ui.toast(res.msg, 'bad'); if (res !== 'keep') { MS.game.autosave(); rerender(); } }
  }

  const GLOBAL = {
    go(a) {
      let r = a.dataset.arg;
      if (r === 'manage') r = app.manageTab || 'fin';
      if (MANAGE.includes(r)) app.manageTab = r;
      if (r === 'start') { MS.game.s = null; app.route = 'start'; return renderStart(); }
      ui.closeAll();
      app.route = r; renderShell();
    },
    theory(a) { ui.openTheory(a.dataset.arg); },
    endTurn() { endTurn(); },
    final() { showFinal(); },
    why(a) { MS.screens.dash.why(a.dataset.arg, S()); }
  };

  /* ---------- Ход ---------- */
  function endTurn(force) {
    const s = S(); if (!s || s.status !== 'active') return;
    if (!force && s.pending.length) {
      return ui.modal({
        title: 'Есть нерешённые ситуации', icon: '<span class="chip warn">' + s.pending.length + '</span>',
        body: '<p>В этом месяце ждут решения: <b>' + s.pending.map(p => ui.esc(MS.sit.def(p.id).title)).join(', ') + '</b>.</p><p class="muted">Если перейти к следующему месяцу, сработает вариант по умолчанию — обычно это бездействие со всеми его последствиями. Бездействие тоже управленческое решение.</p>',
        foot: '<button class="btn" data-m="go">Продолжить без решения</button><button class="btn primary" data-m="sits">К ситуациям</button>',
        actions: { go: (b, m) => { m.close(); endTurn(true); }, sits: (b, m) => { m.close(); app.route = 'sits'; renderShell(); } }
      });
    }
    const prev = s.history[s.history.length - 1] || null;
    app.prevRec = prev; app.beforeTurn = { cash: s.cash };
    const res = MS.game.endTurn();
    if (!res) return;
    app.lastResult = res;
    app.animate = true;
    if (app.route === 'start') app.route = 'dash';
    renderShell();
    MS.screens.dash.turnResult(res, s);
    ui.vibrate(15);
  }

  function showFinal() {
    const s = S(); if (!s) return;
    if (s.status === 'active') {
      return ui.confirm('Завершить игру?', 'Компания будет закрыта для управления, а вы получите итоговую оценку управленческих компетенций и подробный разбор решений. Продолжить эту игру будет нельзя (но можно заранее сохранить копию в меню).', 'Подвести итоги', () => { MS.game.finish(); app.route = 'reports'; app.reportView = 'final'; renderShell(); });
    }
    app.route = 'reports'; app.reportView = 'final'; renderShell();
  }

  function back() {
    if (ui.closeTop()) return true;
    if (app.route === 'start') { if (MS.screens.start.back && MS.screens.start.back()) return true; return false; }
    if (app.route !== 'dash') { app.route = 'dash'; renderShell(); return true; }
    return false;
  }
  function debounce(f, ms) { let t; return function () { clearTimeout(t); t = setTimeout(f, ms); }; }

  app.init = init; app.render = render; app.rerender = rerender; app.renderShell = renderShell; app.renderContent = renderContent;
  app.hydrate = hydrate; app.endTurn = endTurn; app.back = back; app.showFinal = showFinal; app.applyPrefs = applyPrefs;
  app.openGame = function (s) { MS.game.s = s; app.route = 'dash'; renderShell(); };
  return app;
})();

/* Кнопка «Назад» Android вызывает эту функцию через WebView */
globalThis.msBack = function () { try { return MS.app.back() ? 'handled' : 'exit'; } catch (e) { return 'exit'; } };
document.addEventListener('DOMContentLoaded', () => MS.app.init());
