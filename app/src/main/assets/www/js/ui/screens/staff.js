/* Персонал: отделы, найм и увольнение, зарплаты, руководители, мотивация */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.staff = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, A = MS.act, C = MS.CAT, CH = MS.charts.COLORS;
  const st = { cnt: {} };

  function render(s) {
    const o = E.compute(s), sr = M.salaryRatio(s), q3 = U.sum(s.counters.quits3, x => x.q);
    let h = '<div class="row between wrap mb12"><div><h2>Персонал</h2><div class="small muted">Найм, оплата труда, руководители, мотивация и квалификация</div></div><div class="row wrap">' + ui.theoryChips(['herzberg', 'maslow', 'mcgregor']) + '</div></div>';
    h += '<div class="card mb12"><div class="stats">' +
      stat('Численность', M.headcount(s) + ' чел.') + stat('Фонд оплаты труда', U.money(M.payroll(s)) + '/мес') + stat('Зарплаты к рынку', U.pct(sr, 0), sr < 0.95 ? 'bad' : sr > 1.05 ? 'good' : '') +
      stat('Удовлетворённость', U.num(s.staff.morale) + ' → ' + U.num(o.moraleTarget), ui.toneOf(s.staff.morale, 60, 42)) + stat('Текучесть', U.pct(o.turnoverRate, 1) + '/мес', o.turnoverRate > 0.04 ? 'bad' : '') +
      stat('Ушли за 3 мес.', q3 + ' чел.') + stat('Квалификация цеха', U.num(s.staff.depts.prod.skill), ui.toneOf(s.staff.depts.prod.skill, 60, 40)) + stat('Руководителей', M.heads(s)) + '</div></div>';

    h += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Удовлетворённость: факторы</h3><span class="chip">цель ' + U.num(o.moraleTarget) + '</span></div><p class="small muted">По Герцбергу: гигиенические факторы (зарплата, условия, контроль) только убирают недовольство, мотиваторы (премии за результат, рост, обучение) создают вовлечённость.</p>' + ui.factors(o.explain.morale) + '</div>';

    // Политики
    const c = s.staff.control;
    const style = c >= 70 ? 'Жёсткий контроль (теория X)' : c <= 30 ? 'Свобода и доверие (теория Y)' : 'Сбалансированный';
    const tr = C.TRAINING;
    h += '<div class="card"><div class="card-h"><h3>Политика управления персоналом</h3></div>' +
      '<div class="row between small"><span>Уровень контроля</span><b id="ctlLbl">' + c + ' — ' + style + '</b></div>' + ui.range('control', 0, 100, 5, c) +
      '<div class="tiny muted mb12">При квалификации ' + U.num(s.staff.depts.prod.skill) + ' контроль ' + (s.staff.depts.prod.skill < 40 ? 'немного повышает выработку, но снижает удовлетворённость.' : 'скорее мешает: зрелая команда лучше работает при доверии.') + '</div>' +
      '<div class="row between small"><span>Премии</span><b id="bonLbl">' + U.pct(s.staff.bonusPct, 0) + ' от ФОТ</b></div>' + ui.range('bonus', 0, 0.3, 0.01, s.staff.bonusPct) +
      '<div class="row between mt8 mb12"><span class="small muted">Принцип</span>' + ui.seg('bonusMode', [{ v: 'kpi', l: 'За результат (KPI)' }, { v: 'fixed', l: 'Фиксированные' }], s.staff.bonusMode) + '</div>' +
      '<div class="small mb8">Обучение и повышение квалификации</div>' + ui.seg('training', tr.map((t, i) => ({ v: i, l: t.name })), s.staff.training) +
      '<div class="tiny muted mt8 mb12">Затраты: ' + U.pct(tr[s.staff.training].rate, 0) + ' от ФОТ ≈ ' + U.money(M.payroll(s) * tr[s.staff.training].rate) + '/мес. ' + (M.ind(s).skillDecay > 0.3 ? 'В вашей отрасли навыки быстро устаревают.' : '') + '</div>' +
      '<div class="row between"><div><b class="small">Автоматически замещать уволившихся</b><div class="tiny muted">Новички приходят с низкой квалификацией, подбор стоит денег</div></div><label class="switch"><input type="checkbox" data-change="autoRep" ' + (s.staff.autoReplace ? 'checked' : '') + '><span></span></label></div></div></div>';

    // Отделы
    h += '<h3 class="mt16 mb12">Отделы</h3><div class="grid g2">' + M.depts(s).map(d => deptCard(s, d)).join('') + '</div>';
    const missing = Object.keys(C.DEPTS).filter(d => !C.DEPTS[d].core && !s.staff.depts[d]);
    if (missing.length) h += '<div class="card mt16"><div class="card-h"><h3>Сформировать новый отдел</h3>' + ui.theoryChips(['fayol']) + '</div><div class="grid g3">' + missing.map(d => '<div class="opt-card"><b>' + C.DEPTS[d].name + '</b><div class="small muted mt8">' + C.DEPTS[d].desc + '</div><div class="tiny muted mt8">Зарплата на рынке ≈ ' + U.money(M.marketWage(s, d)) + '</div><button class="btn sm mt8" data-act="createDept" data-arg="' + d + '">' + ui.icon('plus') + 'Создать</button></div>').join('') + '</div></div>';
    return h;
  }

  function deptCard(s, d) {
    const dp = s.staff.depts[d], mw = M.marketWage(s, d), I = M.ind(s), def = C.DEPTS[d];
    const n = st.cnt[d] || 1;
    const ratio = dp.wage / mw;
    let need = '';
    if (d === 'prod') { const o = E.compute(s); need = 'Выработка ' + U.num(o.perWorker, 1) + ' ' + I.unit + '/чел. · для спроса нужно ≈ ' + U.num(Math.ceil(o.potential / Math.max(0.01, o.perWorker))) + ' чел.'; }
    if (d === 'sales') need = 'Покрытие продаж: ' + U.pct(E.salesCoverage(s), 0);
    if (d === 'admin') { const co = E.coordination(s); need = 'Нужно управленцев ≈ ' + U.num(co.need, 1) + ' · координация ' + U.pct(co.f, 0); }
    return '<div class="card"><div class="card-h"><div><h3>' + (d === 'prod' ? I.prodLabel : def.name) + '</h3><div class="tiny muted">' + need + '</div></div><span class="chip">' + dp.n + ' чел.</span></div>' +
      '<div class="row between small"><span class="muted">Квалификация</span><b>' + U.num(dp.skill) + '</b></div>' + ui.bar(dp.skill / 100, dp.skill < 40 ? 'var(--bad)' : dp.skill > 65 ? 'var(--good)' : '') +
      '<div class="row between small mt12"><span class="muted">Зарплата (рынок ' + U.money(mw) + ')</span><b id="w_' + d + '">' + U.money(dp.wage) + ' · ' + U.pct(ratio, 0) + '</b></div>' + ui.range('wage', Math.round(mw * 0.6 / 500) * 500, Math.round(mw * 1.6 / 500) * 500, 500, dp.wage, d) +
      '<div class="row wrap mt8"><div class="stepper"><button data-act="cnt" data-arg="' + d + '" data-v="-1">−</button><span>' + n + '</span><button data-act="cnt" data-arg="' + d + '" data-v="1">+</button></div>' +
      '<button class="btn sm good" data-act="hire" data-arg="' + d + '">Нанять · ' + U.money(A.hireCost(s, d, n)) + '</button><button class="btn sm danger" data-act="fire" data-arg="' + d + '"' + (dp.n ? '' : ' disabled') + '>Уволить</button></div>' +
      '<div class="tiny muted mt8">Лимит найма в этом месяце: ' + Math.max(0, A.hireLimit(s, d)) + ' чел. Увольнение: выходное пособие 2 оклада.</div>' +
      '<div class="list-i mt8" style="border-top:1px solid var(--border);padding-top:12px">' + (dp.head ? '<div class="grow"><b class="small">' + ui.esc(dp.head.name) + '</b><div class="tiny muted">Руководитель · компетентность ' + dp.head.skill + ' · стиль ' + styleName(dp.head.style) + ' · ' + U.money(dp.head.wage) + '/мес' + (dp.head.internal ? ' · из своих' : '') + '</div></div><button class="btn sm ghost" data-act="removeHead" data-arg="' + d + '">Освободить</button>' : '<div class="grow small muted">Руководитель не назначен' + (d === 'prod' || d === 'admin' ? ' — отдел теряет эффективность' : '') + '</div><button class="btn sm" data-act="headModal" data-arg="' + d + '">Назначить</button>') + '</div>' +
      (!def.core ? '<button class="btn sm ghost mt8" data-act="closeDept" data-arg="' + d + '">Расформировать отдел</button>' : '') + '</div>';
  }
  const styleName = (x) => ({ X: 'авторитарный', Y: 'демократический', B: 'ситуационный' })[x] || 'ситуационный';
  const stat = (l, v, cls) => '<div class="stat"><span class="l">' + l + '</span><span class="v ' + (cls || '') + '">' + v + '</span></div>';

  function headModal(s, d) {
    const dp = s.staff.depts[d];
    const body = '<p class="small muted">Руководитель повышает эффективность отдела (Файоль: распорядительство и координация). Кандидаты на рынке меняются раз в квартал.</p>' +
      s.staff.candidates.map(c => '<div class="list-i"><div class="grow"><b>' + ui.esc(c.name) + '</b><div class="small muted">Компетентность ' + c.skill + ' · стиль ' + styleName(c.style) + ' · ' + U.money(M.candidateWage(s, c, d)) + '/мес</div>' + ui.bar(c.skill / 100) + '</div><button class="btn sm primary" data-m="hire" data-c="' + c.id + '">Нанять</button></div>').join('') +
      '<div class="list-i"><div class="grow"><b>Повысить своего сотрудника</b><div class="small muted">Дешевле, мотивирует коллектив (карьерный рост), но компетентность ≈ квалификации отдела + 10–20</div></div><button class="btn sm" data-m="promote"' + (dp.n < 2 ? ' disabled' : '') + '>Повысить</button></div>' +
      '<div class="hint mt12 small">Стиль руководителя: авторитарный (теория X) хорош для неопытных команд, демократический (теория Y) — для зрелых. Авторитарный руководитель в зрелой команде может стать источником текучести.</div>';
    ui.modal({
      title: 'Руководитель: ' + C.DEPTS[d].short, body, actions: {
        hire: (b, m) => { const r = A.appointHead(s, d, b.dataset.c); m.close(); if (!r.ok) ui.toast(r.msg, 'bad'); else { MS.game.autosave(); MS.app.rerender(); } },
        promote: (b, m) => { const r = A.promoteInternal(s, d); m.close(); if (!r.ok) ui.toast(r.msg, 'bad'); else { MS.game.autosave(); MS.app.rerender(); } }
      }
    });
  }

  const act = {
    cnt(a) { const d = a.dataset.arg; st.cnt[d] = U.clamp((st.cnt[d] || 1) + (+a.dataset.v) * ((st.cnt[d] || 1) >= 10 && +a.dataset.v > 0 ? 5 : 1), 1, 200); },
    hire(a, s) { return A.hire(s, a.dataset.arg, st.cnt[a.dataset.arg] || 1); },
    fire(a, s) {
      const d = a.dataset.arg, n = Math.min(st.cnt[d] || 1, s.staff.depts[d].n);
      ui.confirm('Уволить ' + n + ' чел.?', 'Выходные пособия: ' + U.money(A.severance(s, d, n)) + '. Сокращения вызывают страх у остальных сотрудников (нижние уровни пирамиды Маслоу) и снижают удовлетворённость на несколько месяцев.', 'Уволить', () => { const r = A.fire(s, d, n); ui.toast(r.msg || '', r.ok ? 'good' : 'bad'); MS.game.autosave(); MS.app.rerender(); }, true);
      return 'keep';
    },
    bonusMode(a, s) { return A.setBonus(s, s.staff.bonusPct, a.dataset.v); },
    training(a, s) { return A.setTraining(s, +a.dataset.v); },
    createDept(a, s) { return A.createDept(s, a.dataset.arg); },
    closeDept(a, s) { ui.confirm('Расформировать отдел?', 'Все сотрудники отдела будут уволены с выплатой пособий.', 'Расформировать', () => { const r = A.closeDept(s, a.dataset.arg); if (!r.ok) ui.toast(r.msg, 'bad'); MS.game.autosave(); MS.app.rerender(); }, true); return 'keep'; },
    headModal(a, s) { headModal(s, a.dataset.arg); return 'keep'; },
    removeHead(a, s) { return A.removeHead(s, a.dataset.arg); }
  };
  const input = {
    control(t) { const v = +t.value; const e = document.getElementById('ctlLbl'); if (e) e.textContent = v + ' — ' + (v >= 70 ? 'Жёсткий контроль (теория X)' : v <= 30 ? 'Свобода и доверие (теория Y)' : 'Сбалансированный'); },
    bonus(t) { const e = document.getElementById('bonLbl'); if (e) e.textContent = U.pct(+t.value, 0) + ' от ФОТ'; },
    wage(t, s) { const d = t.dataset.arg; const e = document.getElementById('w_' + d); if (e) e.textContent = U.money(+t.value) + ' · ' + U.pct(+t.value / M.marketWage(s, d), 0); }
  };
  const change = {
    control(t, s) { return A.setControl(s, +t.value); },
    bonus(t, s) { return A.setBonus(s, +t.value); },
    wage(t, s) { return A.setWage(s, t.dataset.arg, +t.value); },
    autoRep(t, s) { return A.setAutoReplace(s, t.checked); }
  };
  return { title: 'Персонал', render, act, input, change };
})();
