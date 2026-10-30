/* Peças de interface: folha que sobe de baixo, aviso com "desfazer", confirmação,
   linha de lançamento com deslizar-para-apagar e seletores. */
(function (G) {
  // ---------- folha (bottom sheet no celular, janela central no tablet) ----------
  const stack = [];
  G.sheet = (html, { onClose, wide = false, full = false } = {}) => {
    const wrap = G.h(`<div class="sheet-wrap"><div class="sheet-scrim"></div>
      <div class="sheet ${wide ? 'wide' : ''} ${full ? 'full' : ''}" role="dialog"><div class="sheet-grab"></div><div class="sheet-body">${html}</div></div></div>`);
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const api = {
      el: wrap.querySelector('.sheet-body'),
      close: () => {
        if (!wrap.isConnected) return;
        wrap.classList.remove('open');
        setTimeout(() => wrap.remove(), 260);
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        onClose && onClose();
      },
    };
    wrap.querySelector('.sheet-scrim').onclick = api.close;
    G.$$('[data-close]', wrap).forEach((b) => (b.onclick = api.close));
    // arrastar a alça para baixo fecha (celular)
    const grab = wrap.querySelector('.sheet-grab'), sh = wrap.querySelector('.sheet');
    let y0 = null;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => { if (y0 != null) sh.style.transform = `translateY(${Math.max(0, e.clientY - y0)}px)`; });
    grab.addEventListener('pointerup', (e) => { if (y0 != null && e.clientY - y0 > 90) api.close(); sh.style.transform = ''; y0 = null; });
    stack.push(api);
    return api;
  };
  G.closeTopSheet = () => { const s = stack[stack.length - 1]; if (s) { s.close(); return true; } return false; };

  // ---------- aviso ----------
  let toastTimer;
  G.toast = (msg, { undo = false, icon = 'check' } = {}) => {
    G.$$('.toast').forEach((t) => t.remove());
    const t = G.h(`<div class="toast">${G.icon(icon, 18)}<span>${G.esc(msg)}</span>${undo ? '<button class="toast-undo">Desfazer</button>' : ''}</div>`);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    if (undo) t.querySelector('.toast-undo').onclick = () => { if (G.undo()) { G.toast('Desfeito', { icon: 'repeat' }); G.render(); } };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, undo ? 5500 : 2600);
  };

  G.confirm = (title, text, { ok = 'Confirmar', danger = false } = {}) => new Promise((resolve) => {
    let answered = false;
    const s = G.sheet(`<h3 class="sheet-title">${G.esc(title)}</h3><p class="muted">${text}</p>
      <div class="row-btns"><button class="btn ghost" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${G.esc(ok)}</button></div>`,
    { onClose: () => { if (!answered) resolve(false); } });
    s.el.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); s.close(); };
    s.el.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); s.close(); };
  });

  // ---------- peças visuais ----------
  G.catBadge = (cat, size = 40) => `<span class="cat-badge" style="--c:${cat.color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.48)}px">${cat.icon}</span>`;
  G.accBadge = (acc, size = 40) => `<span class="cat-badge acc" style="--c:${acc.color};width:${size}px;height:${size}px">${G.icon((G.ACCOUNT_TYPES[acc.type] || {}).icon || 'wallet', Math.round(size * 0.5))}</span>`;

  G.txRow = (t) => {
    let badge, title, sub, cls;
    if (t.type === 'transfer') {
      badge = `<span class="cat-badge" style="--c:var(--transfer);width:40px;height:40px">${G.icon('swap', 20)}</span>`;
      title = t.desc || 'Transferência';
      sub = `${G.esc(G.acc(t.accountId).name)} → ${G.esc(G.acc(t.toAccountId).name)}`;
      cls = 'transfer';
    } else {
      const c = t.splits && t.splits.length > 1 ? { icon: '🧾', color: '#64748B', name: `Dividido em ${t.splits.length} categorias` } : G.cat(t.categoryId);
      badge = G.catBadge(c);
      title = t.desc || c.name;
      sub = `${G.esc(c.name)} · ${G.esc(G.acc(t.accountId).name)}`;
      cls = t.type;
    }
    const tags = [];
    if (t.pending) tags.push(`<span class="pill ${t.date < G.today() ? 'late' : 'due'}">${t.date < G.today() ? 'atrasado' : t.type === 'income' ? 'a receber' : 'a pagar'}</span>`);
    if (t.installment) tags.push(`<span class="pill">${t.installment.n}/${t.installment.total}</span>`);
    if (t.recurringId) tags.push(`<span class="pill">${G.icon('repeat', 11)}</span>`);
    if (t.source === 'scan') tags.push(`<span class="pill">${G.icon('sparkles', 11)}</span>`);
    const sign = t.type === 'expense' ? '−' : t.type === 'income' ? '+' : '';
    return `<div class="tx-row" data-id="${t.id}">
      <div class="tx-del">${G.icon('trash', 20)}<span>Apagar</span></div>
      <div class="tx-inner">${badge}
        <div class="tx-main"><div class="tx-title">${G.esc(title)} ${tags.join('')}</div><div class="tx-sub">${sub}</div></div>
        <div class="tx-amt ${cls}">${sign}${G.money(t.amount, { abs: true })}</div></div></div>`;
  };

  // lista agrupada por dia, com total do dia
  G.txList = (list, { empty = 'Nenhum lançamento por aqui.' } = {}) => {
    if (!list.length) return `<div class="empty">${G.icon('list', 34)}<p>${empty}</p></div>`;
    const days = G.groupBy(list.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), (t) => t.date);
    return Object.entries(days).map(([d, arr]) => {
      const tot = G.totals(arr);
      return `<div class="day-group"><div class="day-head"><span>${G.dateLabel(d)}</span><span class="${tot.net >= 0 ? 'pos' : 'neg'}">${tot.income || tot.expense ? G.money(tot.net, { sign: true }) : ''}</span></div>
        <div class="card flush">${arr.map(G.txRow).join('')}</div></div>`;
    }).join('');
  };

  // deslizar para a esquerda apaga (com desfazer); tocar edita
  G.bindTxRows = (root) => {
    G.$$('.tx-row', root).forEach((row) => {
      const inner = row.querySelector('.tx-inner');
      let x0 = null, y0 = 0, dx = 0, swiping = false;
      inner.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; dx = 0; swiping = false; });
      inner.addEventListener('pointermove', (e) => {
        if (x0 == null) return;
        const mx = e.clientX - x0, my = e.clientY - y0;
        if (!swiping && Math.abs(mx) > 12 && Math.abs(mx) > Math.abs(my) * 1.4) { swiping = true; inner.setPointerCapture(e.pointerId); }
        if (swiping) { dx = Math.min(0, mx); inner.style.transform = `translateX(${dx}px)`; row.classList.toggle('arm', dx < -90); }
      });
      const end = () => {
        if (x0 == null) return;
        if (swiping && dx < -90) {
          inner.style.transform = 'translateX(-110%)';
          setTimeout(() => G.deleteTx(row.dataset.id), 160);
        } else if (!swiping) G.openTx(row.dataset.id);
        else inner.style.transform = '';
        row.classList.remove('arm');
        x0 = null;
      };
      inner.addEventListener('pointerup', end);
      inner.addEventListener('pointercancel', () => { inner.style.transform = ''; x0 = null; });
    });
  };

  G.deleteTx = (id) => {
    const t = G.state.tx.find((x) => x.id === id);
    if (!t) return;
    G.snapshot();
    G.removeTx(id);
    // a recorrência volta a ficar pendente
    if (t.recurringId) { const r = G.state.recurring.find((x) => x.id === t.recurringId); if (r && r.done) for (const k in r.done) if (r.done[k] === id) delete r.done[k]; }
    G.save(); G.render();
    G.toast('Lançamento apagado', { undo: true, icon: 'trash' });
  };

  // ---------- seletor de mês ----------
  G.monthSwitch = (key, onChange) => {
    const el = G.h(`<div class="month-switch"><button class="icon-btn" data-m="-1" aria-label="Mês anterior">${G.icon('left')}</button>
      <button class="month-label">${G.cap(G.monthName(key))}</button><button class="icon-btn" data-m="1" aria-label="Próximo mês">${G.icon('right')}</button></div>`);
    G.$$('[data-m]', el).forEach((b) => (b.onclick = () => onChange(G.addMonths(key, Number(b.dataset.m)))));
    el.querySelector('.month-label').onclick = () => onChange(G.monthKey(G.today()));
    return el;
  };

  // ---------- grade de categorias ----------
  G.catGrid = (kind, selected, onPick, { compact = false } = {}) => {
    const el = G.h(`<div class="cat-grid ${compact ? 'compact' : ''}">${G.catsByUse(kind).map((c) => `
      <button class="cat-opt ${c.id === selected ? 'on' : ''}" data-id="${c.id}" style="--c:${c.color}"><span class="cat-opt-ic">${c.icon}</span><span class="cat-opt-name">${G.esc(c.name)}</span></button>`).join('')}
      <button class="cat-opt add" data-new>${G.icon('plus', 20)}<span class="cat-opt-name">Nova</span></button></div>`);
    G.$$('.cat-opt[data-id]', el).forEach((b) => (b.onclick = () => {
      G.$$('.cat-opt', el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); G.vibrate(); onPick(b.dataset.id);
    }));
    el.querySelector('[data-new]').onclick = () => G.editCategory(null, kind, (c) => onPick(c.id, true));
    return el;
  };

  G.accountChips = (selected, onPick, { exclude = null, types = null } = {}) => {
    const accs = G.activeAccounts().filter((a) => a.id !== exclude && (!types || types.includes(a.type)));
    const el = G.h(`<div class="chips">${accs.map((a) => `<button class="chip ${a.id === selected ? 'on' : ''}" data-id="${a.id}" style="--c:${a.color}">
      ${G.icon((G.ACCOUNT_TYPES[a.type] || {}).icon || 'wallet', 16)}${G.esc(a.name)}</button>`).join('')}</div>`);
    G.$$('.chip', el).forEach((b) => (b.onclick = () => { G.$$('.chip', el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); onPick(b.dataset.id); }));
    return el;
  };

  // ---------- editar / criar categoria ----------
  G.editCategory = (cat, kind, onDone) => {
    const c = cat ? { ...cat } : { id: 'c' + G.uid(), name: '', kind, icon: kind === 'income' ? '💰' : '📦', color: G.PALETTE[Math.floor(Math.random() * G.PALETTE.length)] };
    const s = G.sheet(`<h3 class="sheet-title">${cat ? 'Editar categoria' : 'Nova categoria'}</h3>
      <div class="cat-preview"></div>
      <label class="field"><span>Nome</span><input id="cn" value="${G.esc(c.name)}" maxlength="32" placeholder="Ex.: Academia"></label>
      <div class="field"><span>Ícone</span><div class="emoji-grid">${G.EMOJIS.map((e) => `<button class="emoji ${e === c.icon ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <div class="field"><span>Cor</span><div class="color-grid">${G.PALETTE.map((p) => `<button class="color ${p === c.color ? 'on' : ''}" style="background:${p}" data-c="${p}"></button>`).join('')}</div></div>
      <div class="row-btns">${cat ? `<button class="btn ghost danger-text" data-del>${G.icon('trash', 18)} Arquivar</button>` : ''}<button class="btn primary" data-ok>Salvar</button></div>`);
    const prev = () => (s.el.querySelector('.cat-preview').innerHTML = `${G.catBadge(c, 56)}<strong>${G.esc(c.name || 'Nome da categoria')}</strong>`);
    prev();
    const nm = s.el.querySelector('#cn');
    nm.oninput = () => { c.name = nm.value; prev(); };
    G.$$('.emoji', s.el).forEach((b) => (b.onclick = () => { G.$$('.emoji', s.el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); c.icon = b.textContent; prev(); }));
    G.$$('.color', s.el).forEach((b) => (b.onclick = () => { G.$$('.color', s.el).forEach((x) => x.classList.remove('on')); b.classList.add('on'); c.color = b.dataset.c; prev(); }));
    s.el.querySelector('[data-ok]').onclick = () => {
      if (!c.name.trim()) { nm.focus(); return; }
      c.name = c.name.trim();
      if (cat) Object.assign(G.state.categories.find((x) => x.id === cat.id), c); else G.state.categories.push(c);
      G.save(); s.close(); onDone && onDone(c); G.render();
    };
    const del = s.el.querySelector('[data-del]');
    if (del) del.onclick = () => { G.state.categories.find((x) => x.id === cat.id).archived = true; G.save(); s.close(); G.render(); G.toast('Categoria arquivada — os lançamentos antigos continuam com ela'); };
    if (!cat) setTimeout(() => nm.focus(), 300);
  };
})(window.G);
