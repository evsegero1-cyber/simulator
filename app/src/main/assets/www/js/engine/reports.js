/* Отчёты: годовой отчёт руководителя, итоговая оценка компетенций, SWOT и PEST */
var MS = globalThis.MS = globalThis.MS || {};

MS.reports = (function () {
  const U = MS.util, M = MS.model, C = MS.CAT;
  const sc = (v) => Math.round(U.clamp(v, 0, 100));
  function grade(v) {
    if (v >= 85) return { g: 'A', label: 'Отлично', tone: 'good' };
    if (v >= 70) return { g: 'B', label: 'Хорошо', tone: 'good' };
    if (v >= 55) return { g: 'C', label: 'Удовлетворительно', tone: 'warn' };
    if (v >= 40) return { g: 'D', label: 'Слабо', tone: 'bad' };
    return { g: 'E', label: 'Неудовлетворительно', tone: 'bad' };
  }

  function periodStats(s, h) {
    if (!h.length) return null;
    const rev = U.sum(h, x => x.revenue), net = U.sum(h, x => x.netProfit), ebitda = U.sum(h, x => x.ebitda);
    const avgStaff = U.avg(h, x => x.staff), quits = U.sum(h, x => x.quits);
    const exp = U.avg(h, x => x.expensesCash);
    return {
      rev, net, ebitda, ros: rev > 0 ? net / rev : 0, months: h.length,
      morale: U.avg(h, x => x.morale), turnover: avgStaff ? quits / avgStaff * 12 / h.length : 0,
      prodIdx: U.avg(h, x => x.prodIndex), perWorker: U.avg(h, x => x.productivity),
      service: U.avg(h, x => x.service), util: U.avg(h, x => x.utilization),
      shareStart: h[0].share, shareEnd: h[h.length - 1].share,
      cashEnd: h[h.length - 1].cash + h[h.length - 1].deposit, debtEnd: h[h.length - 1].debt,
      negMonths: h.filter(x => x.cash < 0).length, minCash: Math.min.apply(null, h.map(x => x.cash)),
      cashMonths: exp > 0 ? (h[h.length - 1].cash + h[h.length - 1].deposit) / exp : 0,
      quality: U.avg(h, x => x.quality), rep: h[h.length - 1].reputation, repStart: h[0].reputation,
      innovation: U.avg(h, x => x.innovation), staffEnd: h[h.length - 1].staff, staffStart: h[0].staff,
      profitMonths: h.filter(x => x.netProfit > 0).length
    };
  }

  function scores(s, st, prevSt, decisions) {
    const lev = st.ebitda > 0 ? st.debtEnd / (st.ebitda * 12 / st.months) : (st.debtEnd > 0 ? 9 : 0);
    const growth = prevSt && prevSt.rev > 0 ? st.rev / prevSt.rev - 1 : 0;
    const fin = sc(45 + st.ros * 280 + Math.min(st.cashMonths, 4) * 4 - Math.max(0, lev - 2) * 7 - st.negMonths * 6);
    const hr = sc(st.morale * 0.95 + 8 - Math.max(0, st.turnover - 0.2) * 70);
    const prod = sc(st.prodIdx * 62 + st.service * 25 + Math.min(st.util, 1) * 10 - Math.max(0, st.util - 1.05) * 60 - 5);
    const dev = sc(50 + growth * 120 + (st.shareEnd - st.shareStart) * 500 + (st.innovation - 45) * 0.5 + (st.rep - st.repStart) * 0.8);
    const dq = decisions.length ? sc(50 + U.avg(decisions, d => d.score) * 25) : 50;
    const res = sc(40 + Math.min(st.cashMonths, 5) * 8 - Math.max(0, lev - 1.5) * 8 - st.negMonths * 9 + st.profitMonths / st.months * 20);
    const total = sc(fin * 0.22 + hr * 0.16 + prod * 0.14 + dev * 0.16 + dq * 0.18 + res * 0.14);
    return { fin, hr, prod, dev, dq, res, total, lev, growth };
  }
  const SCORE_LABELS = { fin: 'Финансовая устойчивость', hr: 'Управление персоналом', prod: 'Производительность', dev: 'Развитие компании', dq: 'Качество решений', res: 'Устойчивость к кризисам' };

  function goalsCheck(s, st, scs, year) {
    const g = (s.org.goals || []).filter(() => s.org.goalsYear === year);
    return g.map(x => {
      const def = C.GOALS.find(d => d.id === x.id);
      let fact, okv;
      switch (x.id) {
        case 'profit': fact = st.ros * 100; okv = fact >= x.target; break;
        case 'share': fact = st.shareEnd * 100; okv = fact >= x.target; break;
        case 'growth': fact = scs.growth * 100; okv = fact >= x.target; break;
        case 'morale': fact = st.morale; okv = fact >= x.target; break;
        case 'debt': fact = scs.lev; okv = fact <= x.target; break;
        case 'turnover': fact = st.turnover * 100; okv = fact <= x.target; break;
      }
      return { name: def.name, target: x.target, unit: def.unit, fact, ok: okv };
    });
  }

  function comments(s, st, scs, decisions) {
    const out = [];
    const push = (tone, text, th) => out.push({ tone, text, th });
    if (st.ros > 0.1) push('good', 'Высокая рентабельность продаж (' + U.pct(st.ros) + '): компания эффективно превращает выручку в прибыль.', 'breakeven');
    else if (st.ros < 0) push('bad', 'Год закрыт с убытком. Проверьте точку безубыточности: цена, переменные затраты и постоянные расходы.', 'breakeven');
    if (st.negMonths) push('bad', 'Отрицательный баланс ' + st.negMonths + ' мес. за год — кассовые разрывы. Прибыль и деньги — не одно и то же.', 'finance');
    if (st.cashMonths < 1) push('warn', 'Запас денег меньше месяца расходов — компания уязвима для любого кризиса.', 'finance');
    if (scs.lev > 3) push('bad', 'Долговая нагрузка ' + U.num(scs.lev, 1) + '× EBITDA — выше безопасного уровня (до 2–3×).', 'finance');
    if (st.morale < 45) push('bad', 'Низкая удовлетворённость персонала (' + U.num(st.morale) + '). Начните с гигиенических факторов: зарплата, условия, контроль.', 'herzberg');
    else if (st.morale > 68) push('good', 'Высокая удовлетворённость персонала (' + U.num(st.morale) + ') — это рост выработки и низкая текучесть.', 'herzberg');
    if (st.turnover > 0.35) push('bad', 'Текучесть ' + U.pct(st.turnover, 0) + ' в год: потери на найме и обучении, падение квалификации.', 'maslow');
    if (st.util > 1.03) push('warn', 'Мощности работали с перегрузкой — растут износ, переработки и брак.', 'fayol');
    if (st.util < 0.7) push('warn', 'Мощности загружены лишь на ' + U.pct(st.util, 0) + ': постоянные затраты распределяются на малый объём, себестоимость высокая.', 'breakeven');
    if (st.service < 0.9) push('warn', 'Компания не удовлетворила ' + U.pct(1 - st.service, 0) + ' спроса — клиенты уходят к конкурентам, репутация падает.', 'deming');
    if (scs.growth > 0.15) push('good', 'Выручка выросла на ' + U.pct(scs.growth, 0) + ' за год.', 'strategy');
    if (st.innovation < 35) push('warn', 'Ассортимент устаревает (новизна ' + U.num(st.innovation) + '). По BCG пора обновлять продукты.', 'bcg');
    const avoid = decisions.filter(d => d.tags.includes('avoid') || d.auto).length;
    if (avoid >= 2) push('bad', 'В ' + avoid + ' ситуациях вы выбрали бездействие или не приняли решения вовремя — проблемы откладывались.', 'thomas');
    const unethical = decisions.filter(d => d.tags.includes('unethical')).length;
    if (unethical) push('bad', 'Принимались неэтичные решения — их риски несоизмеримы с выгодой.', 'strategy');
    if (s.market.strategy === 'none' && s.turn >= 24) push('warn', 'У компании нет выбранной конкурентной стратегии — риск «застрять посередине» по Портеру.', 'porter');
    const a = M.adizes(s);
    push('info', 'Стадия жизненного цикла по Адизесу: «' + a.name + '». ' + a.tip, 'adizes');
    return out;
  }

  function year(s, y) {
    const h = s.history.filter(x => Math.floor(x.turn / 12) === y);
    const hp = s.history.filter(x => Math.floor(x.turn / 12) === y - 1);
    const st = periodStats(s, h); if (!st) return null;
    const prevSt = periodStats(s, hp);
    const dec = s.decisions.filter(d => Math.floor(d.turn / 12) === y);
    const scs = scores(s, st, prevSt, dec);
    const yr = {
      year: y + 1, stats: st, prev: prevSt, scores: scs, grade: grade(scs.total),
      goals: goalsCheck(s, st, scs, y), comments: comments(s, st, scs, dec),
      decisions: dec.length, avgDecision: dec.length ? U.avg(dec, d => d.score) : 0,
      best: dec.slice().sort((a, b) => b.score - a.score).slice(0, 2),
      worst: dec.slice().sort((a, b) => a.score - b.score).filter(d => d.score < 0).slice(0, 2),
      adizes: M.adizes(s).name
    };
    return yr;
  }

  /* ---------- Итоговая оценка компетенций ---------- */
  function final(s) {
    const yrs = s.yearReports;
    const all = periodStats(s, s.history);
    const dec = s.decisions;
    const byCat = (cat) => dec.filter(d => d.cat === cat);
    const avgS = (arr) => arr.length ? U.avg(arr, d => d.score) : 0;
    const yAvg = (k) => yrs.length ? U.avg(yrs, y => y.scores[k]) : (all ? scores(s, all, null, dec)[k] : 50);
    const tags = {}; dec.forEach(d => d.tags.forEach(t => tags[t] = (tags[t] || 0) + 1)); const auto = dec.filter(d => d.auto).length;
    const comp = [
      { k: 'fin', name: 'Финансовый менеджмент', v: sc(yAvg('fin') * 0.7 + (50 + avgS(byCat('finance')) * 25) * 0.3), th: 'finance' },
      { k: 'hr', name: 'Управление персоналом', v: sc(yAvg('hr') * 0.7 + (50 + avgS(byCat('staff')) * 25) * 0.3), th: 'herzberg' },
      { k: 'ops', name: 'Операционный менеджмент', v: sc(yAvg('prod') * 0.7 + (50 + avgS(byCat('production')) * 25) * 0.3), th: 'deming' },
      { k: 'mkt', name: 'Маркетинг и конкуренция', v: sc(yAvg('dev') * 0.5 + (50 + avgS(byCat('market')) * 25) * 0.3 + (all ? all.shareEnd / Math.max(0.01, s.history[0].share) * 10 : 10)), th: 'porter' },
      { k: 'str', name: 'Стратегическое мышление', v: sc(yAvg('dev') * 0.5 + (50 + avgS(byCat('strategy')) * 25) * 0.25 + (s.market.strategy !== 'none' ? 10 : 0) + Math.min(15, (s.markets.length + s.products.length + s.org.branches + s.done.length) * 2)), th: 'strategy' },
      { k: 'crisis', name: 'Антикризисное управление', v: sc(yAvg('res')), th: 'change' },
      { k: 'dec', name: 'Принятие решений', v: sc(50 + avgS(dec) * 25 - auto * 2), th: 'thomas' }
    ];
    const total = sc(U.avg(comp, c => c.v) * (s.status === 'lost' ? 0.8 : 1));
    // Профиль стиля руководства
    const X = (tags.X || 0) + (tags.force || 0), Y = (tags.Y || 0) + (tags.collab || 0) + (tags.delegate || 0);
    const style = [];
    if (X > Y * 1.5 && X >= 3) style.push({ t: 'Авторитарный стиль (теория X)', d: 'Вы чаще выбирали контроль, давление и силовые решения. Это работает с неопытным персоналом, но снижает вовлечённость зрелой команды.' });
    else if (Y > X * 1.5 && Y >= 3) style.push({ t: 'Демократический стиль (теория Y)', d: 'Вы чаще вовлекали людей, делегировали и искали сотрудничество. Сильный стиль для зрелых команд; важно не терять контроль в кризис.' });
    else style.push({ t: 'Ситуационный стиль', d: 'Вы сочетали контроль и вовлечение в зависимости от обстоятельств — подход Херси–Бланшара.' });
    if ((tags.avoid || 0) + auto >= Math.max(3, dec.length * 0.2)) style.push({ t: 'Склонность откладывать решения', d: 'Заметная доля ситуаций решалась бездействием. По модели Томаса–Килманна избегание оправдано лишь для мелких вопросов.' });
    if ((tags.invest || 0) + (tags.plan || 0) >= 3) style.push({ t: 'Ориентация на будущее', d: 'Вы инвестировали в людей, технологии и планирование, принимая временные потери ради долгосрочного эффекта.' });
    if ((tags.cut || 0) >= 3) style.push({ t: 'Ставка на сокращение издержек', d: 'В трудных ситуациях вы чаще резали расходы. Это спасает ликвидность, но может подорвать развитие.' });
    if (tags.unethical) style.push({ t: 'Этические риски', d: 'Были решения, нарушающие закон или этику. Устойчивый бизнес строится на доверии.' });
    const best = comp.slice().sort((a, b) => b.v - a.v)[0], worst = comp.slice().sort((a, b) => a.v - b.v)[0];
    const titles = { fin: 'Финансовый стратег', hr: 'Лидер команды', ops: 'Операционный директор', mkt: 'Рыночный боец', str: 'Стратег-визионер', crisis: 'Антикризисный управляющий', dec: 'Мастер решений' };
    const ind = M.ind(s);
    const h0 = s.history[0], hl = s.history[s.history.length - 1];
    return {
      total, grade: grade(total), comp, style, title: titles[best.k], best, worst,
      bestDecisions: dec.slice().sort((a, b) => b.score - a.score).slice(0, 4),
      worstDecisions: dec.slice().sort((a, b) => a.score - b.score).filter(d => d.score < 0).slice(0, 4),
      years: yrs.length, months: s.turn, status: s.status, lost: s.lostReason,
      summary: all ? {
        rev0: h0.revenue, revN: hl.revenue, share0: h0.share, shareN: hl.share, staff0: h0.staff, staffN: hl.staff,
        cash: hl.cash + hl.deposit, debt: hl.debt, totalProfit: U.sum(s.history, x => x.netProfit), industry: ind.name,
        decisions: dec.length, markets: s.markets.length, products: s.products.length, branches: s.org.branches
      } : null,
      advice: worst.v < 60 ? adviceFor(worst.k) : 'Ваш наименее развитый навык — «' + worst.name + '», но и он на хорошем уровне. Попробуйте сыграть на более высокой сложности или в другой отрасли.'
    };
  }
  function adviceFor(k) {
    return {
      fin: 'Следите за запасом денег (не меньше 1–2 месяцев расходов), долговой нагрузкой (до 2–3× EBITDA) и дебиторкой. Помните: компании гибнут от кассовых разрывов.',
      hr: 'Начинайте с гигиенических факторов (зарплата не ниже рынка), затем добавляйте мотиваторы: премии за результат, обучение, карьерный рост.',
      ops: 'Держите загрузку мощностей 85–100%, вовремя обслуживайте оборудование и следите за качеством — по Демингу, проблемы качества системные.',
      mkt: 'Цена, качество, репутация и узнаваемость работают вместе. Выберите стратегию Портера и не вступайте в ценовую войну без преимущества в издержках.',
      str: 'Ставьте годовые цели, используйте SWOT/PEST, развивайтесь по матрице Ансоффа: новые рынки, новые продукты, филиалы.',
      crisis: 'Держите резерв денег и умеренный долг, не урезайте «инвестиции в будущее» надолго, а в кризис действуйте быстро.',
      dec: 'Не откладывайте решения: бездействие тоже решение, и почти всегда худшее. Оценивайте причину проблемы, а не только симптом.'
    }[k];
  }

  /* ---------- SWOT ---------- */
  function swot(s) {
    const Mk = s.market, comps = Mk.competitors;
    const cq = U.avg(comps, c => c.q), cr = U.avg(comps, c => c.rep), cp = U.avg(comps, c => c.priceK);
    const ci = MS.economy.creditInfo(s), cx = MS.sit.ctx(s);
    const S = [], W = [], O = [], T = [];
    (Mk.quality > cq + 4 ? S : Mk.quality < cq - 4 ? W : []).push((Mk.quality > cq ? 'Качество выше' : 'Качество ниже') + ' среднего у конкурентов (' + U.num(Mk.quality) + ' против ' + U.num(cq) + ')');
    (Mk.reputation > cr + 4 ? S : Mk.reputation < cr - 4 ? W : []).push((Mk.reputation > cr ? 'Репутация сильнее' : 'Репутация слабее') + ' конкурентов (' + U.num(Mk.reputation) + ' против ' + U.num(cr) + ')');
    if (s.staff.morale > 65) S.push('Мотивированный коллектив'); else if (s.staff.morale < 45) W.push('Низкая удовлетворённость персонала');
    if (cx.skill > 62) S.push('Высокая квалификация персонала'); else if (cx.skill < 42) W.push('Недостаточная квалификация персонала');
    if (ci.ebitda12 <= 0 && ci.debt > 0) W.push('Долг при отрицательной EBITDA — нечем обслуживать'); else if (ci.lev < 1.5) S.push('Низкая долговая нагрузка (' + U.num(ci.lev, 1) + '× EBITDA)'); else if (ci.lev > 3) W.push('Высокая долговая нагрузка (' + U.num(Math.min(ci.lev, 99), 1) + '× EBITDA)');
    if (cx.cashMonths > 3) S.push('Финансовая подушка: ' + U.num(cx.cashMonths, 1) + ' мес. расходов'); else if (cx.cashMonths < 1) W.push('Запас денег меньше месяца расходов');
    if (s.prod.condition < 45 && M.ind(s).capitalIntensity >= 0.5) W.push('Изношенное оборудование (' + U.num(s.prod.condition) + '/100)');
    if (s.prod.tech > 8) S.push('Технологическое преимущество');
    if (Mk.innovation > 65) S.push('Обновлённый ассортимент'); else if (Mk.innovation < 35) W.push('Устаревающий ассортимент');
    if (M.heads(s) < 2 && M.headcount(s) > 40) W.push('Нет руководителей отделов — все решения на директоре');
    const coord = MS.economy.coordination(s); if (coord.fitNote && coord.fit < 1) W.push(coord.fitNote);
    // внешние
    if (Mk.cycle > 0.3) O.push('Экономический подъём — растёт спрос'); else if (Mk.cycle < -0.3) T.push('Экономический спад — спрос снижается');
    if (Mk.keyRate < s.diff.keyRate - 0.01) O.push('Снижение ключевой ставки — дешевеют кредиты'); else if (Mk.keyRate > s.diff.keyRate + 0.01) T.push('Высокая ключевая ставка — дорогие кредиты, охлаждение спроса');
    Object.keys(C.MARKETS).forEach(id => { const nm = M.marketName(s, id); if (nm && !s.markets.some(m => m.id === id) && C.MARKETS[id].req(s)) O.push('Доступен выход на рынок: ' + nm); });
    if (s.products.length < M.ind(s).products.length) O.push('Не освоены направления: ' + M.ind(s).products.filter(p => !s.products.includes(p)).slice(0, 2).join(', '));
    if (cp < 0.95) T.push('Конкуренты демпингуют (цены в среднем ' + U.pct(cp - 1, 0) + ' к рынку)');
    if (comps.length >= 4) T.push('Плотная конкуренция: ' + comps.length + ' ' + U.plural(comps.length, 'крупный игрок', 'крупных игрока', 'крупных игроков'));
    if (M.ind(s).wageInflation * s.diff.wageInflMult > 0.08) T.push('Быстрый рост зарплат на рынке труда');
    if (M.flag(s, 'bigClient')) T.push('Зависимость от крупного покупателя');
    if (comps.some(c => c.q > Mk.quality + 10)) T.push('Есть конкуренты со значительно лучшим качеством');
    const weak = comps.filter(c => c.rep < 45); if (weak.length) O.push('Слабые конкуренты: ' + weak.map(c => c.name).join(', '));
    return { S, W, O, T };
  }
  function pest(s) {
    const Mk = s.market, I = M.ind(s);
    return {
      P: ['Налог на прибыль ' + U.pct(s.diff.taxRate, 0) + ', страховые взносы ' + U.pct(I.socialRate, 1), M.flag(s, 'subsidyNoLayoff') ? 'Действуют условия господдержки (сохранение штата)' : 'Регуляторная среда стабильна'],
      E: ['Ключевая ставка ' + U.pct(Mk.keyRate, 1) + ', инфляция ≈ ' + U.pct(MS.economy.inflation(s), 1) + ' в год', 'Фаза цикла: ' + (Mk.cycle > 0.3 ? 'подъём' : Mk.cycle < -0.3 ? 'спад' : 'стабилизация') + ' (спрос ' + U.pct(Mk.macro - 1, 0) + ' к норме)', 'Цены на сырьё выросли на ' + U.pct(Mk.matIndex - 1, 0) + ' с начала игры'],
      S: ['Зарплаты на рынке труда выросли на ' + U.pct(Mk.wageIndex - 1, 0) + ' с начала игры', 'Ожидания клиентов к новизне: ' + (Mk.innovation < 40 ? 'ассортимент кажется устаревшим' : 'ассортимент актуален')],
      T: ['Технологический уровень компании: +' + U.num(s.prod.tech, 1) + ' к базовому', 'Скорость устаревания навыков в отрасли: ' + (I.skillDecay > 0.3 ? 'высокая' : 'умеренная')]
    };
  }

  return { year, final, swot, pest, grade, SCORE_LABELS, periodStats };
})();
