/* Модель данных: создание новой игры и вспомогательные расчёты состояния */
var MS = globalThis.MS = globalThis.MS || {};

MS.model = (function () {
  const U = MS.util;

  const ind = (s) => MS.INDUSTRIES[s.company.industry];

  function newGame(p) {
    const I = MS.INDUSTRIES[p.industry];
    const diff = Object.assign({}, MS.DIFFICULTY[p.diffKey] || MS.DIFFICULTY.normal, p.diffCustom || {});
    const seed = (p.seed != null ? p.seed : Math.floor(Math.random() * 1e9)) | 0;
    const s = {
      v: 1, id: U.uid(), createdAt: Date.now(), updatedAt: Date.now(),
      rngState: seed, seed,
      company: { name: p.name || 'Новая компания', industry: I.id },
      diffKey: p.diffKey || 'normal', diff,
      turn: 0, status: 'active', lostReason: null,
      cash: Math.round(startCapital(I) * diff.capitalMult),
      deposit: 0, loans: [], receivables: [], taxLossCF: 0,
      flows: { opIn: 0, opOut: 0, inv: 0, fin: 0, dev: 0, other: 0, notes: [] },
      prod: {
        capacity: I.startCapacity, condition: 72, tech: 0, auto: 0,
        book: I.startCapacity * I.capUnitCost * 0.55,
        maint: 1, planMode: 'auto', plan: 1.0, qc: 1, supplier: 'standard', stock: 'normal',
        raw: 0, finished: 0, pending: []
      },
      staff: {
        depts: {
          prod: { n: I.staff.prod.n, wage: I.staff.prod.wage, skill: I.startSkill, head: null, acc: 0 },
          sales: { n: I.staff.sales.n, wage: I.staff.sales.wage, skill: I.startSkill, head: null, acc: 0 },
          admin: { n: I.staff.admin.n, wage: I.staff.admin.wage, skill: I.startSkill + 5, head: null, acc: 0 }
        },
        control: 50, bonusPct: 0, bonusMode: 'kpi', training: 1, autoReplace: true,
        morale: 60, layoffMemory: 0, candidates: [], hiredThisMonth: 0
      },
      market: {
        price: I.price, awareness: 2.0, reputation: 50, quality: 52, innovation: 50,
        keyRate: diff.keyRate, priceIndex: 1, wageIndex: 1, matIndex: 1,
        cyclePhase: Math.floor(seedRand(seed) * 11) - 2, cyclePeriod: 54, macro: 1,
        competitors: I.competitors.map(c => Object.assign({ base: Object.assign({}, c), share: 0 }, U.deep(c))),
        others: 1, researchUntil: -1, campaigns: [], strategy: 'none', strategyAt: -99, lastShare: I.startShare
      },
      markets: [], products: [], done: [], projects: [],
      org: { structure: 'functional', structureAt: -99, branches: 0, goals: [] },
      mods: [], delayed: [], flags: {}, sitCooldown: {}, pending: [], decisions: [],
      history: [], events: [], yearReports: [], lastReport: null,
      counters: { negCash: 0, lowShare: 0, lowMorale: 0, quits3: [], overtime: 0 },
      ref: { revenue: I.price * I.marketDemand * I.startShare, units: I.marketDemand * I.startShare, staff: I.staff.prod.n + I.staff.sales.n + I.staff.admin.n },
      settings: { autosave: true, anim: true }
    };
    // стартовые запасы
    s.prod.raw = Math.round(s.ref.units * MS.CAT.STOCK.normal.months);
    if (I.inventory === 'stock') s.prod.finished = Math.round(s.ref.units * 0.4);
    MS.economy.calibrate(s);
    MS.economy.refreshMacro(s);
    genCandidates(s);
    log(s, 'start', `Вы назначены руководителем компании «${s.company.name}». Отрасль: ${I.name}. Стартовый капитал — ${U.money(s.cash)}.`, 'info');
    return s;
  }
  function seedRand(seed) { const st = { rngState: seed ^ 0x5bd1e995 }; return U.rng(st); }
  function startCapital(I) { return I.price * I.marketDemand * I.startShare * (2.0 + I.receivable.share * I.receivable.lag * 1.2) + 3000000; }

  const depts = (s) => Object.keys(s.staff.depts);
  const dept = (s, d) => s.staff.depts[d];
  const headcount = (s) => U.sum(depts(s), d => s.staff.depts[d].n);
  function marketWage(s, d) {
    const I = ind(s); const C = MS.CAT.DEPTS[d];
    const base = I.staff[d] ? I.staff[d].wage : I.staff[C.wageFrom].wage * C.wageK;
    return base * s.market.wageIndex;
  }
  const payroll = (s) => U.sum(depts(s), d => s.staff.depts[d].n * s.staff.depts[d].wage) + headsPay(s);
  const headsPay = (s) => U.sum(depts(s), d => s.staff.depts[d].head ? s.staff.depts[d].head.wage : 0);
  function salaryRatio(s) {
    const n = headcount(s); if (!n) return 1;
    return U.sum(depts(s), d => s.staff.depts[d].n * s.staff.depts[d].wage / marketWage(s, d)) / n;
  }
  function avgSkill(s) {
    const n = headcount(s); if (!n) return 0;
    return U.sum(depts(s), d => s.staff.depts[d].n * s.staff.depts[d].skill) / n;
  }
  const heads = (s) => depts(s).filter(d => s.staff.depts[d].head).length;

  function refRevenue(s) {
    const h = s.history.slice(-3);
    const r = h.length ? U.avg(h, x => x.revenue) : s.ref.revenue;
    return Math.max(r, s.ref.revenue * 0.6) * (h.length ? 1 : s.market.priceIndex);
  }
  function monthlyExpenses(s) {
    const h = s.history.slice(-3);
    if (h.length) return U.avg(h, x => x.expensesCash);
    return payroll(s) * (1 + ind(s).socialRate) + ind(s).overhead + s.ref.units * ind(s).matCost;
  }
  const totalDebt = (s) => U.sum(s.loans, l => l.balance) + Math.max(0, -s.cash);

  function mod(s, k) { return U.sum(s.mods.filter(m => m.k === k), m => m.v); }
  function addMod(s, k, v, months, why, src) {
    s.mods.push({ k, v, until: s.turn + months, why: why || '', src: src || '' });
  }
  const flag = (s, f) => s.flags[f] != null && s.flags[f] >= s.turn;
  function setFlag(s, f, months) { s.flags[f] = s.turn + (months == null ? 9999 : months); }

  function log(s, type, text, tone) {
    s.events.push({ turn: s.turn, type, text, tone: tone || 'info' });
    if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
  }

  function genCandidates(s) {
    const I = ind(s);
    const list = [];
    for (let i = 0; i < 3; i++) {
      const skill = U.rndInt(s, 38, 92);
      const style = U.pick(s, ['X', 'Y', 'Y', 'B']);
      list.push({ id: U.uid(), name: U.personName(s), skill, style, wageK: 1.35 + skill / 110 + U.rng(s) * 0.15 });
    }
    s.staff.candidates = list;
  }
  function candidateWage(s, c, d) { return Math.round(marketWage(s, d) * c.wageK / 1000) * 1000; }

  function equipValue(s) { return s.prod.capacity * ind(s).capUnitCost * s.market.priceIndex; }
  function marketName(s, id) {
    const n = MS.CAT.MARKET_NAMES[s.company.industry];
    if (n && n[id] !== undefined) return n[id];
    return MS.CAT.MARKETS[id].name;
  }
  function equipName(s, id) { return (MS.CAT.EQUIP_NAMES[s.company.industry] || {})[id] || MS.CAT.EQUIP.find(e => e.id === id).name; }

  /* Стадия жизненного цикла по Адизесу */
  function adizes(s) {
    const h = s.history; const age = s.turn;
    const last12 = h.slice(-12), prev12 = h.slice(-24, -12);
    const rev12 = U.sum(last12, x => x.revenue), revPrev = U.sum(prev12, x => x.revenue);
    const growth = revPrev > 0 ? rev12 / revPrev - 1 : (h.length > 2 ? (h[h.length - 1].revenue / h[0].revenue - 1) : 0);
    const profit12 = U.sum(last12, x => x.netProfit);
    const ros = rev12 > 0 ? profit12 / rev12 : 0;
    const bureaucracy = headcount(s) ? dept(s, 'admin').n / headcount(s) : 0;
    const inn = s.market.innovation;
    let st;
    if (age < 6) st = 'infancy';
    else if (age < 18 && growth > 0.12) st = 'gogo';
    else if (growth > 0.15 && ros < 0.04) st = 'gogo';
    else if (growth > 0.08 && heads(s) < 2) st = 'adolescence';
    else if (growth > 0.03 && ros > 0.05 && inn >= 40) st = 'prime';
    else if (growth > -0.03 && ros > 0.02 && inn >= 30) st = 'stable';
    else if (ros > 0 && inn < 30 && bureaucracy > 0.12) st = 'bureaucracy';
    else if (ros > 0 && inn < 35) st = 'aristocracy';
    else if (ros <= 0 && growth < -0.1) st = 'recrimination';
    else if (growth > 0) st = 'adolescence'; else st = 'stable';
    return Object.assign({ id: st, growth, ros, bureaucracy }, ADIZES[st]);
  }
  const ADIZES = {
    infancy: { name: 'Младенчество', tip: 'Главное — продажи и деньги. Высокий риск кассового разрыва.', order: 1 },
    gogo: { name: '«Давай-давай»', tip: 'Быстрый рост и много возможностей. Опасность — распыление и отсутствие систем.', order: 2 },
    adolescence: { name: 'Юность', tip: 'Пора делегировать, назначать руководителей и внедрять регламенты.', order: 3 },
    prime: { name: 'Расцвет', tip: 'Баланс гибкости и управляемости. Задача — не останавливать обновление.', order: 4 },
    stable: { name: 'Стабильность', tip: 'Рост замедляется. Нужны новые продукты и рынки, чтобы не начать стареть.', order: 5 },
    aristocracy: { name: 'Аристократия', tip: 'Деньги есть, но инновации угасают. Нужно обновление ассортимента.', order: 6 },
    bureaucracy: { name: 'Бюрократия', tip: 'Аппарат разросся, гибкость потеряна. Нужна реорганизация и сокращение управленцев.', order: 7 },
    recrimination: { name: 'Ранняя бюрократия (охота на ведьм)', tip: 'Падение продаж и поиск виноватых. Требуются антикризисные меры.', order: 7 }
  };

  return { newGame, ind, depts, dept, headcount, marketWage, payroll, headsPay, salaryRatio, avgSkill, heads, refRevenue, monthlyExpenses, totalDebt, mod, addMod, flag, setFlag, log, genCandidates, candidateWage, equipValue, marketName, equipName, adizes, ADIZES };
})();
