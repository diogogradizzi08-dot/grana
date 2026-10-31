/* Grana — casca do app: navegação, tema, primeira abertura e dados de exemplo. */
(function (G) {
  G.VERSION = '1.3.1'; // ao publicar: igual ao version.json e suba o VERSION do sw.js
  G.screens = G.screens || {};
  const TABS = [['home', 'home', 'Início'], ['tx', 'list', 'Lançamentos'], ['insights', 'pie', 'Análises'], ['more', 'grid', 'Mais']];
  const MORE_ROUTES = ['accounts', 'budgets', 'goals', 'recurring', 'categories', 'import', 'settings'];

  G.go = (route) => { if (location.hash !== '#' + route) location.hash = route; else G.render(); };
  const route = () => (location.hash || '#home').slice(1).split('?')[0] || 'home';

  G.render = () => {
    const r = G.screens[route()] ? route() : 'home';
    const view = G.$('#view');
    const same = view.dataset.route === r, y = same ? window.scrollY : 0;
    view.dataset.route = r;
    G.screens[r](view);
    // ao trocar de tela: os blocos sobem em cascata e o número principal conta até o valor.
    // Re-desenhar a mesma tela (depois de salvar algo) não anima, para não piscar.
    if (!same && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter');
      G.$$('.hero-value', view).forEach(G.countUp);
    }
    const tab = MORE_ROUTES.includes(r) ? 'more' : r;
    G.$$('.nav-item').forEach((n) => n.classList.toggle('on', n.dataset.r === tab));
    window.scrollTo(0, y);
  };

  G.applyTheme = () => {
    const t = G.state.settings.theme;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = G.$('meta[name="theme-color"]'); if (m) m.content = dark ? '#0B1210' : '#F3F6F4';
  };

  function shell() {
    document.body.insertAdjacentHTML('afterbegin', `
      <nav class="nav">
        <div class="nav-brand"><span class="logo">${G.icon('drop', 20)}</span><b>Grana</b></div>
        ${TABS.slice(0, 2).map(navItem).join('')}
        <button class="nav-fab" id="fab" aria-label="Novo lançamento">${G.icon('plus', 28)}</button>
        ${TABS.slice(2).map(navItem).join('')}
        <button class="nav-scan" id="navScan">${G.icon('scan', 20)}<span>Ler nota</span></button>
      </nav>
      <main id="view" class="view"></main>`);
    G.$('#fab').onclick = () => openFabMenu();
    G.$('#navScan').onclick = () => G.openScan();
  }
  const navItem = ([r, ic, label]) => `<a class="nav-item" data-r="${r}" href="#${r}">${G.icon(ic, 22)}<span>${label}</span></a>`;

  // o botão + abre as quatro formas de lançar; um toque a mais, mas nunca escolher errado
  function openFabMenu() {
    const s = G.sheet(`<h3 class="sheet-title">Novo lançamento</h3><div class="fab-menu">
      <button data-q="expense"><span class="q-ic exp">${G.icon('minus')}</span><b>Despesa</b><small>gastei</small></button>
      <button data-q="income"><span class="q-ic inc">${G.icon('plus')}</span><b>Receita</b><small>recebi</small></button>
      <button data-q="scan"><span class="q-ic ai">${G.icon('scan')}</span><b>Ler nota ou contracheque</b><small>foto ou PDF</small></button>
      <button data-q="transfer"><span class="q-ic tr">${G.icon('swap')}</span><b>Transferência</b><small>entre contas, pagar fatura</small></button></div>`);
    G.$$('[data-q]', s.el).forEach((b) => (b.onclick = () => { s.close(); setTimeout(() => (b.dataset.q === 'scan' ? G.openScan() : G.openAdd({ type: b.dataset.q })), 200); }));
  }

  function onboarding() {
    const s = G.sheet(`<div class="welcome"><span class="logo big">${G.icon('drop', 40)}</span><h2>Bem-vindo ao Grana</h2>
      <p class="muted">Seu controle financeiro, simples de lançar e bom de entender. Tudo fica guardado só neste aparelho.</p>
      <label class="field"><span>Como quer ser chamado?</span><input id="wn" placeholder="Seu nome"></label>
      <label class="field"><span>Quanto tem hoje na conta corrente?</span><input id="wb" inputmode="decimal" placeholder="0,00"></label>
      <button class="btn primary big wide-btn" id="go">Começar</button>
      <button class="btn ghost wide-btn" id="demo">${G.icon('sparkles', 18)} Explorar com dados de exemplo</button>
      <p class="muted small">Depois você cria cartões, contas e metas em <b>Mais</b>.</p></div>`);
    const finish = () => { G.state.settings.onboarded = true; G.save(); G.render(); };
    s.el.querySelector('#go').onclick = () => {
      G.state.settings.name = s.el.querySelector('#wn').value.trim();
      const v = G.parseMoney(s.el.querySelector('#wb').value);
      const acc = G.state.accounts.find((a) => a.id === 'conta'); if (acc) acc.initial = v;
      s.close(); finish();
    };
    s.el.querySelector('#demo').onclick = () => { G.loadDemo(); s.close(); finish(); G.toast('Dados de exemplo — apague em Ajustes quando quiser começar de verdade'); };
  }

  // três meses fictícios, com vazamentos de propósito, para o app mostrar o que sabe fazer
  G.loadDemo = () => {
    const keepKey = G.state.settings.geminiKey;
    G.state = G.freshState();
    const st = G.state;
    st.settings.geminiKey = keepKey; st.settings.onboarded = true; st.settings.name = st.settings.name || 'Diogo';
    st.accounts.push({ id: 'nubank', name: 'Nubank', type: 'credit', color: '#7C3AED', initial: 0, closingDay: 3, dueDay: 10, limit: 800000 });
    st.accounts.push({ id: 'reserva', name: 'Reserva', type: 'savings', color: '#0369A1', initial: 1250000 });
    st.accounts[0].initial = 320000; st.accounts[1].initial = 60000;
    let seed = 7; const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const t = G.today(), cur = G.monthKey(t);
    const add = (o) => { if (o.date <= t) G.addTx(o); };
    st.recurring.push(
      { id: 'r1', type: 'income', amount: 720000, desc: 'Salário', categoryId: 'salario', accountId: 'conta', freq: 'monthly', day: 5, start: G.addMonths(cur, -2) + '-05', done: {} },
      { id: 'r2', type: 'expense', amount: 180000, desc: 'Aluguel', categoryId: 'moradia', accountId: 'conta', freq: 'monthly', day: 10, start: G.addMonths(cur, -2) + '-10', done: {} },
      { id: 'r3', type: 'expense', amount: 11990, desc: 'Internet Vivo Fibra', categoryId: 'contas', accountId: 'conta', freq: 'monthly', day: 15, start: G.addMonths(cur, -2) + '-15', done: {} },
      { id: 'r4', type: 'expense', amount: 5590, desc: 'Netflix', categoryId: 'assinaturas', accountId: 'nubank', freq: 'monthly', day: 12, start: G.addMonths(cur, -2) + '-12', done: {} },
    );
    for (let i = 2; i >= 0; i--) {
      const m = G.addMonths(cur, -i);
      for (const r of st.recurring) { const d = G.dateInMonth(m, r.day); if (d <= t && (i > 0 || r.id === 'r1')) G.confirmRecurring(r, d); }
      add({ type: 'expense', amount: 2190, desc: 'Spotify', categoryId: 'assinaturas', accountId: 'nubank', date: G.dateInMonth(m, 18) });
      add({ type: 'expense', amount: 9990, desc: 'Smart Fit', categoryId: 'assinaturas', accountId: 'nubank', date: G.dateInMonth(m, 2) });
      add({ type: 'expense', amount: 1890, desc: 'Tarifa pacote de serviços', categoryId: 'tarifas', accountId: 'conta', date: G.dateInMonth(m, 1) });
      add({ type: 'expense', amount: 16000 + Math.round(rnd() * 9000), desc: 'Enel energia', categoryId: 'contas', accountId: 'conta', date: G.dateInMonth(m, 20) });
      for (let w = 0; w < 4; w++) {
        const d = G.dateInMonth(m, 3 + w * 7);
        const a = 30000 + Math.round(rnd() * 25000), clean = Math.round(a * 0.12), hyg = Math.round(a * 0.08), beer = w % 2 ? Math.round(a * 0.1) : 0;
        add({ type: 'expense', amount: a, desc: pick(['Carrefour', 'Assaí Atacadista', 'Pão de Açúcar']), categoryId: 'mercado', accountId: 'nubank', date: d, source: 'scan',
          splits: [{ categoryId: 'mercado', amount: a - clean - hyg - beer }, { categoryId: 'casa', amount: clean }, { categoryId: 'higiene', amount: hyg }].concat(beer ? [{ categoryId: 'bebidas', amount: beer }] : []) });
      }
      const deliveries = i === 0 ? 9 : 5;
      for (let k = 0; k < deliveries; k++) add({ type: 'expense', amount: 3500 + Math.round(rnd() * 5000), desc: 'iFood', categoryId: 'delivery', accountId: 'nubank', date: G.dateInMonth(m, 1 + Math.floor(rnd() * 27)) });
      for (let k = 0; k < 10; k++) add({ type: 'expense', amount: 800 + Math.round(rnd() * 1400), desc: pick(['Padaria Pão Nosso', 'Café da esquina', 'Starbucks']), categoryId: 'padaria', accountId: pick(['carteira', 'nubank']), date: G.dateInMonth(m, 1 + Math.floor(rnd() * 27)) });
      for (let k = 0; k < 6; k++) add({ type: 'expense', amount: 1500 + Math.round(rnd() * 2500), desc: 'Uber', categoryId: 'transporte', accountId: 'nubank', date: G.dateInMonth(m, 1 + Math.floor(rnd() * 27)) });
      add({ type: 'expense', amount: 25000, desc: 'Posto Shell', categoryId: 'combustivel', accountId: 'nubank', date: G.dateInMonth(m, 8) });
      add({ type: 'expense', amount: 6000 + Math.round(rnd() * 8000), desc: 'Drogasil', categoryId: 'farmacia', accountId: 'nubank', date: G.dateInMonth(m, 14) });
      add({ type: 'expense', amount: 9000 + Math.round(rnd() * 12000), desc: pick(['Outback', 'Coco Bambu', 'Pizzaria Bella']), categoryId: 'restaurante', accountId: 'nubank', date: G.dateInMonth(m, 22) });
      if (i === 1) add({ type: 'income', amount: 85000, desc: 'Freela site', categoryId: 'extra', accountId: 'conta', date: G.dateInMonth(m, 25) });
      if (i === 0) { add({ type: 'expense', amount: 4500, desc: 'Juros cheque especial', categoryId: 'tarifas', accountId: 'conta', date: G.dateInMonth(m, 2) }); }
      const prevInv = G.addMonths(m, -1);
      if (i < 2) add({ type: 'transfer', amount: 250000, desc: 'Fatura Nubank ' + G.monthName(prevInv, false), accountId: 'conta', toAccountId: 'nubank', date: G.dateInMonth(m, 10) });
    }
    // a parcela do celular
    const group = G.uid();
    for (let n = 1; n <= 10; n++) add({ type: 'expense', amount: 24990, desc: `Celular Samsung (${n}/10)`, categoryId: 'compras', accountId: 'nubank', date: G.dateInMonth(G.addMonths(cur, n - 2), 6), installment: { group, n, total: 10 } });
    st.budgets = { mercado: 160000, delivery: 30000, padaria: 15000, restaurante: 25000, transporte: 20000 };
    st.goals = [{ id: 'g1', name: 'Reserva de emergência', target: 3000000, saved: 1250000, deadline: G.addMonths(cur, 14) + '-01', icon: '🛟', color: '#0369A1' },
      { id: 'g2', name: 'Viagem', target: 800000, saved: 210000, deadline: G.addMonths(cur, 8) + '-01', icon: '✈️', color: '#EA580C' }];
    G.save();
  };

  // ===== atualização: compara a versão instalada com a publicada (version.json) =====
  G.checkUpdate = async ({ manual = false } = {}) => {
    if (!navigator.onLine) { if (manual) G.toast('Sem internet agora — tente de novo conectado', { icon: 'alert' }); return false; }
    try {
      const res = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
      const info = await res.json();
      if (info.version && info.version !== G.VERSION) { showUpdateBar(info); return true; }
      if (manual) G.toast(`Você já está na versão mais nova (${G.VERSION})`);
    } catch (e) { if (manual) G.toast('Não consegui verificar agora', { icon: 'alert' }); }
    return false;
  };
  function showUpdateBar(info) {
    if (G.$('.update-bar')) return;
    const bar = G.h(`<div class="update-bar">${G.icon('sparkles', 18)}<div><b>Versão nova disponível (${G.esc(info.version)})</b>${info.notes ? `<small>${G.esc(info.notes)}</small>` : ''}</div>
      <button class="btn sm primary" data-up>Atualizar</button><button class="icon-btn sm" data-later title="Depois">${G.icon('x', 16)}</button></div>`);
    document.body.appendChild(bar);
    bar.querySelector('[data-later]').onclick = () => bar.remove();
    bar.querySelector('[data-up]').onclick = () => G.applyUpdate();
  }
  // os dados ficam no aparelho (IndexedDB) e não são tocados: só os arquivos do app são trocados
  G.applyUpdate = async () => {
    G.toast('Atualizando…', { icon: 'repeat' });
    try {
      await G.flushSave?.();
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) await reg.update();
      if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map((k) => caches.delete(k))); }
    } catch (e) { /* recarregar mesmo assim */ }
    location.reload();
  };

  async function init() {
    await G.loadState();
    if (G.migrateInvoices()) G.save();
    G.applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', G.applyTheme);
    shell();
    // girar o tablet muda a largura dos gráficos
    let lastW = innerWidth;
    window.addEventListener('resize', G.debounce(() => { if (Math.abs(innerWidth - lastW) > 40) { lastW = innerWidth; G.render(); } }, 250));
    window.addEventListener('hashchange', () => { G.closeTopSheet(); G.render(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') G.closeTopSheet(); });
    G.render();
    if (G.storageBroken) G.toast('Este navegador não deixou salvar dados. Abra pelo Chrome.', { icon: 'alert' });
    if (!G.state.settings.onboarded && !G.state.tx.length) setTimeout(onboarding, 300);
    // atalho do ícone instalado (manifest shortcuts)
    const p = new URLSearchParams(location.search);
    if (p.get('a') === 'scan') setTimeout(() => G.openScan(), 400);
    else if (p.get('a') === 'expense') setTimeout(() => G.openAdd({ type: 'expense' }), 400);
    // procura versão nova ao abrir e sempre que o app volta para a tela
    setTimeout(() => G.checkUpdate(), 1500);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') G.checkUpdate(); });
  }
  document.addEventListener('DOMContentLoaded', init);
})(window.G);
