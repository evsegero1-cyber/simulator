/* Экономический движок: все показатели считаются из причин, каждая причина записывается в «факторы» */
var MS = globalThis.MS = globalThis.MS || {};

MS.economy = (function () {
  const U = MS.util, M = MS.model, C = MS.CAT;
  const ln = Math.log, exp = Math.exp;

  /* ---------- Привлекательность для покупателя (логит-модель выбора) ---------- */
  function elasticity(s) {
    const I = M.ind(s); const st = s.market.strategy;
    return I.elasticity * 1.6 * (st === 'diff' ? 0.8 : st === 'focus' ? 0.7 : 1);
  }
  function scoreParts(s, relP, q, rep, aw, inn) {
    const I = M.ind(s); const st = s.market.strategy;
    const qK = st === 'diff' ? 1.2 : 1;
    return {
      price: -elasticity(s) * ln(Math.max(0.3, relP)),
      quality: I.qW * qK * (q - 50) / 20,
      reputation: I.rW * (rep - 50) / 22,
      awareness: I.mW * 0.5 * ln(1 + Math.max(0, aw)),
      innovation: (inn - 50) / 45
    };
  }
  const total = (o) => U.sum(Object.values(o));

  function headF(s, d) { const h = M.dept(s, d) && M.dept(s, d).head; return h ? 0.94 + 0.14 * h.skill / 100 : 0.93; }

  function salesCoverage(s) {
    const I = M.ind(s); const D = s.staff.depts.sales;
    const need = Math.max(1, I.staff.sales.n * Math.pow(s.prod.capacity / I.startCapacity, 0.7));
    return (D.n * (0.85 + 0.3 * D.skill / 100) * headF(s, 'sales') / 0.93) / need;
  }

  function companyExtras(s) {
    const cov = salesCoverage(s);
    const ex = { sales: 0.4 * ln(U.clamp(cov, 0.25, 1.6)) };
    if (s.market.campaigns.some(c => c.id === 'loyalty')) ex.loyalty = C.CAMPAIGNS.find(c => c.id === 'loyalty').attr;
    if (s.done.includes('brand')) ex.brand = 0.1;
    if (s.market.strategy === 'focus') ex.focus = 0.35;
    const m = M.mod(s, 'attr'); if (m) ex.events = m;
    return ex;
  }

  function stdPrice(s) { return M.ind(s).price * s.market.priceIndex; }
  function effPrice(s) {
    const promo = s.market.campaigns.find(c => c.id === 'promo');
    return s.market.price * (promo ? 1 - C.CAMPAIGNS.find(c => c.id === 'promo').priceCut : 1);
  }

  function shares(s, overridePrice) {
    const Mk = s.market;
    const relP = (overridePrice != null ? overridePrice : effPrice(s)) / stdPrice(s);
    const parts = scoreParts(s, relP, Mk.quality, Mk.reputation, Mk.awareness, Mk.innovation);
    const extras = companyExtras(s);
    const sc = total(parts) + total(extras);
    const ec = exp(sc);
    const comps = Mk.competitors.map(c => exp(total(scoreParts(s, c.priceK, c.q, c.rep, c.aw, 50))));
    const denom = ec + U.sum(comps) + Mk.others;
    return { company: ec / denom, comps: comps.map(x => x / denom), others: Mk.others / denom, parts, extras, relP, score: sc };
  }

  /* Калибровка «прочих участников рынка», чтобы стартовая доля совпала с отраслевой */
  function calibrate(s) {
    const I = M.ind(s);
    s.market.others = 0;
    const sh = shares(s);
    const ec = exp(sh.score);
    const comps = s.market.competitors.map(c => exp(total(scoreParts(s, c.priceK, c.q, c.rep, c.aw, 50))));
    s.market.others = Math.max(0.1, ec / I.startShare - ec - U.sum(comps));
    const sh2 = shares(s);
    s.market.competitors.forEach((c, i) => c.share = sh2.comps[i]);
    s.market.lastShare = sh2.company;
  }

  /* ---------- Макросреда (PEST: экономика) ---------- */
  function refreshMacro(s) {
    const I = M.ind(s); const Mk = s.market;
    const vol = I.volatility * s.diff.volatilityMult;
    const cyc = Math.sin(2 * Math.PI * (s.turn + Mk.cyclePhase) / Mk.cyclePeriod);
    const rateEffect = -(Mk.keyRate - s.diff.keyRate) * 0.6; // дорогие кредиты охлаждают спрос
    Mk.macro = Math.max(0.5, 1 + vol * cyc + rateEffect * (I.capitalIntensity > 0.9 ? 1.3 : 0.7));
    Mk.cycle = cyc;
  }
  function laborShare(I) {
    const pay = (I.staff.prod.n * I.staff.prod.wage + I.staff.sales.n * I.staff.sales.wage + I.staff.admin.n * I.staff.admin.wage) * (1 + I.socialRate);
    return U.clamp(pay / (I.price * I.marketDemand * I.startShare), 0, 0.9);
  }
  const inflation = (s) => U.clamp(s.market.keyRate - 0.075, 0.03, 0.2);

  /* ---------- Расчёт операционных показателей месяца (без изменения состояния) ---------- */
  function compute(s) {
    const I = M.ind(s), Mk = s.market, P = s.prod, St = s.staff, D = St.depts;
    const month = s.turn % 12;
    const o = { explain: {} };

    // Спрос
    const growth = Math.pow(1.003, s.turn);
    const marketsAdd = U.sum(s.markets.filter(m => m.ready), m => C.MARKETS[m.id].demand * m.ramp);
    const productsMult = 1 + C.PRODUCT.demand * s.products.length + (s.done.includes('online') ? 0.12 : 0);
    const focusK = Mk.strategy === 'focus' ? 0.75 : 1;
    const base = I.marketDemand * growth + s.org.branches * I.branch.demand;
    const dMod = M.mod(s, 'demand');
    o.demand = base * Mk.macro * I.season[month] * (1 + marketsAdd) * productsMult * focusK * (1 + dMod);
    o.explain.demand = [
      { l: 'Базовый рынок' + (s.org.branches ? ' и филиалы' : ''), v: base, fmt: 'units' },
      { l: 'Экономический цикл и ставка', v: Mk.macro - 1, fmt: 'pct' },
      { l: 'Сезонность (' + U.MONTHS[month].toLowerCase() + ')', v: I.season[month] - 1, fmt: 'pct' },
      { l: 'Новые рынки', v: marketsAdd, fmt: 'pct' },
      { l: 'Ассортимент и каналы', v: productsMult - 1, fmt: 'pct' }
    ];
    if (focusK !== 1) o.explain.demand.push({ l: 'Фокус на нише', v: focusK - 1, fmt: 'pct' });
    if (dMod) o.explain.demand.push({ l: 'События', v: dMod, fmt: 'pct' });

    // Доля рынка
    const sh = shares(s);
    o.share = sh.company; o.shares = sh;
    o.potential = o.demand * sh.company;
    o.price = effPrice(s); o.stdPrice = stdPrice(s);
    o.explain.share = [
      { l: 'Цена (' + U.pct(sh.relP - 1, 0) + ' к рынку)', v: sh.parts.price },
      { l: 'Качество', v: sh.parts.quality },
      { l: 'Репутация', v: sh.parts.reputation },
      { l: 'Узнаваемость (реклама)', v: sh.parts.awareness },
      { l: 'Новизна ассортимента', v: sh.parts.innovation },
      { l: 'Работа отдела продаж', v: sh.extras.sales }
    ];
    if (sh.extras.loyalty) o.explain.share.push({ l: 'Программа лояльности', v: sh.extras.loyalty });
    if (sh.extras.brand) o.explain.share.push({ l: 'Сильный бренд', v: sh.extras.brand });
    if (sh.extras.focus) o.explain.share.push({ l: 'Нишевая лояльность', v: sh.extras.focus });
    if (sh.extras.events) o.explain.share.push({ l: 'События', v: sh.extras.events });

    // Производительность труда
    const skill = D.prod.skill, mor = St.morale, c = St.control;
    const f = {
      skill: 0.6 + 0.8 * skill / 100,
      morale: 0.78 + 0.44 * mor / 100,
      control: 1 + 0.12 * ((c - 50) / 50) * (1 - 1.6 * skill / 100),
      head: headF(s, 'prod') / 0.93,
      coord: coordination(s).f,
      equipment: I.capitalIntensity >= 0.5 ? 0.92 + 0.08 * P.condition / 100 : 1,
      tech: 1 + P.tech / 100,
      auto: 1 + P.auto,
      change: 1 + M.mod(s, 'prod')
    };
    if (s.done.includes('lean')) f.lean = 1.06;
    o.prodFactors = f;
    o.prodIndex = Object.values(f).reduce((a, b) => a * b, 1);
    o.perWorker = I.laborPU * o.prodIndex;
    o.workforce = D.prod.n * o.perWorker;
    o.equipCap = P.capacity * (0.75 + 0.25 * P.condition / 100) * (1 + M.mod(s, 'capacity'));
    o.normalMax = Math.min(o.workforce, o.equipCap);
    o.bottleneck = o.workforce < o.equipCap ? 'staff' : 'equipment';
    const FL = { skill: 'Квалификация', morale: 'Удовлетворённость', control: 'Стиль контроля', head: 'Руководитель цеха', coord: 'Координация (управленцы)', equipment: 'Состояние оборудования', tech: 'Технологии', auto: 'Автоматизация', change: 'Временные события', lean: 'Lean' };
    o.explain.prod = Object.keys(f).map(k => ({ l: FL[k], v: f[k] - 1, fmt: 'pct' }));

    // План производства
    const sk = C.STOCK[P.stock];
    let target;
    if (P.planMode === 'auto') {
      if (I.inventory === 'stock') target = U.clamp(o.potential * 1.35 - P.finished, 0, o.normalMax);
      else target = Math.min(o.potential, o.normalMax);
    } else {
      const pl = U.clamp(P.plan, 0, 1.2);
      target = pl <= 1 ? pl * o.normalMax : Math.min(o.normalMax + (pl - 1) * o.workforce, o.equipCap * 1.15, o.workforce * pl);
    }
    o.target = target;
    o.overtime = o.workforce > 0 ? Math.max(0, target / o.workforce - 1) : 0;
    o.utilization = o.normalMax > 0 ? target / o.normalMax : 0;

    // Сырьё
    const sup = C.SUPPLIERS[P.supplier];
    let matK = sup.k;
    if (Mk.strategy === 'cost') matK *= 0.96; else if (Mk.strategy === 'diff') matK *= 1.03;
    if (s.done.includes('lean')) matK *= 0.95;
    o.matUnit = I.matCost * Mk.matIndex * matK;
    const rawTarget = o.potential * sk.months;
    const supplyAvail = U.clamp(1 + M.mod(s, 'supply') * (s.done.includes('logistics') ? 0.5 : 1), 0, 1);
    o.purchase = Math.max(0, target + rawTarget - P.raw) * supplyAvail;
    o.supplyAvail = supplyAvail;
    o.production = Math.max(0, Math.min(target, P.raw + o.purchase));

    // Продажи
    const avail = I.inventory === 'stock' ? P.finished + o.production : o.production;
    o.sales = Math.min(o.potential, avail);
    o.service = o.potential > 0 ? o.sales / o.potential : 1;
    o.revenue = o.sales * o.price;

    // Удовлетворённость: двухфакторная модель Герцберга + пирамида Маслоу
    const sr = M.salaryRatio(s);
    const mf = [];
    mf.push({ l: 'Зарплата к рынку (' + U.pct(sr, 0) + ')', v: sr < 1 ? -(1 - sr) * 140 : Math.min((sr - 1) * 45, 9), g: 'h' });
    const lastProfit = s.history.length ? s.history[s.history.length - 1].netProfit : 1;
    if (St.bonusPct > 0) mf.push({ l: St.bonusMode === 'kpi' ? 'Премии за результат' : 'Фиксированные премии', v: St.bonusPct * 100 * (St.bonusMode === 'kpi' ? 0.9 * (lastProfit > 0 ? 1 : 0.35) : 0.45), g: St.bonusMode === 'kpi' ? 'm' : 'h' });
    const tr = C.TRAINING[St.training];
    if (tr.morale) mf.push({ l: 'Обучение и развитие', v: tr.morale * (sr < 0.9 ? 0.4 : 1), g: 'm' });
    const ctl = -(c - 50) * 0.16 * (0.5 + skill / 100) - (c < 30 && skill < 40 ? (30 - c) * 0.1 : 0);
    mf.push({ l: 'Уровень контроля', v: ctl, g: 'h' });
    if (I.capitalIntensity >= 0.5) mf.push({ l: 'Условия труда (оборудование)', v: (P.condition - 60) * 0.08 + P.tech * 0.1, g: 'h' });
    if (St.layoffMemory > 0.5) mf.push({ l: 'Страх сокращений', v: -St.layoffMemory, g: 'h' });
    if (o.overtime > 0.01) mf.push({ l: 'Переработки', v: -o.overtime * 80, g: 'h' });
    const hs = M.heads(s); if (hs) mf.push({ l: 'Карьерные перспективы', v: Math.min(hs * 1.5, 6), g: 'm' });
    const h12 = s.history.slice(-12), p12 = s.history.slice(-24, -12);
    if (p12.length >= 6) {
      const g = U.sum(h12, x => x.revenue) / Math.max(1, U.sum(p12, x => x.revenue)) - 1;
      if (g > 0.1) mf.push({ l: 'Компания растёт', v: 3, g: 'm' });
      if (g < -0.1) mf.push({ l: 'Компания сокращается', v: -4, g: 'h' });
    }
    if (D.hr && D.hr.n) mf.push({ l: 'Работа HR-отдела', v: Math.min(3, D.hr.n * 1.5), g: 'm' });
    if (P.qc === 3) mf.push({ l: 'Вовлечение (TQM)', v: 2, g: 'm' });
    if (s.done.includes('hrbrand')) mf.push({ l: 'Корпоративная культура', v: 3, g: 'm' });
    const mm = M.mod(s, 'moraleT'); if (mm) mf.push({ l: 'События', v: mm, g: 'e' });
    o.moraleTarget = U.clamp(52 + U.sum(mf, x => x.v), 5, 95);
    o.explain.morale = mf;

    // Качество
    const qcq = C.QC[P.qc].q + (D.quality ? Math.min(10, D.quality.n / Math.max(1, D.prod.n / 15) * 10) : 0);
    const equipQ = I.capitalIntensity >= 0.5 ? 40 + P.condition * 0.45 + P.tech * 1.5 : 45 + skill * 0.2 + P.tech * 1.5;
    const qf = [
      { l: 'Сырьё (' + sup.name.toLowerCase() + ')', v: sup.q * 0.3 },
      { l: 'Квалификация', v: skill * 0.25 },
      { l: 'Оборудование и технологии', v: equipQ * 0.2 },
      { l: 'Контроль качества', v: qcq * 0.25 }
    ];
    let qAdd = 0;
    if (Mk.strategy === 'diff') { qAdd += 5; qf.push({ l: 'Стратегия дифференциации', v: 5 }); }
    if (Mk.strategy === 'cost') { qAdd -= 4; qf.push({ l: 'Экономия на издержках', v: -4 }); }
    if (s.done.includes('iso')) { qAdd += 6; qf.push({ l: 'ISO 9001', v: 6 }); }
    if (s.done.includes('erp')) { qAdd += 3; qf.push({ l: 'ERP', v: 3 }); }
    if (o.utilization > 1.03) { const v = -(o.utilization - 1) * 45; qAdd += v; qf.push({ l: 'Спешка из-за перегрузки', v }); }
    const qm = M.mod(s, 'qualityT'); if (qm) { qAdd += qm; qf.push({ l: 'События', v: qm }); }
    o.qualityTarget = U.clamp(U.sum(qf.slice(0, 4), x => x.v) + qAdd, 5, 98);
    o.explain.quality = qf;

    // Репутация
    const rf = [
      { l: 'Качество продукции', v: (Mk.quality - 50) * 0.55 },
      { l: 'Цена для клиента', v: U.clamp(-(sh.relP - 1) * 20, -10, 6) },
      { l: 'Выполнение заказов (' + U.pct(o.service, 0) + ')', v: -(1 - o.service) * 40 },
      { l: 'Отношение персонала к клиентам', v: (mor - 50) * 0.08 }
    ];
    const pr = U.sum(Mk.campaigns, cp => (C.CAMPAIGNS.find(x => x.id === cp.id) || {}).rep || 0) * 6;
    if (pr) rf.push({ l: 'Рекламные и PR-кампании', v: pr });
    if (s.done.includes('brand')) rf.push({ l: 'Бренд', v: 4 });
    const rm = M.mod(s, 'repT'); if (rm) rf.push({ l: 'События', v: rm });
    o.repTarget = U.clamp(50 + U.sum(rf, x => x.v), 3, 97);
    o.explain.rep = rf;

    // Турбулентность персонала
    let tov = I.baseTurnover + Math.max(0, 55 - mor) * 0.0022 + Math.max(0, 0.95 - sr) * 0.25;
    if (I.id === 'it' && sr < 1) tov += (1 - sr) * 0.1;
    if (D.hr && D.hr.n) tov *= 0.8;
    if (s.done.includes('hrbrand')) tov *= 0.75;
    tov *= 1 + M.mod(s, 'turnover');
    o.turnoverRate = U.clamp(tov, 0.002, 0.6);
    return o;
  }

  function coordination(s) {
    const D = s.staff.depts; const S = C.STRUCTURES[s.org.structure];
    const others = M.headcount(s) - D.admin.n;
    let need = others / S.span * (s.done.includes('erp') ? 0.75 : 1);
    need = Math.max(1, need);
    const ratio = (D.admin.n * (0.85 + 0.3 * D.admin.skill / 100) * headF(s, 'admin') / 0.93) / need;
    let f = ratio < 1 ? 0.84 + 0.16 * ratio : 1 + Math.min(0.02, (ratio - 1) * 0.02);
    const size = M.headcount(s);
    let fit = 1, fitNote = '';
    const st = s.org.structure, wide = s.org.branches + s.markets.length;
    if (st === 'linear' && size > 45) { fit = 1 - Math.min(0.12, (size - 45) * 0.0015); fitNote = 'Линейная структура тесна для такого размера'; }
    if (st === 'functional' && wide >= 3) { fit = 0.96; fitNote = 'Много рынков и филиалов — функциональной структуре трудно'; }
    if (st === 'divisional') { fit = wide >= 2 ? 1.05 : 0.95; fitNote = wide >= 2 ? 'Дивизионы соответствуют рынкам' : 'Дивизионы без рынков — лишний аппарат'; }
    if (st === 'matrix') { fit = s.products.length >= 2 ? 1.03 : 0.97; fitNote = s.products.length >= 2 ? 'Матрица помогает вести много продуктов' : 'Матрица без проектов создаёт путаницу'; }
    return { f: f * fit, ratio, need, fit, fitNote };
  }

  /* ---------- Себестоимость и безубыточность ---------- */
  function unitEconomics(s, o) {
    o = o || compute(s);
    const I = M.ind(s), P = s.prod;
    const pay = M.payroll(s) * (1 + I.socialRate);
    const prodPay = s.staff.depts.prod.n * s.staff.depts.prod.wage * (1 + I.socialRate);
    const fixed = pay - prodPay + overheadCost(s) + maintCost(s) + depreciation(s) + U.sum(s.market.campaigns, c => campaignMonthly(s, c));
    const units = Math.max(1, o.production || o.sales);
    const varUnit = o.matUnit + prodPay / units;
    const contrib = o.price - o.matUnit;
    return {
      material: o.matUnit, labor: prodPay / units, overhead: (fixed - depreciation(s)) / units, depr: depreciation(s) / units,
      full: o.matUnit + (pay + overheadCost(s) + maintCost(s) + depreciation(s)) / units,
      fixed: fixed + prodPay, contrib, breakeven: contrib > 0 ? (fixed + prodPay) / contrib : Infinity, varUnit
    };
  }
  function overheadCost(s) {
    const I = M.ind(s);
    let o = I.overhead * s.market.priceIndex + s.org.branches * I.branch.overhead * s.market.priceIndex;
    if (s.done.includes('energy')) o *= 0.92;
    if (s.done.includes('erp')) o *= 0.95;
    return o * (1 + M.mod(s, 'overhead'));
  }
  function maintCost(s) { return M.equipValue(s) * C.MAINT[s.prod.maint].rate; }
  function depreciation(s) { return s.prod.book * 1.5 / M.ind(s).deprMonths; }
  function campaignMonthly(s, c) {
    const def = C.CAMPAIGNS.find(x => x.id === c.id);
    return def ? def.costK * c.base : 0;
  }

  /* ---------- Кредиты ---------- */
  function creditInfo(s) {
    const h = s.history.slice(-12);
    const ebitda12 = h.length ? U.sum(h, x => x.ebitda) * 12 / h.length : s.ref.revenue * 0.6;
    const rev12 = h.length ? U.sum(h, x => x.revenue) * 12 / h.length : s.ref.revenue * 12;
    const debt = M.totalDebt(s);
    const lev = ebitda12 > 0 ? debt / ebitda12 : (debt > 0 ? 99 : 0);
    let premium = lev > 5 ? 0.06 : lev > 3 ? 0.03 : lev > 2 ? 0.01 : 0;
    if (s.counters.negCash > 0) premium += 0.03;
    premium -= (s.market.reputation - 50) * 0.0004;
    if (s.staff.depts.finance && s.staff.depts.finance.n) premium -= 0.01;
    const rate = Math.max(0.03, s.market.keyRate + s.diff.spread + premium);
    let limit = Math.max(0, rev12 * 0.45 + s.prod.book * 0.5 - debt);
    if (lev > 5 || ebitda12 <= 0) limit *= 0.25;
    if (M.flag(s, 'bankDistrust')) limit *= 0.3;
    const rating = lev < 1 ? 'A' : lev < 2 ? 'BBB' : lev < 3 ? 'BB' : lev < 5 ? 'B' : 'CCC';
    return { rate, limit: Math.round(limit / 100000) * 100000, lev, ebitda12, rating, debt };
  }

  /* ---------- Главная функция хода ---------- */
  function simulateMonth(s, opts) {
    opts = opts || {};
    const I = M.ind(s), Mk = s.market, P = s.prod, St = s.staff, D = St.depts;
    const prev = s.history[s.history.length - 1];
    const o = compute(s);
    const r = { turn: s.turn, events: [], o };
    const fl = s.flows;

    // --- Производство и склад
    P.raw += o.purchase - o.production;
    if (I.inventory === 'perish') P.raw *= (1 - I.perishRate);
    P.raw = Math.max(0, P.raw);
    let waste = 0;
    if (I.inventory === 'stock') {
      P.finished = Math.max(0, P.finished + o.production - o.sales);
      if (I.perishRate) { waste = P.finished * I.perishRate; P.finished -= waste; }
    } else waste = Math.max(0, o.production - o.sales);

    // --- Выручка и поступления
    const revenue = o.revenue;
    const recvShare = I.receivable.share * (D.finance && D.finance.n ? 0.85 : 1) * (1 + M.mod(s, 'receivable'));
    const cashNow = revenue * (1 - recvShare);
    if (recvShare > 0) s.receivables.push({ due: s.turn + I.receivable.lag, amount: revenue * recvShare });
    let collected = 0;
    s.receivables = s.receivables.filter(x => { if (x.due <= s.turn) { collected += x.amount; return false; } return true; });

    // --- Затраты
    const matCOGS = (I.inventory === 'stock' ? o.sales : o.production) * o.matUnit;
    const purchaseCash = o.purchase * o.matUnit;
    const basePay = M.payroll(s);
    const prodPay = D.prod.n * D.prod.wage;
    const overtimePay = prodPay * o.overtime * 1.5;
    const payout = St.bonusMode === 'kpi' ? ((prev ? prev.netProfit > 0 : true) ? U.clamp(o.service * (o.target > 0 ? o.production / o.target : 1), 0.3, 1) : 0.35) : 1;
    const bonus = basePay * St.bonusPct * payout;
    const wages = basePay + overtimePay + bonus;
    const social = wages * I.socialRate;
    const training = basePay * C.TRAINING[St.training].rate;
    const qc = Math.max(revenue, s.ref.revenue * 0.5) * C.QC[P.qc].rate;
    const maint = maintCost(s);
    const overhead = overheadCost(s);
    const marketing = U.sum(Mk.campaigns, c => campaignMonthly(s, c));
    const storage = (P.finished + P.raw) * o.matUnit * I.storageRate * (s.done.includes('logistics') ? 0.5 : 1);
    const readyM = s.markets.filter(m => m.ready);
    const totalAdd = U.sum(readyM, m => C.MARKETS[m.id].demand * m.ramp);
    const logRate = totalAdd > 0 ? U.sum(readyM, m => C.MARKETS[m.id].demand * m.ramp * C.MARKETS[m.id].logistics) / (1 + totalAdd) : 0;
    const logistics = revenue * logRate * (s.done.includes('logistics') ? 0.7 : 1);
    const depr = depreciation(s);
    const dev = fl.dev; // расходы на развитие, оплаченные в этом месяце (проекты, рынки, продукты)
    const otherExp = fl.other; // штрафы, найм, компенсации и т.п.

    // --- Кредиты, овердрафт, депозит
    let interest = 0, principal = 0;
    s.loans.forEach(l => {
      const i = l.balance * l.rate / 12;
      let pr = Math.min(l.balance, l.payment - i);
      if (l.months <= 1) pr = l.balance;
      interest += i; principal += pr; l.balance -= pr; l.months -= 1;
    });
    s.loans = s.loans.filter(l => l.balance > 1 && l.months > 0);
    const odRate = Mk.keyRate + 0.12;
    const overdraftInt = s.cash < 0 ? -s.cash * odRate / 12 : 0;
    const depInt = s.deposit * Math.max(0, Mk.keyRate - 0.02) / 12;
    s.deposit += depInt;
    const propTax = P.book * 0.022 / 12;

    // --- Прибыль
    const opex = wages + social + training + qc + maint + overhead + marketing + storage + logistics + dev + otherExp;
    const ebitda = revenue - matCOGS - opex;
    const ebt = ebitda - depr - interest - overdraftInt + depInt - propTax;
    let tax = 0;
    if (ebt > 0) { const taxable = Math.max(0, ebt - s.taxLossCF); s.taxLossCF = Math.max(0, s.taxLossCF - ebt); tax = taxable * s.diff.taxRate; }
    else s.taxLossCF += -ebt;
    const net = ebt - tax;

    // --- Деньги
    const opIn = cashNow + collected;
    const autoHireCost = 0; // учитывается ниже
    const opOut = purchaseCash + wages + social + training + qc + maint + overhead + marketing + storage + logistics + interest + overdraftInt + propTax + tax;
    s.cash += opIn - opOut - principal;
    P.book = Math.max(0, P.book - depr);

    // --- Персонал
    const morale0 = St.morale;
    St.morale = U.clamp(St.morale + (o.moraleTarget - St.morale) * 0.3, 0, 100);
    St.layoffMemory *= 0.82;
    let quits = 0, hiredAuto = 0, hireCost = 0;
    M.depts(s).forEach(d => {
      const dp = D[d]; if (!dp.n) return;
      const rate = o.turnoverRate * (d === 'admin' ? 0.7 : 1);
      dp.acc += dp.n * rate;
      const q = Math.min(dp.n, Math.floor(dp.acc));
      dp.acc -= q;
      if (q > 0) {
        quits += q;
        if (St.autoReplace) {
          hiredAuto += q;
          hireCost += q * dp.wage * (D.hr && D.hr.n ? 0.35 : 0.6);
          dp.skill = (dp.skill * (dp.n - q) + Math.min(dp.skill, 32) * q) / dp.n;
        } else dp.n -= q;
      }
      // навыки: обучение, опыт, устаревание
      const tr = C.TRAINING[St.training];
      const gain = tr.gain * (1 - dp.skill / 105) * (D.hr && D.hr.n ? 1.2 : 1) + 0.15 * (1 - dp.skill / 100);
      const decay = I.skillDecay * (d === 'prod' ? 1 : 0.6);
      dp.skill = U.clamp(dp.skill + gain - decay + M.mod(s, 'skillT') * (d === 'prod' ? 1 : 0.5), 5, 100);
    });
    if (hireCost) { s.cash -= hireCost; }
    s.counters.quits3.push({ q: quits, n: M.headcount(s) });
    if (s.counters.quits3.length > 3) s.counters.quits3.shift();

    // --- Качество, репутация, узнаваемость, инновации
    Mk.quality = U.clamp(Mk.quality + (o.qualityTarget - Mk.quality) * 0.3, 0, 100);
    Mk.reputation = U.clamp(Mk.reputation + (o.repTarget - Mk.reputation) * 0.12, 0, 100);
    const salesInflow = 0.3 * U.clamp(salesCoverage(s), 0.3, 1.5);
    const campAw = U.sum(Mk.campaigns, c => { const d = C.CAMPAIGNS.find(x => x.id === c.id); return d ? d.aw * (c.id === 'online' && s.done.includes('online') ? 1.4 : 1) : 0; });
    Mk.awareness = Math.max(0, Mk.awareness * 0.85 + salesInflow + campAw + o.share * 1.2);
    const innDecay = (I.id === 'it' ? 1.4 : 0.8) * (D.rnd && D.rnd.n ? 0.5 : 1) - (s.org.structure === 'matrix' ? 0.2 : 0);
    Mk.innovation = U.clamp(Mk.innovation - innDecay, 8, 100);

    // --- Оборудование
    P.condition = U.clamp(P.condition + C.MAINT[P.maint].wear - o.utilization * 0.3 * I.breakdown + 0.3, 0, 100);

    // --- Сроки: поставки оборудования, проекты, рынки, кампании
    const done = [];
    P.pending = P.pending.filter(e => {
      if (e.at <= s.turn + 1) {
        const tot = P.capacity + e.cap;
        P.tech = (P.tech * P.capacity + (P.tech + e.tech) * e.cap) / tot + e.tech * 0.3;
        P.capacity = tot; P.auto += e.auto;
        done.push('Введено в строй: ' + e.name + ' (+' + U.num(e.cap) + ' ' + I.unit + '/мес)');
        return false;
      }
      return true;
    });
    s.projects = s.projects.filter(p => {
      if (p.at <= s.turn + 1) { finishProject(s, p, done); return false; }
      return true;
    });
    s.markets.forEach(m => {
      if (!m.ready && m.at <= s.turn + 1) { m.ready = true; m.ramp = 0.3; done.push('Открыт рынок: ' + M.marketName(s, m.id)); }
      else if (m.ready && m.ramp < 1) m.ramp = Math.min(1, m.ramp + 0.12 + (Mk.reputation - 50) * 0.002);
    });
    Mk.campaigns = Mk.campaigns.filter(c => c.until > s.turn);

    // --- Конкуренты
    const sh0 = o.share;
    competitorsAct(s, o, r);

    // --- Отложенные последствия и временные эффекты
    const due = s.delayed.filter(x => x.at <= s.turn + 1);
    s.delayed = s.delayed.filter(x => x.at > s.turn + 1);
    due.forEach(x => {
      if (x.chance != null && U.rng(s) > x.chance) { if (x.elseWhy) r.events.push({ t: x.elseWhy, tone: 'good' }); return; }
      MS.sit.applyDelayed(s, x);
      r.events.push({ t: x.why, tone: x.tone || 'warn', delayed: true });
      M.log(s, 'delayed', x.why, x.tone || 'warn');
    });

    // --- Макро и цены на следующий месяц
    const infl = inflation(s);
    // цены отрасли следуют за её издержками: в трудоёмких отраслях — ближе к росту зарплат
    const wInfl = I.wageInflation * s.diff.wageInflMult;
    Mk.priceIndex *= 1 + (infl + (wInfl - infl) * laborShare(I)) / 12;
    Mk.matIndex *= 1 + infl / 12 + M.mod(s, 'matInfl');
    Mk.wageIndex *= 1 + I.wageInflation * s.diff.wageInflMult / 12;
    pestEvents(s, r);

    // --- Запись месяца
    const expensesCash = opOut + principal + hireCost + fl.inv + fl.dev + fl.other;
    const rec = {
      turn: s.turn, revenue, sales: o.sales, potential: o.potential, demand: o.demand, production: o.production, capacity: o.normalMax,
      price: o.price, share: o.share, matCOGS, wages, bonus, overtimePay, social, training, qc, maint, overhead, marketing, storage, logistics,
      dev, other: otherExp + hireCost, depr, interest: interest + overdraftInt, depInt, propTax, tax, ebitda, ebt, netProfit: net - hireCost,
      cash: s.cash, deposit: s.deposit, debt: M.totalDebt(s), receivables: U.sum(s.receivables, x => x.amount),
      staff: M.headcount(s), quits, hired: hiredAuto + St.hiredThisMonth, morale: St.morale, skill: D.prod.skill,
      productivity: o.perWorker, prodIndex: o.prodIndex, reputation: Mk.reputation, quality: Mk.quality, awareness: Mk.awareness,
      innovation: Mk.innovation, condition: P.condition, finished: P.finished, raw: P.raw, waste,
      cashIn: opIn + fl.fin + fl.opIn, cashOut: expensesCash, opCF: opIn - opOut - hireCost - fl.other, invCF: -fl.inv - fl.dev, finCF: fl.fin - principal,
      expensesCash, keyRate: Mk.keyRate, macro: Mk.macro, service: o.service, utilization: o.utilization, compShares: o.shares.comps.slice()
    };
    // округление — чтобы сохранения за десятки лет оставались компактными
    Object.keys(rec).forEach(k => { const v = rec[k]; if (typeof v === 'number') rec[k] = Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10000) / 10000; });
    rec.compShares = rec.compShares.map(v => Math.round(v * 10000) / 10000);
    s.history.push(rec);
    r.rec = rec; r.prev = prev; r.done = done; r.moraleDelta = St.morale - morale0;
    done.forEach(t => { r.events.push({ t, tone: 'good' }); M.log(s, 'project', t, 'good'); });

    // --- Сброс месячных потоков, истечение эффектов
    s.flows = { opIn: 0, opOut: 0, inv: 0, fin: 0, dev: 0, other: 0, notes: [] };
    St.hiredThisMonth = 0;
    s.turn += 1;
    s.mods = s.mods.filter(m => m.until >= s.turn);
    Object.keys(s.flags).forEach(k => { if (s.flags[k] < s.turn) delete s.flags[k]; });
    refreshMacro(s);
    if (s.turn % 3 === 0) M.genCandidates(s);

    // --- Проверка поражения
    checkLoss(s, r);
    s.lastReport = summarize(s, r);
    return r;
  }

  function finishProject(s, p, done) {
    const I = M.ind(s);
    if (p.type === 'project') {
      s.done.push(p.id);
      const def = C.PROJECTS.find(x => x.id === p.id);
      if (p.id === 'iso') { s.market.reputation = Math.min(100, s.market.reputation + 5); }
      if (p.id === 'brand') { s.market.reputation = Math.min(100, s.market.reputation + 6); s.market.awareness += 1.5; }
      if (p.id === 'hrbrand') M.addMod(s, 'moraleT', 3, 2, 'HR-бренд');
      done.push('Проект завершён: ' + def.name);
    } else if (p.type === 'product') {
      s.products.push(p.id);
      s.market.innovation = Math.min(100, s.market.innovation + C.PRODUCT.innovation);
      done.push('Запущен новый продукт: ' + p.id);
    } else if (p.type === 'branch') {
      s.org.branches += 1;
      s.prod.capacity += I.branch.cap;
      s.prod.book += p.cost * 0.7;
      const n = I.branch.staff;
      const dp = s.staff.depts.prod;
      dp.skill = (dp.skill * dp.n + 30 * n) / (dp.n + n); dp.n += n;
      s.cash -= n * dp.wage * 0.6;
      done.push('Открыт филиал: ' + I.branch.name + ' №' + s.org.branches + ' (нанято ' + n + ' чел.)');
    } else if (p.type === 'structure') {
      done.push('Реорганизация завершена: ' + C.STRUCTURES[s.org.structure].name);
    }
  }

  function competitorsAct(s, o, r) {
    const Mk = s.market, aggr = s.diff.competitorAggr;
    const rel = o.shares.relP;
    const grow = o.share - Mk.lastShare;
    Mk.competitors.forEach((c, i) => {
      const prevShare = c.share; c.share = o.shares.comps[i];
      // Ответ на ценовое давление
      if (rel < 0.94 && grow > 0.002) c.priceK = Math.max(c.base.priceK * 0.82, c.priceK - 0.008 * aggr);
      else c.priceK += (c.base.priceK - c.priceK) * 0.04;
      // Ответ на потерю доли — маркетинг
      if (c.share < prevShare - 0.002) c.aw += 0.08 * aggr;
      c.aw += (c.base.aw - c.aw) * 0.05;
      // Постепенное развитие качества
      c.q = U.clamp(c.q + 0.025 * aggr + (U.rng(s) - 0.5) * 0.2, 20, 92);
      c.rep += ((c.q - 50) * 0.5 + 50 - c.rep) * 0.05;
    });
    Mk.lastShare = o.share;
  }

  /* PEST-события: ключевая ставка, цены на сырьё. Решения ЦБ — раз в квартал, по циклу экономики */
  function pestEvents(s, r) {
    const Mk = s.market;
    if ((s.turn + 1) % 3 === 0) {
      const target = s.diff.keyRate + Mk.cycle * 0.03; // ставка следует за циклом
      const gap = target - Mk.keyRate;
      let ch = 0;
      if (Math.abs(gap) > 0.004) ch = U.clamp(Math.round(gap * 200) / 200, -0.02, 0.02);
      if (ch !== 0) {
        Mk.keyRate = U.round(U.clamp(Mk.keyRate + ch, 0.04, 0.3), 4);
        const t = 'ЦБ ' + (ch > 0 ? 'повысил' : 'снизил') + ' ключевую ставку до ' + U.pct(Mk.keyRate, 1) + (ch > 0 ? ': кредиты дорожают, спрос охлаждается.' : ': кредиты дешевеют, спрос оживает.');
        r.events.push({ t, tone: ch > 0 ? 'warn' : 'good', pest: 'E' });
        M.log(s, 'pest', t, ch > 0 ? 'warn' : 'good');
      }
    }
  }

  function checkLoss(s, r) {
    const I = M.ind(s);
    // овердрафт в пределах лимита — дорого, но допустимо; выход за лимит несколько месяцев подряд — банкротство
    const odLimit = overdraftLimit(s);
    s.counters.negCash = s.cash < -odLimit ? s.counters.negCash + 1 : 0;
    s.counters.overdraft = s.cash < 0 ? (s.counters.overdraft || 0) + 1 : 0;
    const rev = r.rec.revenue;
    if (s.counters.negCash >= s.diff.bankruptcyMonths) lose(s, 'bankruptcy', 'Долг по овердрафту выше лимита банка ' + s.counters.negCash + ' мес. подряд. Кредиторы подали заявление о банкротстве.');
    else if (s.cash < -Math.max(s.ref.revenue * 2.5, rev * 3)) lose(s, 'bankruptcy', 'Долг по овердрафту превысил допустимый предел. Банк заблокировал счета.');
    s.counters.lowShare = r.rec.share < 0.012 ? s.counters.lowShare + 1 : 0;
    if (s.counters.lowShare >= 6) lose(s, 'market', 'Доля рынка ниже 1,2% полгода подряд: клиенты ушли к конкурентам.');
    const q3 = s.counters.quits3; const n = U.avg(q3, x => x.n);
    const qsum = U.sum(q3, x => x.q);
    if (q3.length === 3 && n > 0 && qsum / n > 0.45) lose(s, 'staff', 'За 3 месяца уволилось ' + U.pct(qsum / n, 0) + ' персонала: компания парализована текучестью кадров.');
    s.counters.lowMorale = s.staff.morale < 15 ? s.counters.lowMorale + 1 : 0;
    if (s.counters.lowMorale >= 3) lose(s, 'staff', 'Удовлетворённость ниже 15 три месяца подряд — массовые увольнения и забастовка.');
    if (s.staff.depts.prod.n < 2) lose(s, 'staff', 'В основном производстве не осталось работников.');
  }
  function overdraftLimit(s) {
    const h = s.history.slice(-6);
    const rev = h.length ? U.avg(h, x => x.revenue) : s.ref.revenue;
    return Math.round(rev * 0.5 * (M.flag(s, 'bankDistrust') ? 0.3 : 1) / 10000) * 10000;
  }
  function lose(s, reason, text) {
    if (s.status !== 'active') return;
    s.status = 'lost'; s.lostReason = { reason, text, turn: s.turn };
    M.log(s, 'lost', text, 'bad');
  }

  function summarize(s, r) {
    const rec = r.rec, prev = r.prev;
    const d = (k) => prev ? rec[k] - prev[k] : 0;
    return {
      turn: rec.turn, revenue: rec.revenue, netProfit: rec.netProfit, cash: rec.cash,
      dRevenue: d('revenue'), dProfit: d('netProfit'), dCash: prev ? rec.cash - prev.cash : 0,
      dShare: d('share'), dMorale: d('morale'), dRep: d('reputation'), dStaff: d('staff'),
      quits: rec.quits, events: r.events, done: r.done
    };
  }

  /* Прогноз следующего месяца при текущих решениях (без событий) */
  function forecast(s) {
    const c = U.deep(s);
    c.pending = []; c.delayed = [];
    const r = simulateMonth(c, { dry: true });
    return r.rec;
  }

  return { overdraftLimit, compute, shares, calibrate, refreshMacro, simulateMonth, forecast, unitEconomics, creditInfo, coordination, salesCoverage, overheadCost, maintCost, depreciation, campaignMonthly, stdPrice, effPrice, elasticity, inflation };
})();
