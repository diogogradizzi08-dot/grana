/* Gráficos em SVG puro: rosca, barras de fluxo, linha de ritmo e barras horizontais. */
(function (G) {
  // rosca: fatias com espaço entre elas; total no meio
  G.donut = (items, { size = 200, thickness = 26, center = '', sub = '' } = {}) => {
    const total = G.sum(items, (i) => i.value) || 1;
    const r = (size - thickness) / 2, c = size / 2, C = 2 * Math.PI * r;
    const gap = items.length > 1 ? 2.5 : 0;
    let off = 0;
    const arcs = items.map((it, idx) => {
      const len = Math.max(0, it.value / total * C - gap);
      const s = `<circle class="donut-seg" data-idx="${idx}" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thickness}"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 ${c} ${c})"><title>${G.esc(it.label)}</title></circle>`;
      off += it.value / total * C;
      return s;
    }).join('');
    return `<svg class="donut" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${thickness}"/>${arcs}
      <text x="${c}" y="${c - 4}" text-anchor="middle" class="donut-center">${G.esc(center)}</text>
      <text x="${c}" y="${c + 16}" text-anchor="middle" class="donut-sub">${G.esc(sub)}</text></svg>`;
  };

  // fluxo mensal: barra de receita e de despesa lado a lado + linha do saldo do mês
  // largura real do cartão: assim o texto do gráfico nunca sai esticado ou espremido
  G.chartWidth = (half = false) => {
    const vw = window.innerWidth;
    let content = vw >= 900 ? Math.min(vw - 232 - 64, 1120) : vw - 32;
    if (half && vw >= 760) content = (content - 16) / 2;
    return Math.max(260, Math.round(content - 36));
  };

  G.flowBars = (series, { height = 190, width = G.chartWidth() } = {}) => {
    const W = width, H = height, padL = 8, padB = 26, padT = 12;
    const max = Math.max(1, ...series.map((s) => Math.max(s.income, s.expense)));
    const n = series.length, slot = (W - padL * 2) / n, bw = Math.min(22, slot / 3.2);
    const y = (v) => padT + (H - padB - padT) * (1 - v / max);
    let bars = '', pts = [];
    series.forEach((s, i) => {
      const x = padL + slot * i + slot / 2;
      bars += `<rect x="${x - bw - 2}" y="${y(s.income)}" width="${bw}" height="${H - padB - y(s.income)}" rx="4" fill="var(--income)" opacity=".85"><title>Receitas ${G.money(s.income)}</title></rect>`;
      bars += `<rect x="${x + 2}" y="${y(s.expense)}" width="${bw}" height="${H - padB - y(s.expense)}" rx="4" fill="var(--expense)" opacity=".85"><title>Despesas ${G.money(s.expense)}</title></rect>`;
      bars += `<text x="${x}" y="${H - 8}" text-anchor="middle" class="axis">${G.monthAbbr(s.key)}</text>`;
      const net = s.income - s.expense;
      bars += `<text x="${x}" y="${Math.min(y(Math.max(s.income, s.expense)) - 4, H - padB - 4)}" text-anchor="middle" class="axis ${net >= 0 ? 'pos' : 'neg'}">${s.income || s.expense ? G.moneyShort(net) : ''}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--line)"/>${bars}</svg>`;
  };

  // ritmo: gasto acumulado do mês contra o mês anterior (e a linha do orçamento, se houver)
  G.paceLine = (cur, prev, { height = 170, upToDay = null, budget = 0, width = G.chartWidth() } = {}) => {
    const W = width, H = height, pad = 10, padB = 22;
    const n = Math.max(cur.length, prev.length);
    const max = Math.max(1, ...cur, ...prev, budget);
    const x = (i) => pad + (W - pad * 2) * (i / (n - 1 || 1));
    const y = (v) => pad + (H - padB - pad) * (1 - v / max);
    const path = (arr, until) => arr.slice(0, until).map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    const lim = upToDay || cur.length;
    const area = path(cur, lim) + ` L ${x(lim - 1)} ${H - padB} L ${x(0)} ${H - padB} Z`;
    const last = cur[lim - 1] || 0;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs><linearGradient id="paceG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".28"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" x2="${W}" y1="${H - padB}" y2="${H - padB}" stroke="var(--line)"/>
      ${budget ? `<line x1="0" x2="${W}" y1="${y(budget)}" y2="${y(budget)}" stroke="var(--warn)" stroke-dasharray="6 6"/><text x="${W - 4}" y="${y(budget) - 5}" text-anchor="end" class="axis">orçamento</text>` : ''}
      <path d="${path(prev, prev.length)}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>
      <path d="${area}" fill="url(#paceG)"/>
      <path d="${path(cur, lim)}" fill="none" stroke="var(--brand)" stroke-width="3" vector-effect="non-scaling-stroke"/>
      <circle cx="${x(lim - 1)}" cy="${y(last)}" r="5" fill="var(--brand)"/>
      <text x="${x(0)}" y="${H - 5}" class="axis">dia 1</text><text x="${W - pad}" y="${H - 5}" text-anchor="end" class="axis">dia ${n}</text></svg>`;
  };

  // barras horizontais com rótulo — ranking de categorias, estabelecimentos, contas
  G.hbars = (rows) => {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return `<div class="hbars">${rows.map((r) => `
      <div class="hbar ${r.onclick ? 'tap' : ''}" ${r.onclick ? `data-act="${r.onclick}"` : ''}>
        <div class="hbar-top"><span class="hbar-label">${r.icon ? `<span class="hbar-ic">${r.icon}</span>` : ''}${G.esc(r.label)}</span><span class="hbar-val">${G.money(r.value)}</span></div>
        <div class="hbar-track"><div class="hbar-fill" style="width:${(r.value / max * 100).toFixed(1)}%;background:${r.color || 'var(--brand)'}"></div></div>
        ${r.note ? `<div class="hbar-note">${r.note}</div>` : ''}
      </div>`).join('')}</div>`;
  };

  // barras verticais simples (dia da semana)
  G.vbars = (values, labels, { height = 120, highlight = -1 } = {}) => {
    const max = Math.max(1, ...values);
    return `<div class="vbars" style="height:${height}px">${values.map((v, i) => `
      <div class="vbar"><div class="vbar-fill ${i === highlight ? 'hi' : ''}" style="height:${(v / max * 100).toFixed(1)}%" title="${G.money(v)}"></div><span>${labels[i]}</span></div>`).join('')}</div>`;
  };

  // saldo projetado dia a dia: linha com área; abaixo de zero fica vermelho
  G.balanceLine = (series, { height = 120, width = G.chartWidth() } = {}) => {
    const W = width, H = height, pad = 8, padB = 18;
    const min = Math.min(0, ...series), max = Math.max(1, ...series);
    const x = (i) => pad + (W - pad * 2) * (i / (series.length - 1 || 1));
    const y = (v) => pad + (H - padB - pad) * (1 - (v - min) / (max - min || 1));
    const pts = series.map((v, i) => x(i).toFixed(1) + ' ' + y(v).toFixed(1));
    const line = 'M' + pts.join(' L');
    const area = line + ` L ${x(series.length - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`;
    const neg = min < 0;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
      <defs><linearGradient id="balG" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--brand)" stop-opacity=".25"/><stop offset="1" stop-color="var(--brand)" stop-opacity="0"/></linearGradient>
      <clipPath id="belowZero"><rect x="0" y="${y(0)}" width="${W}" height="${H}"/></clipPath></defs>
      <path d="${area}" fill="url(#balG)"/>
      ${neg ? `<line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" stroke="var(--expense)" stroke-dasharray="4 4"/>` : ''}
      <path d="${line}" fill="none" stroke="var(--brand)" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
      ${neg ? `<path d="${line}" fill="none" stroke="var(--expense)" stroke-width="2.5" clip-path="url(#belowZero)"/>` : ''}
      <text x="${pad}" y="${H - 4}" class="axis">hoje</text><text x="${W - pad}" y="${H - 4}" text-anchor="end" class="axis">em ${series.length - 1} dias</text></svg>`;
  };

  G.progress = (ratio, cls = '') => `<div class="progress ${cls}"><div style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></div></div>`;
})(window.G);
