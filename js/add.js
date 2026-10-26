/* Lançar e editar: o gesto mais repetido do app. Valor no teclado próprio,
   descrição que lembra a categoria, categorias mais usadas primeiro. */
(function (G) {
  G.openTx = (id) => {
    const t = G.state.tx.find((x) => x.id === id);
    if (t) G.openAdd({ edit: t });
  };

  G.openAdd = ({ type = 'expense', edit = null, preset = {} } = {}) => {
    const isEdit = !!edit;
    const f = edit ? JSON.parse(JSON.stringify(edit)) : {
      type, amount: 0, desc: '', categoryId: null, accountId: G.state.settings.lastAccount || (G.activeAccounts()[0] || {}).id,
      toAccountId: null, date: G.today(), notes: '', ...preset,
    };
    let installments = 1, repeat = 'none', catTouched = isEdit || !!f.categoryId, moreOpen = !!(f.notes);

    const s = G.sheet(`
      <div class="add-head">
        <button class="icon-btn" data-close aria-label="Fechar">${G.icon('x')}</button>
        <div class="seg" id="seg">
          <button data-t="expense">Despesa</button><button data-t="income">Receita</button><button data-t="transfer">Transferência</button>
        </div>
        ${isEdit ? `<button class="icon-btn" id="dup" title="Duplicar">${G.icon('copy')}</button><button class="icon-btn danger-text" id="del" title="Apagar">${G.icon('trash')}</button>` : '<span style="width:40px"></span>'}
      </div>
      <div class="add-cols">
        <div class="add-left">
          <div class="amount-box" id="amtBox"><span class="cur">R$</span><span id="amt">0,00</span></div>
          <div class="keypad" id="keypad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((k) => `<button data-k="${k}">${k === '⌫' ? G.icon('left', 22) : k}</button>`).join('')}</div>
        </div>
        <div class="add-right">
          <div class="desc-wrap"><input id="desc" class="desc-input" placeholder="Descrição (ex.: Padaria, Uber, Salário)" autocomplete="off" maxlength="80" value="${G.esc(f.desc)}">
            <div class="suggest" id="suggest"></div></div>
          <div id="catSec"><div class="sec-label">Categoria <span class="muted" id="catHint"></span></div><div id="cats"></div></div>
          <div class="sec-label" id="accLabel">Conta</div><div id="accs"></div>
          <div id="toSec" class="hidden"><div class="sec-label">Para</div><div id="toAccs"></div></div>
          <div class="sec-label">Data</div>
          <div class="chips" id="dates"><button class="chip" data-d="0">Hoje</button><button class="chip" data-d="-1">Ontem</button>
            <label class="chip date-chip">${G.icon('calendar', 16)}<span id="dateTxt"></span><input type="date" id="dateIn"></label></div>
          ${f.splits && f.splits.length ? `<div class="sec-label">Itens da nota</div><div class="split-list">${f.splits.map((sp) => `<div class="split-line">${G.catBadge(G.cat(sp.categoryId), 28)}<span>${G.esc(G.cat(sp.categoryId).name)}</span><b>${G.money(sp.amount)}</b></div>`).join('')}</div>` : ''}
          <button class="more-toggle" id="moreBtn">${G.icon('down', 18)} Mais opções</button>
          <div id="more" class="${moreOpen ? '' : 'hidden'}">
            <label class="field"><span>Observação</span><textarea id="notes" rows="2" placeholder="Opcional">${G.esc(f.notes || '')}</textarea></label>
            ${isEdit ? '' : `<div class="field" id="instSec"><span>Parcelado no cartão?</span>
              <div class="stepper"><button data-s="-1">${G.icon('minus', 18)}</button><b id="instN">À vista</b><button data-s="1">${G.icon('plus', 18)}</button></div>
              <small class="muted" id="instTxt"></small></div>
            <div class="field"><span>Repetir</span><div class="chips" id="rep">
              <button class="chip on" data-r="none">Não</button><button class="chip" data-r="monthly">Todo mês</button><button class="chip" data-r="weekly">Toda semana</button><button class="chip" data-r="yearly">Todo ano</button></div>
              <small class="muted">Contas fixas (aluguel, salário, assinaturas) entram como previstas e você confirma com um toque.</small></div>`}
          </div>
        </div>
      </div>
      <div class="add-foot">
        ${isEdit ? '' : `<button class="btn ghost" id="saveNew">${G.icon('plus', 18)} Salvar e novo</button>`}
        <button class="btn primary big" id="save">${isEdit ? 'Salvar alterações' : 'Salvar'}</button>
      </div>`, { wide: true, full: true });

    const el = s.el;
    const $ = (q) => el.querySelector(q);

    // ---------- tipo ----------
    const paintType = () => {
      G.$$('#seg button', el).forEach((b) => b.classList.toggle('on', b.dataset.t === f.type));
      el.dataset.type = f.type;
      $('#catSec').classList.toggle('hidden', f.type === 'transfer');
      $('#toSec').classList.toggle('hidden', f.type !== 'transfer');
      $('#accLabel').textContent = f.type === 'transfer' ? 'De' : f.type === 'income' ? 'Entrou em' : 'Saiu de';
      const inst = $('#instSec'); if (inst) inst.classList.toggle('hidden', f.type !== 'expense');
      renderCats(); renderAccs();
    };
    G.$$('#seg button', el).forEach((b) => (b.onclick = () => {
      if (f.type === b.dataset.t) return;
      f.type = b.dataset.t;
      if (!catTouched || G.cat(f.categoryId).kind !== f.type) { f.categoryId = null; catTouched = false; autoCat(); }
      paintType();
    }));

    // ---------- valor (centavos digitados da direita para a esquerda, como no banco) ----------
    const paintAmt = () => { $('#amt').textContent = G.money(f.amount, { force: true, abs: true }).replace('R$', '').trim(); $('#amtBox').classList.toggle('zero', !f.amount); };
    G.$$('#keypad button', el).forEach((b) => (b.onclick = () => {
      const k = b.dataset.k; G.vibrate(8);
      let v = String(f.amount);
      if (k === '⌫') v = v.slice(0, -1) || '0';
      else if (v.length < 11) v = v === '0' ? k.replace(/^0+/, '') || '0' : v + k;
      f.amount = parseInt(v, 10) || 0; paintAmt(); paintInst();
    }));
    // teclado físico (tablet com teclado / PC)
    const onKey = (e) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      if (/^\d$/.test(e.key)) { const b = el.querySelector(`[data-k="${e.key}"]`); b && b.click(); }
      else if (e.key === 'Backspace') el.querySelector('[data-k="⌫"]').click();
      else if (e.key === 'Enter') $('#save').click();
    };
    document.addEventListener('keydown', onKey);
    const origClose = s.close; s.close = () => { document.removeEventListener('keydown', onKey); origClose(); };
    G.$$('[data-close]', el).forEach((b) => (b.onclick = s.close));

    // ---------- descrição: sugere categoria e lembra lançamentos parecidos ----------
    const desc = $('#desc');
    const autoCat = () => {
      if (catTouched || f.type === 'transfer') return;
      const sug = G.suggestCategory(f.desc, f.type);
      if (sug && sug !== f.categoryId) { f.categoryId = sug; renderCats(); $('#catHint').textContent = '· sugerida'; }
    };
    desc.oninput = () => {
      f.desc = desc.value; autoCat();
      const list = G.descSuggestions(f.desc, f.type).filter((x) => G.norm(x.desc) !== G.norm(f.desc));
      $('#suggest').innerHTML = list.map((x, i) => `<button data-i="${i}">${G.catBadge(G.cat(x.categoryId), 26)}<span>${G.esc(x.desc)}</span><small>${G.money(x.amount)}</small></button>`).join('');
      G.$$('#suggest button', el).forEach((b) => (b.onclick = () => {
        const x = list[b.dataset.i];
        f.desc = x.desc; desc.value = x.desc; f.categoryId = x.categoryId; catTouched = true;
        if (!f.amount) { f.amount = x.amount; paintAmt(); }
        if (x.accountId) f.accountId = x.accountId;
        $('#suggest').innerHTML = ''; renderCats(); renderAccs();
      }));
    };
    desc.onblur = () => setTimeout(() => ($('#suggest').innerHTML = ''), 200);

    // ---------- categoria ----------
    let showAll = false;
    const renderCats = () => {
      if (f.type === 'transfer') return;
      const box = $('#cats'); box.innerHTML = '';
      const grid = G.catGrid(f.type, f.categoryId, (id, created) => { f.categoryId = id; catTouched = true; $('#catHint').textContent = ''; if (created) renderCats(); });
      if (!showAll) {
        // as 7 mais usadas + a selecionada sempre visível
        const opts = G.$$('.cat-opt[data-id]', grid);
        opts.forEach((o, i) => { if (i >= 7 && o.dataset.id !== f.categoryId) o.classList.add('hidden'); });
        const hidden = opts.filter((o) => o.classList.contains('hidden')).length;
        if (hidden) {
          const more = G.h(`<button class="cat-opt add">${G.icon('grid', 20)}<span class="cat-opt-name">+${hidden}</span></button>`);
          more.onclick = () => { showAll = true; renderCats(); };
          grid.insertBefore(more, grid.lastElementChild);
          grid.lastElementChild.classList.add('hidden');
        }
      }
      box.appendChild(grid);
    };

    // ---------- contas ----------
    const renderAccs = () => {
      const a = $('#accs'); a.innerHTML = '';
      a.appendChild(G.accountChips(f.accountId, (id) => { f.accountId = id; if (f.toAccountId === id) f.toAccountId = null; renderAccs(); }));
      if (f.type === 'transfer') {
        const b = $('#toAccs'); b.innerHTML = '';
        b.appendChild(G.accountChips(f.toAccountId, (id) => (f.toAccountId = id), { exclude: f.accountId }));
      }
    };

    // ---------- data ----------
    const paintDate = () => {
      const t = G.today();
      G.$$('#dates [data-d]', el).forEach((b) => b.classList.toggle('on', f.date === G.addDays(t, Number(b.dataset.d))));
      const other = f.date !== t && f.date !== G.addDays(t, -1);
      $('.date-chip').classList.toggle('on', other);
      $('#dateTxt').textContent = other ? G.shortDate(f.date) + (f.date.slice(0, 4) !== t.slice(0, 4) ? '/' + f.date.slice(2, 4) : '') : 'Outra data';
      $('#dateIn').value = f.date;
    };
    G.$$('#dates [data-d]', el).forEach((b) => (b.onclick = () => { f.date = G.addDays(G.today(), Number(b.dataset.d)); paintDate(); }));
    $('#dateIn').onchange = (e) => { if (e.target.value) { f.date = e.target.value; paintDate(); } };
    $('.date-chip').onclick = (e) => { const i = $('#dateIn'); if (e.target !== i && i.showPicker) { try { i.showPicker(); } catch (er) { } } };

    // ---------- mais opções ----------
    $('#moreBtn').onclick = () => { moreOpen = !moreOpen; $('#more').classList.toggle('hidden', !moreOpen); $('#moreBtn').classList.toggle('open', moreOpen); };
    const paintInst = () => {
      if (!$('#instN')) return;
      $('#instN').textContent = installments === 1 ? 'À vista' : installments + 'x';
      $('#instTxt').textContent = installments > 1 && f.amount ? `${installments} parcelas de ${G.money(Math.floor(f.amount / installments), { force: true })} — uma em cada mês, a partir da data escolhida.` : '';
    };
    G.$$('[data-s]', el).forEach((b) => (b.onclick = () => { installments = Math.max(1, Math.min(48, installments + Number(b.dataset.s))); if (installments > 1) setRepeat('none'); paintInst(); }));
    const setRepeat = (r) => { repeat = r; G.$$('#rep .chip', el).forEach((x) => x.classList.toggle('on', x.dataset.r === r)); };
    G.$$('#rep .chip', el).forEach((b) => (b.onclick = () => { setRepeat(b.dataset.r); if (repeat !== 'none') { installments = 1; paintInst(); } }));

    // ---------- salvar ----------
    const validate = () => {
      if (!f.amount) { $('#amtBox').classList.add('shake'); setTimeout(() => $('#amtBox').classList.remove('shake'), 400); return false; }
      if (f.type === 'transfer' && !f.toAccountId) { G.toast('Escolha a conta de destino', { icon: 'alert' }); return false; }
      if (!f.accountId) { G.toast('Crie uma conta primeiro (Mais → Contas)', { icon: 'alert' }); return false; }
      if (f.type !== 'transfer' && !f.categoryId) f.categoryId = f.type === 'income' ? 'outras_receitas' : 'outros';
      return true;
    };
    const persist = () => {
      f.desc = desc.value.trim(); f.notes = ($('#notes') || {}).value || '';
      if (f.type !== 'transfer') f.toAccountId = null;
      if (f.type === 'transfer') f.categoryId = null;
      G.state.settings.lastAccount = f.accountId;
      if (isEdit) {
        if (f.splits && f.splits.length && f.amount !== edit.amount) {
          // mudou o total de uma nota dividida: reparte proporcionalmente
          const k = f.amount / edit.amount; let acc = 0;
          f.splits.forEach((sp, i) => { sp.amount = i === f.splits.length - 1 ? f.amount - acc : Math.round(sp.amount * k); acc += sp.amount; });
        }
        G.updateTx(edit.id, f);
        G.toast('Alterações salvas');
      } else if (installments > 1) {
        const group = G.uid(), base = Math.floor(f.amount / installments), first = f.amount - base * (installments - 1);
        for (let i = 0; i < installments; i++) {
          const d = G.dateInMonth(G.addMonths(G.monthKey(f.date), i), Number(f.date.slice(8, 10)));
          G.addTx({ ...f, amount: i ? base : first, date: d, desc: `${f.desc || G.cat(f.categoryId).name} (${i + 1}/${installments})`, installment: { group, n: i + 1, total: installments } });
        }
        G.toast(`${installments} parcelas lançadas`);
      } else {
        const tx = G.addTx({ ...f });
        if (repeat !== 'none') {
          const r = { id: G.uid(), type: f.type, amount: f.amount, desc: f.desc || G.cat(f.categoryId).name, categoryId: f.categoryId, accountId: f.accountId, toAccountId: f.toAccountId, freq: repeat, day: Number(f.date.slice(8, 10)), start: f.date, done: { [f.date]: tx.id } };
          G.state.recurring.push(r); tx.recurringId = r.id;
          G.toast('Lançado — e vai se repetir ' + ({ monthly: 'todo mês', weekly: 'toda semana', yearly: 'todo ano' })[repeat]);
        } else G.toast(f.type === 'income' ? 'Receita lançada' : f.type === 'transfer' ? 'Transferência lançada' : 'Despesa lançada');
      }
      G.save(); G.render();
    };
    $('#save').onclick = () => { if (!validate()) return; persist(); s.close(); };
    const sn = $('#saveNew');
    if (sn) sn.onclick = () => {
      if (!validate()) return; persist();
      const keep = { type: f.type, accountId: f.accountId, date: f.date };
      s.close(); setTimeout(() => G.openAdd({ type: keep.type, preset: { accountId: keep.accountId, date: keep.date } }), 280);
    };
    if (isEdit) {
      $('#del').onclick = () => { s.close(); G.deleteTx(edit.id); };
      $('#dup').onclick = () => {
        const copy = { ...JSON.parse(JSON.stringify(edit)), date: G.today() };
        delete copy.id; delete copy.installment; delete copy.recurringId; delete copy.createdAt;
        G.addTx(copy); G.save(); G.render(); s.close(); G.toast('Duplicado com a data de hoje');
      };
      if (edit.installment) el.querySelector('.add-foot').insertAdjacentHTML('afterbegin', `<small class="muted foot-note">Parcela ${edit.installment.n} de ${edit.installment.total} — a edição vale só para esta parcela.</small>`);
    }

    paintAmt(); paintType(); paintDate(); paintInst();
    if (f.desc) autoCat();
  };
})(window.G);
