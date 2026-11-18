/* Движок управленческих ситуаций: отбор по состоянию компании и истории решений, применение последствий */
var MS = globalThis.MS = globalThis.MS || {};

MS.sit = (function () {
  const U = MS.util, M = MS.model, C = MS.CAT;

  /* Контекст — сжатая картина состояния, по которой ситуации решают, уместны ли они */
  function ctx(s) {
    const h = s.history, last = h[h.length - 1] || {};
    const E = MS.economy;
    const exp = M.monthlyExpenses(s);
    const r3 = h.slice(-3), p3 = h.slice(-6, -3);
    const revTrend = p3.length ? U.sum(r3, x => x.revenue) / Math.max(1, U.sum(p3, x => x.revenue)) - 1 : 0;
    const share6 = h.length > 6 ? h[h.length - 7].share : (h[0] ? h[0].share : 0);
    const q3 = s.counters.quits3;
    return {
      rev: M.refRevenue(s), pay: M.payroll(s), exp, cash: s.cash,
      cashMonths: exp > 0 ? s.cash / exp : 99,
      lev: E.creditInfo(s).lev, morale: s.staff.morale, skill: s.staff.depts.prod.skill,
      share: last.share != null ? last.share : s.market.lastShare, shareTrend: last.share != null ? last.share - share6 : 0,
      revTrend, profit: last.netProfit || 0, util: last.utilization || 0, cond: s.prod.condition,
      quality: s.market.quality, rep: s.market.reputation, sr: M.salaryRatio(s), control: s.staff.control,
      turnover: q3.length ? U.sum(q3, x => x.q) / Math.max(1, U.avg(q3, x => x.n)) : 0,
      age: s.turn, size: M.headcount(s), heads: M.heads(s), ind: s.company.industry,
      recv: U.sum(s.receivables, x => x.amount), stockMonths: last.sales ? s.prod.finished / last.sales : 0,
      innovation: s.market.innovation, overtimeMonths: overtimeStreak(s), wageAvg: M.payroll(s) / Math.max(1, M.headcount(s)),
      admin: s.staff.depts.admin.n, prodN: s.staff.depts.prod.n, debt: M.totalDebt(s), macro: s.market.macro,
      keyRate: s.market.keyRate, relP: E.effPrice(s) / E.stdPrice(s), I: M.ind(s)
    };
  }
  function overtimeStreak(s) { let n = 0; for (let i = s.history.length - 1; i >= 0 && s.history[i].utilization > 1.02; i--) n++; return n; }

  /* ---------- Применение эффекта ---------- */
  function applyFx(s, fx, why, vars) {
    if (!fx) return;
    if (typeof fx === 'function') fx = fx(s, ctx(s), vars || {});
    const Mk = s.market, P = s.prod, St = s.staff;
    if (fx.cash) { s.cash += fx.cash; if (fx.cash < 0) s.flows.other += -fx.cash; else s.flows.opIn += fx.cash; }
    if (fx.morale) St.morale = U.clamp(St.morale + fx.morale, 0, 100);
    if (fx.rep) Mk.reputation = U.clamp(Mk.reputation + fx.rep, 0, 100);
    if (fx.quality) Mk.quality = U.clamp(Mk.quality + fx.quality, 0, 100);
    if (fx.aw) Mk.awareness = Math.max(0, Mk.awareness + fx.aw);
    if (fx.innovation) Mk.innovation = U.clamp(Mk.innovation + fx.innovation, 0, 100);
    if (fx.condition) P.condition = U.clamp(P.condition + fx.condition, 0, 100);
    if (fx.capacityPct) P.capacity = Math.max(1, P.capacity * (1 + fx.capacityPct));
    if (fx.control) St.control = U.clamp(St.control + fx.control, 0, 100);
    if (fx.skill) Object.values(St.depts).forEach(d => d.skill = U.clamp(d.skill + fx.skill, 5, 100));
    if (fx.layoffMemory) St.layoffMemory += fx.layoffMemory;
    if (fx.fire) {
      const d = St.depts[fx.fire.d]; if (d) {
        const n = fx.fire.n != null ? Math.min(fx.fire.n, d.n) : Math.round(d.n * fx.fire.pct);
        d.n = Math.max(fx.fire.d === 'prod' ? 2 : 0, d.n - n);
        St.layoffMemory += Math.min(25, n / Math.max(1, M.headcount(s)) * 70 + 2);
        M.setFlag(s, 'layoffs', 6);
      }
    }
    if (fx.hire) { const d = St.depts[fx.hire.d]; if (d) { const n = fx.hire.n; d.skill = (d.skill * d.n + (fx.hire.skill || 32) * n) / Math.max(1, d.n + n); d.n += n; } }
    if (fx.wage) Object.keys(St.depts).forEach(k => { if (fx.wage.d === 'all' || fx.wage.d === k) St.depts[k].wage = Math.round(St.depts[k].wage * (1 + fx.wage.pct) / 500) * 500; });
    if (fx.mods) fx.mods.forEach(m => M.addMod(s, m[0], m[1], m[2], m[3] || why));
    if (fx.flags) Object.keys(fx.flags).forEach(k => M.setFlag(s, k, fx.flags[k]));
    if (fx.unflag) fx.unflag.forEach(k => delete s.flags[k]);
    if (fx.recv) s.receivables.forEach(x => x.amount *= fx.recv);
    if (fx.shock) { const I = M.ind(s); Mk.matIndex *= 1 + fx.shock; Mk.priceIndex *= 1 + fx.shock * I.matCost / I.price; }
    if (fx.matIndex) Mk.matIndex *= 1 + fx.matIndex;
    if (fx.compPrice) Mk.competitors.forEach(c => c.priceK *= 1 + fx.compPrice);
    if (fx.compAw) Mk.competitors.forEach(c => c.aw += fx.compAw);
    if (fx.others) Mk.others *= 1 + fx.others;
    if (fx.headRemove) { const d = St.depts[fx.headRemove]; if (d) d.head = null; }
    if (fx.loan) {
      const ci = MS.economy.creditInfo(s);
      const rate = ci.rate + (fx.loan.rateAdd || 0);
      s.loans.push({ id: U.uid(), name: fx.loan.name || 'Кредит', principal: fx.loan.amount, balance: fx.loan.amount, rate, months: fx.loan.months, payment: U.annuity(fx.loan.amount, rate, fx.loan.months), start: s.turn });
      s.cash += fx.loan.amount; s.flows.fin += fx.loan.amount;
    }
    if (fx.addComp && Mk.competitors.length < 6) {
      const c = fx.addComp; Mk.competitors.push(Object.assign({ base: Object.assign({}, c), share: 0 }, U.deep(c)));
    }
    if (fx.fn) fx.fn(s, ctx(s));
  }

  /* ---------- Отбор ситуаций ---------- */
  function eligible(s, c) {
    return MS.SITUATIONS.filter(x => {
      if (s.pending.some(p => p.id === x.id)) return false;
      if (x.ind && !x.ind.includes(s.company.industry)) return false;
      if (x.minAge && s.turn < x.minAge) return false;
      const cd = s.sitCooldown[x.id];
      if (cd != null) { if (x.once) return false; if (s.turn - cd < (x.cooldown || 18)) return false; }
      return true;
    }).map(x => ({ x, w: Math.max(0, x.when(s, c) || 0) })).filter(e => e.w > 0);
  }

  function generate(s) {
    if (s.status !== 'active') return [];
    const c = ctx(s); const added = [];
    const el = eligible(s, c);
    const add = (x) => {
      const inst = { uid: U.uid(), id: x.id, at: s.turn, deadline: s.turn + (x.deadline || 0), vars: x.vars ? x.vars(s, c) : {} };
      s.pending.push(inst); s.sitCooldown[x.id] = s.turn; added.push(inst);
      M.log(s, 'situation', 'Новая ситуация: ' + x.title, 'warn');
    };
    const urgent = el.filter(e => e.x.urgent);
    if (urgent.length) add(U.weighted(s, urgent.map(e => ({ w: e.w, v: e.x }))));
    const freq = s.diff.situationFreq;
    const normal = () => eligible(s, c).filter(e => !e.x.urgent);
    if (s.turn >= 1 && s.pending.length < 3 && U.rng(s) < 0.72 * freq) {
      const n = normal(); if (n.length) add(U.weighted(s, n.map(e => ({ w: e.w, v: e.x }))));
    }
    if (s.turn >= 3 && s.pending.length < 3 && U.rng(s) < 0.22 * freq) {
      const n = normal(); if (n.length) add(U.weighted(s, n.map(e => ({ w: e.w, v: e.x }))));
    }
    return added;
  }

  const def = (id) => MS.SITUATIONS.find(x => x.id === id);
  const val = (v, s, c, vars) => typeof v === 'function' ? v(s, c, vars) : v;
  function text(inst, s) { const d = def(inst.id); return val(d.text, s, ctx(s), inst.vars); }
  function optionInfo(inst, s, i) {
    const d = def(inst.id), o = d.options[i], c = ctx(s);
    return {
      t: val(o.t, s, c, inst.vars), hint: val(o.d, s, c, inst.vars) || '',
      cost: Math.max(0, Math.round((typeof o.cost === 'function' ? o.cost(c, s, inst.vars) : o.cost) || 0)),
      available: o.req ? !!o.req(s, c, inst.vars) : true
    };
  }

  /* ---------- Решение ---------- */
  function resolve(s, uid, i, auto) {
    const inst = s.pending.find(p => p.uid === uid); if (!inst) return null;
    const d = def(inst.id), o = d.options[i], c = ctx(s);
    const info = optionInfo(inst, s, i);
    if (!auto && !info.available) return { error: 'Этот вариант сейчас недоступен' };
    if (!auto && info.cost > 0 && s.cash < info.cost && !o.allowDebt) return { error: 'Недостаточно денег: нужно ' + U.money(info.cost) };
    const before = snapshot(s);
    if (info.cost) MS.act.spend(s, info.cost, o.costKind || 'other', d.title);
    const fx = val(o.fx, s, c, inst.vars);
    applyFx(s, fx, d.title);
    (val(o.later, s, c, inst.vars) || []).forEach((l, li) => {
      // в сохранение пишется ссылка на эффект, а не функция — так отложенные последствия переживают загрузку
      s.delayed.push({ at: s.turn + l.in, sit: d.id, opt: i, li, vars: inst.vars, why: l.why, tone: l.tone, chance: l.chance, elseWhy: l.elseWhy });
    });
    const score = U.clamp(val(o.score, s, c, inst.vars) || 0, -2, 2);
    const theory = (o.theory || []).concat(d.theory || []).filter((x, k, a) => a.indexOf(x) === k);
    const rec = {
      turn: s.turn, sitId: d.id, title: d.title, cat: d.cat, choice: info.t, idx: i, score, auto: !!auto,
      tags: o.tags || [], theory, note: val(o.note, s, c, inst.vars) || '',
      principles: val(o.principles, s, c, inst.vars) || val(d.principles, s, c, inst.vars) || ''
    };
    s.decisions.push(rec);
    s.pending = s.pending.filter(p => p.uid !== uid);
    const after = snapshot(s);
    M.log(s, 'decision', (auto ? 'Без решения руководителя: ' : 'Решение: ') + d.title + ' → ' + info.t, auto ? 'bad' : 'info');
    const alts = d.options.map((oo, k) => k === i ? null : { t: val(oo.t, s, c, inst.vars), note: val(oo.note, s, c, inst.vars), score: U.clamp(val(oo.score, s, c, inst.vars) || 0, -2, 2) }).filter(Boolean);
    const later = (val(o.later, s, c, inst.vars) || []).map(l => ({ in: l.in, why: l.why, chance: l.chance }));
    return { rec, before, after, alts, later, theory, cost: info.cost };
  }
  function snapshot(s) { return { cash: s.cash, morale: s.staff.morale, rep: s.market.reputation, quality: s.market.quality, staff: M.headcount(s), skill: s.staff.depts.prod.skill, aw: s.market.awareness }; }

  function applyDelayed(s, x) {
    const d = def(x.sit); if (!d) return;
    const o = d.options[x.opt]; if (!o) return;
    const L = val(o.later, s, ctx(s), x.vars) || [];
    if (L[x.li]) applyFx(s, L[x.li].fx, x.why, x.vars);
  }

  /* Нерешённые до конца месяца ситуации решаются «по умолчанию» — бездействие тоже решение */
  function expire(s) {
    const out = [];
    s.pending.filter(p => p.deadline < s.turn + 1).forEach(p => {
      const d = def(p.id);
      const idx = d.ignore != null ? d.ignore : d.options.length - 1;
      const r = resolve(s, p.uid, idx, true);
      if (r) out.push(r);
    });
    return out;
  }

  function verdict(score) {
    if (score >= 1.5) return { label: 'Сильное решение', tone: 'good' };
    if (score >= 0.5) return { label: 'Разумное решение', tone: 'good' };
    if (score > -0.5) return { label: 'Спорное решение', tone: 'warn' };
    if (score > -1.5) return { label: 'Слабое решение', tone: 'bad' };
    return { label: 'Ошибочное решение', tone: 'bad' };
  }

  return { ctx, applyFx, applyDelayed, generate, resolve, expire, text, optionInfo, def, verdict };
})();
