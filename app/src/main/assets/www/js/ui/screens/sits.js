/* Экран управленческих ситуаций и разбор решений */
var MS = globalThis.MS = globalThis.MS || {};
MS.screens = MS.screens || {};

MS.screens.sits = (function () {
  const U = MS.util, ui = MS.ui;
  const CAT = { staff: 'Персонал', finance: 'Финансы', production: 'Производство', market: 'Рынок', strategy: 'Стратегия' };
  const CT = { staff: 'accent', finance: 'good', production: 'warn', market: '', strategy: 'accent' };
  let filter = 'all';

  function render(s) {
    let html = '<div class="row between wrap mb12"><div><h2>Управленческие ситуации</h2><div class="small muted">Каждое решение имеет последствия — сейчас и через несколько месяцев. Универсально правильных ответов нет: всё зависит от состояния компании.</div></div></div>';
    if (s.pending.length) {
      html += '<div class="col">' + s.pending.map(p => card(p, s)).join('') + '</div>';
    } else html += '<div class="card">' + ui.empty('Нерешённых ситуаций нет. Новые появятся после перехода к следующему месяцу — их набор зависит от состояния компании и ваших прошлых решений.', 'check') + '</div>';

    const dec = s.decisions.slice().reverse().filter(d => filter === 'all' || d.cat === filter);
    html += '<div class="card mt16"><div class="card-h"><h3>История решений</h3>' + ui.seg('filter', [{ v: 'all', l: 'Все' }].concat(Object.keys(CAT).map(k => ({ v: k, l: CAT[k] }))), filter) + '</div>';
    if (s.decisions.length) {
      const avg = U.avg(s.decisions, d => d.score);
      const v = MS.sit.verdict(avg);
      html += '<div class="row wrap mb12"><span class="chip">Решений: ' + s.decisions.length + '</span><span class="chip ' + v.tone + '">Среднее качество: ' + v.label.toLowerCase() + ' (' + U.signed(avg, x => U.num(x, 2)) + ')</span><span class="chip">Без решения: ' + s.decisions.filter(d => d.auto).length + '</span></div>';
    }
    html += dec.length ? dec.slice(0, 60).map(d => { const v = MS.sit.verdict(d.score); return '<div class="list-i" data-act="past" data-arg="' + s.decisions.indexOf(d) + '" style="cursor:pointer"><span class="chip ' + v.tone + '" style="min-width:34px;justify-content:center">' + U.signed(d.score, x => U.num(x, 1)) + '</span><div class="grow"><b>' + ui.esc(d.title) + '</b><div class="small muted">' + (d.auto ? '<span class="bad">Без решения:</span> ' : '') + ui.esc(d.choice) + '</div><div class="tiny dim">' + U.shortDate(d.turn) + ' · ' + CAT[d.cat] + '</div></div></div>'; }).join('') : ui.empty('Решений пока нет');
    return html + '</div>';
  }

  function card(p, s) {
    const d = MS.sit.def(p.id);
    return '<div class="sit"><div class="row wrap"><span class="chip ' + CT[d.cat] + '">' + CAT[d.cat] + '</span>' + (d.urgent ? '<span class="chip bad">Срочно</span>' : '') + '<span class="chip">' + U.shortDate(p.at) + '</span></div>' +
      '<h2 class="mt8">' + ui.esc(d.title) + '</h2><div class="sit-text">' + ui.esc(MS.sit.text(p, s)) + '</div>' +
      d.options.map((o, i) => { const inf = MS.sit.optionInfo(p, s, i); const dis = !inf.available || (inf.cost > s.cash && !o.allowDebt); return '<button class="sit-opt ' + (dis ? 'dis' : '') + '" data-act="choose" data-arg="' + p.uid + '" data-i="' + i + '"><div class="row between"><span class="t">' + ui.esc(inf.t) + '</span>' + (inf.cost ? '<span class="chip ' + (inf.cost > s.cash ? 'bad' : '') + '">' + U.money(inf.cost) + '</span>' : '') + '</div>' + (inf.hint ? '<div class="h">' + ui.esc(inf.hint) + '</div>' : '') + '</button>'; }).join('') +
      '<div class="row wrap mt12"><span class="tiny muted">Связанные концепции:</span>' + ui.theoryChips(d.theory) + '</div></div>';
  }

  /* Разбор решения: принципы, теория, почему сработает или нет, альтернативы */
  function analysis(res, s) {
    const r = res.rec, v = MS.sit.verdict(r.score);
    const b = res.before, a = res.after;
    const ch = [];
    const add = (l, dv, f, inv) => { if (Math.abs(dv) > 0.05) ch.push('<div class="row between small" style="padding:4px 0"><span class="muted">' + l + '</span>' + ui.delta(dv, f, inv) + '</div>'); };
    add('Деньги', a.cash - b.cash, 'money'); add('Удовлетворённость', a.morale - b.morale, 'd1'); add('Репутация', a.rep - b.rep, 'd1'); add('Качество', a.quality - b.quality, 'd1'); add('Персонал', a.staff - b.staff, 'int'); add('Квалификация', a.skill - b.skill, 'd1'); add('Узнаваемость', a.aw - b.aw, 'd1');
    let body = '<div class="verdict ' + v.tone + ' mb12"><div class="ic">' + (r.score >= 0.5 ? '✓' : r.score > -0.5 ? '~' : '✕') + '</div><div><b>' + v.label + '</b><div class="small">' + ui.esc(r.choice) + '</div></div></div>';
    body += '<h4 class="mb8">Почему</h4><p>' + ui.esc(r.note) + '</p>';
    body += '<h4 class="mt12 mb8">Задействованные концепции</h4><div class="row wrap">' + ui.theoryChips(r.theory) + '</div>';
    body += '<div class="grid g2 mt12"><div><h4 class="mb8">Немедленный эффект</h4>' + (ch.length ? ch.join('') : '<div class="small muted">Эффект проявится в расчётах месяца (производительность, спрос, затраты).</div>') + '</div>' +
      '<div><h4 class="mb8">Отложенные последствия</h4>' + (res.later.length ? res.later.map(l => '<div class="small" style="padding:4px 0">через ' + l.in + ' ' + U.plural(l.in, 'месяц', 'месяца', 'месяцев') + ': <span class="muted">' + (l.chance != null && l.chance < 1 ? 'возможно (' + U.pct(l.chance, 0) + ') — ' : '') + 'последствие решения</span></div>').join('') : '<div class="small muted">Не ожидаются — но решение влияет на показатели компании.</div>') + '</div></div>';
    body += '<h4 class="mt16 mb8">Альтернативы</h4>' + res.alts.map(x => { const vv = MS.sit.verdict(x.score); return '<div class="list-i"><span class="chip ' + vv.tone + '">' + U.signed(x.score, y => U.num(y, 1)) + '</span><div class="grow"><b class="small">' + ui.esc(x.t) + '</b><div class="small muted">' + ui.esc(x.note || '') + '</div></div></div>'; }).join('');
    ui.modal({ title: 'Разбор решения: ' + ui.esc(r.title), body, foot: '<button class="btn primary" data-close>Понятно</button>' });
  }

  function pastAnalysis(d) {
    const v = MS.sit.verdict(d.score);
    const def = MS.sit.def(d.sitId);
    let body = '<div class="verdict ' + v.tone + ' mb12"><div class="ic">' + (d.score >= 0.5 ? '✓' : d.score > -0.5 ? '~' : '✕') + '</div><div><b>' + v.label + '</b><div class="small">' + (d.auto ? 'Решение не было принято: ' : '') + ui.esc(d.choice) + '</div></div></div><p>' + ui.esc(d.note) + '</p><div class="row wrap">' + ui.theoryChips(d.theory) + '</div>';
    if (def) body += '<h4 class="mt16 mb8">Все варианты</h4>' + def.options.map((o, i) => '<div class="small" style="padding:4px 0">' + (i === d.idx ? '<b class="accent">▸ ' : '<span class="muted">') + ui.esc(typeof o.t === 'function' ? '…' : o.t) + (i === d.idx ? '</b>' : '</span>') + '</div>').join('');
    ui.modal({ title: ui.esc(d.title) + ' · ' + U.shortDate(d.turn), body });
  }

  const act = {
    choose(a, s) {
      const uid = a.dataset.arg, i = +a.dataset.i;
      const res = MS.sit.resolve(s, uid, i);
      if (!res) return 'keep';
      if (res.error) return { ok: false, msg: res.error };
      MS.game.autosave();
      MS.app.rerender();
      analysis(res, s);
      return 'keep';
    },
    filter(a) { filter = a.dataset.v; },
    past(a, s) { pastAnalysis(s.decisions[+a.dataset.arg]); return 'keep'; }
  };
  return { title: 'Ситуации', render, act, CAT };
})();
