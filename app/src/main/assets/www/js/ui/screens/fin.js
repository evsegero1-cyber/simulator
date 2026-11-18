/* Финансы: отчёт о прибылях, ДДС, себестоимость, бюджет, кредиты, депозит */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.fin = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, A = MS.act, CH = MS.charts.COLORS;
  const st = { pnl: 'm', loanType: 'mid', loanAmt: 0, dep: 0 };

  function pnlTable(r, s, label) {
    const tr = (l, v, cls) => '<tr class="' + (cls || '') + '"><td>' + l + '</td><td class="n ' + (cls === 'total' ? (v >= 0 ? 'good' : 'bad') : '') + '">' + U.money(v, { full: false }) + '</td></tr>';
    const cogs = r.matCOGS, gross = r.revenue - cogs;
    return '<table class="t">' + (label ? '<tr><th>' + label + '</th><th class="n"></th></tr>' : '') +
      tr('Выручка', r.revenue) + tr('Материалы и сырьё (себестоимость)', -cogs, 'sub') + tr('Валовая прибыль', gross, 'total') +
      tr('Заработная плата' + (r.bonus ? ' (в т.ч. премии ' + U.money(r.bonus) + ')' : ''), -r.wages, 'sub') + tr('Страховые взносы', -r.social, 'sub') +
      tr('Аренда, коммунальные, накладные', -r.overhead, 'sub') + tr('Маркетинг', -r.marketing, 'sub') + tr('Обучение', -r.training, 'sub') + tr('Контроль качества', -r.qc, 'sub') +
      tr('Обслуживание оборудования', -r.maint, 'sub') + (r.storage ? tr('Хранение запасов', -r.storage, 'sub') : '') + (r.logistics ? tr('Логистика', -r.logistics, 'sub') : '') +
      (r.dev ? tr('Развитие (проекты, рынки, продукты)', -r.dev, 'sub') : '') + (r.other ? tr('Прочие (найм, штрафы, компенсации)', -r.other, 'sub') : '') +
      tr('EBITDA', r.ebitda, 'total') + tr('Амортизация', -r.depr, 'sub') + tr('Проценты по кредитам', -r.interest, 'sub') + (r.depInt ? tr('Проценты по депозиту', r.depInt, 'sub') : '') + tr('Налог на имущество', -r.propTax, 'sub') +
      tr('Прибыль до налога', r.ebt, 'total') + tr('Налог на прибыль', -r.tax, 'sub') + tr('Чистая прибыль', r.netProfit, 'total') + '</table>';
  }
  function sumRecs(list) {
    const out = {}; if (!list.length) return null;
    Object.keys(list[0]).forEach(k => { if (typeof list[0][k] === 'number') out[k] = U.sum(list, x => x[k] || 0); });
    return out;
  }

  function render(s) {
    const I = M.ind(s), ci = E.creditInfo(s), cx = MS.sit.ctx(s), last = s.history[s.history.length - 1];
    let h = '<div class="row between wrap mb12"><div><h2>Финансы</h2><div class="small muted">Контроль доходов и расходов, бюджет, кредиты и денежные потоки</div></div>' + ui.theoryChips(['finance', 'breakeven']) + '</div>';
    h += '<div class="card mb12"><div class="stats">' +
      stat('Деньги на счёте', U.money(s.cash), s.cash < 0 ? 'bad' : '') + stat('Депозит', U.money(s.deposit)) + stat('Кредиты', U.money(U.sum(s.loans, l => l.balance))) +
      stat('Нам должны', U.money(U.sum(s.receivables, x => x.amount))) + stat('Запас денег', U.num(Math.max(0, cx.cashMonths), 1) + ' мес.', cx.cashMonths < 1 ? 'bad' : cx.cashMonths < 2 ? 'warn' : 'good') +
      stat('Лимит овердрафта', U.money(E.overdraftLimit(s))) + stat('Кредитный рейтинг', ci.rating, ci.lev > 3 ? 'bad' : ci.lev > 2 ? 'warn' : 'good') + stat('Долг / EBITDA', U.num(Math.min(ci.lev, 99), 1) + '×') +
      '</div></div>';

    // P&L
    const recs = st.pnl === 'm' ? (last ? [last] : []) : s.history.slice(-12);
    const agg = sumRecs(recs);
    h += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Отчёт о прибылях и убытках</h3>' + ui.seg('pnl', [{ v: 'm', l: 'Месяц' }, { v: 'y', l: '12 мес.' }], st.pnl) + '</div>' + (agg ? pnlTable(agg, s) : ui.empty('Отчёт появится после первого месяца')) + '</div>';

    // Себестоимость
    const o = E.compute(s), ue = E.unitEconomics(s, o);
    const margin = o.price - ue.full;
    h += '<div class="col"><div class="card"><div class="card-h"><h3>Себестоимость единицы</h3><span class="chip">' + I.unit + '</span></div>' +
      '<div class="row" style="gap:16px;align-items:center">' + MS.charts.donut([{ v: ue.material, color: CH.amber }, { v: ue.labor, color: CH.violet }, { v: ue.overhead, color: CH.cyan }, { v: ue.depr, color: CH.gray }], 120) +
      '<div class="grow small">' + leg(CH.amber, 'Материалы', ue.material) + leg(CH.violet, 'Труд производства', ue.labor) + leg(CH.cyan, 'Накладные и управление', ue.overhead) + leg(CH.gray, 'Амортизация', ue.depr) +
      '<div class="row between mt8"><b>Полная себестоимость</b><b>' + U.money(ue.full) + '</b></div><div class="row between"><span class="muted">Цена</span><span>' + U.money(o.price) + '</span></div><div class="row between"><span class="muted">Прибыль на единицу</span><b class="' + (margin >= 0 ? 'good' : 'bad') + '">' + U.money(margin) + '</b></div></div></div>' +
      '<div class="hint mt12">Маржинальный доход: <b>' + U.money(ue.contrib) + '</b> на ' + I.unit + '. Точка безубыточности: <b>' + (isFinite(ue.breakeven) ? U.num(ue.breakeven) + ' ' + I.unit + '/мес' : 'не достигается') + '</b>' + (last ? ' при продажах ' + U.num(last.sales) + ' (' + (last.sales >= ue.breakeven ? '<span class="good">выше</span>' : '<span class="bad">ниже</span>') + ').' : '.') + '</div></div>';

    // Рентабельность
    const y = s.history.slice(-12), rev = U.sum(y, x => x.revenue), np = U.sum(y, x => x.netProfit), eb = U.sum(y, x => x.ebitda);
    const assets = s.cash + s.deposit + s.prod.book + U.sum(s.receivables, x => x.amount) + (s.prod.raw + s.prod.finished) * o.matUnit;
    const equity = assets - M.totalDebt(s);
    h += '<div class="card"><div class="card-h"><h3>Рентабельность (12 мес.)</h3></div><div class="stats">' +
      stat('ROS (продаж)', y.length ? U.pct(np / Math.max(1, rev)) : '—', np >= 0 ? 'good' : 'bad') + stat('EBITDA-маржа', y.length ? U.pct(eb / Math.max(1, rev)) : '—') +
      stat('ROA (активов)', y.length ? U.pct(np * 12 / y.length / Math.max(1, assets)) : '—') + stat('ROE (капитала)', y.length && equity > 0 ? U.pct(np * 12 / y.length / equity) : '—') +
      stat('Активы', U.money(assets)) + stat('Собственный капитал', U.money(equity), equity < 0 ? 'bad' : '') + '</div></div></div></div>';

    // ДДС и график
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Денежные потоки</h3><span class="chip">24 мес.</span></div><div data-chart="cf"></div>' +
      (last ? '<table class="t mt12"><tr><td>Операционная деятельность</td><td class="n ' + (last.opCF >= 0 ? 'good' : 'bad') + '">' + U.money(last.opCF) + '</td></tr><tr><td>Инвестиционная деятельность</td><td class="n">' + U.money(last.invCF) + '</td></tr><tr><td>Финансовая деятельность</td><td class="n">' + U.money(last.finCF) + '</td></tr></table>' : '') + '</div>';

    // Бюджет
    const f = E.forecast(s), base = M.payroll(s);
    const C = MS.CAT;
    h += '<div class="card"><div class="card-h"><h3>Бюджет на ' + U.MONTHS[s.turn % 12].toLowerCase() + '</h3><span class="chip">план</span></div><table class="t">' +
      '<tr><td>Ожидаемая выручка</td><td class="n">' + U.money(f.revenue) + '</td></tr>' +
      '<tr class="sub"><td>Фонд оплаты труда с взносами</td><td class="n">' + U.money(f.wages + f.social) + '</td></tr>' +
      '<tr class="sub"><td>Материалы</td><td class="n">' + U.money(f.matCOGS) + '</td></tr>' +
      '<tr class="sub"><td><a href="#" data-act="go" data-arg="mkt">Маркетинг</a></td><td class="n">' + U.money(f.marketing) + '</td></tr>' +
      '<tr class="sub"><td><a href="#" data-act="go" data-arg="staff">Обучение</a> (' + C.TRAINING[s.staff.training].name.toLowerCase() + ')</td><td class="n">' + U.money(f.training) + '</td></tr>' +
      '<tr class="sub"><td><a href="#" data-act="go" data-arg="prod">Контроль качества</a></td><td class="n">' + U.money(f.qc) + '</td></tr>' +
      '<tr class="sub"><td><a href="#" data-act="go" data-arg="prod">Обслуживание оборудования</a></td><td class="n">' + U.money(f.maint) + '</td></tr>' +
      '<tr class="sub"><td>Накладные расходы</td><td class="n">' + U.money(f.overhead) + '</td></tr>' +
      '<tr class="sub"><td>Проценты и платежи по кредитам</td><td class="n">' + U.money(U.sum(s.loans, l => l.payment)) + '</td></tr>' +
      '<tr class="total"><td>Прогноз чистой прибыли</td><td class="n ' + (f.netProfit >= 0 ? 'good' : 'bad') + '">' + U.money(f.netProfit) + '</td></tr>' +
      '<tr class="total"><td>Баланс на конец месяца</td><td class="n ' + (f.cash >= 0 ? '' : 'bad') + '">' + U.money(f.cash) + '</td></tr></table>' +
      '<div class="hint mt12 tiny">Бюджет пересчитывается при любом вашем решении: измените цену, штат или расходы — и увидите эффект здесь.</div></div></div>';

    // Кредиты
    const L = A.LOANS[st.loanType];
    const amt = Math.min(st.loanAmt || Math.round(ci.limit / 2 / 100000) * 100000, ci.limit);
    const rate = ci.rate + L.add;
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Получить кредит</h3>' + ui.theoryChips(['finance']) + '</div>' +
      (ci.limit >= 100000 ? ui.seg('loanType', Object.keys(A.LOANS).map(k => ({ v: k, l: A.LOANS[k].name.split(' ')[0] })), st.loanType) +
        '<div class="mt12 row between small"><span class="muted">Сумма</span><b id="loanAmt">' + U.money(amt) + '</b></div>' + ui.range('loanAmt', 0, ci.limit, 100000, amt) +
        '<div class="stats mt8"><div class="stat"><span class="l">Ставка</span><span class="v">' + U.pct(rate, 1) + '</span></div><div class="stat"><span class="l">Срок</span><span class="v">' + L.months + ' мес.</span></div><div class="stat"><span class="l">Платёж</span><span class="v" id="loanPay">' + U.money(U.annuity(amt, rate, L.months)) + '</span></div><div class="stat"><span class="l">Переплата</span><span class="v" id="loanOver">' + U.money(U.annuity(amt, rate, L.months) * L.months - amt) + '</span></div></div>' +
        '<button class="btn primary block mt12" data-act="loan">Взять кредит</button>' : '<div class="hint">Банк не готов кредитовать: слишком высокая долговая нагрузка или убытки. Улучшите EBITDA или погасите часть долга.</div>') +
      '<div class="tiny muted mt8">Лимит одобрения: ' + U.money(ci.limit) + '. Ставка = ключевая (' + U.pct(s.market.keyRate, 1) + ') + маржа банка + надбавка за риск.</div></div>';
    h += '<div class="card"><div class="card-h"><h3>Действующие кредиты</h3></div>' + (s.loans.length ? s.loans.map(l => '<div class="list-i"><div class="grow"><b>' + ui.esc(l.name) + '</b><div class="small muted">Остаток ' + U.money(l.balance) + ' · ' + U.pct(l.rate, 1) + ' · ещё ' + l.months + ' мес. · платёж ' + U.money(l.payment) + '/мес</div>' + ui.bar(1 - l.balance / l.principal) + '</div><button class="btn sm" data-act="repay" data-arg="' + l.id + '"' + (s.cash < l.balance ? ' disabled' : '') + '>Погасить</button><button class="btn sm ghost" data-act="repayHalf" data-arg="' + l.id + '"' + (s.cash < l.balance / 2 ? ' disabled' : '') + '>½</button></div>').join('') : ui.empty('Кредитов нет')) +
      '<h3 class="mt16 mb8">Депозит</h3><div class="small muted mb8">Ставка ' + U.pct(Math.max(0, s.market.keyRate - 0.02), 1) + ' годовых. Свободные деньги работают, но остаются доступными.</div>' +
      '<div class="row between small"><span class="muted">Сумма</span><b id="depAmt">' + U.money(st.dep) + '</b></div>' + ui.range('dep', 0, Math.max(s.cash, s.deposit, 0), 100000, Math.min(st.dep, Math.max(s.cash, s.deposit, 0))) +
      '<div class="row mt8"><button class="btn grow" data-act="depPut"' + (s.cash <= 0 ? ' disabled' : '') + '>Положить</button><button class="btn grow" data-act="depTake"' + (s.deposit <= 0 ? ' disabled' : '') + '>Снять</button></div></div></div>';
    return h;
  }
  const stat = (l, v, cls) => '<div class="stat"><span class="l">' + l + '</span><span class="v ' + (cls || '') + '">' + v + '</span></div>';
  const leg = (c, l, v) => '<div class="row between"><span><span class="dot" style="background:' + c + ';margin-right:6px"></span>' + l + '</span><span>' + U.money(v) + '</span></div>';

  function charts(s) {
    const h = s.history.slice(-24), labels = h.map(x => U.shortDate(x.turn));
    return { cf: { labels, fmt: v => U.money(v), height: 200, series: [{ name: 'Операционный поток', values: h.map(x => x.opCF), type: 'bar', posNeg: true }, { name: 'Баланс', values: h.map(x => x.cash), color: CH.blue }] } };
  }

  const act = {
    pnl(a) { st.pnl = a.dataset.v; },
    loanType(a) { st.loanType = a.dataset.v; },
    loan(a, s) { const ci = E.creditInfo(s); const amt = Math.min(st.loanAmt || Math.round(ci.limit / 2 / 100000) * 100000, ci.limit); const r = A.takeLoan(s, st.loanType, amt); if (r.ok) { st.loanAmt = 0; return { ok: true, msg: 'Кредит получен: ' + U.money(amt) }; } return r; },
    repay(a, s) { return A.repayLoan(s, a.dataset.arg); },
    repayHalf(a, s) { const l = s.loans.find(x => x.id === a.dataset.arg); return A.repayLoan(s, l.id, l.balance / 2); },
    depPut(a, s) { return A.depositPut(s, Math.min(st.dep, s.cash)); },
    depTake(a, s) { return A.depositTake(s, Math.min(st.dep || s.deposit, s.deposit)); }
  };
  const input = {
    loanAmt(t, s) { st.loanAmt = +t.value; const ci = E.creditInfo(s), L = A.LOANS[st.loanType], rate = ci.rate + L.add, p = U.annuity(st.loanAmt, rate, L.months); set('loanAmt', U.money(st.loanAmt)); set('loanPay', U.money(p)); set('loanOver', U.money(p * L.months - st.loanAmt)); },
    dep(t) { st.dep = +t.value; set('depAmt', U.money(st.dep)); }
  };
  const change = { loanAmt: () => 'keep', dep: () => 'keep' };
  function set(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
  return { title: 'Финансы', render, charts, act, input, change, pnlTable };
})();
