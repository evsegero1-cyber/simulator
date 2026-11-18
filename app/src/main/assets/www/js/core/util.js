/* Утилиты: детерминированный ГСЧ, форматирование, математика */
var MS = globalThis.MS = globalThis.MS || {};

MS.util = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const round = (v, d = 0) => { const k = Math.pow(10, d); return Math.round(v * k) / k; };
  const sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  const avg = (arr, f) => arr.length ? sum(arr, f) / arr.length : 0;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const deep = (o) => JSON.parse(JSON.stringify(o));

  /* Mulberry32 — состояние хранится в сохранении, поэтому загрузка не «перебрасывает кубики» */
  function rng(state) {
    let t = (state.rngState = (state.rngState + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const chance = (s, p) => rng(s) < p;
  const pick = (s, arr) => arr[Math.floor(rng(s) * arr.length)];
  const rndInt = (s, a, b) => a + Math.floor(rng(s) * (b - a + 1));
  function weighted(s, items) { // items: [{w, v}]
    const tot = sum(items, i => i.w);
    if (tot <= 0) return null;
    let r = rng(s) * tot;
    for (const it of items) { r -= it.w; if (r <= 0) return it.v; }
    return items[items.length - 1].v;
  }

  const nbsp = ' ';
  function money(v, opts = {}) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const neg = v < 0; const a = Math.abs(v);
    let s;
    if (opts.full) s = Math.round(a).toLocaleString('ru-RU');
    else if (a >= 1e9) s = round(a / 1e9, 2).toLocaleString('ru-RU') + nbsp + 'млрд';
    else if (a >= 1e6) s = round(a / 1e6, a >= 1e8 ? 0 : (a >= 1e7 ? 1 : 2)).toLocaleString('ru-RU') + nbsp + 'млн';
    else if (a >= 1e3) s = round(a / 1e3, a >= 1e5 ? 0 : 1).toLocaleString('ru-RU') + nbsp + 'тыс';
    else s = Math.round(a).toLocaleString('ru-RU');
    return (neg ? '−' : '') + s + nbsp + '₽';
  }
  function num(v, d = 0) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const neg = v < 0;
    return (neg ? '−' : '') + round(Math.abs(v), d).toLocaleString('ru-RU');
  }
  const pct = (v, d = 1) => (v === null || isNaN(v)) ? '—' : num(v * 100, d) + '%';
  const signed = (v, f) => (v > 0 ? '+' : '') + (f ? f(v) : num(v, 1));

  const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const dateOf = (turn) => ({ year: 1 + Math.floor(turn / 12), month: turn % 12 });
  const dateLabel = (turn) => { const d = dateOf(turn); return MONTHS[d.month] + ', год ' + d.year; };
  const shortDate = (turn) => { const d = dateOf(turn); return MONTHS_SHORT[d.month] + ' ' + d.year; };

  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  const FIRST_M = ['Алексей', 'Дмитрий', 'Сергей', 'Андрей', 'Михаил', 'Игорь', 'Николай', 'Павел', 'Роман', 'Виктор', 'Олег', 'Артём', 'Евгений', 'Константин', 'Илья'];
  const FIRST_F = ['Елена', 'Ольга', 'Наталья', 'Ирина', 'Татьяна', 'Марина', 'Анна', 'Светлана', 'Юлия', 'Ксения', 'Дарья', 'Вера', 'Людмила', 'Алина'];
  const LAST = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Соколов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Волков', 'Соловьёв', 'Васильев', 'Зайцев', 'Павлов', 'Семёнов', 'Голубев', 'Виноградов', 'Богданов', 'Воробьёв', 'Фёдоров', 'Михайлов', 'Беляев', 'Тарасов', 'Белов', 'Комаров', 'Орлов', 'Киселёв', 'Макаров', 'Андреев', 'Ковалёв'];
  function personName(s) {
    const f = rng(s) < 0.5;
    let last = pick(s, LAST);
    if (f) last = last.endsWith('ий') ? last.slice(0, -2) + 'ая' : last + 'а';
    return (f ? pick(s, FIRST_F) : pick(s, FIRST_M)) + ' ' + last;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* Аннуитетный платёж */
  function annuity(P, annualRate, n) {
    const r = annualRate / 12;
    if (r <= 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  }
  /* NPV по ставке дисконтирования (годовая), денежные потоки помесячно */
  function npv(annualRate, flows) {
    const r = annualRate / 12;
    return flows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, i), 0);
  }

  return { clamp, lerp, round, sum, avg, uid, deep, rng, chance, pick, rndInt, weighted, money, num, pct, signed, MONTHS, MONTHS_SHORT, dateOf, dateLabel, shortDate, plural, personName, esc, annuity, npv };
})();
