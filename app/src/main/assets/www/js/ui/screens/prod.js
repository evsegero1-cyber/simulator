/* Производство: мощности, план выпуска, оборудование, качество, сырьё и запасы */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.prod = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, A = MS.act, C = MS.CAT, CH = MS.charts.COLORS;

  function render(s) {
    const I = M.ind(s), P = s.prod, o = E.compute(s), u = I.unit;
    let h = '<div class="row between wrap mb12"><div><h2>Производство</h2><div class="small muted">' + I.prodLabel + ': мощности, объём выпуска, оборудование, качество и снабжение</div></div><div class="row wrap">' + ui.theoryChips(['taylor', 'deming']) + '</div></div>';
    const maxV = Math.max(o.workforce, o.equipCap, o.potential, 1);
    h += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Мощности и загрузка</h3><span class="chip ' + (o.utilization > 1.02 ? 'warn' : o.utilization < 0.7 ? 'warn' : 'good') + '">загрузка ' + U.pct(o.utilization, 0) + '</span></div>' +
      cap('Выработка персонала', o.workforce, maxV, CH.violet, u) + cap('Мощность оборудования', o.equipCap, maxV, CH.cyan, u) + cap('Спрос на вашу продукцию', o.potential, maxV, CH.amber, u) + cap('План выпуска', o.target, maxV, CH.blue, u) +
      '<div class="hint mt12">Узкое место: <b>' + (o.bottleneck === 'staff' ? 'персонал' : 'оборудование') + '</b>. ' + (o.potential > o.normalMax * 1.03 ? 'Спрос выше мощности — вы теряете продажи. ' + (o.bottleneck === 'staff' ? 'Наймите работников или повысьте выработку.' : 'Закупите оборудование или откройте филиал.') : o.utilization < 0.75 ? 'Мощности простаивают: постоянные затраты ложатся на малый объём — себестоимость растёт.' : 'Баланс мощности и спроса нормальный.') + '</div>' +
      '<h4 class="mt16 mb8">План производства</h4>' + ui.seg('planMode', [{ v: 'auto', l: 'По спросу (авто)' }, { v: 'manual', l: 'Вручную' }], P.planMode) +
      (P.planMode === 'manual' ? '<div class="row between small mt12"><span>Загрузка от нормальной мощности</span><b id="planLbl">' + U.pct(P.plan, 0) + '</b></div>' + ui.range('plan', 0.3, 1.2, 0.05, P.plan) + '<div class="tiny muted">Выше 100% — сверхурочные (оплата ×1,5), износ, брак и выгорание.</div>' : '<div class="tiny muted mt8">' + (I.inventory === 'stock' ? 'Выпуск подстраивается под спрос с небольшим запасом готовой продукции.' : 'Выпуск подстраивается под спрос.') + '</div>') +
      '</div>';
    h += '<div class="card"><div class="card-h"><h3>Производительность труда</h3><span class="chip">' + U.num(o.perWorker, 1) + ' ' + u + '/чел.</span></div><p class="small muted">Норма выработки отрасли — ' + U.num(I.laborPU, 1) + ' ' + u + ' на работника в месяц. Факторы:</p>' + ui.factors(o.explain.prod) + '</div></div>';

    // Оборудование
    const cap0 = I.capitalIntensity >= 0.5;
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Оборудование</h3></div><div class="stats mb12">' +
      stat('Мощность (номинал)', U.num(P.capacity) + ' ' + u) + stat('Состояние', U.num(P.condition) + '/100', ui.toneOf(P.condition, 65, 45)) + stat('Технологии', '+' + U.num(P.tech, 1)) + stat('Автоматизация', '+' + U.pct(P.auto, 0)) + stat('Балансовая стоимость', U.money(P.book)) + '</div>' +
      ui.bar(P.condition / 100, P.condition < 45 ? 'var(--bad)' : P.condition < 65 ? 'var(--warn)' : 'var(--good)', true) +
      '<h4 class="mt16 mb8">Обслуживание</h4>' + ui.seg('maint', C.MAINT.map((m, i) => ({ v: i, l: m.name.split(' ')[0] + (i === 3 ? ' ТО' : '') })), P.maint) +
      '<div class="tiny muted mt8">' + C.MAINT[P.maint].name + ': ' + U.money(E.maintCost(s)) + '/мес, износ ' + U.signed(C.MAINT[P.maint].wear - o.utilization * 0.3 * I.breakdown + 0.3, v => U.num(v, 1)) + ' ед./мес. ' + (cap0 ? 'Изношенное оборудование ломается и снижает мощность.' : '') + '</div>' +
      (P.pending.length ? '<h4 class="mt16 mb8">В пути</h4>' + P.pending.map(e => '<div class="list-i"><div class="grow small"><b>' + ui.esc(e.name) + '</b><div class="muted">+' + U.num(e.cap) + ' ' + u + ' · ввод через ' + Math.max(1, e.at - s.turn) + ' мес.</div></div></div>').join('') : '') +
      '<button class="btn sm ghost mt12" data-act="sell">Продать часть оборудования…</button></div>';
    h += '<div class="card"><div class="card-h"><h3>Закупка и модернизация</h3>' + ui.theoryChips(['npv', 'change']) + '</div>' + C.EQUIP.map(e => {
      const ec = A.equipCost(s, e.id);
      return '<div class="opt-card mb8"><div class="row between"><b>' + ui.esc(M.equipName(s, e.id)) + '</b><span class="chip">' + U.money(ec.cost) + '</span></div><div class="small muted mt8">' + e.desc + ' Срок поставки ' + e.months + ' мес.</div><div class="row between mt8"><span class="tiny muted">+' + U.num(ec.cap) + ' ' + u + '/мес · окупаемость ≈ ' + payback(s, o, ec) + '</span><button class="btn sm primary" data-act="buy" data-arg="' + e.id + '"' + (s.cash < ec.cost ? ' disabled' : '') + '>Купить</button></div></div>';
    }).join('') + '</div></div>';

    // Качество и снабжение
    const sup = C.SUPPLIERS[P.supplier];
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Качество продукции</h3><span class="chip ' + ui.toneOf(s.market.quality, 60, 45) + '">' + U.num(s.market.quality) + ' → ' + U.num(o.qualityTarget) + '</span></div>' + ui.factors(o.explain.quality) +
      '<h4 class="mt16 mb8">Контроль качества</h4>' + ui.seg('qc', C.QC.map((q, i) => ({ v: i, l: ['Нет', 'Выборочный', 'ОТК', 'TQM'][i] })), P.qc) + '<div class="tiny muted mt8">' + C.QC[P.qc].name + ': ' + U.pct(C.QC[P.qc].rate, 1) + ' от выручки.</div></div>';
    h += '<div class="card"><div class="card-h"><h3>Снабжение и запасы</h3></div><div class="grid g3">' + Object.keys(C.SUPPLIERS).map(k => { const x = C.SUPPLIERS[k]; return '<div class="opt-card ' + (P.supplier === k ? 'on' : '') + '" data-act="supplier" data-arg="' + k + '"><b class="small">' + x.name + '</b><div class="tiny muted mt8">Цена ×' + U.num(x.k, 2) + '<br>Качество сырья ' + x.q + '<br>Риск срывов ' + (x.risk > 1 ? 'высокий' : x.risk < 1 ? 'низкий' : 'средний') + '</div></div>'; }).join('') + '</div>' +
      '<h4 class="mt16 mb8">Политика запасов сырья</h4>' + ui.seg('stock', Object.keys(C.STOCK).map(k => ({ v: k, l: { jit: 'Точно в срок', normal: '2 недели', safety: 'Страховой' }[k] })), P.stock) +
      '<div class="stats mt12">' + stat('Сырьё на складе', U.num(P.raw) + ' ' + u) + (I.inventory === 'stock' ? stat('Готовая продукция', U.num(P.finished) + ' ' + u) : '') + stat('Материалы на ед.', U.money(o.matUnit)) + stat('Закупка в месяц', U.money(o.purchase * o.matUnit)) + '</div>' +
      '<div class="hint mt12 tiny">' + (I.inventory === 'perish' ? 'Продукты портятся: каждый месяц теряется ' + U.pct(I.perishRate, 0) + ' запаса. ' : '') + 'Минимальные запасы экономят деньги, но при срыве поставки производство остановится. Страховой запас — наоборот.</div></div></div>';
    return h;
  }
  function cap(l, v, max, col, u) { return '<div class="mb8"><div class="row between small"><span class="muted">' + l + '</span><b>' + U.num(v) + ' ' + u + '</b></div>' + ui.bar(v / max, col) + '</div>'; }
  const stat = (l, v, cls) => '<div class="stat"><span class="l">' + l + '</span><span class="v ' + (cls || '') + '">' + v + '</span></div>';
  function payback(s, o, ec) {
    // оценка: дополнительная маржа, если спрос выше мощности
    const extra = Math.max(0, Math.min(ec.cap, o.potential - o.normalMax));
    const m = extra * (o.price - o.matUnit) * 0.6;
    return m > 0 ? U.num(ec.cost / m, 0) + ' мес.' : 'нет при текущем спросе';
  }

  const act = {
    planMode(a, s) { return A.setPlan(s, a.dataset.v, s.prod.plan); },
    maint(a, s) { return A.setMaint(s, +a.dataset.v); },
    qc(a, s) { return A.setQC(s, +a.dataset.v); },
    supplier(a, s) { return A.setSupplier(s, a.dataset.arg); },
    stock(a, s) { return A.setStock(s, a.dataset.v); },
    buy(a, s) { const ec = A.equipCost(s, a.dataset.arg); ui.confirm('Закупить оборудование?', ui.esc(M.equipName(s, a.dataset.arg)) + ' за ' + U.money(ec.cost) + '. Деньги списываются сейчас, мощность появится через ' + ec.e.months + ' мес.', 'Купить', () => { const r = A.buyEquip(s, a.dataset.arg); ui.toast(r.ok ? 'Оборудование заказано' : r.msg, r.ok ? 'good' : 'bad'); MS.game.autosave(); MS.app.rerender(); }); return 'keep'; },
    sell(a, s) {
      ui.modal({ title: 'Продажа оборудования', body: '<p class="small muted">Продажа активов — источник денег в кризис. Оборудование продаётся по 60% балансовой стоимости, мощность снижается.</p>' + [0.1, 0.2, 0.3].map(p => '<div class="list-i"><div class="grow">' + U.pct(p, 0) + ' мощности (−' + U.num(s.prod.capacity * p) + ' ' + M.ind(s).unit + ')</div><b>' + U.money(s.prod.book * p * 0.6) + '</b><button class="btn sm danger" data-m="sell" data-p="' + p + '">Продать</button></div>').join(''),
        actions: { sell: (b, m) => { A.sellEquip(s, +b.dataset.p); m.close(); MS.game.autosave(); MS.app.rerender(); } } });
      return 'keep';
    }
  };
  const input = { plan(t) { const e = document.getElementById('planLbl'); if (e) e.textContent = U.pct(+t.value, 0); } };
  const change = { plan(t, s) { return A.setPlan(s, 'manual', +t.value); } };
  return { title: 'Производство', render, act, input, change };
})();
