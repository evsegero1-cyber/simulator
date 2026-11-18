/* Стратегическое развитие: жизненный цикл, стратегия Портера, структура, филиалы, проекты, цели, SWOT/PEST */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.strat = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, A = MS.act, C = MS.CAT;
  const st = { goals: null };

  function benefit(s, id, o) {
    const last = s.history.slice(-3), I = M.ind(s);
    const rev = last.length ? U.avg(last, x => x.revenue) : o.revenue;
    const cm = o.price > 0 ? (o.price - o.matUnit) / o.price : 0.3;
    const headroom = o.normalMax > o.sales ? 1 : 0.3;
    const adminPay = s.staff.depts.admin.n * s.staff.depts.admin.wage * (1 + I.socialRate);
    const ovh = E.overheadCost(s);
    switch (id) {
      case 'erp': return adminPay * 0.25 + ovh * 0.05 + rev * 0.01 * cm;
      case 'energy': return ovh * 0.08;
      case 'iso': return rev * 0.04 * cm * headroom;
      case 'brand': return rev * 0.04 * cm * headroom;
      case 'lean': return o.production * o.matUnit * 0.05 + s.staff.depts.prod.n * s.staff.depts.prod.wage * 0.05;
      case 'logistics': return (last.length ? U.avg(last, x => x.storage * 0.5 + x.logistics * 0.3) : 0) + rev * 0.005;
      case 'online': return rev * 0.12 * cm * headroom;
      case 'hrbrand': return o.turnoverRate * 0.25 * M.headcount(s) * M.payroll(s) / Math.max(1, M.headcount(s)) * 0.6 + rev * 0.005;
    }
    return 0;
  }
  function npvOf(s, cost, months, ben) {
    const r = s.market.keyRate + s.diff.spread;
    const flows = [-cost]; for (let i = 1; i <= 36; i++) flows.push(i <= months ? 0 : ben);
    const npv = U.npv(r, flows);
    return { npv, payback: ben > 0 ? months + cost / ben : Infinity };
  }

  function render(s) {
    const I = M.ind(s), o = E.compute(s), ad = M.adizes(s);
    let h = '<div class="row between wrap mb12"><div><h2>Стратегическое развитие</h2><div class="small muted">Жизненный цикл, конкурентная стратегия, структура, филиалы, инвестиции и долгосрочные цели</div></div><div class="row wrap">' + ui.theoryChips(['strategy', 'adizes', 'swot', 'pest']) + '</div></div>';
    const stages = ['infancy', 'gogo', 'adolescence', 'prime', 'stable', 'aristocracy', 'bureaucracy'];
    h += '<div class="card mb12"><div class="card-h"><h3>Жизненный цикл по Адизесу</h3><span class="chip accent th-chip" data-act="theory" data-arg="adizes">' + ad.name + '</span></div><div class="lifecycle">' + stages.map(k => '<div class="' + (k === ad.id || (ad.id === 'recrimination' && k === 'bureaucracy') ? 'on' : '') + '">' + M.ADIZES[k].name + '</div>').join('') + '</div><div class="hint mt12">' + ad.tip + ' <span class="muted">Рост выручки за год: ' + U.pct(ad.growth, 0) + ', рентабельность: ' + U.pct(ad.ros, 1) + ', доля управленцев: ' + U.pct(ad.bureaucracy, 0) + '.</span></div></div>';

    // Цели года
    const goals = s.org.goals && s.org.goalsYear === Math.floor(s.turn / 12) ? s.org.goals : [];
    const editing = st.goals || goals.map(g => Object.assign({}, g));
    h += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Цели на год ' + (Math.floor(s.turn / 12) + 1) + '</h3>' + ui.theoryChips(['fayol']) + '</div><p class="small muted">Планирование — первая функция менеджмента по Файолю. Выберите до 3 целей: выполнение оценивается в годовом отчёте.</p>' +
      C.GOALS.map(g => { const cur = editing.find(x => x.id === g.id); return '<div class="list-i"><label class="switch"><input type="checkbox" data-change="goalOn" data-arg="' + g.id + '" ' + (cur ? 'checked' : '') + '><span></span></label><div class="grow small">' + g.name + '</div>' + (cur ? '<div class="stepper"><button data-act="goalStep" data-arg="' + g.id + '" data-v="-1">−</button><span>' + cur.target + g.unit + '</span><button data-act="goalStep" data-arg="' + g.id + '" data-v="1">+</button></div>' : '') + '</div>'; }).join('') +
      (st.goals ? '<button class="btn primary block mt12" data-act="saveGoals">Утвердить цели</button>' : goals.length ? '<div class="tiny good mt8">Цели утверждены</div>' : '') + '</div>';

    // Стратегия Портера
    h += '<div class="card"><div class="card-h"><h3>Конкурентная стратегия</h3>' + ui.theoryChips(['porter']) + '</div>' + Object.keys(C.STRATEGIES).map(k => '<div class="opt-card mb8 ' + (s.market.strategy === k ? 'on' : '') + '" data-act="strategy" data-arg="' + k + '"><b>' + C.STRATEGIES[k].name + '</b><div class="small muted mt8">' + C.STRATEGIES[k].desc + '</div></div>').join('') + '<div class="tiny muted">Менять стратегию можно раз в год.</div></div></div>';

    // Структура и филиалы
    const co = E.coordination(s);
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Организационная структура</h3>' + ui.theoryChips(['fayol', 'change']) + '</div><div class="small mb12">Текущая: <b>' + C.STRUCTURES[s.org.structure].name + '</b> · координация ' + U.pct(co.f, 0) + (co.fitNote ? ' · <span class="' + (co.fit < 1 ? 'warn' : 'good') + '">' + co.fitNote + '</span>' : '') + '</div>' +
      Object.keys(C.STRUCTURES).map(k => { const x = C.STRUCTURES[k]; return '<div class="opt-card mb8 ' + (s.org.structure === k ? 'on' : '') + '"><div class="row between"><b>' + x.name + '</b><span class="chip">' + x.good + '</span></div><div class="small muted mt8">' + x.desc + '</div>' + (s.org.structure !== k ? '<div class="row wrap mt8"><button class="btn sm primary" data-act="reorg" data-arg="' + k + '" data-c="1">С разъяснением · ' + U.money(A.campaignBase(s) * 0.35) + '</button><button class="btn sm" data-act="reorg" data-arg="' + k + '" data-c="0">Приказом · ' + U.money(A.campaignBase(s) * 0.25) + '</button></div>' : '') + '</div>'; }).join('') +
      '<div class="tiny muted">Любая реорганизация временно снижает выработку (модель Левина). Разъяснение и вовлечение персонала уменьшают спад и сопротивление.</div></div>';
    const bc = A.branchCost(s), br = s.projects.find(p => p.type === 'branch');
    h += '<div class="card"><div class="card-h"><h3>Филиалы и расширение</h3><span class="chip">филиалов: ' + s.org.branches + '</span></div><div class="opt-card"><div class="row between"><b>' + I.branch.name + '</b><span class="chip">' + U.money(bc) + '</span></div><div class="small muted mt8">+' + U.num(I.branch.cap) + ' ' + I.unit + '/мес мощности, +' + U.num(I.branch.demand) + ' ' + I.unit + ' локального спроса, +' + I.branch.staff + ' сотрудников (наём автоматически), накладные +' + U.money(I.branch.overhead * s.market.priceIndex) + '/мес. Срок ' + I.branch.months + ' мес.</div>' +
      (br ? '<div class="chip warn mt8">Открывается: ещё ' + (br.at - s.turn) + ' мес.</div>' : '<button class="btn primary sm mt8" data-act="branch"' + (s.cash < bc ? ' disabled' : '') + '>Открыть филиал</button>') + '</div>' +
      '<div class="hint mt12">Матрица Ансоффа: филиалы и новые рынки — «развитие рынка», новые продукты — «развитие продукта». Расширяйтесь, когда мощности загружены и есть финансовый резерв.</div>' +
      '<h4 class="mt16 mb8">Активные проекты</h4>' + (s.projects.length ? s.projects.map(p => '<div class="list-i"><div class="grow small"><b>' + ui.esc(projName(s, p)) + '</b><div class="muted">завершение через ' + Math.max(1, p.at - s.turn) + ' мес.</div></div>' + ui.bar(1 - (p.at - s.turn) / Math.max(1, p.at - p.start)) + '</div>').join('') : '<div class="small muted">Нет</div>') + '</div></div>';

    // Инвестиционные проекты
    h += '<div class="card mt16"><div class="card-h"><h3>Инвестиционные проекты</h3>' + ui.theoryChips(['npv']) + '</div><div class="grid g2">' + C.PROJECTS.filter(p => !p.ind || p.ind.includes(I.id)).map(p => {
      const done = s.done.includes(p.id), run = s.projects.find(x => x.id === p.id), cost = A.projectCost(s, p.id), ok = !p.req || p.req(s);
      const n = npvOf(s, cost, p.months, benefit(s, p.id, o));
      return '<div class="opt-card ' + (done ? 'on' : '') + '"><div class="row between"><b>' + p.name + '</b>' + (done ? '<span class="chip good">выполнен</span>' : run ? '<span class="chip warn">идёт</span>' : '<span class="chip">' + U.money(cost) + '</span>') + '</div><div class="small muted mt8">' + p.desc + ' Срок ' + p.months + ' мес.</div>' +
        (!done && !run ? '<div class="row between mt8"><span class="tiny ' + (n.npv >= 0 ? 'good' : 'muted') + '">NPV (3 года) ≈ ' + U.money(n.npv) + ' · окупаемость ' + (isFinite(n.payback) && n.payback < 120 ? U.num(n.payback, 0) + ' мес.' : '—') + '</span><button class="btn sm primary" data-act="project" data-arg="' + p.id + '"' + (!ok || s.cash < cost ? ' disabled' : '') + '>Запустить</button></div>' + (!ok ? '<div class="tiny bad mt8">' + p.reqText + '</div>' : '') : '') + '<div class="row wrap mt8">' + ui.theoryChips(p.theory) + '</div></div>';
    }).join('') + '</div><div class="tiny muted mt8">NPV — оценка при текущих объёмах и ставке дисконтирования ' + U.pct(s.market.keyRate + s.diff.spread, 1) + '. Реальный эффект зависит от ваших будущих решений.</div></div>';

    // SWOT и PEST
    const sw = MS.reports.swot(s), pe = MS.reports.pest(s);
    const li = (a) => a.length ? '<ul>' + a.map(x => '<li>' + ui.esc(x) + '</li>').join('') + '</ul>' : '<div class="tiny muted mt8">—</div>';
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>SWOT-анализ</h3>' + ui.theoryChips(['swot']) + '</div><div class="swot"><div class="sw-s"><b class="good">S — сильные стороны</b>' + li(sw.S) + '</div><div class="sw-w"><b class="bad">W — слабые стороны</b>' + li(sw.W) + '</div><div class="sw-o"><b class="accent">O — возможности</b>' + li(sw.O) + '</div><div class="sw-t"><b class="warn">T — угрозы</b>' + li(sw.T) + '</div></div></div>' +
      '<div class="card"><div class="card-h"><h3>PEST-анализ</h3>' + ui.theoryChips(['pest']) + '</div>' + [['P', 'Политико-правовые'], ['E', 'Экономические'], ['S', 'Социальные'], ['T', 'Технологические']].map(x => '<div class="mb12"><b class="small">' + x[0] + ' — ' + x[1] + '</b>' + li(pe[x[0]]) + '</div>').join('') + '<div data-chart="rate"></div></div></div>';
    return h;
  }
  function projName(s, p) {
    if (p.type === 'product') return 'Продукт: ' + p.id;
    if (p.type === 'branch') return M.ind(s).branch.name;
    if (p.type === 'structure') return 'Реорганизация: ' + C.STRUCTURES[p.id].name;
    const d = C.PROJECTS.find(x => x.id === p.id); return d ? d.name : p.id;
  }
  function charts(s) {
    const h = s.history.slice(-36), labels = h.map(x => U.shortDate(x.turn));
    return { rate: { labels, height: 150, zero: false, fmt: v => U.pct(v, 1), axisFmt: v => U.pct(v, 0), series: [{ name: 'Ключевая ставка', values: h.map(x => x.keyRate), color: MS.charts.COLORS.amber }, { name: 'Спрос к норме', values: h.map(x => x.macro - 1 + x.keyRate), color: MS.charts.COLORS.gray, dash: true, fmt: v => '' }].slice(0, 1) } };
  }

  const act = {
    strategy(a, s) { return A.setStrategy(s, a.dataset.arg); },
    reorg(a, s) {
      const k = a.dataset.arg, comm = a.dataset.c === '1';
      ui.confirm('Реорганизация: ' + C.STRUCTURES[k].name, comm ? 'Вы объясните сотрудникам цели изменений и вовлечёте лидеров мнений. Спад выработки около 4% на 3 месяца.' : 'Изменения вводятся приказом без разъяснений. Спад выработки около 9% на 3 месяца, падение удовлетворённости и риск сопротивления.', 'Начать', () => { const r = A.reorganize(s, k, comm); ui.toast(r.ok ? 'Реорганизация начата' : r.msg, r.ok ? 'good' : 'bad'); MS.game.autosave(); MS.app.rerender(); });
      return 'keep';
    },
    branch(a, s) { ui.confirm('Открыть филиал?', 'Стоимость ' + U.money(A.branchCost(s)) + '. Убедитесь, что после вложений останется резерв денег на 2–3 месяца расходов.', 'Открыть', () => { const r = A.openBranch(s); ui.toast(r.ok ? 'Открытие филиала начато' : r.msg, r.ok ? 'good' : 'bad'); MS.game.autosave(); MS.app.rerender(); }); return 'keep'; },
    project(a, s) { return A.startProject(s, a.dataset.arg); },
    goalStep(a, s) { const g = st.goals || (st.goals = (s.org.goals || []).map(x => Object.assign({}, x))); const x = g.find(y => y.id === a.dataset.arg); if (x) x.target = Math.max(0, x.target + (+a.dataset.v) * (x.id === 'debt' ? 0.5 : x.id === 'morale' ? 5 : 1)); },
    saveGoals(a, s) { A.setGoals(s, st.goals || []); st.goals = null; return { ok: true, msg: 'Цели на год утверждены' }; }
  };
  const change = {
    goalOn(t, s) {
      const g = st.goals || (st.goals = (s.org.goalsYear === Math.floor(s.turn / 12) ? (s.org.goals || []) : []).map(x => Object.assign({}, x)));
      const id = t.dataset.arg;
      if (t.checked) { if (g.length >= 3) { t.checked = false; return { ok: false, msg: 'Не больше 3 целей' }; } g.push({ id, target: C.GOALS.find(x => x.id === id).def }); }
      else st.goals = g.filter(x => x.id !== id);
    }
  };
  return { title: 'Стратегия', render, charts, act, change };
})();
