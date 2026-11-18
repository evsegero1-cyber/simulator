/* Маркетинг и рынок: цена, конкуренты, реклама, репутация, новые рынки и продукты */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.mkt = (function () {
  const U = MS.util, ui = MS.ui, M = MS.model, E = MS.economy, A = MS.act, C = MS.CAT, CH = MS.charts.COLORS;

  function pricePreview(s, price, o) {
    const sh = E.shares(s, price);
    const pot = o.demand * sh.company;
    const sales = Math.min(pot, o.normalMax + (M.ind(s).inventory === 'stock' ? s.prod.finished : 0));
    return { share: sh.company, pot, sales, revenue: sales * price, margin: sales * (price - o.matUnit) };
  }

  function render(s) {
    const I = M.ind(s), Mk = s.market, o = E.compute(s), std = E.stdPrice(s);
    const pv = pricePreview(s, Mk.price, o);
    let h = '<div class="row between wrap mb12"><div><h2>Маркетинг и рынок</h2><div class="small muted">Цена, конкуренты, продвижение, репутация, новые рынки и продукты</div></div><div class="row wrap">' + ui.theoryChips(['porter', 'bcg', 'strategy']) + '</div></div>';
    h += '<div class="grid g2"><div class="card"><div class="card-h"><h3>Формирование цены</h3><span class="chip">рынок ' + U.money(std) + '</span></div>' +
      '<div class="row between"><span class="muted small">Ваша цена</span><b id="pr" style="font-size:20px">' + U.money(Mk.price) + ' <span class="small ' + (Mk.price < std * 0.97 ? 'warn' : '') + '">' + U.signed((Mk.price / std - 1) * 100, v => U.num(v, 0) + '%') + '</span></b></div>' +
      ui.range('price', Math.round(std * 0.6), Math.round(std * 1.5), Math.max(1, Math.round(std / 200)), Mk.price) +
      '<div class="row wrap mb12"><button class="btn sm" data-act="priceStd">По рынку</button><button class="btn sm ghost" data-act="priceAdj" data-v="-0.05">−5%</button><button class="btn sm ghost" data-act="priceAdj" data-v="0.05">+5%</button></div>' +
      '<div class="stats">' + stat('Прогноз доли', '<span id="pvShare">' + U.pct(pv.share) + '</span>') + stat('Продажи', '<span id="pvSales">' + U.num(pv.sales) + '</span> ' + I.unit) + stat('Выручка', '<span id="pvRev">' + U.money(pv.revenue) + '</span>') + stat('Маржинальный доход', '<span id="pvMar">' + U.money(pv.margin) + '</span>') + '</div>' +
      '<div class="hint mt12 tiny">Чувствительность клиентов к цене в отрасли: ' + (E.elasticity(s) > 2.5 ? 'высокая' : E.elasticity(s) > 2 ? 'средняя' : 'умеренная') + '. Рыночная цена растёт вместе с инфляцией (≈ ' + U.pct(E.inflation(s), 0) + ' в год) — не забывайте её пересматривать.</div></div>';
    // Конкуренты
    const exact = Mk.researchUntil >= s.turn;
    const fz = (v, f) => exact ? f(v) : '≈ ' + f(Math.round(v / 5) * 5);
    h += '<div class="card"><div class="card-h"><h3>Конкуренты</h3>' + (exact ? '<span class="chip good">исследование до ' + U.shortDate(Mk.researchUntil) + '</span>' : '<button class="btn sm" data-act="research">Исследование · ' + U.money(C.RESEARCH.costK * A.campaignBase(s)) + '</button>') + '</div>' +
      '<div class="scroll-x"><table class="t"><tr><th>Компания</th><th class="n">Цена</th><th class="n">Качество</th><th class="n">Репутация</th><th class="n">Доля</th></tr>' +
      '<tr><td><b class="accent">' + ui.esc(s.company.name) + '</b></td><td class="n">' + U.pct(Mk.price / std, 0) + '</td><td class="n">' + U.num(Mk.quality) + '</td><td class="n">' + U.num(Mk.reputation) + '</td><td class="n"><b>' + U.pct(o.share) + '</b></td></tr>' +
      Mk.competitors.map((c, i) => '<tr><td>' + ui.esc(c.name) + '</td><td class="n">' + (exact ? U.pct(c.priceK, 0) : '≈ ' + U.pct(Math.round(c.priceK * 20) / 20, 0)) + '</td><td class="n">' + fz(c.q, U.num) + '</td><td class="n">' + fz(c.rep, U.num) + '</td><td class="n">' + (exact ? U.pct(o.shares.comps[i]) : '≈ ' + U.pct(Math.round(o.shares.comps[i] * 100) / 100, 0)) + '</td></tr>').join('') +
      '<tr class="sub"><td>Прочие участники рынка</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td class="n">' + U.pct(o.shares.others, 0) + '</td></tr></table></div>' +
      '<div data-chart="share" class="mt12"></div></div></div>';

    // Продвижение
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Рекламные кампании</h3><span class="chip">узнаваемость ' + U.num(Mk.awareness, 1) + '</span></div>' + C.CAMPAIGNS.map(cp => {
      const on = Mk.campaigns.find(x => x.id === cp.id);
      const base = A.campaignBase(s);
      return '<div class="opt-card mb8 ' + (on ? 'on' : '') + '"><div class="row between"><b>' + cp.name + '</b><span class="chip">' + U.money(cp.costK * base) + '/мес' + (cp.setupK ? ' + ' + U.money(cp.setupK * base) : '') + '</span></div><div class="small muted mt8">' + cp.desc + '</div><div class="row between mt8"><span class="tiny muted">' + (on ? 'Идёт, осталось ' + (on.until - s.turn) + ' мес.' : 'Длительность ' + cp.months + ' мес.') + '</span>' + (on ? '<button class="btn sm ghost" data-act="stopCamp" data-arg="' + cp.id + '">Остановить</button>' : '<button class="btn sm primary" data-act="camp" data-arg="' + cp.id + '">Запустить</button>') + '</div></div>';
    }).join('') + '</div>';
    h += '<div class="card"><div class="card-h"><h3>Репутация</h3><span class="chip ' + ui.toneOf(Mk.reputation, 60, 40) + '">' + U.num(Mk.reputation) + ' → ' + U.num(o.repTarget) + '</span></div>' + ui.factors(o.explain.rep) +
      '<h4 class="mt16 mb8">Что определяет вашу долю рынка</h4>' + ui.factors(o.explain.share, { d: 2 }) + '</div></div>';

    // Рынки и продукты
    h += '<div class="grid g2 mt16"><div class="card"><div class="card-h"><h3>Выход на новые рынки</h3>' + ui.theoryChips(['strategy']) + '</div>' + Object.keys(C.MARKETS).filter(id => M.marketName(s, id)).map(id => {
      const d = C.MARKETS[id], m = s.markets.find(x => x.id === id), ok = d.req(s), cost = A.marketCost(s, id);
      return '<div class="opt-card mb8 ' + (m ? 'on' : '') + '"><div class="row between"><b>' + ui.esc(M.marketName(s, id)) + '</b>' + (m ? (m.ready ? '<span class="chip good">освоение ' + U.pct(m.ramp, 0) + '</span>' : '<span class="chip warn">через ' + (m.at - s.turn) + ' мес.</span>') : '<span class="chip">' + U.money(cost) + '</span>') + '</div><div class="small muted mt8">' + d.desc + ' Срок ' + d.months + ' мес.</div>' +
        (m ? '' : '<div class="row between mt8"><span class="tiny ' + (ok ? 'muted' : 'bad') + '">' + (ok ? 'Условия выполнены' : d.reqText) + '</span><button class="btn sm primary" data-act="market" data-arg="' + id + '"' + (!ok || s.cash < cost ? ' disabled' : '') + '>Выйти</button></div>') + '</div>';
    }).join('') + '</div>';
    const pc = A.productCost(s), inProg = s.projects.filter(p => p.type === 'product');
    h += '<div class="card"><div class="card-h"><h3>Разработка новых продуктов</h3><span class="chip ' + ui.toneOf(Mk.innovation, 55, 35) + '">новизна ' + U.num(Mk.innovation) + '</span></div><p class="small muted">Ассортимент стареет каждый месяц (жизненный цикл товара). Новый продукт: ' + U.money(pc.cost) + ', ' + pc.months + ' мес.' + (s.staff.depts.rnd && s.staff.depts.rnd.n ? ' (с учётом R&D)' : ' — R&D-отдел ускорит и удешевит разработку') + '.</p>' +
      I.products.map(p => { const done = s.products.includes(p), pr = inProg.find(x => x.id === p); return '<div class="list-i"><div class="grow"><b class="small">' + ui.esc(p) + '</b><div class="tiny muted">' + (done ? 'Выпускается' : pr ? 'Разработка: ещё ' + (pr.at - s.turn) + ' мес.' : 'Спрос +7%, новизна +24') + '</div></div>' + (done ? '<span class="chip good">' + ui.icon('check').replace('<svg', '<svg style="width:14px;height:14px"') + '</span>' : pr ? '<span class="chip warn">в работе</span>' : '<button class="btn sm" data-act="product" data-arg="' + ui.esc(p) + '"' + (s.cash < pc.cost ? ' disabled' : '') + '>Разработать</button>') + '</div>'; }).join('') + '</div></div>';
    return h;
  }
  const stat = (l, v) => '<div class="stat"><span class="l">' + l + '</span><span class="v">' + v + '</span></div>';

  function charts(s) {
    const h = s.history.slice(-24), labels = h.map(x => U.shortDate(x.turn));
    return { share: { labels, height: 170, zero: false, fmt: v => U.pct(v), axisFmt: v => U.pct(v, 0), series: [{ name: 'Ваша доля', values: h.map(x => x.share), color: CH.blue, type: 'area' }] } };
  }

  const act = {
    priceStd(a, s) { return A.setPrice(s, E.stdPrice(s)); },
    priceAdj(a, s) { return A.setPrice(s, s.market.price * (1 + +a.dataset.v)); },
    research(a, s) { return A.research(s); },
    camp(a, s) { return A.launchCampaign(s, a.dataset.arg); },
    stopCamp(a, s) { return A.stopCampaign(s, a.dataset.arg); },
    market(a, s) { const id = a.dataset.arg; ui.confirm('Выйти на рынок?', ui.esc(M.marketName(s, id)) + ': ' + U.money(A.marketCost(s, id)) + ' сейчас, результат через ' + C.MARKETS[id].months + ' мес., затем постепенное освоение. Убедитесь, что хватит мощностей для нового спроса.', 'Начать', () => { const r = A.enterMarket(s, id); ui.toast(r.ok ? 'Выход на рынок начат' : r.msg, r.ok ? 'good' : 'bad'); MS.game.autosave(); MS.app.rerender(); }); return 'keep'; },
    product(a, s) { return A.developProduct(s, a.dataset.arg); }
  };
  const input = {
    price(t, s) {
      const p = +t.value, o = E.compute(s), std = E.stdPrice(s), pv = pricePreview(s, p, o);
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
      set('pr', U.money(p) + ' <span class="small">' + U.signed((p / std - 1) * 100, v => U.num(v, 0) + '%') + '</span>');
      set('pvShare', U.pct(pv.share)); set('pvSales', U.num(pv.sales)); set('pvRev', U.money(pv.revenue)); set('pvMar', U.money(pv.margin));
    }
  };
  const change = { price(t, s) { return A.setPrice(s, +t.value); } };
  return { title: 'Маркетинг', render, charts, act, input, change };
})();
