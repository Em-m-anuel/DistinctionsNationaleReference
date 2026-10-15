/* ==========================================================================
   GAB-ORIENT — Graphiques SVG/HTML sans dépendance
   GOCharts.mount(el, type, options) dessine un graphique et le redessine à
   chaque changement de largeur. Types : bar, line, donut, hbar.
   Infobulles : chaque marque porte data-tip, géré par l'application.
   ========================================================================== */
window.GOCharts = (function () {
  'use strict';
  const fmt = n => Number(n).toLocaleString('fr-FR');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const registry = new WeakMap();

  function scale(maxVal) {
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
    const step = steps.find(s => Math.ceil(maxVal / s) <= 5) || 1000;
    const top = Math.max(step, Math.ceil(maxVal / step) * step);
    const ticks = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { top, ticks };
  }

  function axes(W, H, m, top, ticks) {
    const ih = H - m.t - m.b;
    return ticks.map(t => {
      const y = m.t + ih - (t / top) * ih;
      return `<line class="ch-grid" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>` +
             `<text class="ch-tick" x="${m.l - 8}" y="${y + 4}" text-anchor="end">${fmt(t)}</text>`;
    }).join('') + `<line class="ch-axis" x1="${m.l}" x2="${W - m.r}" y1="${m.t + ih}" y2="${m.t + ih}"/>`;
  }

  function bar(el, o) {
    const W = Math.max(260, el.clientWidth), H = o.height || 230, m = { t: 18, r: 6, b: 30, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { top, ticks } = scale(Math.max(1, ...o.values));
    const bw = iw / o.labels.length, barW = Math.min(36, bw * 0.6);
    const every = bw < 30 ? 2 : 1;
    let s = axes(W, H, m, top, ticks);
    o.values.forEach((v, i) => {
      const h = (v / top) * ih, x = m.l + bw * i + (bw - barW) / 2, y = m.t + ih - h;
      const tip = `<strong>${esc(o.labels[i])}</strong>${fmt(v)} ${esc(o.unit || '')}`;
      s += `<rect class="ch-bar" style="--i:${i}" x="${x}" y="${y}" width="${barW}" height="${Math.max(h, v ? 2 : 0)}" rx="3" fill="${o.color || 'var(--green-600)'}" tabindex="0" role="img" aria-label="${esc(o.labels[i])} : ${fmt(v)} ${esc(o.unit || '')}" data-tip="${esc(tip)}"/>`;
      if (bw > 26 && v > 0) s += `<text class="ch-val" x="${x + barW / 2}" y="${y - 6}" text-anchor="middle">${fmt(v)}</text>`;
      if (i % every === 0) s += `<text class="ch-xlabel" x="${x + barW / 2}" y="${H - 10}" text-anchor="middle">${esc(o.short ? o.short[i] : o.labels[i])}</text>`;
    });
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(o.aria || '')}">${s}</svg>`;
  }

  function line(el, o) {
    const W = Math.max(260, el.clientWidth), H = o.height || 230, m = { t: 18, r: 14, b: 30, l: 34 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const { top, ticks } = scale(Math.max(1, ...o.values));
    const n = o.values.length, step = n > 1 ? iw / (n - 1) : 0;
    const pts = o.values.map((v, i) => [m.l + step * i, m.t + ih - (v / top) * ih]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = d + ` L ${pts[n - 1][0]} ${m.t + ih} L ${pts[0][0]} ${m.t + ih} Z`;
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    const color = o.color || 'var(--blue-600)';
    const every = step < 34 ? 2 : 1;
    let s = `<defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${o.areaColor || '#3a75c4'}" stop-opacity="0.18"/><stop offset="1" stop-color="${o.areaColor || '#3a75c4'}" stop-opacity="0"/></linearGradient></defs>`;
    s += axes(W, H, m, top, ticks);
    s += `<path class="ch-area" d="${area}" fill="url(#${id})"/>`;
    s += `<path class="ch-line" d="${d}" stroke="${color}" pathLength="1"/>`;
    pts.forEach((p, i) => {
      const tip = `<strong>${esc(o.labels[i])}</strong>${fmt(o.values[i])} ${esc(o.unit || '')}`;
      s += `<circle class="ch-point" cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}" tabindex="0" role="img" aria-label="${esc(o.labels[i])} : ${fmt(o.values[i])} ${esc(o.unit || '')}" data-tip="${esc(tip)}"/>`;
      if (i % every === 0) s += `<text class="ch-xlabel" x="${p[0]}" y="${H - 10}" text-anchor="middle">${esc(o.short ? o.short[i] : o.labels[i])}</text>`;
    });
    if (n) s += `<text class="ch-val" x="${pts[n - 1][0]}" y="${pts[n - 1][1] - 10}" text-anchor="end">${fmt(o.values[n - 1])}</text>`;
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="${esc(o.aria || '')}">${s}</svg>`;
  }

  function donut(el, o) {
    const total = o.items.reduce((a, b) => a + b.value, 0);
    const R = 64, C = 2 * Math.PI * R;
    let acc = 0, segs = '';
    o.items.forEach((it, i) => {
      if (!it.value) return;
      const pct = (it.value / total) * 100;
      const gap = o.items.filter(x => x.value).length > 1 ? 0.6 : 0;
      const tip = `<strong>${esc(it.label)}</strong>${fmt(it.value)} · ${Math.round(pct)} %`;
      segs += `<circle class="ch-seg" data-k="${i}" cx="90" cy="90" r="${R}" stroke="${it.color}" stroke-width="22" pathLength="100" stroke-dasharray="${Math.max(pct - gap, 0.1)} ${100 - Math.max(pct - gap, 0.1)}" stroke-dashoffset="${-acc}" transform="rotate(-90 90 90)" tabindex="0" role="img" aria-label="${esc(it.label)} : ${fmt(it.value)}" data-tip="${esc(tip)}"/>`;
      acc += pct;
    });
    const svg = `<svg width="180" height="180" viewBox="0 0 180 180" role="group" aria-label="${esc(o.aria || '')}">
      <circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--slate-50)" stroke-width="22"/>${segs}
      <g class="donut-center"><text class="big" x="90" y="92" text-anchor="middle">${fmt(total)}</text><text class="small" x="90" y="110" text-anchor="middle">${esc(o.centerLabel || '')}</text></g></svg>`;
    const legend = o.items.map((it, i) => `<div class="legend-item" data-k="${i}"><i style="background:${it.color}"></i><span>${esc(it.label)}</span><b>${fmt(it.value)}</b><em>${total ? Math.round(it.value / total * 100) : 0} %</em></div>`).join('');
    return `<div class="donut-wrap">${svg}<div class="legend">${legend}</div></div>`;
  }

  function hbar(el, o) {
    const max = Math.max(1, ...o.items.map(i => i.value));
    return `<div class="hbars">${o.items.map((it, i) => `
      <div class="hbar" data-tip="${esc(`<strong>${esc(it.label)}</strong>${fmt(it.value)} ${esc(o.unit || '')}`)}">
        <span class="hbar-label" title="${esc(it.label)}">${esc(it.label)}</span>
        <span class="hbar-track"><span class="hbar-fill" style="--i:${i};background:${it.color || o.color || 'var(--navy-800)'}" data-w="${(it.value / max) * 100}"></span></span>
        <span class="hbar-val">${fmt(it.value)}</span>
      </div>`).join('')}</div>`;
  }

  const R = { bar, line, donut, hbar };

  function draw(el, type, o, animate) {
    el.classList.toggle('animate', !!animate);
    el.innerHTML = R[type](el, o);
    if (type === 'hbar') {
      const fills = el.querySelectorAll('.hbar-fill');
      const apply = () => fills.forEach(f => { f.style.width = f.dataset.w + '%'; });
      if (animate) requestAnimationFrame(() => requestAnimationFrame(apply)); else { fills.forEach(f => { f.style.transition = 'none'; }); apply(); }
    }
    if (type === 'donut') {
      const wrap = el.querySelector('.donut-wrap');
      const hot = k => {
        wrap.classList.toggle('has-hot', k != null);
        el.querySelectorAll('[data-k]').forEach(n => n.classList.toggle('is-hot', n.dataset.k === k));
      };
      el.querySelectorAll('[data-k]').forEach(n => {
        n.addEventListener('pointerenter', () => hot(n.dataset.k));
        n.addEventListener('pointerleave', () => hot(null));
        n.addEventListener('focus', () => hot(n.dataset.k));
        n.addEventListener('blur', () => hot(null));
      });
    }
  }

  function mount(el, type, o) {
    const prev = registry.get(el);
    if (prev) prev.ro.disconnect();
    draw(el, type, o, true);
    let w = el.clientWidth, t;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - w) < 8) return;
      w = el.clientWidth;
      clearTimeout(t);
      t = setTimeout(() => draw(el, type, o, false), 120);
    });
    ro.observe(el);
    registry.set(el, { ro });
  }

  return { mount, fmt };
})();
