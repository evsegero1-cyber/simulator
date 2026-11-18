/* Графики на SVG без внешних библиотек: линии, области, столбцы, спарклайны, кольцевые диаграммы */
var MS = globalThis.MS = globalThis.MS || {};

MS.charts = (function () {
  const U = MS.util;
  const COLORS = { blue: '#4f8cff', green: '#2fbf71', red: '#f0616d', amber: '#f2b84b', violet: '#9b7bff', cyan: '#33c3d6', pink: '#e86fb3', gray: '#8b97ae' };

  function niceTicks(min, max, n) {
    if (min === max) { max = min + 1; }
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag, step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    const t = []; for (let v = lo; v <= hi + step / 2; v += step) t.push(v);
    return t;
  }

  /* cfg: { labels, series:[{name,color,values,type:'line'|'bar'|'area',dash}], fmt, height, zero } */
  function render(el, cfg) {
    const W = Math.max(260, el.clientWidth || 600), H = cfg.height || 210;
    const padL = cfg.padL || 54, padR = 10, padT = 10, padB = 24;
    const n = cfg.labels.length;
    if (!n) { el.innerHTML = '<div class="empty small">Данные появятся после первого месяца</div>'; return; }
    const all = []; cfg.series.forEach(s => s.values.forEach(v => { if (v != null && isFinite(v)) all.push(v); }));
    let min = Math.min(...all), max = Math.max(...all);
    if (cfg.zero !== false || cfg.series.some(s => s.type === 'bar')) { min = Math.min(0, min); max = Math.max(0, max); }
    if (cfg.min != null) min = cfg.min; if (cfg.max != null) max = cfg.max;
    if (min === max) { max += 1; min -= cfg.zero === false ? 1 : 0; }
    const ticks = niceTicks(min, max, 4); min = ticks[0]; max = ticks[ticks.length - 1];
    const iw = W - padL - padR, ih = H - padT - padB;
    const x = (i) => padL + (n === 1 ? iw / 2 : (cfg.series.some(s => s.type === 'bar') ? (i + 0.5) * iw / n : i * iw / (n - 1)));
    const y = (v) => padT + ih - (v - min) / (max - min) * ih;
    const fmt = cfg.fmt || (v => U.num(v));
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '">';
    svg += '<g class="axis">';
    ticks.forEach(t => { svg += '<line class="gridline" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(t) + '" y2="' + y(t) + '"' + (t === 0 ? ' style="stroke:#3a4a6b"' : '') + '/><text x="' + (padL - 6) + '" y="' + (y(t) + 3.5) + '" text-anchor="end">' + U.esc(cfg.axisFmt ? cfg.axisFmt(t) : short(t)) + '</text>'; });
    const every = Math.max(1, Math.ceil(n / Math.floor(iw / 52)));
    cfg.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1 && n < 8) svg += '<text x="' + x(i) + '" y="' + (H - 6) + '" text-anchor="middle">' + U.esc(l) + '</text>'; });
    svg += '</g>';
    const bars = cfg.series.filter(s => s.type === 'bar');
    const bw = Math.max(2, Math.min(22, iw / n * 0.7 / Math.max(1, bars.length)));
    bars.forEach((s, k) => {
      s.values.forEach((v, i) => {
        if (v == null) return;
        const bx = x(i) - bw * bars.length / 2 + k * bw, y0 = y(0), y1 = y(v);
        const col = s.posNeg ? (v >= 0 ? COLORS.green : COLORS.red) : (s.color || COLORS.blue);
        svg += '<rect x="' + bx + '" y="' + Math.min(y0, y1) + '" width="' + (bw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" rx="2" fill="' + col + '" opacity=".85"/>';
      });
    });
    cfg.series.filter(s => s.type !== 'bar').forEach((s, k) => {
      const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
      if (!pts.length) return;
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
      const col = s.color || COLORS.blue;
      if (s.type === 'area') {
        const gid = 'g' + Math.random().toString(36).slice(2, 7);
        svg += '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + col + '" stop-opacity=".35"/><stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';
        svg += '<path d="' + d + 'L' + pts[pts.length - 1][0] + ' ' + y(Math.max(min, 0)) + 'L' + pts[0][0] + ' ' + y(Math.max(min, 0)) + 'Z" fill="url(#' + gid + ')"/>';
      }
      svg += '<path class="ln" d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (s.width || 2.2) + '" stroke-linejoin="round" stroke-linecap="round"' + (s.dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    });
    svg += '<line class="cursor" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + ih) + '" stroke="#5d6a83" stroke-dasharray="3 3" style="display:none"/>';
    svg += '</svg>';
    const legend = cfg.series.length > 1 || cfg.legend ? '<div class="legend">' + cfg.series.map(s => '<span><i style="background:' + (s.posNeg ? COLORS.green : s.color || COLORS.blue) + '"></i>' + U.esc(s.name) + '</span>').join('') + '</div>' : '';
    el.innerHTML = '<div class="chart">' + svg + '<div class="tip" style="display:none"></div></div>' + legend;
    // анимация прорисовки линий
    if (MS.store.prefs().anim) el.querySelectorAll('path.ln').forEach(p => { const L = p.getTotalLength ? p.getTotalLength() : 0; if (!L) return; p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); p.style.transition = 'stroke-dashoffset .9s ease'; p.style.strokeDashoffset = 0; setTimeout(() => { p.style.strokeDasharray = ''; }, 950); });
    const box = el.querySelector('.chart'), tip = box.querySelector('.tip'), cur = box.querySelector('.cursor'), sv = box.querySelector('svg');
    const move = (ev) => {
      const r = sv.getBoundingClientRect(); const px = (ev.clientX - r.left) * W / r.width;
      let best = 0, bd = 1e9; for (let i = 0; i < n; i++) { const dd = Math.abs(x(i) - px); if (dd < bd) { bd = dd; best = i; } }
      cur.setAttribute('x1', x(best)); cur.setAttribute('x2', x(best)); cur.style.display = '';
      tip.innerHTML = '<b>' + U.esc(cfg.tipLabels ? cfg.tipLabels[best] : cfg.labels[best]) + '</b>' + cfg.series.map(s => s.values[best] == null ? '' : '<div><span class="dot" style="background:' + (s.posNeg ? (s.values[best] >= 0 ? COLORS.green : COLORS.red) : s.color || COLORS.blue) + ';margin-right:6px"></span>' + U.esc(s.name) + ': <b style="display:inline">' + U.esc((s.fmt || fmt)(s.values[best])) + '</b></div>').join('');
      tip.style.display = '';
      const left = x(best) / W * r.width; tip.style.left = U.clamp(left, 70, r.width - 70) + 'px'; tip.style.top = '-6px';
    };
    box.addEventListener('pointermove', move); box.addEventListener('pointerdown', move);
    box.addEventListener('pointerleave', () => { tip.style.display = 'none'; cur.style.display = 'none'; });
  }
  function short(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return U.round(v / 1e9, 1) + ' млрд';
    if (a >= 1e6) return U.round(v / 1e6, 1) + ' млн';
    if (a >= 1e3) return U.round(v / 1e3, 0) + ' тыс';
    if (a > 0 && a < 1) return U.round(v * 100, 0) + '%';
    return U.round(v, 1);
  }
  function spark(values, color) {
    const v = values.filter(x => x != null && isFinite(x)); if (v.length < 2) return '';
    const min = Math.min(...v), max = Math.max(...v), W = 74, H = 26;
    const pts = v.map((x, i) => [i / (v.length - 1) * W, H - 3 - (max === min ? 0.5 : (x - min) / (max - min)) * (H - 6)]);
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><path d="' + pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('') + '" fill="none" stroke="' + (color || COLORS.blue) + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>';
  }
  function donut(parts, size) {
    size = size || 140; const r = size / 2 - 10, c = size / 2, tot = U.sum(parts, p => Math.max(0, p.v)) || 1;
    let a = -Math.PI / 2, out = '<svg viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">';
    parts.forEach(p => {
      const ang = Math.max(0, p.v) / tot * Math.PI * 2; if (ang <= 0) return;
      const a2 = a + ang, large = ang > Math.PI ? 1 : 0;
      out += '<path d="M' + (c + r * Math.cos(a)) + ' ' + (c + r * Math.sin(a)) + ' A' + r + ' ' + r + ' 0 ' + large + ' 1 ' + (c + r * Math.cos(a2 - 0.0001)) + ' ' + (c + r * Math.sin(a2 - 0.0001)) + '" fill="none" stroke="' + p.color + '" stroke-width="16"/>';
      a = a2;
    });
    return out + '</svg>';
  }
  return { render, spark, donut, COLORS, short };
})();
