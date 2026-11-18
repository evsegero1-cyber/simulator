/* Игровой цикл и сохранения (localStorage, несколько слотов, автосохранение) */
var MS = globalThis.MS = globalThis.MS || {};

MS.store = (function () {
  const IDX = 'ms_index_v1', PFX = 'ms_save_', LAST = 'ms_last';
  const ls = () => { try { return globalThis.localStorage; } catch (e) { return null; } };
  function index() { try { return JSON.parse(ls().getItem(IDX) || '[]'); } catch (e) { return []; } }
  function writeIndex(list) { try { ls().setItem(IDX, JSON.stringify(list)); } catch (e) { } }
  function meta(s, name) {
    const I = MS.INDUSTRIES[s.company.industry];
    const h = s.history[s.history.length - 1];
    return { id: s.id, name: name || s.slotName || s.company.name, company: s.company.name, industry: I.name, turn: s.turn, cash: s.cash, status: s.status, updatedAt: Date.now(), revenue: h ? h.revenue : 0 };
  }
  function save(s, name) {
    s.updatedAt = Date.now(); if (name) s.slotName = name;
    try {
      ls().setItem(PFX + s.id, JSON.stringify(s));
      const list = index().filter(x => x.id !== s.id); list.unshift(meta(s, name)); writeIndex(list);
      ls().setItem(LAST, s.id);
      return true;
    } catch (e) { return false; }
  }
  function load(id) { try { const t = ls().getItem(PFX + id); return t ? migrate(JSON.parse(t)) : null; } catch (e) { return null; } }
  function remove(id) { try { ls().removeItem(PFX + id); writeIndex(index().filter(x => x.id !== id)); if (ls().getItem(LAST) === id) ls().removeItem(LAST); } catch (e) { } }
  function last() { try { return ls().getItem(LAST); } catch (e) { return null; } }
  function copyAs(s, name) { const c = MS.util.deep(s); c.id = MS.util.uid(); c.slotName = name; save(c, name); return c; }
  function migrate(s) { s.flows = s.flows || { opIn: 0, opOut: 0, inv: 0, fin: 0, dev: 0, other: 0, notes: [] }; return s; }
  function exportText(s) { return JSON.stringify(s); }
  function importText(t) {
    const s = JSON.parse(t);
    if (!s || !s.company || !s.history) throw new Error('Это не сохранение симулятора');
    s.id = MS.util.uid(); save(migrate(s)); return s;
  }
  const PREF = 'ms_prefs';
  function prefs() { try { return Object.assign({ anim: true, haptics: true }, JSON.parse(ls().getItem(PREF) || '{}')); } catch (e) { return { anim: true }; } }
  function setPrefs(p) { try { ls().setItem(PREF, JSON.stringify(p)); } catch (e) { } }
  return { index, save, load, remove, last, copyAs, exportText, importText, prefs, setPrefs };
})();

MS.game = (function () {
  const api = { s: null };

  api.start = function (params) {
    api.s = MS.model.newGame(params);
    MS.store.save(api.s);
    return api.s;
  };
  api.open = function (id) { const s = MS.store.load(id); if (s) api.s = s; return s; };
  api.autosave = function () { if (api.s && api.s.settings.autosave !== false) MS.store.save(api.s); };

  /* Завершение месяца: нерешённые ситуации → расчёт месяца → годовой отчёт → новые ситуации */
  api.endTurn = function () {
    const s = api.s; if (!s || s.status !== 'active') return null;
    const expired = MS.sit.expire(s);
    const r = MS.economy.simulateMonth(s);
    let yearReport = null;
    if (s.turn % 12 === 0) {
      yearReport = MS.reports.year(s, s.turn / 12 - 1);
      if (yearReport) s.yearReports.push(yearReport);
    }
    const added = s.status === 'active' ? MS.sit.generate(s) : [];
    MS.store.save(s);
    return { r, expired, added, yearReport };
  };

  api.finish = function () {
    const s = api.s; if (!s) return null;
    if (s.status === 'active') { s.status = 'finished'; MS.model.log(s, 'end', 'Руководитель завершил игру и подвёл итоги.', 'info'); }
    MS.store.save(s);
    return MS.reports.final(s);
  };
  return api;
})();
