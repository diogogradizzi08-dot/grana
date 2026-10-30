/* Telas do "Mais": contas e cartões, orçamento, metas, contas fixas, categorias,
   importar extrato e ajustes (IA, backup, tema). */
(function (G) {
  // ======================= MAIS =======================
  G.screens.more = (root) => {
    const items = [
      ['accounts', 'wallet', 'Contas e cartões', 'Saldos, faturas e limites'],
      ['budgets', 'target', 'Orçamento', 'Limite por categoria no mês'],
      ['goals', 'piggy', 'Metas e caixinhas', 'Guardar para um objetivo'],
      ['recurring', 'repeat', 'Contas fixas', 'Salário, aluguel, assinaturas'],
      ['categories', 'tag', 'Categorias', 'Criar, editar e organizar'],
      ['import', 'upload', 'Importar extrato', 'Arquivo OFX ou CSV do banco'],
      ['settings', 'settings', 'Ajustes', 'Leitura com IA, backup, tema'],
    ];
    root.innerHTML = `<header class="topbar"><h1>Mais</h1></header>
      <div class="more-grid">${items.map(([r, ic, t, s]) => `<a href="#${r}" class="more-item card"><span class="more-ic">${G.icon(ic, 22)}</span><span><b>${t}</b><small>${s}</small></span>${G.icon('right', 18, 'chev')}</a>`).join('')}</div>
      ${backupNudge()}`;
  };
  function backupNudge() {
    const lb = G.state.settings.lastBackup;
    const days = lb ? Math.floor((Date.now() - lb) / 864e5) : null;
    if (G.state.tx.length < 5 || (days != null && days < 30)) return '';
    return `<div class="warn-box mt">${G.icon('alert', 18)}<span>${days == null ? 'Você ainda não fez nenhuma cópia de segurança.' : `Última cópia de segurança há ${days} dias.`} Seus dados ficam só neste aparelho. <a href="#settings">Fazer backup</a></span></div>`;
  }
  G.backupNudge = backupNudge;

  // ======================= CONTAS =======================
  G.screens.accounts = (root) => {
    const accs = G.activeAccounts();
    const normal = accs.filter((a) => a.type !== 'credit'), cards = accs.filter((a) => a.type === 'credit');
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Contas e cartões</h1><button class="btn sm primary" id="newAcc">${G.icon('plus', 16)} Nova</button></header>
      <div class="hero card slim"><div class="hero-top"><span>Total disponível</span></div><div class="hero-value">${G.money(G.totalBalance())}</div></div>
      <div class="sec-label">Contas</div>
      <div class="acc-grid">${normal.map((a) => { const b = G.accountBalance(a.id, G.today()); return `<button class="acc-card card" data-acc="${a.id}" style="--c:${a.color}">
        ${G.accBadge(a, 40)}<span class="acc-name">${G.esc(a.name)}<small>${G.ACCOUNT_TYPES[a.type].label}</small></span><b class="${b < 0 ? 'neg' : ''}">${G.money(b)}</b></button>`; }).join('') || '<p class="muted">Nenhuma conta.</p>'}</div>
      <div class="sec-label">Cartões de crédito</div>
      <div class="acc-grid">${cards.map((a) => { const inv = G.invoice(a.id, G.currentInvoiceKey(a)); const used = -Math.min(0, G.accountBalance(a.id)); return `<button class="acc-card card cc" data-card="${a.id}" style="--c:${a.color}">
        <div class="cc-top">${G.icon('card', 22)}<span>${G.esc(a.name)}</span></div>
        <div class="cc-mid"><small>Fatura de ${G.monthName(inv.key, false)}</small><b>${G.money(inv.total)}</b><small>fecha ${G.shortDate(inv.closing)} · vence ${G.shortDate(inv.due)}</small></div>
        ${a.limit ? `<div class="cc-limit">${G.progress(used / a.limit, used / a.limit > 0.8 ? 'over' : '')}<small>${G.money(Math.max(0, a.limit - used))} de limite livre</small></div>` : ''}</button>`; }).join('') || `<button class="card add-card" id="newCard">${G.icon('plus', 22)} Adicionar cartão de crédito</button>`}</div>
      <p class="hint">${G.icon('info', 14)} Compras no cartão entram na fatura pelo dia de fechamento. Para pagar a fatura, use “Pagar fatura” — é uma transferência da conta para o cartão.</p>`;
    root.querySelector('#newAcc').onclick = () => G.editAccount(null);
    const nc = root.querySelector('#newCard'); if (nc) nc.onclick = () => G.editAccount(null, 'credit');
    G.$$('[data-acc]', root).forEach((b) => (b.onclick = () => G.accountDetail(b.dataset.acc)));
    G.$$('[data-card]', root).forEach((b) => (b.onclick = () => G.openInvoice(b.dataset.card)));
  };

  G.accountDetail = (id) => {
    const a = G.acc(id);
    const list = G.state.tx.filter((t) => t.accountId === id || t.toAccountId === id).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 60);
    const s = G.sheet(`<div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">${G.esc(a.name)}</h3><button class="icon-btn" id="ed">${G.icon('edit')}</button></div>
      <div class="hero card slim" style="--brand:${a.color}"><div class="hero-top"><span>Saldo hoje</span></div><div class="hero-value">${G.money(G.accountBalance(id, G.today()))}</div>
      <div class="hero-sub">Saldo inicial ${G.money(a.initial || 0)} · <a href="#" id="adj">corrigir saldo</a></div></div>
      <div class="sec-label">Movimentações recentes</div><div class="flush-list card flush">${list.map(G.txRow).join('') || '<div class="empty small">Sem movimentações.</div>'}</div>`, { wide: true });
    s.el.querySelector('#ed').onclick = () => { s.close(); G.editAccount(a); };
    s.el.querySelector('#adj').onclick = (e) => { e.preventDefault(); s.close(); G.adjustBalance(a); };
    G.bindTxRows(s.el);
  };

  // corrigir saldo: lança um ajuste em vez de mexer no histórico
  G.adjustBalance = (a) => {
    const cur = G.accountBalance(a.id, G.today());
    const s = G.sheet(`<h3 class="sheet-title">Corrigir saldo — ${G.esc(a.name)}</h3><p class="muted">Hoje o app calcula ${G.money(cur, { force: true })}. Quanto tem de verdade?</p>
      <label class="field"><span>Saldo real</span><input id="nb" inputmode="decimal" value="${(cur / 100).toFixed(2).replace('.', ',')}"></label>
      <p class="muted small">A diferença corrige o saldo inicial da conta — não aparece como gasto nem receita nas análises.</p>
      <div class="row-btns"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Corrigir</button></div>`);
    s.el.querySelector('#ok').onclick = () => {
      const v = G.parseMoney(s.el.querySelector('#nb').value), diff = v - cur;
      if (diff) { a.initial = (a.initial || 0) + diff; G.save(); G.render(); G.toast('Saldo corrigido'); }
      s.close();
    };
  };

  G.editAccount = (acc, presetType = 'checking') => {
    const a = acc ? { ...acc } : { id: 'a' + G.uid(), name: '', type: presetType, color: G.PALETTE[Math.floor(Math.random() * 16)], initial: 0, closingDay: 3, dueDay: 10, limit: 0 };
    const s = G.sheet(`<h3 class="sheet-title">${acc ? 'Editar conta' : 'Nova conta'}</h3>
      <div class="field"><span>Tipo</span><div class="chips">${Object.entries(G.ACCOUNT_TYPES).map(([k, v]) => `<button class="chip ${a.type === k ? 'on' : ''}" data-ty="${k}">${G.icon(v.icon, 16)}${v.label}</button>`).join('')}</div></div>
      <label class="field"><span>Nome</span><input id="an" value="${G.esc(a.name)}" placeholder="Ex.: Nubank, Itaú, Carteira"></label>
      <label class="field" id="initF"><span>Saldo atual</span><input id="ai" inputmode="decimal" value="${a.initial ? (a.initial / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"></label>
      <div id="ccF" class="two">
        <label class="field"><span>Dia do fechamento</span><input id="cd" type="number" min="1" max="31" value="${a.closingDay || 3}"></label>
        <label class="field"><span>Dia do vencimento</span><input id="dd" type="number" min="1" max="31" value="${a.dueDay || 10}"></label>
        <label class="field" style="grid-column:1/-1"><span>Limite</span><input id="lm" inputmode="decimal" value="${a.limit ? (a.limit / 100).toFixed(2).replace('.', ',') : ''}" placeholder="opcional"></label>
      </div>
      <div class="field"><span>Cor</span><div class="color-grid">${G.PALETTE.map((p) => `<button class="color ${p === a.color ? 'on' : ''}" style="background:${p}" data-c="${p}"></button>`).join('')}</div></div>
      <div class="row-btns">${acc ? `<button class="btn ghost danger-text" id="arch">${G.icon('trash', 18)} Arquivar</button>` : ''}<button class="btn primary" id="ok">Salvar</button></div>`);
    const el = s.el;
    const paint = () => { el.querySelector('#ccF').classList.toggle('hidden', a.type !== 'credit'); el.querySelector('#initF').classList.toggle('hidden', a.type === 'credit' || !!acc); };
    paint();
    G.$$('[data-ty]', el).forEach((b) => (b.onclick = () => { a.type = b.dataset.ty; G.$$('[data-ty]', el).forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
    G.$$('.color', el).forEach((b) => (b.onclick = () => { a.color = b.dataset.c; G.$$('.color', el).forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('#ok').onclick = () => {
      a.name = el.querySelector('#an').value.trim();
      if (!a.name) { el.querySelector('#an').focus(); return; }
      if (!acc) a.initial = a.type === 'credit' ? 0 : G.parseMoney(el.querySelector('#ai').value);
      a.closingDay = Math.max(1, Math.min(31, Number(el.querySelector('#cd').value) || 3));
      a.dueDay = Math.max(1, Math.min(31, Number(el.querySelector('#dd').value) || 10));
      a.limit = G.parseMoney(el.querySelector('#lm').value);
      if (acc) Object.assign(G.state.accounts.find((x) => x.id === acc.id), a); else G.state.accounts.push(a);
      G.save(); G.render(); s.close(); G.toast(acc ? 'Conta atualizada' : 'Conta criada');
    };
    const ar = el.querySelector('#arch');
    if (ar) ar.onclick = async () => {
      s.close();
      if (await G.confirm('Arquivar conta?', 'Ela some das listas, mas os lançamentos antigos continuam nas análises.', { ok: 'Arquivar', danger: true })) {
        G.state.accounts.find((x) => x.id === acc.id).archived = true; G.save(); G.render();
      }
    };
  };

  // fatura do cartão, mês a mês
  G.openInvoice = (accId, key = null) => {
    const a = G.acc(accId);
    key = key || G.currentInvoiceKey(a);
    const inv = G.invoice(accId, key);
    const cats = G.byCategory(inv.items, 'expense');
    const s = G.sheet(`<div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">${G.esc(a.name)}</h3><button class="icon-btn" id="ed">${G.icon('edit')}</button></div>
      <div class="month-switch center-row"><button class="icon-btn" data-m="-1">${G.icon('left')}</button><span class="month-label">Fatura de ${G.monthName(key)}</span><button class="icon-btn" data-m="1">${G.icon('right')}</button></div>
      <div class="hero card slim" style="--brand:${a.color}"><div class="hero-top"><span>Total da fatura</span><span>vence ${G.shortDate(inv.due)}</span></div><div class="hero-value">${G.money(inv.total)}</div>
        <div class="hero-sub">Fecha em ${G.shortDate(inv.closing)} · ${inv.items.length} compra(s)</div></div>
      ${inv.total > 0 ? `<button class="btn primary big wide-btn" id="pay">${G.icon('check', 18)} Pagar fatura</button>` : ''}
      ${cats.length ? `<div class="sec-label">Por categoria</div>${G.hbars(cats.slice(0, 6).map((c) => ({ label: G.cat(c.categoryId).name, icon: G.cat(c.categoryId).icon, value: c.amount, color: G.cat(c.categoryId).color })))}` : ''}
      <div class="sec-label">Compras</div><div class="card flush">${inv.items.sort((x, y) => y.date.localeCompare(x.date)).map(G.txRow).join('') || '<div class="empty small">Nenhuma compra nesta fatura.</div>'}</div>`, { wide: true });
    G.$$('[data-m]', s.el).forEach((b) => (b.onclick = () => { s.close(); setTimeout(() => G.openInvoice(accId, G.addMonths(key, Number(b.dataset.m))), 50); }));
    s.el.querySelector('#ed').onclick = () => { s.close(); G.editAccount(a); };
    const pay = s.el.querySelector('#pay');
    if (pay) pay.onclick = () => { s.close(); G.openAdd({ type: 'transfer', preset: { amount: inv.total, toAccountId: accId, desc: `Fatura ${a.name} ${G.monthName(key, false)}`, accountId: (G.activeAccounts().find((x) => x.type === 'checking') || {}).id, date: G.today() } }); };
    G.bindTxRows(s.el);
  };

  // ======================= ORÇAMENTO =======================
  G.screens.budgets = (root) => {
    const key = G.view.month || G.monthKey(G.today());
    const st = G.budgetStatus(key);
    // sugestão: média dos últimos 3 meses arredondada para cima
    const avg = {};
    const past = [1, 2, 3].map((i) => G.txInMonth(G.addMonths(key, -i))).filter((l) => l.length);
    for (const l of past) for (const e of G.byCategory(l, 'expense')) avg[e.categoryId] = (avg[e.categoryId] || 0) + e.amount / past.length;
    const spent = {}; G.byCategory(G.txInMonth(key), 'expense').forEach((e) => (spent[e.categoryId] = e.amount));
    const cats = G.cats('expense').slice().sort((a, b) => (G.state.budgets[b.id] ? 1 : 0) - (G.state.budgets[a.id] ? 1 : 0) || (avg[b.id] || 0) - (avg[a.id] || 0));
    const income = G.monthTotals(G.addMonths(key, -1)).income || G.monthTotals(key).income;
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Orçamento</h1><div class="topbar-act" id="ms"></div></header>
      <div class="hero card slim"><div class="hero-top"><span>Gasto nas categorias com limite</span><span>${G.pct(st.expected)} do mês</span></div>
        <div class="hero-value">${G.money(st.spent)} <small>de ${G.money(st.limit)}</small></div>${G.progress(st.limit ? st.spent / st.limit : 0)}
        ${income && st.limit ? `<div class="hero-sub">O orçamento total equivale a ${G.pct(st.limit / income)} da sua renda.</div>` : ''}</div>
      ${Object.keys(avg).length ? `<button class="btn ghost wide-btn" id="auto">${G.icon('sparkles', 18)} Sugerir limites pela minha média</button>` : ''}
      <div class="card flush">${cats.map((c) => { const lim = G.state.budgets[c.id] || 0, sp = spent[c.id] || 0, r = st.rows.find((x) => x.categoryId === c.id); return `<button class="budget-item" data-c="${c.id}">
        ${G.catBadge(c, 36)}<span class="tx-main"><span class="tx-title">${G.esc(c.name)}</span><span class="tx-sub">${lim ? `${G.money(sp)} de ${G.money(lim)}${r && r.projected > lim && r.state !== 'over' ? ` · projeção ${G.money(r.projected)}` : ''}` : avg[c.id] ? `média ${G.money(Math.round(avg[c.id]))}/mês · sem limite` : 'sem limite'}</span>
        ${lim ? G.progress(sp / lim, r ? r.state : '') : ''}</span><b class="${r ? r.state : ''}">${lim ? G.pct(sp / lim) : G.icon('plus', 18)}</b></button>`; }).join('')}</div>`;
    root.querySelector('#ms').appendChild(G.monthSwitch(key, (k) => { G.view.month = k; G.render(); }));
    G.$$('[data-c]', root).forEach((b) => (b.onclick = () => {
      const c = G.cat(b.dataset.c), cur = G.state.budgets[c.id] || 0;
      const s = G.sheet(`<h3 class="sheet-title">${c.icon} Limite para ${G.esc(c.name)}</h3>
        ${avg[c.id] ? `<p class="muted">Sua média nos últimos 3 meses: <b>${G.money(Math.round(avg[c.id]))}</b></p>` : ''}
        <label class="field"><span>Limite por mês</span><input id="bv" inputmode="decimal" value="${cur ? (cur / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"></label>
        <div class="row-btns">${cur ? '<button class="btn ghost danger-text" id="rm">Remover limite</button>' : ''}<button class="btn primary" id="ok">Salvar</button></div>`);
      setTimeout(() => s.el.querySelector('#bv').focus(), 250);
      s.el.querySelector('#ok').onclick = () => { const v = G.parseMoney(s.el.querySelector('#bv').value); if (v) G.state.budgets[c.id] = v; else delete G.state.budgets[c.id]; G.save(); G.render(); s.close(); };
      const rm = s.el.querySelector('#rm'); if (rm) rm.onclick = () => { delete G.state.budgets[c.id]; G.save(); G.render(); s.close(); };
    }));
    const au = root.querySelector('#auto');
    if (au) au.onclick = async () => {
      if (!(await G.confirm('Sugerir limites?', 'Cada categoria em que você gastou nos últimos 3 meses ganha um limite igual à média, arredondado para cima. Dá para ajustar depois.', { ok: 'Sugerir' }))) return;
      for (const [cid, v] of Object.entries(avg)) if (v >= 2000) G.state.budgets[cid] = Math.ceil(v / 5000) * 5000;
      G.save(); G.render(); G.toast('Limites sugeridos');
    };
  };

  // ======================= METAS =======================
  G.screens.goals = (root) => {
    const goals = G.state.goals;
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Metas e caixinhas</h1><button class="btn sm primary" id="ng">${G.icon('plus', 16)} Nova</button></header>
      ${goals.length ? `<div class="acc-grid">${goals.map((g) => { const r = g.target ? g.saved / g.target : 0; const months = g.deadline ? Math.max(1, (G.parseDate(g.deadline) - new Date()) / (864e5 * 30.4)) : null; const per = months ? Math.ceil(Math.max(0, g.target - g.saved) / months) : null; return `<div class="goal card" style="--c:${g.color}">
        <div class="goal-top"><span class="goal-ic">${g.icon}</span><b>${G.esc(g.name)}</b><button class="icon-btn sm" data-ed="${g.id}">${G.icon('edit', 16)}</button></div>
        <div class="goal-ring">${G.donut([{ value: Math.min(g.saved, g.target), color: g.color, label: 'guardado' }, { value: Math.max(0, g.target - g.saved), color: 'transparent', label: 'falta' }], { size: 120, thickness: 12, center: G.pct(r), sub: '' })}</div>
        <div class="goal-num">${G.money(g.saved)} <small>de ${G.money(g.target)}</small></div>
        <small class="muted">${r >= 1 ? 'Meta alcançada! 🎉' : per ? `Guarde ${G.money(per)}/mês até ${G.shortDate(g.deadline)}/${g.deadline.slice(2, 4)}` : 'Sem prazo definido'}</small>
        <div class="row-btns"><button class="btn sm ghost" data-wd="${g.id}">${G.icon('minus', 16)} Retirar</button><button class="btn sm primary" data-dep="${g.id}">${G.icon('plus', 16)} Guardar</button></div></div>`; }).join('')}</div>`
        : `<div class="empty">${G.icon('piggy', 40)}<p>Crie uma caixinha para a reserva de emergência, a viagem ou o carro novo. O app mostra quanto guardar por mês para chegar no prazo.</p></div>`}`;
    root.querySelector('#ng').onclick = () => editGoal(null);
    G.$$('[data-ed]', root).forEach((b) => (b.onclick = () => editGoal(goals.find((g) => g.id === b.dataset.ed))));
    const move = (id, sign) => {
      const g = goals.find((x) => x.id === id);
      const s = G.sheet(`<h3 class="sheet-title">${sign > 0 ? 'Guardar em' : 'Retirar de'} ${G.esc(g.name)}</h3>
        <label class="field"><span>Valor</span><input id="v" inputmode="decimal" placeholder="0,00"></label>
        <label class="check"><input type="checkbox" id="mk" checked> Registrar como ${sign > 0 ? 'saída' : 'entrada'} numa conta</label><div id="ac"></div>
        <div class="row-btns"><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="ok">Confirmar</button></div>`);
      let accId = (G.activeAccounts().find((a) => a.type !== 'credit') || {}).id;
      s.el.querySelector('#ac').appendChild(G.accountChips(accId, (id2) => (accId = id2), { types: ['checking', 'savings', 'cash', 'invest'] }));
      setTimeout(() => s.el.querySelector('#v').focus(), 250);
      s.el.querySelector('#ok').onclick = () => {
        const v = G.parseMoney(s.el.querySelector('#v').value); if (!v) return;
        g.saved = Math.max(0, g.saved + sign * v);
        if (s.el.querySelector('#mk').checked && accId) G.addTx({ type: sign > 0 ? 'expense' : 'income', amount: v, date: G.today(), desc: `${sign > 0 ? 'Guardado em' : 'Retirado de'} ${g.name}`, categoryId: sign > 0 ? 'investir' : 'outras_receitas', accountId: accId, goalId: g.id });
        G.save(); G.render(); s.close(); G.toast(sign > 0 ? 'Guardado!' : 'Retirado');
      };
    };
    G.$$('[data-dep]', root).forEach((b) => (b.onclick = () => move(b.dataset.dep, 1)));
    G.$$('[data-wd]', root).forEach((b) => (b.onclick = () => move(b.dataset.wd, -1)));
  };
  function editGoal(goal) {
    const g = goal ? { ...goal } : { id: 'g' + G.uid(), name: '', target: 0, saved: 0, deadline: '', icon: '🎯', color: '#0E7C66' };
    const icons = ['🎯', '🛟', '✈️', '🚗', '🏠', '🎓', '💍', '👶', '💻', '🏖️', '🩺', '🎁'];
    const s = G.sheet(`<h3 class="sheet-title">${goal ? 'Editar meta' : 'Nova meta'}</h3>
      <label class="field"><span>Nome</span><input id="gn" value="${G.esc(g.name)}" placeholder="Ex.: Reserva de emergência"></label>
      <div class="two"><label class="field"><span>Quanto quer juntar</span><input id="gt" inputmode="decimal" value="${g.target ? (g.target / 100).toFixed(2).replace('.', ',') : ''}"></label>
      <label class="field"><span>Já tem guardado</span><input id="gs" inputmode="decimal" value="${g.saved ? (g.saved / 100).toFixed(2).replace('.', ',') : ''}"></label></div>
      <label class="field"><span>Até quando (opcional)</span><input id="gd" type="date" value="${g.deadline}"></label>
      <div class="field"><span>Ícone</span><div class="emoji-grid">${icons.map((e) => `<button class="emoji ${e === g.icon ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><span>Cor</span><div class="color-grid">${G.PALETTE.map((p) => `<button class="color ${p === g.color ? 'on' : ''}" style="background:${p}" data-c="${p}"></button>`).join('')}</div></div>
      <p class="muted small">Dica: a reserva de emergência ideal cobre de 3 a 6 meses dos seus gastos fixos.</p>
      <div class="row-btns">${goal ? `<button class="btn ghost danger-text" id="del">${G.icon('trash', 18)} Apagar</button>` : ''}<button class="btn primary" id="ok">Salvar</button></div>`);
    G.$$('.emoji', s.el).forEach((b) => (b.onclick = () => { g.icon = b.textContent; G.$$('.emoji', s.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    G.$$('.color', s.el).forEach((b) => (b.onclick = () => { g.color = b.dataset.c; G.$$('.color', s.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    s.el.querySelector('#ok').onclick = () => {
      g.name = s.el.querySelector('#gn').value.trim(); g.target = G.parseMoney(s.el.querySelector('#gt').value);
      g.saved = G.parseMoney(s.el.querySelector('#gs').value); g.deadline = s.el.querySelector('#gd').value;
      if (!g.name || !g.target) { G.toast('Preencha nome e valor', { icon: 'alert' }); return; }
      if (goal) Object.assign(G.state.goals.find((x) => x.id === goal.id), g); else G.state.goals.push(g);
      G.save(); G.render(); s.close();
    };
    const d = s.el.querySelector('#del');
    if (d) d.onclick = () => { G.snapshot(); G.state.goals = G.state.goals.filter((x) => x.id !== goal.id); G.save(); G.render(); s.close(); G.toast('Meta apagada', { undo: true }); };
  }

  // ======================= CONTAS FIXAS =======================
  G.screens.recurring = (root) => {
    const rs = G.state.recurring;
    const exp = rs.filter((r) => r.type === 'expense' && !r.paused), inc = rs.filter((r) => r.type === 'income' && !r.paused);
    const mOut = G.sum(exp, G.monthlyEquivalent), mIn = G.sum(inc, G.monthlyEquivalent);
    const subs = G.detectSubscriptions(G.monthKey(G.today())).filter((x) => !rs.some((r) => G.norm(r.desc) === G.norm(x.desc)));
    const row = (r) => { const next = G.occurrences(r, G.today(), G.addMonths(G.monthKey(G.today()), 13) + '-28').find((d) => !(r.done || {})[d]); return `<button class="budget-item" data-r="${r.id}">${G.catBadge(G.cat(r.categoryId), 36)}
      <span class="tx-main"><span class="tx-title">${G.esc(r.desc)}${r.paused ? ' <span class="pill">pausada</span>' : ''}</span><span class="tx-sub">${({ monthly: 'Todo mês, dia ' + r.day, weekly: 'Toda semana', yearly: 'Todo ano' })[r.freq]}${next ? ' · próxima ' + G.shortDate(next) : ''}</span></span>
      <b class="${r.type === 'income' ? 'pos' : ''}">${G.money(r.amount)}</b></button>`; };
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Contas fixas</h1><button class="btn sm primary" id="nr">${G.icon('plus', 16)} Nova</button></header>
      <div class="kpis two-col"><div class="kpi"><small>Entra todo mês</small><b class="pos">${G.money(mIn)}</b></div><div class="kpi"><small>Sai todo mês</small><b class="neg">${G.money(mOut)}</b><span class="muted small">${G.money(mOut * 12)} por ano</span></div></div>
      ${subs.length ? `<div class="card"><div class="card-head"><h2>${G.icon('sparkles', 18)} Encontrei gastos que se repetem</h2></div><p class="muted small">Transformar em conta fixa ajuda a prever o mês.</p>
        ${subs.map((x, i) => `<div class="pend-row">${G.catBadge(G.cat(x.categoryId), 32)}<div class="tx-main"><div class="tx-title">${G.esc(x.desc)}</div><div class="tx-sub">${G.money(x.amount)} por mês</div></div><button class="btn sm ghost" data-sub="${i}">Tornar fixa</button></div>`).join('')}</div>` : ''}
      ${inc.length ? `<div class="sec-label">Receitas</div><div class="card flush">${inc.map(row).join('')}</div>` : ''}
      <div class="sec-label">Despesas</div><div class="card flush">${exp.map(row).join('') || '<div class="empty small">Cadastre aluguel, internet, academia, streaming… Elas aparecem no Início para confirmar com um toque.</div>'}</div>
      ${rs.some((r) => r.paused) ? `<div class="sec-label">Pausadas</div><div class="card flush">${rs.filter((r) => r.paused).map(row).join('')}</div>` : ''}`;
    root.querySelector('#nr').onclick = () => editRecurring(null);
    G.$$('[data-r]', root).forEach((b) => (b.onclick = () => editRecurring(rs.find((r) => r.id === b.dataset.r))));
    G.$$('[data-sub]', root).forEach((b) => (b.onclick = () => { const x = subs[b.dataset.sub]; editRecurring(null, { desc: x.desc, amount: x.amount, categoryId: x.categoryId }); }));
  };
  G.editRecurring = (rec) => editRecurring(rec);
  function editRecurring(rec, preset = {}) {
    const r = rec ? { ...rec } : { id: G.uid(), type: 'expense', amount: 0, desc: '', categoryId: 'contas', accountId: (G.activeAccounts()[0] || {}).id, freq: 'monthly', day: Number(G.today().slice(8, 10)), start: G.today(), done: {}, ...preset };
    const s = G.sheet(`<h3 class="sheet-title">${rec ? 'Editar conta fixa' : 'Nova conta fixa'}</h3>
      <div class="seg wide" id="rt"><button data-t="expense">Despesa</button><button data-t="income">Receita</button></div>
      <label class="field"><span>Descrição</span><input id="rd" value="${G.esc(r.desc)}" placeholder="Ex.: Aluguel, Netflix, Salário"></label>
      <div class="two"><label class="field"><span>Valor</span><input id="ra" inputmode="decimal" value="${r.amount ? (r.amount / 100).toFixed(2).replace('.', ',') : ''}"></label>
      <label class="field"><span>Dia</span><input id="rday" type="number" min="1" max="31" value="${r.day}"></label></div>
      <div class="field"><span>Frequência</span><div class="chips" id="rf">${[['monthly', 'Mensal'], ['weekly', 'Semanal'], ['yearly', 'Anual']].map(([k, l]) => `<button class="chip ${r.freq === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><span>Categoria</span><div id="rc"></div></div>
      <div class="field"><span>Conta</span><div id="racc"></div></div>
      <div class="row-btns">${rec ? `<button class="btn ghost" id="pause">${r.paused ? 'Reativar' : 'Pausar'}</button><button class="btn ghost danger-text" id="del">${G.icon('trash', 18)}</button>` : ''}<button class="btn primary" id="ok">Salvar</button></div>`, { wide: true });
    const el = s.el;
    const paint = () => {
      G.$$('#rt button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === r.type));
      const c = el.querySelector('#rc'); c.innerHTML = ''; c.appendChild(G.catGrid(r.type, r.categoryId, (id) => (r.categoryId = id), { compact: true }));
    };
    paint();
    G.$$('#rt button', el).forEach((b) => (b.onclick = () => { r.type = b.dataset.t; r.categoryId = r.type === 'income' ? 'salario' : 'contas'; paint(); }));
    G.$$('#rf .chip', el).forEach((b) => (b.onclick = () => { r.freq = b.dataset.f; G.$$('#rf .chip', el).forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('#racc').appendChild(G.accountChips(r.accountId, (id) => (r.accountId = id)));
    el.querySelector('#rd').oninput = (e) => { const g = G.suggestCategory(e.target.value, r.type); if (g && !rec) { r.categoryId = g; paint(); } };
    el.querySelector('#ok').onclick = () => {
      r.desc = el.querySelector('#rd').value.trim(); r.amount = G.parseMoney(el.querySelector('#ra').value);
      r.day = Math.max(1, Math.min(31, Number(el.querySelector('#rday').value) || 1));
      if (!r.desc || !r.amount) { G.toast('Preencha descrição e valor', { icon: 'alert' }); return; }
      if (!rec) {
        // começa no próximo vencimento (ou hoje, se o dia já chegou neste mês e ainda não foi pago)
        const mk = G.monthKey(G.today());
        r.start = r.freq === 'weekly' ? G.today() : G.dateInMonth(mk, r.day) >= G.addDays(G.today(), -3) ? G.dateInMonth(mk, r.day) : G.dateInMonth(G.addMonths(mk, 1), r.day);
        G.state.recurring.push(r);
      } else Object.assign(G.state.recurring.find((x) => x.id === rec.id), r);
      G.save(); G.render(); s.close(); G.toast('Conta fixa salva');
    };
    if (rec) {
      el.querySelector('#pause').onclick = () => { G.state.recurring.find((x) => x.id === rec.id).paused = !rec.paused; G.save(); G.render(); s.close(); };
      el.querySelector('#del').onclick = () => { G.snapshot(); G.state.recurring = G.state.recurring.filter((x) => x.id !== rec.id); G.save(); G.render(); s.close(); G.toast('Conta fixa apagada (os lançamentos já feitos ficam)', { undo: true }); };
    }
  }

  // ======================= CATEGORIAS =======================
  G.screens.categories = (root) => {
    const sec = (kind, title) => `<div class="sec-label">${title}</div><div class="cat-list card flush">${G.cats(kind).map((c) => `<button class="budget-item" data-c="${c.id}">${G.catBadge(c, 36)}<span class="tx-main"><span class="tx-title">${G.esc(c.name)}</span></span>${G.icon('edit', 16, 'muted')}</button>`).join('')}
      <button class="budget-item" data-new="${kind}"><span class="cat-badge" style="--c:var(--brand);width:36px;height:36px">${G.icon('plus', 18)}</span><span class="tx-main"><span class="tx-title">Nova categoria</span></span></button></div>`;
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Categorias</h1></header>
      <div class="two-sec">${sec('expense', 'Despesas')}${sec('income', 'Receitas')}</div>`;
    G.$$('[data-c]', root).forEach((b) => (b.onclick = () => G.editCategory(G.cat(b.dataset.c))));
    G.$$('[data-new]', root).forEach((b) => (b.onclick = () => G.editCategory(null, b.dataset.new)));
  };

  // ======================= IMPORTAR EXTRATO =======================
  G.screens.import = (root) => {
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Importar extrato</h1></header>
      <div class="card"><p>Baixe o extrato no app ou site do seu banco em <b>OFX</b> (o melhor, quase todo banco oferece) ou <b>CSV</b> e escolha o arquivo aqui. O Grana classifica cada linha sozinho e ignora o que já foi lançado.</p>
        <label class="btn primary big wide-btn">${G.icon('upload', 20)} Escolher arquivo OFX ou CSV<input type="file" accept=".ofx,.csv,.txt,.qfx" hidden id="imp"></label>
        <p class="muted small">Também dá para importar a fatura do cartão em OFX — escolha a conta do cartão na próxima tela.</p></div>`;
    root.querySelector('#imp').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const buf = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(buf);
      if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
      const rows = /<OFX>|OFXHEADER/i.test(text) ? parseOFX(text) : parseCSV(text);
      if (!rows.length) { G.toast('Não encontrei lançamentos nesse arquivo', { icon: 'alert' }); return; }
      reviewImport(rows);
    };
  };
  function parseOFX(text) {
    const out = [];
    const blocks = text.split(/<STMTTRN>/i).slice(1);
    for (const b of blocks) {
      const tag = (t) => { const m = b.match(new RegExp('<' + t + '>([^<\\r\\n]*)', 'i')); return m ? m[1].trim() : ''; };
      const amt = parseFloat(tag('TRNAMT').replace(',', '.'));
      const d = tag('DTPOSTED');
      if (!d || isNaN(amt)) continue;
      out.push({ date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), amount: Math.round(amt * 100), desc: (tag('MEMO') || tag('NAME') || 'Lançamento').replace(/\s+/g, ' '), fitid: tag('FITID') });
    }
    return out;
  }
  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
    const head = split(lines[0]).map((h) => G.norm(h));
    const find = (re) => head.findIndex((h) => re.test(h));
    let di = find(/data|date/), vi = find(/valor|amount|quantia|montante/), ti = find(/descri|historico|lancamento|title|memo|estabelecimento/);
    const start = di >= 0 ? 1 : 0;
    if (di < 0) { di = 0; vi = 2; ti = 1; }
    const out = [];
    for (const l of lines.slice(start)) {
      const c = split(l);
      const ds = c[di] || '';
      let date = null;
      let m = ds.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
      if (m) date = (m[3].length === 2 ? '20' + m[3] : m[3]) + '-' + m[2] + '-' + m[1];
      else if ((m = ds.match(/(\d{4})-(\d{2})-(\d{2})/))) date = m[0];
      const raw = (c[vi] || '').replace(/R\$\s?/, '');
      // "1.234,56" (BR) ou "1234.56" (exportação em inglês)
      const amount = /,\d{1,2}$/.test(raw.trim()) ? G.parseMoney(raw) * (raw.includes('-') ? -1 : 1) : Math.round(parseFloat(raw) * 100);
      if (!date || !amount || isNaN(amount)) continue;
      out.push({ date, amount, desc: (c[ti] || 'Lançamento').replace(/\s+/g, ' ') });
    }
    return out;
  }
  function reviewImport(rows) {
    let accountId = (G.activeAccounts()[0] || {}).id;
    let invert = false;
    const existing = new Set(G.state.tx.map((t) => t.fitid).filter(Boolean));
    const dupKey = (r, acc) => G.state.tx.some((t) => t.accountId === acc && t.date === r.date && Math.abs(t.amount) === Math.abs(r.amount) && (t.type === 'expense') === (r.amount < 0));
    const s = G.sheet(`<div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">${rows.length} lançamentos no arquivo</h3><span style="width:40px"></span></div>
      <div class="sec-label">Para qual conta?</div><div id="ia"></div>
      <label class="check"><input type="checkbox" id="inv"> Os sinais estão trocados (compras aparecem positivas — comum em CSV de fatura de cartão)</label>
      <div id="isum"></div><div class="card flush" id="ilist"></div>
      <div class="add-foot"><button class="btn primary big" id="iok">Importar</button></div>`, { wide: true, full: true });
    const el = s.el;
    let prepared = [];
    const paint = () => {
      const acc = G.acc(accountId);
      prepared = rows.map((r) => {
        const amt = invert || acc.type === 'credit' && rows.filter((x) => x.amount > 0).length > rows.length / 2 ? -r.amount : r.amount;
        const type = amt < 0 ? 'expense' : 'income';
        const dup = (r.fitid && existing.has(r.fitid)) || dupKey({ ...r, amount: amt }, accountId);
        return { ...r, amt, type, categoryId: G.suggestCategory(r.desc, type) || (type === 'income' ? 'outras_receitas' : 'outros'), dup, on: !dup };
      });
      draw();
    };
    const draw = () => {
      const on = prepared.filter((p) => p.on);
      el.querySelector('#isum').innerHTML = `<p class="muted small">${on.length} para importar · ${prepared.filter((p) => p.dup).length} já existiam (desmarcados) · toque na categoria para trocar.</p>`;
      el.querySelector('#ilist').innerHTML = prepared.map((p, i) => `<div class="item-row ${p.on ? '' : 'off'}"><input type="checkbox" data-on="${i}" ${p.on ? 'checked' : ''}>
        <button class="item-cat" data-cat="${i}">${G.catBadge(G.cat(p.categoryId), 32)}</button>
        <div class="item-main"><span class="tx-title">${G.esc(p.desc)}</span><small>${G.shortDate(p.date)} · ${G.esc(G.cat(p.categoryId).name)}${p.dup ? ' · <b>já lançado?</b>' : ''}</small></div>
        <b class="${p.type === 'income' ? 'pos' : 'neg'}">${G.money(Math.abs(p.amt), { force: true })}</b></div>`).join('');
      G.$$('[data-on]', el).forEach((c) => (c.onchange = () => { prepared[c.dataset.on].on = c.checked; draw(); }));
      G.$$('[data-cat]', el).forEach((b) => (b.onclick = () => { const p = prepared[b.dataset.cat]; G.pickCat(p.type, p.categoryId, (id) => {
        // mesma descrição recebe a mesma categoria na lista inteira
        prepared.forEach((x) => { if (G.norm(x.desc) === G.norm(p.desc) && x.type === p.type) x.categoryId = id; }); draw(); }); }));
    };
    el.querySelector('#ia').appendChild(G.accountChips(accountId, (id) => { accountId = id; paint(); }));
    el.querySelector('#inv').onchange = (e) => { invert = e.target.checked; paint(); };
    paint();
    el.querySelector('#iok').onclick = () => {
      const on = prepared.filter((p) => p.on);
      on.forEach((p) => G.addTx({ type: p.type, amount: Math.abs(p.amt), date: p.date, desc: p.desc, categoryId: p.categoryId, accountId, source: 'import', fitid: p.fitid }));
      G.save(); G.render(); s.close(); G.toast(`${on.length} lançamentos importados`);
      G.go('tx');
    };
  }

  // ======================= AJUSTES =======================
  G.screens.settings = (root) => {
    const st = G.state.settings;
    const lb = st.lastBackup ? new Date(st.lastBackup).toLocaleDateString('pt-BR') : 'nunca';
    root.innerHTML = `<header class="topbar"><a href="#more" class="icon-btn">${G.icon('left')}</a><h1>Ajustes</h1></header>
      <div class="settings">
      <section class="card"><div class="card-head"><h2>${G.icon('sparkles', 18)} Leitura inteligente</h2><span class="pill ${st.geminiKey ? 'ai' : ''}">${st.geminiKey ? 'IA ativada' : 'leitor básico'}</span></div>
        <p class="muted small">Com a IA do Google (grátis), o app lê notas de mercado item por item, contracheques, NF-e, boletos e PDFs, e classifica tudo. Sem ela, usa um leitor básico no próprio aparelho.</p>
        <button class="btn ${st.geminiKey ? 'ghost' : 'primary'} wide-btn" id="ai">${st.geminiKey ? 'Trocar ou remover a chave' : 'Ativar leitura com IA (grátis)'}</button></section>

      <section class="card"><div class="card-head"><h2>${G.icon('lock', 18)} Seus dados</h2></div>
        <p class="muted small">Tudo fica guardado só neste aparelho — nada vai para servidor. Por isso, faça cópias de segurança. Último backup: <b>${lb}</b>.</p>
        <div class="row-btns wrap"><button class="btn primary" id="bk">${G.icon('download', 18)} Fazer backup</button><label class="btn ghost">${G.icon('upload', 18)} Restaurar backup<input type="file" accept=".json,application/json" hidden id="rs"></label></div>
        <p class="muted small">Para usar no celular <b>e</b> no tablet: faça o backup num, envie o arquivo para você mesmo (WhatsApp, e-mail, Drive) e restaure no outro.</p>
        <button class="btn ghost wide-btn" id="csv">${G.icon('file', 18)} Exportar planilha (CSV)</button></section>

      <section class="card"><div class="card-head"><h2>Preferências</h2></div>
        <label class="field"><span>Seu nome</span><input id="nm" value="${G.esc(st.name)}" placeholder="Para a saudação"></label>
        <div class="field"><span>Tema</span><div class="seg wide" id="th">${[['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']].map(([k, l]) => `<button data-t="${k}" class="${st.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <label class="check"><input type="checkbox" id="hv" ${st.hideValues ? 'checked' : ''}> Esconder valores ao abrir (privacidade em público)</label></section>

      <section class="card"><div class="card-head"><h2>${G.icon('repeat', 18)} Atualização</h2><span class="pill">versão ${G.VERSION}</span></div>
        <p class="muted small">O app procura versões novas sozinho quando você o abre com internet e mostra um aviso para atualizar. Seus lançamentos não são apagados ao atualizar.</p>
        <button class="btn ghost wide-btn" id="upd">${G.icon('repeat', 18)} Procurar atualização</button></section>
      <section class="card"><div class="card-head"><h2>Zona de perigo</h2></div>
        <button class="btn ghost danger-text wide-btn" id="demo">Carregar dados de exemplo</button>
        <button class="btn ghost danger-text wide-btn" id="wipe">${G.icon('trash', 18)} Apagar todos os dados</button></section>
      <p class="muted small center">Grana · versão ${G.VERSION}</p></div>`;
    root.querySelector('#ai').onclick = () => G.openAiSetup();
    root.querySelector('#upd').onclick = () => G.checkUpdate({ manual: true });
    root.querySelector('#bk').onclick = doBackup;
    root.querySelector('#rs').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!(await G.confirm('Restaurar backup?', 'Os dados atuais deste aparelho serão substituídos pelos do arquivo.', { ok: 'Restaurar', danger: true }))) return;
      try { G.importBackup(await f.text()); G.applyTheme(); G.render(); G.toast('Backup restaurado'); } catch (er) { G.toast(er.message, { icon: 'alert' }); }
    };
    root.querySelector('#csv').onclick = exportCSV;
    root.querySelector('#nm').onchange = (e) => { st.name = e.target.value.trim(); G.save(); };
    G.$$('#th button', root).forEach((b) => (b.onclick = () => { st.theme = b.dataset.t; G.save(); G.applyTheme(); G.render(); }));
    root.querySelector('#hv').onchange = (e) => { st.hideValues = e.target.checked; G.save(); };
    root.querySelector('#demo').onclick = async () => { if (await G.confirm('Carregar exemplo?', 'Substitui os dados atuais por 3 meses de lançamentos fictícios, para você explorar o app. Faça backup antes se já tiver dados.', { ok: 'Carregar', danger: true })) { G.loadDemo(); G.render(); G.toast('Exemplo carregado'); G.go('home'); } };
    root.querySelector('#wipe').onclick = async () => {
      if (!(await G.confirm('Apagar tudo?', 'Todos os lançamentos, contas, metas e ajustes deste aparelho serão apagados. Não dá para desfazer.', { ok: 'Apagar tudo', danger: true }))) return;
      const key = st.geminiKey; G.state = G.freshState(); G.state.settings.geminiKey = key; G.state.settings.onboarded = true; G.save(); G.go('home'); G.toast('Dados apagados');
    };
  };

  async function doBackup() {
    const data = G.exportBackup();
    const name = `grana-backup-${G.today()}.json`;
    const file = new File([data], name, { type: 'application/json' });
    G.state.settings.lastBackup = Date.now(); G.save();
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Backup do Grana' }); G.render(); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    G.toast('Backup salvo em Downloads'); G.render();
  }
  function exportCSV() {
    const q = (s) => '"' + String(s == null ? '' : s).replace(/"/g, '""') + '"';
    const rows = [['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Observação'].map(q).join(';')];
    for (const t of G.state.tx.slice().sort((a, b) => a.date.localeCompare(b.date))) {
      const v = ((t.type === 'expense' ? -t.amount : t.amount) / 100).toFixed(2).replace('.', ',');
      const cat = t.type === 'transfer' ? 'Transferência → ' + G.acc(t.toAccountId).name : t.splits ? t.splits.map((s) => G.cat(s.categoryId).name).join(' + ') : G.cat(t.categoryId).name;
      rows.push([G.shortDate(t.date) + '/' + t.date.slice(0, 4), { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }[t.type], t.desc, cat, G.acc(t.accountId).name, v, t.notes].map(q).join(';'));
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' })); a.download = `grana-${G.today()}.csv`; a.click();
    G.toast('Planilha exportada');
  }

  G.openAiSetup = () => {
    const st = G.state.settings;
    const s = G.sheet(`<h3 class="sheet-title">${G.icon('sparkles', 20)} Leitura com IA — grátis</h3>
      <ol class="steps">
        <li>Abra <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener"><b>aistudio.google.com/apikey</b></a> e entre com sua conta Google.</li>
        <li>Toque em <b>Create API key</b> (Criar chave de API) e copie a chave.</li>
        <li>Cole aqui embaixo e toque em <b>Testar e salvar</b>.</li>
      </ol>
      <label class="field"><span>Chave da API do Google AI</span><input id="k" value="${G.esc(st.geminiKey)}" placeholder="AIza..." autocomplete="off" spellcheck="false"></label>
      <div class="err-box hidden" id="kErr">${G.icon('alert', 18)}<span></span></div>
      <div class="info-box">${G.icon('info', 18)}<span>O plano gratuito do Google não cobra nada e não pede cartão — dá para ler dezenas de notas por dia. A chave fica só neste aparelho e não vai no backup. A imagem do documento é enviada ao Google apenas para ser lida; no plano gratuito o Google pode usar esse conteúdo para melhorar os serviços dele. Se preferir total privacidade, use o leitor básico.</span></div>
      <div class="row-btns">${st.geminiKey ? '<button class="btn ghost danger-text" id="rm">Remover chave</button>' : '<button class="btn ghost" data-close>Agora não</button>'}<button class="btn primary" id="ok">Testar e salvar</button></div>`);
    const errBox = s.el.querySelector('#kErr');
    s.el.querySelector('#k').oninput = () => errBox.classList.add('hidden');
    s.el.querySelector('#ok').onclick = async () => {
      const raw = s.el.querySelector('#k').value;
      if (!G.cleanKey(raw)) return;
      const b = s.el.querySelector('#ok'); b.disabled = true; b.textContent = 'Testando…';
      errBox.classList.add('hidden');
      try {
        const r = await G.testGeminiKey(raw);
        st.geminiKey = r.key; st.aiModel = r.model; G.save(); s.close(); G.render();
        G.toast(r.warn || 'IA ativada! Já pode ler notas', { icon: r.warn ? 'alert' : 'sparkles' });
      } catch (e) {
        b.disabled = false; b.textContent = 'Testar de novo';
        // o motivo fica escrito na tela (o aviso rápido sumia antes de dar para ler)
        errBox.querySelector('span').innerHTML = '<b>A chave não funcionou.</b> ' + G.esc(e.message);
        errBox.classList.remove('hidden');
      }
    };
    const rm = s.el.querySelector('#rm'); if (rm) rm.onclick = () => { st.geminiKey = ''; G.save(); s.close(); G.render(); G.toast('Chave removida'); };
  };
})(window.G);
