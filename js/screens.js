/* Telas principais: Início, Lançamentos e Análises. */
(function (G) {
  G.view = { month: null, listFilter: null, listType: 'all', q: '' };
  const curMonth = () => G.view.month || G.monthKey(G.today());

  // ======================= INÍCIO =======================
  G.screens.home = (root) => {
    const key = G.monthKey(G.today());
    const tot = G.monthTotals(key);
    const balance = G.totalBalance();
    const upcoming = G.upcomingRecurring(key);
    const upIn = G.sum(upcoming.filter((u) => u.r.type === 'income'), (u) => u.r.amount);
    const upOut = G.sum(upcoming.filter((u) => u.r.type === 'expense'), (u) => u.r.amount);
    const pending = G.pendingRecurring();
    const leaks = G.leaks(key);
    const cats = G.byCategory(G.txInMonth(key), 'expense');
    const budget = G.budgetStatus(key);
    const cards = G.activeAccounts().filter((a) => a.type === 'credit');
    const recent = G.state.tx.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 6);
    const hour = new Date().getHours();
    const hello = (hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite') + (G.state.settings.name ? ', ' + G.state.settings.name : '');
    const ratio = tot.income ? Math.min(1, tot.expense / tot.income) : (tot.expense ? 1 : 0);

    root.innerHTML = `
      <header class="topbar"><div><small class="muted">${G.cap(G.WD[new Date().getDay()])}, ${new Date().getDate()} de ${G.MONTHS[new Date().getMonth()]}</small><h1>${G.esc(hello)}</h1></div>
        <div class="topbar-act"><button class="icon-btn" id="eye" title="Esconder valores">${G.icon(G.state.settings.hideValues ? 'eyeOff' : 'eye')}</button></div></header>
      <div class="home-grid">
        <section class="hero card">
          <div class="hero-top"><span>Saldo nas contas</span>${G.icon('wallet', 18)}</div>
          <div class="hero-value">${G.money(balance)}</div>
          <div class="hero-sub">${upcoming.length ? `Previsto no fim do mês: <b>${G.money(balance + upIn - upOut)}</b>` : 'Inclui contas e dinheiro, sem o cartão de crédito'}</div>
          <div class="hero-split">
            <div><small>${G.icon('arrowUp', 14)} Receitas em ${G.monthName(key, false)}</small><b>${G.money(tot.income)}</b></div>
            <div><small>${G.icon('arrowDown', 14)} Despesas</small><b>${G.money(tot.expense)}</b></div>
          </div>
          <div class="hero-bar"><i style="width:${ratio * 100}%"></i></div>
          <small class="hero-note">${tot.income ? (tot.expense <= tot.income ? `Gastou ${G.pct(ratio)} do que entrou — sobram ${G.money(tot.net)}` : `Gastou ${G.money(-tot.net)} a mais do que entrou`) : 'Lance suas receitas para ver quanto sobra'}</small>
        </section>

        <section class="quick">
          <button data-q="expense"><span class="q-ic exp">${G.icon('minus')}</span>Despesa</button>
          <button data-q="income"><span class="q-ic inc">${G.icon('plus')}</span>Receita</button>
          <button data-q="scan"><span class="q-ic ai">${G.icon('scan')}</span>Ler nota</button>
          <button data-q="transfer"><span class="q-ic tr">${G.icon('swap')}</span>Transferir</button>
        </section>

        ${pending.length ? `<section class="card">
          <div class="card-head"><h2>${G.icon('repeat', 18)} Contas fixas a confirmar</h2><span class="badge">${pending.length}</span></div>
          ${pending.slice(0, 5).map((p, i) => `<div class="pend-row">${G.catBadge(G.cat(p.r.categoryId), 36)}
            <div class="tx-main"><div class="tx-title">${G.esc(p.r.desc)}</div><div class="tx-sub"><b class="${p.r.type === 'income' ? 'pos' : ''}">${G.money(p.r.amount)}</b> · ${G.shortDate(p.date)}${p.date < G.today() ? ' · venceu' : ''}</div></div>
            <button class="icon-btn sm" data-skip="${i}" title="Pular este mês">${G.icon('x', 16)}</button>
            <button class="btn sm primary" data-ok="${i}">${p.r.type === 'income' ? 'Recebi' : 'Paguei'}</button></div>`).join('')}
        </section>` : ''}

        ${leaks.length ? `<section class="card alerts">
          <div class="card-head"><h2>${G.icon('drop', 18)} Atenção ao seu dinheiro</h2><a href="#insights" class="link">Ver análise</a></div>
          ${leaks.slice(0, 3).map((l, i) => `<button class="alert-row lvl-${l.level}" data-leak="${i}"><span class="alert-ic">${G.icon(l.icon, 18)}</span>
            <span class="alert-txt"><b>${G.esc(l.title)}</b><small>${l.text}</small></span><span class="alert-val">${G.money(l.value)}</span></button>`).join('')}
        </section>` : ''}

        <section class="card">
          <div class="card-head"><h2>Para onde foi o dinheiro</h2><a href="#insights" class="link">Detalhes</a></div>
          ${cats.length ? `<div class="mini-donut">${G.donut(cats.slice(0, 6).map((c) => ({ value: c.amount, color: G.cat(c.categoryId).color, label: G.cat(c.categoryId).name })).concat(cats.length > 6 ? [{ value: G.sum(cats.slice(6), (c) => c.amount), color: '#94A3B8', label: 'Outras' }] : []), { size: 150, thickness: 20, center: G.moneyShort(tot.expense), sub: 'no mês' })}
            ${G.hbars(cats.slice(0, 5).map((c) => ({ label: G.cat(c.categoryId).name, icon: G.cat(c.categoryId).icon, value: c.amount, color: G.cat(c.categoryId).color, onclick: 'cat:' + c.categoryId })))}</div>`
            : `<div class="empty small">${G.icon('pie', 30)}<p>Seus gastos do mês aparecem aqui, separados por categoria.</p></div>`}
        </section>

        ${budget.rows.length ? `<section class="card">
          <div class="card-head"><h2>${G.icon('target', 18)} Orçamento do mês</h2><a href="#budgets" class="link">Ajustar</a></div>
          <div class="budget-total"><span>${G.money(budget.spent)} de ${G.money(budget.limit)}</span><small class="muted">${G.pct(budget.expected)} do mês já passou</small></div>
          ${G.progress(budget.spent / budget.limit, budget.spent > budget.limit ? 'over' : budget.spent / budget.limit > budget.expected + 0.1 ? 'fast' : '')}
          ${budget.rows.slice(0, 4).map((r) => `<div class="budget-row"><span>${G.cat(r.categoryId).icon} ${G.esc(G.cat(r.categoryId).name)}</span><small class="${r.state}">${r.state === 'over' ? 'estourou' : r.state === 'fast' ? 'rápido demais' : 'no ritmo'}</small><b>${G.pct(r.ratio)}</b></div>${G.progress(r.ratio, r.state)}`).join('')}
        </section>` : ''}

        ${cards.length ? `<section class="card">
          <div class="card-head"><h2>${G.icon('card', 18)} Cartões</h2><a href="#accounts" class="link">Faturas</a></div>
          ${cards.map((a) => { const inv = G.invoice(a.id, G.currentInvoiceKey(a)); return `<button class="inv-row" data-acc="${a.id}">${G.accBadge(a, 36)}
            <span class="tx-main"><span class="tx-title">${G.esc(a.name)}</span><span class="tx-sub">Fatura de ${G.monthName(inv.key, false)} · vence ${G.shortDate(inv.due)}</span></span>
            <span class="right"><b>${G.money(inv.total)}</b>${a.limit ? `<small class="muted">${G.pct(inv.total / a.limit)} do limite</small>` : ''}</span></button>`; }).join('')}
        </section>` : ''}

        <section class="card recent">
          <div class="card-head"><h2>Últimos lançamentos</h2><a href="#tx" class="link">Ver todos</a></div>
          ${recent.length ? `<div class="flush-list">${recent.map(G.txRow).join('')}</div>` : `<div class="empty small">${G.icon('plus', 30)}<p>Toque em <b>Despesa</b> ou <b>Ler nota</b> para começar.</p></div>`}
        </section>
      </div>`;

    root.querySelector('#eye').onclick = () => { G.state.settings.hideValues = !G.state.settings.hideValues; G.save(); G.render(); };
    G.$$('[data-q]', root).forEach((b) => (b.onclick = () => (b.dataset.q === 'scan' ? G.openScan() : G.openAdd({ type: b.dataset.q }))));
    G.$$('[data-ok]', root).forEach((b) => (b.onclick = () => {
      const p = pending[b.dataset.ok];
      G.confirmRecurringFlow(p);
    }));
    G.$$('[data-skip]', root).forEach((b) => (b.onclick = () => { const p = pending[b.dataset.skip]; G.skipRecurring(p.r, p.date); G.save(); G.render(); G.toast('Pulado neste período'); }));
    G.$$('[data-leak]', root).forEach((b) => (b.onclick = () => G.openLeak(leaks[b.dataset.leak], key)));
    G.$$('[data-act^="cat:"]', root).forEach((b) => (b.onclick = () => G.openList({ categoryId: b.dataset.act.slice(4) }, key)));
    G.$$('[data-acc]', root).forEach((b) => (b.onclick = () => G.openInvoice(b.dataset.acc)));
    G.bindTxRows(root);
  };

  // confirmar conta fixa: valor pode ter mudado (a conta de luz nunca vem igual)
  G.confirmRecurringFlow = (p) => {
    const s = G.sheet(`<h3 class="sheet-title">${G.esc(p.r.desc)}</h3><p class="muted">${G.dateLabel(p.date)} · ${G.esc(G.cat(p.r.categoryId).name)}</p>
      <label class="field"><span>Valor ${p.r.type === 'income' ? 'recebido' : 'pago'}</span><input id="rv" inputmode="decimal" value="${(p.r.amount / 100).toFixed(2).replace('.', ',')}"></label>
      <label class="check"><input type="checkbox" id="rvAll"> Usar este valor nos próximos meses</label>
      <div class="row-btns"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="rvOk">Confirmar</button></div>`);
    s.el.querySelector('#rvOk').onclick = () => {
      const v = G.parseMoney(s.el.querySelector('#rv').value);
      if (!v) return;
      if (s.el.querySelector('#rvAll').checked) p.r.amount = v;
      G.confirmRecurring(p.r, p.date, v); G.save(); G.render(); s.close(); G.toast('Confirmado');
    };
  };

  // um alerta leva aos lançamentos que o causaram
  G.openLeak = (l, key) => {
    if (l.filter) G.openList(l.filter, key, l.title);
    else G.go('insights');
  };
  G.openList = (filter, key, label = null) => {
    G.view.listFilter = filter ? { ...filter, label: label || (filter.categoryId ? G.cat(filter.categoryId).name : filter.accountId ? G.acc(filter.accountId).name : 'Filtro') } : null;
    G.view.month = key || G.view.month;
    G.go('tx');
  };

  // ======================= LANÇAMENTOS =======================
  G.screens.tx = (root) => {
    const key = curMonth();
    const f = G.view.listFilter;
    let list = G.view.q ? G.state.tx.slice() : G.txInMonth(key);
    if (G.view.listType !== 'all') list = list.filter((t) => t.type === G.view.listType);
    list = G.applyFilter(list, { ...(f || {}), q: G.view.q });
    const tot = G.totals(list);
    root.innerHTML = `
      <header class="topbar"><h1>Lançamentos</h1><div class="topbar-act" id="ms"></div></header>
      <div class="search"><span>${G.icon('search', 18)}</span><input id="q" placeholder="Buscar por descrição, item, categoria ou valor" value="${G.esc(G.view.q)}">${G.view.q ? `<button class="icon-btn sm" id="qx">${G.icon('x', 16)}</button>` : ''}</div>
      <div class="chips scroll">
        ${[['all', 'Tudo'], ['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências']].map(([k, l]) => `<button class="chip ${G.view.listType === k ? 'on' : ''}" data-lt="${k}">${l}</button>`).join('')}
        <button class="chip" id="fCat">${G.icon('tag', 15)} Categoria</button><button class="chip" id="fAcc">${G.icon('wallet', 15)} Conta</button>
      </div>
      ${f ? `<div class="filter-on">${G.icon('filter', 15)} ${G.esc(f.label)} <button id="fx">${G.icon('x', 14)} limpar</button></div>` : ''}
      <div class="sum-strip">
        <div><small>Entradas</small><b class="pos">${G.money(tot.income)}</b></div>
        <div><small>Saídas</small><b class="neg">${G.money(tot.expense)}</b></div>
        <div><small>Resultado</small><b class="${tot.net >= 0 ? 'pos' : 'neg'}">${G.money(tot.net, { sign: true })}</b></div>
      </div>
      ${G.view.q ? `<p class="muted small">Buscando em todos os meses — ${list.length} resultado(s).</p>` : ''}
      <div id="list">${G.txList(list, { empty: G.view.q || f ? 'Nada encontrado com esse filtro.' : `Nenhum lançamento em ${G.monthName(key)}.` })}</div>
      <p class="hint">${G.icon('info', 14)} Toque para editar · deslize para a esquerda para apagar</p>`;
    if (!G.view.q) root.querySelector('#ms').appendChild(G.monthSwitch(key, (k) => { G.view.month = k; G.render(); }));
    const q = root.querySelector('#q');
    q.oninput = G.debounce(() => { G.view.q = q.value; G.render(); const n = G.$('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 350);
    const qx = root.querySelector('#qx'); if (qx) qx.onclick = () => { G.view.q = ''; G.render(); };
    G.$$('[data-lt]', root).forEach((b) => (b.onclick = () => { G.view.listType = b.dataset.lt; G.render(); }));
    const fx = root.querySelector('#fx'); if (fx) fx.onclick = () => { G.view.listFilter = null; G.render(); };
    root.querySelector('#fCat').onclick = () => {
      const kind = G.view.listType === 'income' ? 'income' : 'expense';
      G.pickCat(kind, f && f.categoryId, (id) => { G.view.listFilter = { categoryId: id, label: G.cat(id).name }; G.render(); });
    };
    root.querySelector('#fAcc').onclick = () => {
      const s = G.sheet(`<h3 class="sheet-title">Conta</h3><div id="ac"></div>`);
      s.el.querySelector('#ac').appendChild(G.accountChips(f && f.accountId, (id) => { G.view.listFilter = { accountId: id, label: G.acc(id).name }; s.close(); G.render(); }));
    };
    G.bindTxRows(root);
  };

  // ======================= ANÁLISES =======================
  G.screens.insights = (root) => {
    const key = curMonth(), prevKey = G.addMonths(key, -1);
    const list = G.txInMonth(key);
    const tot = G.totals(list), prev = G.monthTotals(prevKey);
    const cats = G.byCategory(list, 'expense');
    const prevCats = {}; G.byCategory(G.txInMonth(prevKey), 'expense').forEach((c) => (prevCats[c.categoryId] = c.amount));
    const incomes = G.byCategory(list, 'income');
    const leaks = G.leaks(key);
    const isCurrent = key === G.monthKey(G.today());
    const day = isCurrent ? Number(G.today().slice(8, 10)) : G.daysInMonth(key);
    const savings = tot.income ? tot.net / tot.income : null;
    const flow = G.cashflow(key, 6);
    const merchants = G.topMerchants(list, 8);
    const wd = G.byWeekday(list);
    const fixedSet = new Set(G.detectSubscriptions(key).map((x) => G.norm(x.desc)));
    const fixed = G.sum(list.filter((t) => t.type === 'expense' && (t.recurringId || fixedSet.has(G.norm(t.desc)))), (t) => t.amount);
    const variable = tot.expense - fixed;
    const budget = G.budgetStatus(key);
    const avg6 = G.sum(flow.slice(0, 5), (m) => m.expense) / Math.max(1, flow.slice(0, 5).filter((m) => m.expense).length);
    const delta = (a, b) => (b ? (a - b) / b : null);
    const dTxt = (d, invert = false) => d == null ? '' : `<span class="delta ${(d > 0) !== invert ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${G.pct(Math.abs(d))}</span>`;

    root.innerHTML = `
      <header class="topbar"><h1>Análises</h1><div class="topbar-act" id="ms"></div></header>
      <div class="kpis">
        <div class="kpi"><small>Receitas</small><b class="pos">${G.money(tot.income)}</b>${dTxt(delta(tot.income, prev.income), true)}</div>
        <div class="kpi"><small>Despesas</small><b class="neg">${G.money(tot.expense)}</b>${dTxt(delta(tot.expense, prev.expense))}</div>
        <div class="kpi"><small>Sobrou</small><b class="${tot.net >= 0 ? 'pos' : 'neg'}">${G.money(tot.net, { sign: true })}</b><span class="muted small">vs ${G.money(prev.net)} em ${G.monthAbbr(prevKey)}</span></div>
        <div class="kpi"><small>Taxa de poupança</small><b>${savings == null ? '—' : G.pct(savings)}</b><span class="muted small">${savings == null ? 'sem receitas' : savings >= 0.2 ? 'ótimo (meta: 20%)' : savings >= 0.1 ? 'razoável (meta: 20%)' : savings >= 0 ? 'apertado (meta: 20%)' : 'no vermelho'}</span></div>
      </div>

      <div class="ins-grid">
        <section class="card span2">
          <div class="card-head"><h2>${G.icon('drop', 18)} Vazamentos e alertas</h2><span class="muted small">${leaks.length ? leaks.length + ' encontrado(s)' : ''}</span></div>
          ${leaks.length ? leaks.map((l, i) => `<button class="alert-row lvl-${l.level}" data-leak="${i}"><span class="alert-ic">${G.icon(l.icon, 18)}</span>
            <span class="alert-txt"><b>${G.esc(l.title)}</b><small>${l.text}</small></span><span class="alert-val">${G.money(l.value)}</span></button>`).join('')
            : `<div class="empty small">${G.icon('check', 30)}<p>Nenhum vazamento detectado neste mês. Quanto mais meses lançados, mais esperta fica esta análise.</p></div>`}
        </section>

        <section class="card">
          <div class="card-head"><h2>Para onde foi</h2><span class="muted small">${cats.length} categorias</span></div>
          ${cats.length ? `<div class="donut-wrap">${G.donut(cats.slice(0, 8).map((c) => ({ value: c.amount, color: G.cat(c.categoryId).color, label: G.cat(c.categoryId).name })).concat(cats.length > 8 ? [{ value: G.sum(cats.slice(8), (c) => c.amount), color: '#94A3B8', label: 'Outras' }] : []), { size: 190, center: G.moneyShort(tot.expense), sub: 'em despesas' })}</div>
          <div class="rank">${cats.map((c) => { const p = prevCats[c.categoryId]; const d = delta(c.amount, p); return `<button class="rank-row" data-cat="${c.categoryId}">${G.catBadge(G.cat(c.categoryId), 34)}
            <span class="tx-main"><span class="tx-title">${G.esc(G.cat(c.categoryId).name)}</span><span class="tx-sub">${G.pct(c.amount / tot.expense, 1)} · ${c.count} lançamento(s)${budgetNote(budget, c.categoryId)}</span></span>
            <span class="right"><b>${G.money(c.amount)}</b>${d == null ? '<small class="muted">novo</small>' : dTxt(d)}</span></button>`; }).join('')}</div>`
            : `<div class="empty small">${G.icon('pie', 30)}<p>Sem despesas neste mês.</p></div>`}
        </section>

        <section class="card">
          <div class="card-head"><h2>De onde veio</h2></div>
          ${incomes.length ? G.hbars(incomes.map((c) => ({ label: G.cat(c.categoryId).name, icon: G.cat(c.categoryId).icon, value: c.amount, color: G.cat(c.categoryId).color, note: G.pct(c.amount / tot.income) + ' das receitas', onclick: 'cat:' + c.categoryId })))
            : `<div class="empty small">${G.icon('arrowUp', 30)}<p>Sem receitas neste mês.</p></div>`}
          <div class="card-head mt"><h2>Fixos × variáveis</h2></div>
          ${tot.expense ? `<div class="stack-bar big"><i style="width:${fixed / tot.expense * 100}%;background:var(--transfer)"></i><i style="width:${variable / tot.expense * 100}%;background:var(--warn)"></i></div>
            <div class="legend"><span><i class="dot" style="background:var(--transfer)"></i>Fixos e assinaturas <b>${G.money(fixed)}</b></span><span><i class="dot" style="background:var(--warn)"></i>Variáveis <b>${G.money(variable)}</b></span></div>
            <p class="muted small">${tot.income && fixed ? `Seus gastos fixos comprometem ${G.pct(fixed / tot.income)} da renda. ${fixed / tot.income > 0.5 ? 'Acima de 50% deixa pouco espaço para imprevistos.' : 'Abaixo de 50% é saudável.'}` : 'É nos variáveis que dá para cortar rápido.'}</p>` : '<p class="muted small">Sem despesas.</p>'}
        </section>

        <section class="card span2">
          <div class="card-head"><h2>Ritmo de gastos</h2><span class="legend inline"><span><i class="dot" style="background:var(--brand)"></i>${G.monthName(key, false)}</span><span><i class="dot dash"></i>${G.monthName(prevKey, false)}</span></span></div>
          ${G.paceLine(G.dailyCumulative(key), G.dailyCumulative(prevKey), { upToDay: day })}
          <p class="muted small">${isCurrent && day >= 5 && tot.expense ? `No ritmo de ${G.money(Math.round(tot.expense / day))} por dia, o mês fecha perto de ${G.money(Math.round(tot.expense / day * G.daysInMonth(key)))} em despesas.` : `Média de ${G.money(Math.round(tot.expense / Math.max(1, day)))} por dia.`}</p>
        </section>

        <section class="card span2">
          <div class="card-head"><h2>Últimos 6 meses</h2><span class="legend inline"><span><i class="dot" style="background:var(--income)"></i>Receitas</span><span><i class="dot" style="background:var(--expense)"></i>Despesas</span></span></div>
          ${G.flowBars(flow)}
          <p class="muted small">${avg6 ? `Sua média de despesas nos meses anteriores é ${G.money(Math.round(avg6))}. ${tot.expense > avg6 * 1.1 ? 'Este mês está acima dela.' : tot.expense < avg6 * 0.9 ? 'Este mês está abaixo dela.' : 'Este mês está na média.'}` : 'Com mais meses lançados, aparece a sua tendência.'}</p>
        </section>

        <section class="card">
          <div class="card-head"><h2>Onde você mais gasta</h2></div>
          ${merchants.length ? G.hbars(merchants.map((m) => ({ label: m.desc, icon: G.cat(m.categoryId).icon, value: m.amount, color: G.cat(m.categoryId).color, note: m.count > 1 ? `${m.count} vezes · média ${G.money(Math.round(m.amount / m.count))}` : '' }))) : '<p class="muted small">Sem despesas.</p>'}
        </section>

        <section class="card">
          <div class="card-head"><h2>Dia da semana</h2></div>
          ${tot.expense ? G.vbars(wd, ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], { highlight: wd.indexOf(Math.max(...wd)) }) + ((i) => `<p class="muted small">Você gasta mais ${i === 0 || i === 6 ? 'aos' : 'às'} ${G.WD[i]}s.</p>`)(wd.indexOf(Math.max(...wd))) : '<p class="muted small">Sem despesas.</p>'}
          <div class="card-head mt"><h2>Por conta / cartão</h2></div>
          ${G.byAccount(list).length ? G.hbars(G.byAccount(list).map((a) => ({ label: G.acc(a.accountId).name, value: a.amount, color: G.acc(a.accountId).color }))) : '<p class="muted small">—</p>'}
        </section>
      </div>`;
    root.querySelector('#ms').appendChild(G.monthSwitch(key, (k) => { G.view.month = k; G.render(); }));
    G.$$('[data-leak]', root).forEach((b) => (b.onclick = () => G.openLeak(leaks[b.dataset.leak], key)));
    G.$$('[data-cat]', root).forEach((b) => (b.onclick = () => G.openList({ categoryId: b.dataset.cat }, key)));
    G.$$('[data-act^="cat:"]', root).forEach((b) => (b.onclick = () => G.openList({ categoryId: b.dataset.act.slice(4) }, key)));
  };
  function budgetNote(budget, cid) {
    const r = budget.rows.find((x) => x.categoryId === cid);
    return r ? ` · ${G.pct(r.ratio)} do orçamento` : '';
  }
})(window.G);
