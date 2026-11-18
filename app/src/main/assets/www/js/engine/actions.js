/* Действия игрока. Каждое действие проверяет условия и меняет состояние компании */
var MS = globalThis.MS = globalThis.MS || {};

MS.act = (function () {
  const U = MS.util, M = MS.model, C = MS.CAT, E = () => MS.economy;
  const ok = (msg) => ({ ok: true, msg });
  const fail = (msg) => ({ ok: false, msg });

  function spend(s, amount, kind, note) {
    s.cash -= amount;
    s.flows[kind] = (s.flows[kind] || 0) + amount;
    if (note) s.flows.notes.push(note);
  }
  function canPay(s, amount) { return s.cash >= amount; }
  const active = (s) => s.status === 'active';

  /* ---------- Персонал ---------- */
  function hireLimit(s, d) { const dp = M.dept(s, d); return Math.max(4, Math.ceil(dp.n * 0.3)) - (dp.hiredM === s.turn ? dp.hiredN : 0); }
  function hireCost(s, d, n) { const dp = M.dept(s, d); return n * Math.max(dp.wage, M.marketWage(s, d)) * (s.staff.depts.hr && s.staff.depts.hr.n ? 0.35 : 0.6); }
  function hire(s, d, n) {
    const dp = M.dept(s, d); if (!dp || n <= 0) return fail('Нет такого отдела');
    const lim = hireLimit(s, d);
    if (n > lim) return fail('Рынок труда позволяет нанять не более ' + lim + ' чел. в этот отдел за месяц');
    const cost = hireCost(s, d, n);
    if (!canPay(s, cost)) return fail('Недостаточно денег на подбор персонала (' + U.money(cost) + ')');
    spend(s, cost, 'other', 'Подбор персонала');
    const newSkill = Math.min(dp.skill, 30 + (dp.wage / M.marketWage(s, d) - 1) * 40);
    dp.skill = dp.n + n > 0 ? (dp.skill * dp.n + U.clamp(newSkill, 20, 60) * n) / (dp.n + n) : U.clamp(newSkill, 20, 60);
    dp.n += n;
    if (dp.hiredM !== s.turn) { dp.hiredM = s.turn; dp.hiredN = 0; }
    dp.hiredN += n; s.staff.hiredThisMonth += n;
    M.log(s, 'staff', 'Нанято ' + n + ' чел. в отдел «' + C.DEPTS[d].short + '». Затраты на подбор ' + U.money(cost) + '.', 'info');
    return ok('Нанято: ' + n);
  }
  function severance(s, d, n) { return n * M.dept(s, d).wage * 2; }
  function fire(s, d, n) {
    const dp = M.dept(s, d); if (!dp || n <= 0) return fail('Некого увольнять');
    n = Math.min(n, dp.n);
    if (d === 'prod' && dp.n - n < 2) return fail('В производстве должно остаться хотя бы 2 человека');
    const cost = severance(s, d, n);
    spend(s, cost, 'other', 'Выходные пособия');
    dp.n -= n;
    const hc = Math.max(1, M.headcount(s));
    s.staff.layoffMemory += Math.min(25, n / hc * 70 + 2);
    M.setFlag(s, 'layoffs', 6);
    if (M.flag(s, 'subsidyNoLayoff')) {
      M.log(s, 'finance', 'Нарушено условие господдержки о сохранении штата: грант нужно вернуть.', 'bad');
      const back = s.flags.subsidyAmount || 0; delete s.flags.subsidyNoLayoff;
      spend(s, back, 'other', 'Возврат гранта');
    }
    M.log(s, 'staff', 'Уволено ' + n + ' чел. из отдела «' + C.DEPTS[d].short + '». Выходные пособия ' + U.money(cost) + '. Коллектив насторожен.', 'warn');
    return ok('Уволено: ' + n);
  }
  function setWage(s, d, wage) {
    const dp = M.dept(s, d); const old = dp.wage;
    wage = Math.round(wage / 500) * 500;
    if (wage < old * 0.97) {
      // снижение зарплаты — нарушение гигиенического фактора, память о нём держится
      M.addMod(s, 'moraleT', -Math.min(15, (old - wage) / old * 60), 4, 'Снижение зарплат');
      M.setFlag(s, 'wageCut', 8);
      M.log(s, 'staff', 'Зарплата в отделе «' + C.DEPTS[d].short + '» снижена на ' + U.pct(1 - wage / old, 0) + '. Сотрудники недовольны.', 'warn');
    } else if (wage > old * 1.03) {
      M.log(s, 'staff', 'Зарплата в отделе «' + C.DEPTS[d].short + '» повышена на ' + U.pct(wage / old - 1, 0) + '.', 'good');
    }
    dp.wage = wage;
    return ok();
  }
  function setControl(s, v) { s.staff.control = U.clamp(Math.round(v), 0, 100); return ok(); }
  function setBonus(s, pct, mode) { s.staff.bonusPct = U.clamp(pct, 0, 0.3); if (mode) s.staff.bonusMode = mode; return ok(); }
  function setTraining(s, lvl) { s.staff.training = U.clamp(lvl, 0, 3); return ok(); }
  function setAutoReplace(s, v) { s.staff.autoReplace = !!v; return ok(); }

  function createDept(s, d) {
    if (s.staff.depts[d]) return fail('Отдел уже существует');
    const wage = Math.round(M.marketWage(s, d) / 1000) * 1000;
    s.staff.depts[d] = { n: 0, wage, skill: 45, head: null, acc: 0 };
    M.log(s, 'org', 'Создан отдел: ' + C.DEPTS[d].name + '. Наймите сотрудников, чтобы он заработал.', 'info');
    return ok('Отдел создан');
  }
  function closeDept(s, d) {
    const dp = s.staff.depts[d]; if (!dp || C.DEPTS[d].core) return fail('Этот отдел нельзя закрыть');
    if (dp.n) fire(s, d, dp.n);
    delete s.staff.depts[d];
    M.log(s, 'org', 'Отдел «' + C.DEPTS[d].short + '» расформирован.', 'warn');
    return ok();
  }
  function appointHead(s, d, candId) {
    const dp = M.dept(s, d); if (!dp) return fail('Нет отдела');
    const c = s.staff.candidates.find(x => x.id === candId); if (!c) return fail('Кандидат недоступен');
    const wage = M.candidateWage(s, c, d);
    const cost = wage * 1.0; // услуги рекрутинга
    if (!canPay(s, cost)) return fail('Недостаточно денег на подбор руководителя');
    spend(s, cost, 'other', 'Подбор руководителя');
    if (dp.head) s.staff.morale = Math.max(0, s.staff.morale - 1);
    dp.head = { name: c.name, skill: c.skill, style: c.style, wage, since: s.turn, internal: false };
    s.staff.candidates = s.staff.candidates.filter(x => x.id !== candId);
    M.setFlag(s, 'newHead_' + d, 4);
    M.log(s, 'staff', c.name + ' назначен(а) руководителем: ' + C.DEPTS[d].short + '. Компетентность ' + c.skill + '.', 'good');
    return ok();
  }
  function promoteInternal(s, d) {
    const dp = M.dept(s, d); if (!dp || dp.n < 2) return fail('В отделе нет подходящих сотрудников');
    const skill = Math.round(U.clamp(dp.skill + 8 + U.rng(s) * 12, 25, 90));
    const wage = Math.round(dp.wage * 1.45 / 1000) * 1000;
    dp.n -= 1;
    dp.head = { name: U.personName(s), skill, style: 'B', wage, since: s.turn, internal: true };
    M.addMod(s, 'moraleT', 3, 3, 'Повышение своего сотрудника');
    M.log(s, 'staff', dp.head.name + ' повышен(а) до руководителя: ' + C.DEPTS[d].short + '. Коллектив видит карьерные перспективы.', 'good');
    return ok();
  }
  function removeHead(s, d) {
    const dp = M.dept(s, d); if (!dp || !dp.head) return fail('Нет руководителя');
    spend(s, dp.head.wage * 2, 'other', 'Компенсация руководителю');
    M.log(s, 'staff', dp.head.name + ' освобождён(а) от должности.', 'warn');
    dp.head = null;
    return ok();
  }

  /* ---------- Финансы ---------- */
  const LOANS = {
    short: { name: 'Краткосрочный (12 мес.)', months: 12, add: 0 },
    mid: { name: 'Инвестиционный (36 мес.)', months: 36, add: 0.01 },
    long: { name: 'Долгосрочный (60 мес.)', months: 60, add: 0.015 }
  };
  function takeLoan(s, type, amount) {
    const ci = E().creditInfo(s); const L = LOANS[type];
    amount = Math.round(amount / 100000) * 100000;
    if (amount <= 0) return fail('Укажите сумму');
    if (amount > ci.limit) return fail('Банк одобряет не более ' + U.money(ci.limit));
    const rate = ci.rate + L.add;
    const payment = U.annuity(amount, rate, L.months);
    s.loans.push({ id: U.uid(), name: L.name, principal: amount, balance: amount, rate, months: L.months, payment, start: s.turn });
    s.cash += amount; s.flows.fin += amount;
    M.log(s, 'finance', 'Получен кредит ' + U.money(amount) + ' под ' + U.pct(rate, 1) + ' на ' + L.months + ' мес. Платёж ' + U.money(payment) + '/мес.', 'info');
    return ok();
  }
  function repayLoan(s, id, amount) {
    const l = s.loans.find(x => x.id === id); if (!l) return fail('Кредит не найден');
    amount = Math.min(amount || l.balance, l.balance);
    if (!canPay(s, amount)) return fail('Недостаточно денег');
    s.cash -= amount; s.flows.fin -= amount; l.balance -= amount;
    if (l.balance < 1) s.loans = s.loans.filter(x => x !== l);
    else l.payment = U.annuity(l.balance, l.rate, l.months);
    M.log(s, 'finance', 'Досрочное погашение кредита: ' + U.money(amount) + '.', 'good');
    return ok();
  }
  function depositPut(s, amount) {
    if (amount <= 0 || !canPay(s, amount)) return fail('Недостаточно денег');
    s.cash -= amount; s.deposit += amount; return ok();
  }
  function depositTake(s, amount) {
    amount = Math.min(amount, s.deposit); if (amount <= 0) return fail('Депозит пуст');
    s.deposit -= amount; s.cash += amount; return ok();
  }

  /* ---------- Производство ---------- */
  function equipCost(s, id) {
    const I = M.ind(s), e = C.EQUIP.find(x => x.id === id);
    const cap = Math.round(I.startCapacity * e.capK);
    return { cap, cost: Math.round(cap * I.capUnitCost * e.costK * s.market.priceIndex / 10000) * 10000, e };
  }
  function buyEquip(s, id) {
    const { cap, cost, e } = equipCost(s, id);
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost) + '. Возьмите кредит или накопите средства.');
    spend(s, cost, 'inv', 'Закупка оборудования');
    s.prod.book += cost;
    s.prod.pending.push({ id, name: M.equipName(s, id), cap, tech: e.tech, auto: e.auto, at: s.turn + e.months });
    M.log(s, 'production', 'Заказано: ' + M.equipName(s, id) + ' за ' + U.money(cost) + '. Ввод через ' + e.months + ' мес.', 'info');
    return ok();
  }
  function sellEquip(s, pct) {
    const P = s.prod; pct = U.clamp(pct, 0.05, 0.5);
    const capLoss = Math.round(P.capacity * pct);
    const money = Math.round(P.book * pct * 0.6);
    P.capacity -= capLoss; P.book -= P.book * pct;
    s.cash += money; s.flows.inv -= money;
    M.log(s, 'production', 'Продано ' + U.pct(pct, 0) + ' оборудования за ' + U.money(money) + '. Мощность −' + U.num(capLoss) + '.', 'warn');
    return ok();
  }
  const setMaint = (s, v) => { s.prod.maint = U.clamp(v, 0, 3); return ok(); };
  const setQC = (s, v) => { s.prod.qc = U.clamp(v, 0, 3); return ok(); };
  const setSupplier = (s, v) => { s.prod.supplier = v; return ok(); };
  const setStock = (s, v) => { s.prod.stock = v; return ok(); };
  const setPlan = (s, mode, v) => { s.prod.planMode = mode; if (v != null) s.prod.plan = U.clamp(v, 0, 1.2); return ok(); };

  /* ---------- Маркетинг ---------- */
  function campaignBase(s) { return M.refRevenue(s); }
  function launchCampaign(s, id) {
    const d = C.CAMPAIGNS.find(x => x.id === id);
    if (s.market.campaigns.some(c => c.id === id)) return fail('Кампания уже идёт');
    const base = campaignBase(s);
    const setup = (d.setupK || 0) * base;
    if (!canPay(s, setup + d.costK * base)) return fail('Недостаточно денег');
    if (setup) spend(s, setup, 'dev', 'Запуск ' + d.name);
    s.market.campaigns.push({ id, base, until: s.turn + d.months, start: s.turn });
    if (id === 'promo') M.setFlag(s, 'promoUsed', 12);
    M.log(s, 'market', 'Запущена кампания «' + d.name + '» на ' + d.months + ' мес. (' + U.money(d.costK * base) + '/мес).', 'info');
    return ok();
  }
  function stopCampaign(s, id) { s.market.campaigns = s.market.campaigns.filter(c => c.id !== id); return ok(); }
  function research(s) {
    const cost = C.RESEARCH.costK * campaignBase(s);
    if (!canPay(s, cost)) return fail('Недостаточно денег');
    spend(s, cost, 'dev', 'Маркетинговое исследование');
    s.market.researchUntil = s.turn + C.RESEARCH.months;
    M.log(s, 'market', 'Проведено маркетинговое исследование: данные о конкурентах точны 6 месяцев.', 'info');
    return ok();
  }
  function setPrice(s, p) { s.market.price = Math.max(1, Math.round(p)); return ok(); }
  function marketCost(s, id) { return Math.round(C.MARKETS[id].costK * campaignBase(s) / 10000) * 10000; }
  function enterMarket(s, id) {
    const d = C.MARKETS[id];
    if (s.markets.some(m => m.id === id)) return fail('Рынок уже освоен или осваивается');
    if (!d.req(s)) return fail(d.reqText);
    const cost = marketCost(s, id);
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost));
    spend(s, cost, 'dev', 'Выход на рынок');
    s.markets.push({ id, at: s.turn + d.months, ready: false, ramp: 0, start: s.turn });
    M.log(s, 'strategy', 'Начат выход на рынок «' + M.marketName(s, id) + '». Срок ' + d.months + ' мес.', 'info');
    return ok();
  }
  function productCost(s) {
    const rnd = s.staff.depts.rnd && s.staff.depts.rnd.n;
    return { cost: Math.round(C.PRODUCT.costK * campaignBase(s) * (rnd ? 0.8 : 1) / 10000) * 10000, months: rnd ? (s.staff.depts.rnd.n >= 3 ? 2 : 3) : C.PRODUCT.months };
  }
  function developProduct(s, name) {
    if (s.products.includes(name) || s.projects.some(p => p.id === name)) return fail('Уже в работе');
    if (s.projects.filter(p => p.type === 'product').length >= 1 + (s.org.structure === 'matrix' ? 1 : 0)) return fail('Компания уже ведёт разработку продукта');
    const { cost, months } = productCost(s);
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost));
    spend(s, cost, 'dev', 'Разработка продукта');
    s.projects.push({ type: 'product', id: name, at: s.turn + months, start: s.turn, cost });
    M.log(s, 'strategy', 'Начата разработка: ' + name + '. Запуск через ' + months + ' мес.', 'info');
    return ok();
  }
  function setStrategy(s, id) {
    if (s.market.strategy === id) return ok();
    if (s.turn - s.market.strategyAt < 12 && s.market.strategy !== 'none') return fail('Стратегию можно менять не чаще раза в год (последняя смена ' + (s.turn - s.market.strategyAt) + ' мес. назад)');
    s.market.strategy = id; s.market.strategyAt = s.turn;
    M.addMod(s, 'prod', -0.02, 2, 'Перестройка под новую стратегию');
    M.log(s, 'strategy', 'Выбрана конкурентная стратегия: ' + C.STRATEGIES[id].name + '.', 'info');
    return ok();
  }

  /* ---------- Стратегия ---------- */
  function branchCost(s) { return Math.round(M.ind(s).branch.cost * s.market.priceIndex / 10000) * 10000; }
  function openBranch(s) {
    const I = M.ind(s);
    if (s.projects.some(p => p.type === 'branch')) return fail('Уже открывается филиал');
    const cost = branchCost(s);
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost));
    spend(s, cost, 'inv', 'Открытие филиала');
    s.projects.push({ type: 'branch', id: 'branch', at: s.turn + I.branch.months, start: s.turn, cost });
    M.log(s, 'strategy', 'Начато открытие: ' + I.branch.name + '. Срок ' + I.branch.months + ' мес.', 'info');
    return ok();
  }
  function projectCost(s, id) { return Math.round(C.PROJECTS.find(p => p.id === id).costK * campaignBase(s) / 10000) * 10000; }
  function startProject(s, id) {
    const d = C.PROJECTS.find(p => p.id === id);
    if (s.done.includes(id) || s.projects.some(p => p.id === id)) return fail('Проект уже выполнен или идёт');
    if (d.req && !d.req(s)) return fail(d.reqText);
    const cost = projectCost(s, id);
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost));
    spend(s, cost, 'dev', d.name);
    s.projects.push({ type: 'project', id, at: s.turn + d.months, start: s.turn, cost });
    if (d.dip) M.addMod(s, 'prod', -d.dip, d.months, 'Внедрение: ' + d.name);
    M.log(s, 'strategy', 'Запущен проект «' + d.name + '». Срок ' + d.months + ' мес.', 'info');
    return ok();
  }
  function reorganize(s, structure, communicate) {
    if (s.org.structure === structure) return fail('Эта структура уже действует');
    if (s.projects.some(p => p.type === 'structure')) return fail('Реорганизация уже идёт');
    const cost = Math.round(campaignBase(s) * (communicate ? 0.35 : 0.25) / 10000) * 10000;
    if (!canPay(s, cost)) return fail('Нужно ' + U.money(cost));
    spend(s, cost, 'dev', 'Реорганизация');
    s.org.structure = structure; s.org.structureAt = s.turn;
    s.projects.push({ type: 'structure', id: structure, at: s.turn + 3, start: s.turn, cost });
    M.addMod(s, 'prod', communicate ? -0.04 : -0.09, 3, 'Реорганизация (переходный период)');
    if (!communicate) { M.addMod(s, 'moraleT', -7, 3, 'Непонятная реорганизация'); M.setFlag(s, 'reorgResist', 4); }
    else M.addMod(s, 'moraleT', -1, 2, 'Реорганизация');
    M.log(s, 'strategy', 'Начата реорганизация: ' + C.STRUCTURES[structure].name + (communicate ? ' (с разъяснением и вовлечением персонала).' : ' (приказом, без разъяснений).'), 'info');
    return ok();
  }
  function setGoals(s, goals) { s.org.goals = goals; s.org.goalsYear = Math.floor(s.turn / 12); return ok(); }

  return { spend, hire, fire, hireLimit, hireCost, severance, setWage, setControl, setBonus, setTraining, setAutoReplace, createDept, closeDept, appointHead, promoteInternal, removeHead, LOANS, takeLoan, repayLoan, depositPut, depositTake, equipCost, buyEquip, sellEquip, setMaint, setQC, setSupplier, setStock, setPlan, launchCampaign, stopCampaign, research, setPrice, marketCost, enterMarket, productCost, developProduct, setStrategy, branchCost, openBranch, projectCost, startProject, reorganize, setGoals, campaignBase };
})();
