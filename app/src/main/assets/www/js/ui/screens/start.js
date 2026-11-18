/* Стартовый экран: продолжить, новая игра (мастер), загрузка, настройки */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.start = (function () {
  const U = MS.util, ui = MS.ui;
  const st = { view: 'home', step: 1, name: '', industry: 'manufacturing', diffKey: 'normal', custom: null, seed: '' };

  function render() {
    return '<div class="start"><div class="start-box fade-in">' + (st.view === 'home' ? home() : st.view === 'new' ? wizard() : st.view === 'load' ? load() : prefs()) + '</div></div>';
  }
  function home() {
    const last = MS.store.last(); const idx = MS.store.index(); const lm = idx.find(x => x.id === last) || idx[0];
    return '<div class="hero"><div class="brand-logo">УС</div><div><h1>Управленческий симулятор</h1><div class="muted">Обучение менеджменту через управление виртуальным предприятием</div></div></div>' +
      '<div class="grid g2">' +
      '<div class="col">' +
      (lm ? '<button class="btn primary lg block" data-act="cont" data-arg="' + lm.id + '">' + ui.icon('play') + 'Продолжить: ' + ui.esc(lm.company) + '</button><div class="tiny muted" style="margin-top:-4px;padding-left:4px">' + ui.esc(lm.industry) + ' · ' + U.dateLabel(lm.turn) + (lm.status !== 'active' ? ' · игра окончена' : '') + '</div>' : '') +
      '<button class="btn lg block ' + (lm ? '' : 'primary') + '" data-act="view" data-arg="new">' + ui.icon('plus') + 'Новая игра</button>' +
      '<button class="btn lg block" data-act="view" data-arg="load"' + (idx.length ? '' : ' disabled') + '>' + ui.icon('folder') + 'Загрузить сохранение (' + idx.length + ')</button>' +
      '<button class="btn lg block" data-act="lib">' + ui.icon('library') + 'Теория менеджмента</button>' +
      '<button class="btn lg block ghost" data-act="view" data-arg="prefs">' + ui.icon('manage') + 'Настройки приложения</button>' +
      '</div>' +
      '<div class="card"><h3 class="mb8">Как играть</h3><div class="small muted col" style="gap:8px">' +
      '<div><b class="accent">1.</b> Вы — руководитель компании. Один ход — один месяц.</div>' +
      '<div><b class="accent">2.</b> Перед ходом изучите панель, решите управленческие ситуации и настройте финансы, персонал, производство и маркетинг.</div>' +
      '<div><b class="accent">3.</b> Нажмите «Следующий месяц» — движок рассчитает выручку, зарплаты, налоги, поведение конкурентов и последствия решений.</div>' +
      '<div><b class="accent">4.</b> После каждого решения — разбор с теорией менеджмента: Файоль, Маслоу, Герцберг, МакГрегор, Адизес, SWOT, PEST и др.</div>' +
      '<div><b class="accent">5.</b> Каждый год — отчёт руководителя. Банкротство, потеря рынка или массовый уход персонала завершают игру.</div>' +
      '</div><div class="hint mt12">Работает полностью офлайн. Прогресс сохраняется автоматически.</div></div>' +
      '</div>';
  }

  function wizard() {
    const steps = '<div class="steps">' + [1, 2, 3].map(i => '<i class="' + (st.step >= i ? 'on' : '') + '"></i>').join('') + '</div>';
    const head = '<div class="row between mb12"><button class="btn ghost" data-act="' + (st.step === 1 ? 'view' : 'step') + '" data-arg="' + (st.step === 1 ? 'home' : st.step - 1) + '">' + ui.icon('back') + 'Назад</button><span class="muted small">Шаг ' + st.step + ' из 3</span></div>';
    let body = '';
    if (st.step === 1) {
      body = '<h2 class="mb12">Компания и отрасль</h2><label class="f">Название компании</label><input type="text" data-change="name" id="cname" maxlength="40" placeholder="Например, ООО «Вектор»" value="' + ui.esc(st.name) + '">' +
        '<div class="grid g3 mt16">' + Object.values(MS.INDUSTRIES).map(I => '<div class="ind-card ' + (st.industry === I.id ? 'on' : '') + '" data-act="ind" data-arg="' + I.id + '"><div class="row"><div class="ind-ic">' + ui.icon(I.id) + '</div><div><b>' + I.name + '</b><div class="tiny muted">' + I.company + '</div></div></div><p class="small muted mt8">' + I.desc + '</p>' +
          '<div class="tiny"><div class="mb8"><b class="accent">Особенности:</b> ' + I.features.join('; ') + '</div><div class="mb8"><b class="bad">Риски:</b> ' + I.risks.join('; ') + '</div><div><b class="good">Возможности:</b> ' + I.opportunities.join('; ') + '</div></div></div>').join('') + '</div>' +
        '<div class="row mt16" style="justify-content:flex-end"><button class="btn primary lg" data-act="step" data-arg="2">Далее ' + ui.icon('next') + '</button></div>';
    } else if (st.step === 2) {
      const d = Object.assign({}, MS.DIFFICULTY[st.diffKey === 'custom' ? 'normal' : st.diffKey], st.custom || {});
      body = '<h2 class="mb12">Сложность</h2><div class="grid g4">' + ['easy', 'normal', 'hard', 'custom'].map(k => '<div class="opt-card ' + (st.diffKey === k ? 'on' : '') + '" data-act="diff" data-arg="' + k + '"><b>' + (k === 'custom' ? 'Своя' : MS.DIFFICULTY[k].label) + '</b><div class="tiny muted mt8">' + ({ easy: 'Больше капитала, мягкий рынок, пассивные конкуренты', normal: 'Сбалансированная экономика', hard: 'Мало денег, резкие циклы, агрессивные конкуренты', custom: 'Настройте все параметры вручную' })[k] + '</div></div>').join('') + '</div>' +
        (st.diffKey === 'custom' ? '<div class="card mt16"><h3 class="mb12">Параметры</h3>' + MS.DIFF_FIELDS.map(f => '<div class="mb12"><div class="row between small"><span>' + f.label + '</span><b id="dv_' + f.k + '">' + (f.pct ? U.pct(d[f.k], 1) : U.num(d[f.k], 2)) + '</b></div>' + ui.range('dfield', f.min, f.max, f.step, d[f.k], f.k) + '</div>').join('') + '</div>' : '') +
        '<div class="mt16"><label class="f">Зерно случайности (необязательно): одинаковое зерно — одинаковый мир</label><input type="number" data-change="seed" value="' + ui.esc(st.seed) + '" placeholder="Случайное"></div>' +
        '<div class="row mt16" style="justify-content:flex-end"><button class="btn primary lg" data-act="step" data-arg="3">Далее ' + ui.icon('next') + '</button></div>';
    } else {
      const s = preview();
      const I = MS.INDUSTRIES[st.industry];
      const o = MS.economy.compute(s);
      const ue = MS.economy.unitEconomics(s, o);
      body = '<h2 class="mb12">Стартовые показатели</h2><div class="card"><div class="row mb12"><div class="ind-ic">' + ui.icon(I.id) + '</div><div><b>' + ui.esc(st.name || 'Новая компания') + '</b><div class="small muted">' + I.company + ' · ' + (st.diffKey === 'custom' ? 'своя сложность' : MS.DIFFICULTY[st.diffKey].label.toLowerCase() + ' уровень') + '</div></div></div>' +
        '<div class="stats">' +
        stat('Стартовый капитал', U.money(s.cash)) + stat('Персонал', MS.model.headcount(s) + ' чел.') + stat('Мощность', U.num(s.prod.capacity) + ' ' + I.unit + '/мес') +
        stat('Цена', U.money(s.market.price)) + stat('Себестоимость ед.', U.money(ue.full)) + stat('Доля рынка', U.pct(o.share)) +
        stat('Выручка в первый месяц ≈', U.money(o.revenue)) + stat('Фонд оплаты труда', U.money(MS.model.payroll(s)) + '/мес') + stat('Удовлетворённость', U.num(s.staff.morale)) +
        '</div><div class="hint mt16"><b>Подсказка:</b> первые месяцы года — сезонный спад. Следите за запасом денег, индексируйте цены вслед за инфляцией и не забывайте про зарплаты — рынок труда тоже дорожает.</div></div>' +
        '<div class="row mt16" style="justify-content:flex-end"><button class="btn primary lg" data-act="startGame">' + ui.icon('play') + 'Начать управление</button></div>';
    }
    return head + steps + body;
  }
  const stat = (l, v) => '<div class="stat"><span class="l">' + l + '</span><span class="v">' + v + '</span></div>';
  function params() {
    return { name: (st.name || 'Новая компания').trim(), industry: st.industry, diffKey: st.diffKey === 'custom' ? 'normal' : st.diffKey, diffCustom: st.diffKey === 'custom' ? st.custom : null, seed: st.seed !== '' ? parseInt(st.seed, 10) : null };
  }
  function preview() { const p = params(); if (p.seed == null) p.seed = 1; return MS.model.newGame(p); }

  function load() {
    const idx = MS.store.index();
    return '<div class="row between mb12"><button class="btn ghost" data-act="view" data-arg="home">' + ui.icon('back') + 'Назад</button><h2>Сохранения</h2><span></span></div>' +
      '<div class="col">' + (idx.length ? idx.map(x => '<div class="save-i"><div class="ind-ic">' + ui.icon(Object.values(MS.INDUSTRIES).find(I => I.name === x.industry) ? Object.values(MS.INDUSTRIES).find(I => I.name === x.industry).id : 'folder') + '</div><div class="grow"><b>' + ui.esc(x.name) + '</b><div class="small muted">' + ui.esc(x.company) + ' · ' + ui.esc(x.industry) + ' · ' + U.dateLabel(x.turn) + (x.status === 'lost' ? ' · <span class="bad">поражение</span>' : x.status === 'finished' ? ' · завершена' : '') + '</div><div class="tiny dim">Сохранено ' + new Date(x.updatedAt).toLocaleString('ru-RU') + ' · баланс ' + U.money(x.cash) + '</div></div><button class="btn primary sm" data-act="cont" data-arg="' + x.id + '">Открыть</button><button class="btn ghost sm" data-act="del" data-arg="' + x.id + '">' + ui.icon('trash') + '</button></div>').join('') : ui.empty('Сохранений пока нет', 'folder')) + '</div>' +
      '<div class="card mt16"><h3 class="mb8">Импорт сохранения</h3><p class="small muted">Вставьте текст сохранения, экспортированный из меню игры.</p><textarea id="imp"></textarea><button class="btn mt8" data-act="imp">Импортировать</button></div>';
  }
  function prefs() {
    const p = MS.store.prefs();
    return '<div class="row between mb12"><button class="btn ghost" data-act="view" data-arg="home">' + ui.icon('back') + 'Назад</button><h2>Настройки приложения</h2><span></span></div>' +
      '<div class="card col">' +
      '<div class="row between"><div><b>Анимации</b><div class="small muted">Плавное изменение показателей и графиков</div></div><label class="switch"><input type="checkbox" data-change="pref" data-arg="anim" ' + (p.anim ? 'checked' : '') + '><span></span></label></div>' +
      '<div class="row between"><div><b>Вибрация</b><div class="small muted">Короткий отклик при ходе и ошибках</div></div><label class="switch"><input type="checkbox" data-change="pref" data-arg="haptics" ' + (p.haptics ? 'checked' : '') + '><span></span></label></div>' +
      '</div><div class="hint mt12">Параметры экономики и сложности текущей партии меняются в игре: «Меню» → «Параметры игры».</div>';
  }

  const act = {
    view(a) { st.view = a.dataset.arg; if (st.view === 'new') st.step = 1; },
    step(a) { const n = +a.dataset.arg; if (n === 2 && st.step === 1) { const v = document.getElementById('cname'); if (v) st.name = v.value; } st.step = n; },
    ind(a) { const v = document.getElementById('cname'); if (v) st.name = v.value; st.industry = a.dataset.arg; },
    diff(a) { st.diffKey = a.dataset.arg; if (st.diffKey === 'custom' && !st.custom) st.custom = Object.assign({}, MS.DIFFICULTY.normal); },
    startGame() { const s = MS.game.start(params()); st.view = 'home'; MS.app.openGame(s); MS.ui.toast('Компания «' + s.company.name + '» создана. Удачи, руководитель!', 'good'); return 'keep'; },
    cont(a) { const s = MS.game.open(a.dataset.arg); if (!s) { ui.toast('Не удалось открыть сохранение', 'bad'); return; } MS.app.openGame(s); return 'keep'; },
    del(a) { ui.confirm('Удалить сохранение?', 'Это действие нельзя отменить.', 'Удалить', () => { MS.store.remove(a.dataset.arg); MS.app.render(); }, true); return 'keep'; },
    imp() { try { const s = MS.store.importText(document.getElementById('imp').value.trim()); ui.toast('Импортировано: ' + s.company.name, 'good'); } catch (e) { ui.toast('Ошибка импорта: ' + e.message, 'bad'); } },
    lib() { MS.screens.library.openStandalone(); return 'keep'; }
  };
  const change = {
    name(t) { st.name = t.value; return 'keep'; },
    seed(t) { st.seed = t.value; return 'keep'; },
    pref(t) { const p = MS.store.prefs(); p[t.dataset.arg] = t.checked; MS.store.setPrefs(p); MS.app.applyPrefs(); return 'keep'; },
    dfield() { return 'keep'; }
  };
  const input = {
    dfield(t) { const f = MS.DIFF_FIELDS.find(x => x.k === t.dataset.arg); st.custom[f.k] = parseFloat(t.value); const e = document.getElementById('dv_' + f.k); if (e) e.textContent = f.pct ? U.pct(st.custom[f.k], 1) : U.num(st.custom[f.k], 2); }
  };
  function back() { if (st.view !== 'home') { if (st.view === 'new' && st.step > 1) st.step--; else st.view = 'home'; MS.app.render(); return true; } return false; }
  return { render, act, change, input, back, st };
})();
