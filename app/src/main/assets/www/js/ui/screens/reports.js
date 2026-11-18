/* Отчёты: годовые отчёты руководителя, итоговая оценка, долгосрочные графики; журнал; теория; меню */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.reports = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, R = MS.reports, CH = MS.charts.COLORS;
  let range = 60;

  function render(s, app) {
    if (app.reportView === 'final') return finalView(s, app);
    let h = '<div class="row between wrap mb12"><div><h2>Отчёты и оценка</h2><div class="small muted">Годовые отчёты руководителя формируются в конце каждого игрового года</div></div>' +
      '<button class="btn ' + (s.status === 'active' ? '' : 'primary') + '" data-act="final">' + ui.icon('reports') + (s.status === 'active' ? 'Завершить и получить итоговую оценку' : 'Итоговая оценка') + '</button></div>';
    h += '<div class="grid g3">' + (s.yearReports.length ? s.yearReports.map((y, i) => '<div class="card" style="cursor:pointer" data-act="year" data-arg="' + i + '"><div class="row"><div class="grade ' + y.grade.tone + '">' + y.grade.g + '</div><div class="grow"><h3>Год ' + y.year + '</h3><div class="small muted">' + y.grade.label + ' · ' + y.scores.total + '/100</div><div class="tiny dim">Выручка ' + U.money(y.stats.rev) + ' · прибыль <span class="' + (y.stats.net >= 0 ? 'good' : 'bad') + '">' + U.money(y.stats.net) + '</span></div></div></div></div>').join('') : '<div class="card" style="grid-column:1/-1">' + ui.empty('Первый годовой отчёт появится в конце 12-го месяца. До него осталось ' + (12 - s.turn % 12) + ' мес.', 'reports') + '</div>') + '</div>';
    if (s.yearReports.length > 1) h += '<div class="card mt16"><div class="card-h"><h3>Оценки по годам</h3></div><div data-chart="grades"></div></div>';
    h += '<div class="card mt16"><div class="card-h"><h3>Долгосрочная динамика</h3>' + ui.seg('range', [{ v: 24, l: '2 года' }, { v: 60, l: '5 лет' }, { v: 9999, l: 'Всё' }], range) + '</div><div data-chart="longRev"></div><div class="grid g2 mt16"><div data-chart="longShare"></div><div data-chart="longStaff"></div></div></div>';
    return h;
  }

  function charts(s) {
    const h = s.history.slice(-range), labels = h.map(x => U.shortDate(x.turn));
    // помесячные данные агрегируются по кварталам для длинных периодов
    const yr = s.yearReports;
    return {
      longRev: { labels, height: 220, fmt: v => U.money(v), series: [{ name: 'Выручка', values: h.map(x => x.revenue), color: CH.cyan, type: 'area' }, { name: 'Чистая прибыль', values: h.map(x => x.netProfit), type: 'bar', posNeg: true }] },
      longShare: { labels, height: 170, zero: false, fmt: v => U.pct(v), axisFmt: v => U.pct(v, 0), series: [{ name: 'Доля рынка', values: h.map(x => x.share), color: CH.blue }] },
      longStaff: { labels, height: 170, zero: false, fmt: v => U.num(v), series: [{ name: 'Персонал', values: h.map(x => x.staff), color: CH.violet }, { name: 'Удовлетворённость', values: h.map(x => x.morale), color: CH.pink }] },
      grades: { labels: yr.map(y => 'Год ' + y.year), height: 190, min: 0, max: 100, fmt: v => U.num(v), series: [{ name: 'Итог', values: yr.map(y => y.scores.total), color: CH.blue, type: 'area' }, { name: 'Финансы', values: yr.map(y => y.scores.fin), color: CH.green, width: 1.4 }, { name: 'Персонал', values: yr.map(y => y.scores.hr), color: CH.pink, width: 1.4 }, { name: 'Решения', values: yr.map(y => y.scores.dq), color: CH.amber, width: 1.4 }] }
    };
  }

  function yearBody(y) {
    const st = y.stats, sc = y.scores;
    let b = '<div class="row mb12"><div class="grade ' + y.grade.tone + '">' + y.grade.g + '</div><div><h3>' + y.grade.label + ' — ' + sc.total + ' из 100</h3><div class="small muted">Стадия по Адизесу: ' + y.adizes + '</div></div></div>';
    b += '<div class="stats mb12">' + stat('Выручка', U.money(st.rev)) + stat('Чистая прибыль', U.money(st.net), st.net >= 0 ? 'good' : 'bad') + stat('Рентабельность', U.pct(st.ros), st.ros >= 0 ? '' : 'bad') + stat('Рост выручки', y.prev ? U.pct(sc.growth, 0) : '—') +
      stat('Доля рынка', U.pct(st.shareStart) + ' → ' + U.pct(st.shareEnd)) + stat('Удовлетворённость', U.num(st.morale)) + stat('Текучесть', U.pct(st.turnover, 0) + '/год') + stat('Долг / EBITDA', U.num(Math.min(sc.lev, 99), 1) + '×') + '</div>';
    b += '<h4 class="mb8">Оценка по направлениям</h4>' + Object.keys(R.SCORE_LABELS).map(k => '<div class="mb8"><div class="row between small"><span>' + R.SCORE_LABELS[k] + '</span><b class="' + ui.toneOf(sc[k], 70, 45) + '">' + sc[k] + '</b></div>' + ui.bar(sc[k] / 100, sc[k] >= 70 ? 'var(--good)' : sc[k] < 45 ? 'var(--bad)' : 'var(--warn)') + '</div>').join('');
    if (y.goals.length) b += '<h4 class="mt16 mb8">Цели года</h4>' + y.goals.map(g => '<div class="list-i"><span class="chip ' + (g.ok ? 'good' : 'bad') + '">' + (g.ok ? 'выполнена' : 'не выполнена') + '</span><div class="grow small">' + g.name + ' ' + g.target + g.unit + '</div><b class="small">факт ' + U.num(g.fact, 1) + g.unit + '</b></div>').join('');
    b += '<h4 class="mt16 mb8">Комментарии и выводы</h4>' + y.comments.map(c => '<div class="list-i"><span class="dot" style="margin-top:7px;background:var(--' + (c.tone === 'good' ? 'good' : c.tone === 'bad' ? 'bad' : c.tone === 'warn' ? 'warn' : 'accent') + ')"></span><div class="grow small">' + ui.esc(c.text) + (c.th ? ' <span class="chip accent th-chip tiny" data-act="theory" data-arg="' + c.th + '">' + MS.THEORY[c.th].title + '</span>' : '') + '</div></div>').join('');
    if (y.best.length || y.worst.length) b += '<div class="grid g2 mt16"><div><h4 class="mb8">Лучшие решения</h4>' + (y.best.map(dec).join('') || '<div class="small muted">—</div>') + '</div><div><h4 class="mb8">Ошибки</h4>' + (y.worst.map(dec).join('') || '<div class="small muted">Серьёзных ошибок нет</div>') + '</div></div>';
    return b;
  }
  const dec = (d) => '<div class="small" style="padding:5px 0"><span class="chip ' + MS.sit.verdict(d.score).tone + ' tiny">' + U.signed(d.score, x => U.num(x, 1)) + '</span> <b>' + ui.esc(d.title) + '</b><div class="muted tiny">' + ui.esc(d.choice) + '</div></div>';
  const stat = (l, v, cls) => '<div class="stat"><span class="l">' + l + '</span><span class="v ' + (cls || '') + '">' + v + '</span></div>';
  function openYear(i, s) { const y = s.yearReports[i]; if (!y) return; ui.modal({ title: 'Отчёт руководителя: год ' + y.year, body: yearBody(y), wide: true }); }

  function finalView(s, app) {
    const f = R.final(s);
    let h = '<div class="row between wrap mb12"><div><h2>Итоговая оценка управленческих компетенций</h2><div class="small muted">' + ui.esc(s.company.name) + ' · ' + M.ind(s).name + ' · ' + U.num(s.turn / 12, 1) + ' ' + U.plural(Math.floor(s.turn / 12), 'год', 'года', 'лет') + ' управления</div></div><button class="btn" data-act="backList">' + ui.icon('back') + 'К отчётам</button></div>';
    if (s.status === 'lost') h += '<div class="verdict bad mb12"><div class="ic">!</div><div><b>Компания не выжила</b><div class="small">' + ui.esc(s.lostReason.text) + ' Итоговая оценка снижена на 20%.</div></div></div>';
    if (s.status === 'active') h += '<div class="hint mb12">Это промежуточная оценка — игра продолжается. Окончательные итоги можно подвести кнопкой «Завершить игру».</div>';
    h += '<div class="grid g2"><div class="card"><div class="row"><div class="grade ' + f.grade.tone + '" style="width:84px;height:84px;font-size:38px">' + f.grade.g + '</div><div><h2>' + f.total + ' / 100</h2><div class="muted">' + f.grade.label + '</div><div class="chip accent mt8" style="white-space:normal">Ваш профиль: ' + f.title + '</div></div></div>' +
      (f.summary ? '<div class="stats mt16">' + stat('Выручка в месяц', U.money(f.summary.rev0) + ' → ' + U.money(f.summary.revN)) + stat('Доля рынка', U.pct(f.summary.share0) + ' → ' + U.pct(f.summary.shareN)) + stat('Персонал', f.summary.staff0 + ' → ' + f.summary.staffN) + stat('Накопленная прибыль', U.money(f.summary.totalProfit), f.summary.totalProfit >= 0 ? 'good' : 'bad') + stat('Деньги / долг', U.money(f.summary.cash) + ' / ' + U.money(f.summary.debt)) + stat('Рынки · продукты · филиалы', f.summary.markets + ' · ' + f.summary.products + ' · ' + f.summary.branches) + '</div>' : '') + '</div>';
    h += '<div class="card"><h3 class="mb12">Компетенции</h3>' + f.comp.map(c => '<div class="mb8"><div class="row between small"><span>' + c.name + ' <span class="chip accent th-chip tiny" data-act="theory" data-arg="' + c.th + '">теория</span></span><b class="' + ui.toneOf(c.v, 70, 45) + '">' + c.v + '</b></div>' + ui.bar(c.v / 100, c.v >= 70 ? 'var(--good)' : c.v < 45 ? 'var(--bad)' : 'var(--warn)') + '</div>').join('') + '</div></div>';
    h += '<div class="grid g2 mt16"><div class="card"><h3 class="mb12">Стиль руководства</h3>' + f.style.map(x => '<div class="list-i"><div><b>' + x.t + '</b><div class="small muted">' + x.d + '</div></div></div>').join('') + '<div class="hint mt12"><b>Рекомендация:</b> ' + ui.esc(f.advice) + '</div></div>';
    h += '<div class="card"><h3 class="mb12">Разбор ключевых решений</h3><h4 class="mb8">Лучшие</h4>' + (f.bestDecisions.map(dec).join('') || '<div class="small muted">—</div>') + '<h4 class="mt12 mb8">Худшие</h4>' + (f.worstDecisions.map(dec).join('') || '<div class="small muted">Серьёзных ошибок нет</div>') + '</div></div>';
    if (s.yearReports.length) h += '<div class="card mt16"><h3 class="mb12">Годовые отчёты</h3><div class="row wrap">' + s.yearReports.map((y, i) => '<button class="btn sm" data-act="year" data-arg="' + i + '"><span class="' + y.grade.tone + '">' + y.grade.g + '</span> Год ' + y.year + '</button>').join('') + '</div></div>';
    if (s.status !== 'active') h += '<div class="row mt16" style="justify-content:center"><button class="btn primary lg" data-act="newGame">' + ui.icon('plus') + 'Новая игра</button></div>';
    return h;
  }

  const act = {
    year(a, s) { openYear(+a.dataset.arg, s); return 'keep'; },
    range(a) { range = +a.dataset.v; },
    backList(a, s) { MS.app.reportView = null; },
    newGame() { MS.game.s = null; MS.screens.start.st.view = 'new'; MS.screens.start.st.step = 1; MS.app.route = 'start'; MS.app.render(); return 'keep'; }
  };
  return { title: 'Отчёты', render, charts, act, openYear };
})();

