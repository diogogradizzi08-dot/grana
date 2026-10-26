/* Grana — utilidades: dinheiro em centavos, datas locais, ids, DOM. */
window.G = window.G || {};

(function (G) {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const brlShort = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

  G.money = (cents, opts = {}) => {
    if (G.state && G.state.settings.hideValues && !opts.force) return 'R$ •••••';
    const v = (cents || 0) / 100;
    const s = brl.format(opts.abs ? Math.abs(v) : v);
    return opts.sign && cents > 0 ? '+' + s : s;
  };
  // R$ 12,3 mil — para eixos de gráfico e rótulos curtos
  G.moneyShort = (cents) => {
    if (G.state && G.state.settings.hideValues) return '•••';
    const v = Math.abs(cents || 0) / 100;
    const sign = cents < 0 ? '-' : '';
    if (v >= 1e6) return sign + 'R$ ' + brlShort.format(v / 1e6) + ' mi';
    if (v >= 1e3) return sign + 'R$ ' + brlShort.format(v / 1e3) + ' mil';
    return sign + 'R$ ' + Math.round(v);
  };
  // "1.234,56" | "1234.56" | "1234,5" → centavos
  G.parseMoney = (txt) => {
    if (typeof txt === 'number') return Math.round(txt * 100);
    if (!txt) return 0;
    let s = String(txt).replace(/[^\d,.-]/g, '');
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : Math.round(n * 100);
  };
  G.pct = (x, digits = 0) => (isFinite(x) ? (x * 100).toFixed(digits).replace('.', ',') + '%' : '—');

  // ---------- datas (sempre locais, AAAA-MM-DD) ----------
  const pad = (n) => String(n).padStart(2, '0');
  G.iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  G.today = () => G.iso(new Date());
  G.parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d || 1); };
  G.addDays = (s, n) => { const d = G.parseDate(s); d.setDate(d.getDate() + n); return G.iso(d); };
  G.monthKey = (s) => s.slice(0, 7);
  G.addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  G.daysInMonth = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  // dia do mês sem estourar (dia 31 em fevereiro vira 28/29)
  G.dateInMonth = (key, day) => key + '-' + pad(Math.min(day, G.daysInMonth(key)));
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  G.MONTHS = MONTHS; G.WD = WD;
  G.monthName = (key, withYear = true) => { const [y, m] = key.split('-').map(Number); const n = MONTHS[m - 1]; return withYear && y !== new Date().getFullYear() ? n + ' ' + y : n; };
  G.monthAbbr = (key) => MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3);
  G.dateLabel = (s) => {
    const t = G.today();
    if (s === t) return 'Hoje';
    if (s === G.addDays(t, -1)) return 'Ontem';
    if (s === G.addDays(t, 1)) return 'Amanhã';
    const d = G.parseDate(s);
    const base = WD[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()];
    return d.getFullYear() !== new Date().getFullYear() ? base + ' de ' + d.getFullYear() : base;
  };
  G.shortDate = (s) => { const d = G.parseDate(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); };

  G.screens = {};
  G.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // "UBER *TRIP 1234" e "Uber Trip" viram a mesma chave
  G.norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(\d+\/\d+\)/g, '').replace(/[*#\d]+/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  G.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  G.cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  G.$ = (sel, root = document) => root.querySelector(sel);
  G.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  G.h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  G.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  G.sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + f(x), 0);
  G.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  G.vibrate = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { } };
})(window.G);
