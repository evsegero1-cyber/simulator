/* Главная панель руководителя */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.dash = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, CH = MS.charts.COLORS;
  let chartTab = 'fin';

  const KPI = [
    { k: 'cash', l: 'Баланс компании', f: 'money', get: (r, s) => s.cash, col: CH.blue },
    { k: 'revenue', l: 'Выручка за месяц', f: 'money', get: r => r.revenue, col: CH.cyan },
    { k: 'netProfit', l: 'Прибыль / убыток', f: 'money', get: r => r.netProfit, col: CH.green, sign: true },
    { k: 'staff', l: 'Сотрудники', f: 'int', get: r => r.staff, col: CH.violet, unit: ' чел.' },
    { k: 'productivity', l: 'Производительность труда', f: 'd1', get: r => r.productivity, col: CH.amber, unitF: s => ' ' + M.ind(s).unit + '/чел.' },
    { k: 'morale', l: 'Удовлетворённость персонала', f: 'int', get: r => r.morale, col: CH.pink, unit: ' / 100', tone: v => ui.toneOf(v, 60, 42) },
    { k: 'reputation', l: 'Репутация компании', f: 'int', get: r => r.reputation, col: CH.violet, unit: ' / 100', tone: v => ui.toneOf(v, 60, 40) },
    { k: 'share', l: 'Доля рынка', f: 'pct', get: r => r.share, col: CH.blue },
    { k: 'production', l: 'Объём производства', f: 'int', get: r => r.production, col: CH.cyan, unitF: s => ' ' + M.ind(s).unit },
    { k: 'debt', l: 'Задолженности', f: 'money', get: r => r.debt, col: CH.red, invert: true },
    { k: 'total', l: 'Общий финансовый результат', f: 'money', get: (r, s) => U.sum(s.history, x => x.netProfit), col: CH.green, sign: true }
  ];

  function current(s) {
    const last = s.history[s.history.length - 1];
    if (last) return { r: last, forecast: false };
    return { r: E.forecast(s), forecast: true };
  }

  function alerts(s) {
    const out = [], c = MS.sit.ctx(s), I = M.ind(s), o = E.compute(s);
    if (s.status === 'lost') out.push({ t: 'bad', x: 'Игра окончена: ' + s.lostReason.text, go: 'reports' });
    if (s.pending.length) out.push({ t: 'warn', x: 'Ждут решения: ' + s.pending.length + ' ' + U.plural(s.pending.length, 'ситуация', 'ситуации', 'ситуаций'), go: 'sits' });
    if (s.cash < 0) out.push({ t: 'bad', x: 'Отрицательный баланс — работаете в овердрафт (лимит ' + U.money(E.overdraftLimit(s)) + ')', go: 'fin' });
    else if (c.cashMonths < 1.2 && s.turn > 0) out.push({ t: 'warn', x: 'Денег на ' + U.num(Math.max(0, c.cashMonths), 1) + ' мес. расходов', go: 'fin' });
    const rel = s.market.price / E.stdPrice(s);
    if (rel < 0.95) out.push({ t: 'warn', x: 'Цена на ' + U.pct(1 - rel, 0) + ' ниже рыночной — инфляция съедает маржу', go: 'mkt' });
    if (c.sr < 0.95) out.push({ t: 'warn', x: 'Зарплаты ниже рынка (' + U.pct(c.sr, 0) + ') — растёт текучесть', go: 'staff' });
    if (s.staff.morale < 40) out.push({ t: 'bad', x: 'Низкая удовлетворённость персонала', go: 'staff' });
    if (I.capitalIntensity >= 0.5 && s.prod.condition < 45) out.push({ t: 'warn', x: 'Оборудование изношено (' + U.num(s.prod.condition) + '/100)', go: 'prod' });
    if (o.potential > o.normalMax * 1.08) out.push({ t: 'info', x: 'Спрос выше мощности на ' + U.pct(o.potential / o.normalMax - 1, 0) + (o.bottleneck === 'staff' ? ' — не хватает людей' : ' — не хватает оборудования'), go: o.bottleneck === 'staff' ? 'staff' : 'prod' });
    if (o.utilization < 0.7 && s.turn > 2) out.push({ t: 'info', x: 'Мощности загружены на ' + U.pct(o.utilization, 0), go: 'prod' });
    if (c.lev > 3.5) out.push({ t: 'bad', x: 'Долг/EBITDA = ' + U.num(Math.min(c.lev, 99), 1) + '×', go: 'fin' });
    if (I.inventory === 'stock' && c.stockMonths > 1.5) out.push({ t: 'warn', x: 'Затоваривание склада', go: 'prod' });
    if (s.market.innovation < 30) out.push({ t: 'warn', x: 'Ассортимент устаревает', go: 'mkt' });
    if (s.turn % 12 === 0 && s.turn > 0 && !(s.org.goals || []).length) out.push({ t: 'info', x: 'Новый год — поставьте цели', go: 'strat' });
    return out;
  }

  function render(s, app) {
    const { r, forecast } = current(s);
    const prev = app.prevRec;
    const I = M.ind(s);
    const a = alerts(s);
    const hist = s.history.slice(-12);
    let html = '';
    if (a.length) html += '<div class="alerts mb12">' + a.map(x => '<div class="alert ' + x.t + '" data-act="go" data-arg="' + x.go + '">' + ui.icon(x.t === 'info' ? 'info' : 'warn').replace('<svg', '<svg style="width:16px;height:16px;flex:none"') + '<span>' + x.x + '</span></div>').join('') + '</div>';
    const ad = M.adizes(s);
    html += '<div class="row between wrap mb12"><div><h2>Панель руководителя</h2><div class="small muted">' + (forecast ? 'Первый месяц: показан прогноз при текущих решениях' : 'Итоги: ' + U.dateLabel(r.turn).toLowerCase()) + '</div></div><div class="row wrap"><span class="chip accent th-chip" data-act="theory" data-arg="adizes">Стадия: ' + ad.name + '</span><span class="chip">' + C_STRAT(s) + '</span></div></div>';
    html += '<div class="kpis">' + KPI.map(k => {
      const v = k.get(r, s);
      const pv = prev && !forecast ? (k.k === 'total' ? U.sum(s.history.slice(0, -1), x => x.netProfit) : k.k === 'cash' ? prev.cash : prev[k.k]) : null;
      const d = pv != null ? v - pv : null;
      const anim = app.animate && pv != null ? ' data-anim="' + v + '" data-from="' + pv + '" data-fmt="' + k.f + '"' : '';
      const tone = k.tone ? k.tone(v) : k.sign ? (v >= 0 ? 'good' : 'bad') : '';
      const series = k.k === 'total' ? cumul(s).slice(-12) : k.k === 'cash' ? hist.map(x => x.cash) : hist.map(x => x[k.k]);
      const unit = k.unitF ? k.unitF(s) : (k.unit || '');
      return '<div class="kpi" data-act="why" data-arg="' + k.k + '"><div class="kpi-l"><span class="dot" style="background:' + k.col + '"></span>' + k.l + '</div><div class="kpi-v ' + tone + '"><span' + anim + '>' + ui.fmtv(v, k.f) + '</span><span class="small muted" style="font-weight:500">' + unit + '</span></div><div class="kpi-d">' + (forecast ? '<span class="dim">прогноз</span>' : d != null ? ui.delta(d, k.f, k.invert) : '') + '</div>' + MS.charts.spark(series, k.col) + '</div>';
    }).join('') + '</div>';

    // графики
    html += '<div class="grid g3 mt16"><div class="card" style="grid-column:span 2"><div class="card-h"><h3>Динамика</h3>' + ui.seg('chartTab', [{ v: 'fin', l: 'Финансы' }, { v: 'mkt', l: 'Рынок' }, { v: 'hr', l: 'Персонал' }, { v: 'cash', l: 'Деньги' }], chartTab) + '</div><div data-chart="main"></div></div>';
    // прогноз
    const f = E.forecast(s);
    html += '<div class="card"><div class="card-h"><h3>Прогноз на ' + U.MONTHS[s.turn % 12].toLowerCase() + '</h3><span class="chip">при текущих решениях</span></div>' +
      row('Выручка', U.money(f.revenue)) + row('Расходы (денежные)', U.money(f.expensesCash)) + row('Чистая прибыль', '<span class="' + (f.netProfit >= 0 ? 'good' : 'bad') + '">' + U.money(f.netProfit) + '</span>') +
      row('Баланс на конец месяца', '<span class="' + (f.cash >= 0 ? '' : 'bad') + '">' + U.money(f.cash) + '</span>') + row('Продажи / спрос', U.num(f.sales) + ' / ' + U.num(f.potential) + ' ' + I.unit) +
      row('Загрузка мощностей', U.pct(f.utilization, 0)) +
      '<div class="hint mt12 tiny">Прогноз не учитывает случайные события и решения по ситуациям этого месяца.</div>' +
      '<button class="btn turn-btn block mt12" data-act="endTurn"' + (s.status !== 'active' ? ' disabled' : '') + '>Завершить месяц ' + ui.icon('next') + '</button></div></div>';

    // события
    const ev = s.events.filter(e => e.turn >= s.turn - 1).slice(-10).reverse();
    html += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Последние события</h3><button class="btn ghost sm" data-act="go" data-arg="journal">Журнал</button></div>' + (ev.length ? ev.map(evRow).join('') : ui.empty('Пока тихо')) + '</div>';
    // ситуации
    html += '<div class="card"><div class="card-h"><h3>Управленческие ситуации</h3><button class="btn ghost sm" data-act="go" data-arg="sits">Открыть</button></div>' +
      (s.pending.length ? s.pending.map(p => { const d = MS.sit.def(p.id); return '<div class="list-i" data-act="go" data-arg="sits" style="cursor:pointer"><span class="chip ' + catTone(d.cat) + '">' + CAT[d.cat] + '</span><div class="grow"><b>' + ui.esc(d.title) + '</b><div class="small muted">Решить до конца месяца</div></div>' + ui.icon('next').replace('<svg', '<svg style="width:18px;color:var(--muted)"') + '</div>'; }).join('') : ui.empty('Нет нерешённых ситуаций. Самое время заняться развитием.', 'check')) + '</div></div>';
    return html;
  }
  const C_STRAT = (s) => 'Стратегия: ' + MS.CAT.STRATEGIES[s.market.strategy].name.toLowerCase();
  const row = (l, v) => '<div class="row between" style="padding:6px 0;border-bottom:1px dashed var(--border)"><span class="muted small">' + l + '</span><b class="num">' + v + '</b></div>';
  const CAT = { staff: 'Персонал', finance: 'Финансы', production: 'Производство', market: 'Рынок', strategy: 'Стратегия' };
  const catTone = (c) => ({ staff: 'accent', finance: 'good', production: 'warn', market: '', strategy: 'accent' })[c] || '';
  function evRow(e) {
    const col = { good: 'var(--good)', warn: 'var(--warn)', bad: 'var(--bad)', info: 'var(--accent)' }[e.tone] || 'var(--accent)';
    return '<div class="ev"><span class="dot" style="background:' + col + '"></span><div class="grow">' + ui.esc(e.text || e.t) + '<div class="tiny dim">' + U.shortDate(e.turn) + '</div></div></div>';
  }
  function cumul(s) { let a = 0; return s.history.map(x => a += x.netProfit); }

  function charts(s) {
    const h = s.history.slice(-24); const labels = h.map(x => U.shortDate(x.turn));
    const m = v => U.money(v);
    const cfg = {
      fin: { labels, fmt: m, series: [{ name: 'Выручка', color: CH.cyan, values: h.map(x => x.revenue), type: 'area' }, { name: 'Денежные расходы', color: CH.amber, values: h.map(x => x.expensesCash), dash: true }, { name: 'Чистая прибыль', values: h.map(x => x.netProfit), type: 'bar', posNeg: true }] },
      mkt: { labels, zero: false, fmt: v => U.pct(v), axisFmt: v => U.pct(v, 0), series: [{ name: 'Доля рынка', color: CH.blue, values: h.map(x => x.share), type: 'area' }].concat(s.market.competitors.slice(0, 4).map((c, i) => ({ name: c.name, color: [CH.gray, CH.violet, CH.pink, CH.amber][i], values: h.map(x => x.compShares ? x.compShares[i] : null), width: 1.4 }))) },
      hr: { labels, zero: false, min: 0, max: 100, fmt: v => U.num(v), axisFmt: v => U.num(v), series: [{ name: 'Удовлетворённость', color: CH.pink, values: h.map(x => x.morale) }, { name: 'Квалификация', color: CH.amber, values: h.map(x => x.skill) }, { name: 'Репутация', color: CH.violet, values: h.map(x => x.reputation) }, { name: 'Качество', color: CH.cyan, values: h.map(x => x.quality) }] },
      cash: { labels, fmt: m, series: [{ name: 'Баланс', color: CH.blue, values: h.map(x => x.cash), type: 'area' }, { name: 'Задолженность', color: CH.red, values: h.map(x => x.debt) }, { name: 'Дебиторка', color: CH.amber, values: h.map(x => x.receivables), dash: true }] }
    };
    return { main: Object.assign({ height: 230 }, cfg[chartTab]) };
  }

  /* ---------- «Почему так?» по каждому показателю ---------- */
  function why(k, s) {
    const o = E.compute(s), I = M.ind(s), h = s.history.slice(-24), labels = h.map(x => U.shortDate(x.turn));
    const last = s.history[s.history.length - 1];
    let title = (KPI.find(x => x.k === k) || {}).l || '', body = '', th = [], chart = null;
    const line = (name, vals, fmt, col) => ({ labels, fmt, series: [{ name, values: vals, color: col || CH.blue, type: 'area' }] });
    switch (k) {
      case 'cash': {
        th = ['finance'];
        body = last ? '<h4 class="mb8">Движение денег за прошлый месяц</h4>' + row('Операционный поток', U.money(last.opCF)) + row('Инвестиционный поток', U.money(last.invCF)) + row('Финансовый поток (кредиты)', U.money(last.finCF)) + row('Дебиторская задолженность', U.money(last.receivables)) + row('Депозит', U.money(last.deposit)) : '';
        body += '<div class="hint mt12">Баланс — это деньги на счёте. Он отличается от прибыли: покупатели платят с отсрочкой, деньги уходят в запасы, оборудование и погашение кредитов. Лимит овердрафта: ' + U.money(E.overdraftLimit(s)) + '.</div>';
        chart = line('Баланс', h.map(x => x.cash), v => U.money(v)); break;
      }
      case 'revenue': case 'share': {
        th = ['porter', 'pest'];
        body = '<h4 class="mb8">Спрос на рынке: ' + U.num(o.demand) + ' ' + I.unit + '</h4>' + ui.factors(o.explain.demand) +
          '<h4 class="mt16 mb8">Почему клиенты выбирают вас (вклад в привлекательность)</h4>' + ui.factors(o.explain.share, { d: 2 }) +
          '<div class="hint mt12">Выручка = спрос рынка × ваша доля × цена, но не больше, чем вы можете произвести. Сейчас: потенциальные продажи ' + U.num(o.potential) + ' ' + I.unit + ', мощность ' + U.num(o.normalMax) + '.</div>';
        chart = k === 'share' ? { labels, fmt: v => U.pct(v), zero: false, series: [{ name: 'Доля', values: h.map(x => x.share), color: CH.blue, type: 'area' }] } : line('Выручка', h.map(x => x.revenue), v => U.money(v), CH.cyan); break;
      }
      case 'netProfit': case 'total': {
        th = ['breakeven', 'finance'];
        if (last) body = MS.screens.fin.pnlTable(last, s);
        chart = k === 'total' ? line('Накопленный результат', cumul(s).slice(-24), v => U.money(v), CH.green) : { labels, fmt: v => U.money(v), series: [{ name: 'Чистая прибыль', values: h.map(x => x.netProfit), type: 'bar', posNeg: true }] }; break;
      }
      case 'staff': {
        th = ['fayol', 'maslow'];
        body = M.depts(s).map(d => row(MS.CAT.DEPTS[d].name, s.staff.depts[d].n + ' чел.' + (s.staff.depts[d].head ? ' + руководитель' : ''))).join('') +
          row('Уволилось за 3 месяца', U.sum(s.counters.quits3, x => x.q) + ' чел.') + row('Ожидаемая текучесть', U.pct(o.turnoverRate, 1) + ' в месяц');
        chart = line('Численность', h.map(x => x.staff), v => U.num(v), CH.violet); break;
      }
      case 'productivity': {
        th = ['taylor', 'mcgregor', 'hersey'];
        body = '<p class="small muted">Выработка одного работника производства: ' + U.num(o.perWorker, 1) + ' ' + I.unit + ' в месяц при норме ' + U.num(I.laborPU, 1) + '.</p>' + ui.factors(o.explain.prod);
        chart = line('Выработка на человека', h.map(x => x.productivity), v => U.num(v, 1), CH.amber); break;
      }
      case 'morale': {
        th = ['herzberg', 'maslow', 'mcgregor'];
        body = '<p class="small muted">Удовлетворённость движется к целевому уровню <b>' + U.num(o.moraleTarget) + '</b> примерно на 30% разницы в месяц. Гигиенические факторы убирают недовольство, мотиваторы создают удовлетворённость.</p>' + ui.factors(o.explain.morale);
        chart = line('Удовлетворённость', h.map(x => x.morale), v => U.num(v), CH.pink); break;
      }
      case 'reputation': {
        th = ['deming', 'porter'];
        body = '<p class="small muted">Репутация медленно движется к уровню <b>' + U.num(o.repTarget) + '</b>.</p>' + ui.factors(o.explain.rep);
        chart = line('Репутация', h.map(x => x.reputation), v => U.num(v), CH.violet); break;
      }
      case 'production': {
        th = ['fayol', 'breakeven'];
        body = row('Выработка персонала', U.num(o.workforce) + ' ' + I.unit) + row('Мощность оборудования', U.num(o.equipCap) + ' ' + I.unit) + row('Узкое место', o.bottleneck === 'staff' ? 'персонал' : 'оборудование') + row('План', s.prod.planMode === 'auto' ? 'по спросу' : U.pct(s.prod.plan, 0)) + row('Потенциальный спрос', U.num(o.potential) + ' ' + I.unit);
        chart = { labels, fmt: v => U.num(v), series: [{ name: 'Производство', values: h.map(x => x.production), color: CH.cyan, type: 'area' }, { name: 'Спрос на вашу продукцию', values: h.map(x => x.potential), color: CH.amber, dash: true }, { name: 'Мощность', values: h.map(x => x.capacity), color: CH.gray, width: 1.4 }] }; break;
      }
      case 'debt': {
        th = ['finance'];
        const ci = E.creditInfo(s);
        body = row('Кредиты', U.money(U.sum(s.loans, l => l.balance))) + row('Овердрафт', U.money(Math.max(0, -s.cash))) + row('Долг / EBITDA', U.num(Math.min(ci.lev, 99), 1) + '×') + row('Кредитный рейтинг', ci.rating) + row('Нам должны (дебиторка)', U.money(U.sum(s.receivables, x => x.amount)));
        chart = line('Задолженность', h.map(x => x.debt), v => U.money(v), CH.red); break;
      }
    }
    MS.app.modalCharts = chart ? { why: chart } : null;
    ui.modal({ title, body: (chart ? '<div data-chart="why" class="mb12"></div>' : '') + body + (th.length ? '<div class="mt12 row wrap">' + ui.theoryChips(th) + '</div>' : ''), onClose: () => { MS.app.modalCharts = null; } });
  }

  /* ---------- Итоги месяца ---------- */
  function turnResult(res, s) {
    const r = res.r.rec, p = res.r.prev, I = M.ind(s);
    const d = (k) => p ? r[k] - p[k] : null;
    const cell = (l, v, dv, f, inv) => '<div class="stat"><span class="l">' + l + '</span><span class="v">' + v + '</span><span class="tiny">' + (dv != null ? ui.delta(dv, f, inv) : '') + '</span></div>';
    let body = '<div class="stats mb12">' + cell('Выручка', U.money(r.revenue), d('revenue'), 'money') + cell('Чистая прибыль', '<span class="' + (r.netProfit >= 0 ? 'good' : 'bad') + '">' + U.money(r.netProfit) + '</span>', d('netProfit'), 'money') +
      cell('Баланс', U.money(r.cash), p ? r.cash - p.cash : null, 'money') + cell('Доля рынка', U.pct(r.share), d('share'), 'pct') + cell('Удовлетворённость', U.num(r.morale), d('morale'), 'int') + cell('Продано', U.num(r.sales) + ' ' + I.unit, d('sales'), 'int') + '</div>';
    if (r.quits) body += '<div class="small muted mb8">Уволились по собственному желанию: ' + r.quits + ' чел.' + (s.staff.autoReplace ? ' (замещены новичками)' : '') + '</div>';
    if (r.service < 0.97) body += '<div class="small warn mb8">Не удалось удовлетворить ' + U.pct(1 - r.service, 0) + ' спроса — не хватило мощности или запасов.</div>';
    const evs = res.r.events.slice();
    res.expired.forEach(x => evs.push({ t: 'Без решения: «' + x.rec.title + '» → ' + x.rec.choice, tone: 'bad' }));
    if (evs.length) body += '<h4 class="mt12 mb8">События месяца</h4>' + evs.map(e => evRow({ text: (e.delayed ? 'Последствие решения: ' : '') + e.t, tone: e.tone, turn: r.turn })).join('');
    if (res.added.length) body += '<div class="hint mt12"><b>Новые ситуации (' + res.added.length + '):</b> ' + res.added.map(a => ui.esc(MS.sit.def(a.id).title)).join(', ') + '</div>';
    let foot = '';
    if (s.status === 'lost') {
      body = '<div class="verdict bad mb12"><div class="ic">!</div><div><b>Игра окончена</b><div class="small">' + ui.esc(s.lostReason.text) + '</div></div></div>' + body;
      foot = '<button class="btn primary" data-m="final">Итоговая оценка</button>';
    } else {
      if (res.yearReport) foot += '<button class="btn good" data-m="year">Годовой отчёт</button>';
      foot += res.added.length ? '<button class="btn" data-close>Позже</button><button class="btn primary" data-m="sits">К ситуациям</button>' : '<button class="btn primary" data-close>Продолжить</button>';
    }
    ui.modal({
      title: 'Итоги: ' + U.dateLabel(r.turn).toLowerCase(), body, foot, sticky: s.status === 'lost',
      actions: {
        sits: (b, m) => { m.close(); MS.app.route = 'sits'; MS.app.renderShell(); },
        year: (b, m) => { m.close(); MS.screens.reports.openYear(s.yearReports.length - 1, s); },
        final: (b, m) => { m.close(); MS.app.showFinal(); }
      }
    });
    if (res.yearReport && s.status === 'active') setTimeout(() => MS.ui.toast('Сформирован годовой отчёт руководителя за год ' + res.yearReport.year, 'good'), 400);
  }

  const act = { chartTab(a) { chartTab = a.dataset.v; } };
  return { title: 'Панель', render, charts, act, why, turnResult, alerts };
})();