MS.screens.journal = (function () {
  const U = MS.util, ui = MS.ui;
  let f = 'all';
  const T = { all: 'Все', decision: 'Решения', situation: 'Ситуации', delayed: 'Последствия', staff: 'Персонал', finance: 'Финансы', production: 'Производство', market: 'Рынок', strategy: 'Стратегия', project: 'Проекты', pest: 'Внешняя среда' };
  function render(s) {
    const ev = s.events.slice().reverse().filter(e => f === 'all' || e.type === f).slice(0, 300);
    let h = '<div class="row between wrap mb12"><h2>Журнал событий</h2></div><div class="tabs">' + Object.keys(T).map(k => '<button class="tab ' + (f === k ? 'on' : '') + '" data-act="f" data-arg="' + k + '">' + T[k] + '</button>').join('') + '</div>';
    let lastT = null;
    h += '<div class="card">' + (ev.length ? ev.map(e => { const head = e.turn !== lastT ? '<h4 class="mt12 mb8">' + U.dateLabel(e.turn) + '</h4>' : ''; lastT = e.turn; const col = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)' }[e.tone] || 'var(--accent)'; return head + '<div class="ev"><span class="dot" style="background:' + col + '"></span><div class="grow">' + ui.esc(e.text) + '</div></div>'; }).join('') : ui.empty('Событий нет')) + '</div>';
    return h;
  }
  return { title: 'Журнал', render, act: { f(a) { f = a.dataset.arg; } } };
})();

MS.screens.library = (function () {
  const ui = MS.ui;
  function list() {
    return '<div class="grid g2">' + Object.keys(MS.THEORY).map(k => { const t = MS.THEORY[k]; return '<div class="card" style="cursor:pointer" data-act="theory" data-arg="' + k + '"><h3>' + ui.esc(t.title) + '</h3><div class="tiny muted mb8">' + ui.esc(t.author) + '</div><div class="small">' + ui.esc(t.short) + '</div></div>'; }).join('') + '</div>';
  }
  function render() { return '<div class="mb12"><h2>Теория менеджмента</h2><div class="small muted">Концепции, на которых построены механики симулятора. Они же упоминаются в разборах ваших решений.</div></div>' + list(); }
  function openStandalone() { ui.modal({ title: 'Теория менеджмента', body: list(), wide: true }); }
  return { title: 'Теория', render, openStandalone };
})();

MS.screens.menu = (function () {
  const U = MS.util, ui = MS.ui;
  function render(s) {
    let h = '<div class="mb12"><h2>Меню</h2></div><div class="grid g2"><div class="card col"><h3>Игра</h3>' +
      '<div class="small muted">Прогресс сохраняется автоматически после каждого действия и хода.</div>' +
      '<button class="btn block" data-act="saveAs">' + ui.icon('save') + 'Сохранить копию как…</button>' +
      '<button class="btn block" data-act="toLoad">' + ui.icon('folder') + 'Загрузить другое сохранение</button>' +
      '<button class="btn block" data-act="toNew">' + ui.icon('plus') + 'Новая игра</button>' +
      '<button class="btn block" data-act="export">Экспорт сохранения (текст)</button>' +
      '<button class="btn block ghost" data-act="toStart">' + ui.icon('back') + 'Главное меню</button>' +
      (s.status === 'active' ? '<button class="btn block danger" data-act="final">Завершить игру и подвести итоги</button>' : '') +
      '<div class="nav-sep"></div><button class="btn block ghost" data-act="go" data-arg="library">' + ui.icon('library') + 'Теория менеджмента</button><button class="btn block ghost" data-act="go" data-arg="journal">' + ui.icon('journal') + 'Журнал событий</button></div>';
    h += '<div class="card"><div class="card-h"><h3>Параметры игры</h3><span class="chip">' + (MS.DIFFICULTY[s.diffKey] ? MS.DIFFICULTY[s.diffKey].label : 'своя') + '</span></div><p class="small muted">Изменения вступают в силу со следующего месяца.</p>' +
      MS.DIFF_FIELDS.map(f => '<div class="mb12"><div class="row between small"><span>' + f.label + '</span><b id="gp_' + f.k + '">' + (f.pct ? U.pct(s.diff[f.k], 1) : U.num(s.diff[f.k], 2)) + '</b></div>' + ui.range('gparam', f.min, f.max, f.step, s.diff[f.k], f.k) + '</div>').join('') +
      '<div class="row between"><div><b class="small">Автосохранение</b></div><label class="switch"><input type="checkbox" data-change="autosave" ' + (s.settings.autosave !== false ? 'checked' : '') + '><span></span></label></div>' +
      '<div class="row between mt12"><div><b class="small">Анимации</b></div><label class="switch"><input type="checkbox" data-change="anim" ' + (MS.store.prefs().anim ? 'checked' : '') + '><span></span></label></div></div></div>';
    h += '<div class="card mt16 small muted">Управленческий симулятор · офлайн-приложение. Все расчёты выполняются на устройстве, без ИИ и внешних сервисов. Мир игры: ' + U.esc(s.company.name) + ', зерно ' + s.seed + '.</div>';
    return h;
  }
  const act = {
    saveAs(a, s) {
      ui.modal({ title: 'Сохранить копию', body: '<label class="f">Название сохранения</label><input type="text" id="saveName" value="' + ui.esc(s.company.name + ' — ' + U.shortDate(s.turn)) + '">', foot: '<button class="btn" data-close>Отмена</button><button class="btn primary" data-m="ok">Сохранить</button>', actions: { ok: (b, m) => { MS.store.copyAs(s, document.getElementById('saveName').value || s.company.name); m.close(); ui.toast('Копия сохранена', 'good'); } } });
      return 'keep';
    },
    toLoad() { MS.game.s = null; MS.screens.start.st.view = 'load'; MS.app.route = 'start'; MS.app.render(); return 'keep'; },
    toNew() { MS.game.s = null; MS.screens.start.st.view = 'new'; MS.screens.start.st.step = 1; MS.app.route = 'start'; MS.app.render(); return 'keep'; },
    toStart() { MS.game.s = null; MS.screens.start.st.view = 'home'; MS.app.route = 'start'; MS.app.render(); return 'keep'; },
    export(a, s) {
      const t = MS.store.exportText(s);
      ui.modal({ title: 'Экспорт сохранения', body: '<p class="small muted">Скопируйте текст и сохраните его. Импорт — на стартовом экране в разделе «Загрузить».</p><textarea id="expT" readonly>' + ui.esc(t) + '</textarea>', foot: '<button class="btn primary" data-m="copy">Копировать</button>', actions: { copy: () => { const e = document.getElementById('expT'); e.select(); try { navigator.clipboard.writeText(t).then(() => ui.toast('Скопировано', 'good'), () => { document.execCommand('copy'); ui.toast('Скопировано', 'good'); }); } catch (x) { document.execCommand('copy'); ui.toast('Скопировано', 'good'); } } } });
      return 'keep';
    }
  };
  const input = { gparam(t, s) { const f = MS.DIFF_FIELDS.find(x => x.k === t.dataset.arg); const e = document.getElementById('gp_' + f.k); if (e) e.textContent = f.pct ? U.pct(+t.value, 1) : U.num(+t.value, 2); } };
  const change = {
    gparam(t, s) { s.diff[t.dataset.arg] = +t.value; s.diffKey = 'custom'; MS.store.save(s); return 'keep'; },
    autosave(t, s) { s.settings.autosave = t.checked; MS.store.save(s); return 'keep'; },
    anim(t) { const p = MS.store.prefs(); p.anim = t.checked; MS.store.setPrefs(p); MS.app.applyPrefs(); return 'keep'; }
  };
  return { title: 'Меню', render, act, input, change };
})();
