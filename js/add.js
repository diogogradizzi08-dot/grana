/* Lançar e editar: o gesto mais repetido do app. Valor no teclado próprio,
   descrição que lembra a categoria, categorias mais usadas primeiro. */
(function (G) {
  G.openTx = (id) => {
    const t = G.state.tx.find((x) => x.id === id);
    if (!t) return;
    if (t.installment && G.planOf(t.installment.group).length > 1) G.openPlan(t.installment.group);
    else G.openAdd({ edit: t });
  };

  function payBanner(t) {
    const today = G.today(), inc = t.type === 'income';
    const when = t.date < today ? `<b class="neg">atrasado há ${G.daysBetween(t.date, today)} dia(s)</b>` : t.date === today ? '<b>vence hoje</b>' : `vence em ${G.daysBetween(today, t.date)} dia(s)`;
    return `<div class="pay-banner"><div>${G.icon('calendar', 18)}<span><b>${inc ? 'A receber' : 'A pagar'}</b> · ${G.shortDate(t.date)} · ${when}</span></div>
      <div class="pay-actions"><span class="muted small">${inc ? 'Marcar como recebido:' : 'Marcar como pago:'}</span><button class="btn sm primary" data-pay="today">Hoje</button>
      <label class="btn sm ghost">${G.icon('calendar', 15)} Outra data<input type="date" data-pay="other" max="${today}"></label></div></div>`;
  }
  G.payBanner = payBanner;
  G.bindPayBanner = (root, t, sheet) => {
    const b = root.querySelector('[data-pay="today"]');
    if (b) b.onclick = () => { G.markPaid(t.id, G.today()); sheet && sheet.close(); };
    const i = root.querySelector('[data-pay="other"]');
    if (i) {
      i.onchange = () => { if (i.value) { G.markPaid(t.id, i.value); sheet && sheet.close(); } };
      i.parentElement.onclick = (e) => { if (e.target !== i && i.showPicker) { try { i.showPicker(); } catch (er) { } } };
    }
  };
  // pagou: a data do lançamento vira a do pagamento (é quando o dinheiro saiu) e o vencimento fica guardado
  G.markPaid = (id, date) => {
    const t = G.state.tx.find((x) => x.id === id);
    if (!t) return;
    G.snapshot();
    t.due = t.due || t.date; t.date = date; delete t.pending;
    G.save(); G.render();
    G.toast(`${t.type === 'income' ? 'Recebido' : 'Pago'} em ${G.shortDate(date)}`, { undo: true });
  };

  G.openAdd = ({ type = 'expense', edit = null, preset = {} } = {}) => {
    const isEdit = !!edit;
    const f = edit ? JSON.parse(JSON.stringify(edit)) : {
      type, amount: 0, desc: '', categoryId: null, accountId: G.state.settings.lastAccount || (G.activeAccounts()[0] || {}).id,
      toAccountId: null, date: G.today(), notes: '', ...preset,
    };
    if (!isEdit && f.pending == null) f.pending = f.date > G.today();
    const rec = isEdit && edit.recurringId ? G.state.recurring.find((r) => r.id === edit.recurringId) : null;
    // status escolhido à mão não muda sozinho quando a data muda
    // compra parcelada que começou antes do app: parcelas já pagas + se o valor digitado é o total ou a parcela
    let instCur = 1, perParcel = false;
    // fatura escolhida à mão não muda sozinha quando a data muda
    let invTouched = !!f.invoice;
    const isCredit = () => f.type === 'expense' && G.acc(f.accountId).type === 'credit';
    let installments = 1, repeat = 'none', catTouched = isEdit || !!f.categoryId, moreOpen = !!(f.notes) || (isEdit && !rec && !edit.installment), statusTouched = isEdit;

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
          ${isEdit && edit.installment ? `<div class="plan-banner">${G.icon('card', 18)}<span>Parcela <b>${edit.installment.n} de ${edit.installment.total}</b> — o que mudar aqui vale só para ela.</span><button class="btn sm ghost" id="openPlan">Compra inteira</button></div>` : ''}
          ${isEdit && edit.pending ? payBanner(edit) : ''}
          ${isEdit && !edit.pending && edit.due && edit.due !== edit.date ? `<div class="info-box">${G.icon('check', 18)}<span>Pago em ${G.shortDate(edit.date)} — o vencimento era ${G.shortDate(edit.due)}${edit.date < edit.due ? ` (${G.daysBetween(edit.date, edit.due)} dia(s) antes)` : edit.date > edit.due ? ` (${G.daysBetween(edit.due, edit.date)} dia(s) depois)` : ''}.</span></div>` : ''}
          <div class="desc-wrap"><input id="desc" class="desc-input" placeholder="Descrição (ex.: Padaria, Uber, Salário)" autocomplete="off" maxlength="80" value="${G.esc(f.desc)}">
            <div class="suggest" id="suggest"></div></div>
          <div id="catSec"><div class="sec-label">Categoria <span class="muted" id="catHint"></span></div><div id="cats"></div></div>
          <div class="sec-label" id="accLabel">Conta</div><div id="accs"></div>
          <div id="toSec" class="hidden"><div class="sec-label">Para</div><div id="toAccs"></div></div>
          <div class="sec-label" id="dateLabel">Data</div>
          <div class="chips" id="dates"><button class="chip" data-d="0">Hoje</button><button class="chip" data-d="-1">Ontem</button>
            <label class="chip date-chip">${G.icon('calendar', 16)}<span id="dateTxt"></span><input type="date" id="dateIn"></label></div>
          <div class="seg wide status-seg" id="status"><button data-p="0"></button><button data-p="1"></button></div>
          <div id="ccSec" class="cc-sec hidden">
            <div class="sec-label" id="invLabel">Entra na fatura</div>
            <div class="inv-pick" id="invPick"></div>
            <div class="cc-warn hidden" id="invWarn"></div>
            <div id="ccInst"></div>
          </div>
          ${f.splits && f.splits.length ? `<div class="sec-label">Itens da nota</div><div class="split-list">${f.splits.map((sp) => `<div class="split-line">${G.catBadge(G.cat(sp.categoryId), 28)}<span>${G.esc(G.cat(sp.categoryId).name)}</span><b>${G.money(sp.amount)}</b></div>`).join('')}</div>` : ''}
          <button class="more-toggle" id="moreBtn">${G.icon('down', 18)} Mais opções</button>
          <div id="more" class="${moreOpen ? '' : 'hidden'}">
            <label class="field"><span>Observação</span><textarea id="notes" rows="2" placeholder="Opcional">${G.esc(f.notes || '')}</textarea></label>
            <div id="instHome">${isEdit ? '' : `<div class="field" id="instSec"><span>Parcelas</span>
              <div class="stepper"><button data-s="-1">${G.icon('minus', 18)}</button><b id="instN">À vista</b><button data-s="1">${G.icon('plus', 18)}</button></div>
              <div id="instMore" class="hidden">
                <span class="inst-sub">O valor que você digitou é</span>
                <div class="chips" id="instVal"><button class="chip on" data-v="0">O total da compra</button><button class="chip" data-v="1">O valor de cada parcela</button></div>
                <span class="inst-sub">Compra antiga? Parcelas que você já pagou</span>
                <div class="stepper"><button data-c="-1">${G.icon('minus', 18)}</button><b id="instC">nenhuma</b><button data-c="1">${G.icon('plus', 18)}</button></div>
              </div>
              <div class="inst-plan" id="instPlan"></div></div>`}</div>
            ${rec ? `<div class="field"><span>Repetir</span><div class="rec-box">${G.icon('repeat', 18)}<span><b>Conta fixa</b> — ${({ monthly: 'todo mês, dia ' + rec.day, weekly: 'toda semana', yearly: 'todo ano' })[rec.freq]}${rec.end ? ' · parada' : ''}</span>
              ${rec.end ? '' : '<button class="btn sm ghost" id="stopRec">Parar de repetir</button>'}</div></div>`
            : isEdit && edit.installment ? '' : `<div class="field"><span>Repetir</span><div class="chips" id="rep">
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
      renderCats(); renderAccs(); paintCC(); paintInst();
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
      a.appendChild(G.accountChips(f.accountId, (id) => { f.accountId = id; if (f.toAccountId === id) f.toAccountId = null; renderAccs(); paintCC(); paintInst(); }));
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
      // data futura = ainda vai acontecer: entra como "a pagar" até você marcar como pago
      if (!statusTouched) f.pending = f.date > t;
      paintStatus(); paintCC(); paintInst();
    };
    const paintStatus = () => {
      const inc = f.type === 'income';
      const [a, b] = G.$$('#status button', el);
      a.textContent = inc ? 'Recebido' : 'Pago'; b.textContent = inc ? 'A receber' : 'A pagar';
      a.classList.toggle('on', !f.pending); b.classList.toggle('on', !!f.pending);
      $('#dateLabel').textContent = isCredit() ? 'Data da compra' : f.pending ? 'Vencimento' : (inc ? 'Recebido em' : f.type === 'transfer' ? 'Data' : 'Pago em');
    };

    // ---------- cartão de crédito: a fatura é escolhida, não adivinhada ----------
    const paintCC = () => {
      const on = isCredit();
      $('#ccSec').classList.toggle('hidden', !on);
      // compra no cartão não é "paga" nem "a pagar": quem se paga é a fatura
      $('#status').classList.toggle('hidden', on);
      if (on) f.pending = false;
      else if (!statusTouched) f.pending = f.date > G.today();
      const inst = $('#instSec');
      if (inst) {
        const home = on ? $('#ccInst') : $('#instHome');
        if (inst.parentElement !== home) home.appendChild(inst);
        inst.classList.toggle('hidden', f.type !== 'expense');
      }
      paintStatus();
      if (!on) return;
      const acc = G.acc(f.accountId), auto = G.invoiceKey(acc, f.date), thisYear = G.today().slice(0, 4);
      if (!invTouched || !f.invoice) f.invoice = auto;
      const keys = [-1, 0, 1, 2].map((i) => G.addMonths(auto, i));
      if (!keys.includes(f.invoice)) keys.push(f.invoice);
      keys.sort();
      $('#invPick').innerHTML = keys.map((k) => {
        const inv = G.invoice(acc.id, k);
        return `<button class="inv-opt ${k === f.invoice ? 'on' : ''}" data-k="${k}"><b>${G.cap(G.monthAbbr(k))}${k.slice(0, 4) !== thisYear ? ' ' + k.slice(2, 4) : ''}</b>
          <small>vence ${G.shortDate(inv.due)}</small><em class="st-${inv.status}">${inv.label}</em></button>`;
      }).join('');
      G.$$('#invPick [data-k]', el).forEach((b) => (b.onclick = () => { f.invoice = b.dataset.k; invTouched = true; paintCC(); paintInst(); }));
      const inv = G.invoice(acc.id, f.invoice), mes = G.monthName(f.invoice, false), w = $('#invWarn');
      const msg = inv.status === 'paid' ? `A fatura de ${mes} já foi paga. Se entrar nela, vai sobrar um valor a pagar nessa fatura.`
        : inv.status === 'open' ? '' : `A fatura de ${mes} já fechou em ${G.shortDate(inv.closing)}. Compra feita depois do fechamento vai para a fatura seguinte.`;
      w.innerHTML = msg ? `${G.icon('alert', 16)}<span>${msg}</span>` : '';
      w.classList.toggle('hidden', !msg);
    };
    G.$$('#status button', el).forEach((b) => (b.onclick = () => { f.pending = b.dataset.p === '1'; statusTouched = true; paintStatus(); }));
    G.$$('#dates [data-d]', el).forEach((b) => (b.onclick = () => { f.date = G.addDays(G.today(), Number(b.dataset.d)); paintDate(); }));
    $('#dateIn').onchange = (e) => { if (e.target.value) { f.date = e.target.value; paintDate(); } };
    $('.date-chip').onclick = (e) => { const i = $('#dateIn'); if (e.target !== i && i.showPicker) { try { i.showPicker(); } catch (er) { } } };

    // ---------- mais opções ----------
    $('#moreBtn').onclick = () => { moreOpen = !moreOpen; $('#more').classList.toggle('hidden', !moreOpen); $('#moreBtn').classList.toggle('open', moreOpen); };
    // as parcelas que serão lançadas: uma por mês e, no cartão, uma por fatura a partir da escolhida
    const planRows = () => {
      const base = perParcel ? f.amount : Math.floor(f.amount / installments);
      const first = perParcel ? f.amount : f.amount - base * (installments - 1);
      const day = Number(f.date.slice(8, 10)), credit = isCredit(), out = [];
      for (let i = instCur - 1; i < installments; i++) {
        const off = i - (instCur - 1);
        out.push({ n: i + 1, amount: i ? base : first, date: G.dateInMonth(G.addMonths(G.monthKey(f.date), off), day), invoice: credit ? G.addMonths(f.invoice, off) : null });
      }
      return out;
    };
    const paintInst = () => {
      if (isCredit() && $('#invLabel')) $('#invLabel').textContent = installments > 1 ? `A ${instCur}ª parcela entra na fatura` : 'Entra na fatura';
      if (!$('#instN')) return;
      instCur = Math.min(instCur, installments);
      $('#instN').textContent = installments === 1 ? 'À vista' : installments + 'x';
      $('#instMore').classList.toggle('hidden', installments === 1);
      $('#instC').textContent = instCur === 1 ? 'nenhuma' : `${instCur - 1} de ${installments}`;
      G.$$('#instVal .chip', el).forEach((x) => x.classList.toggle('on', (x.dataset.v === '1') === perParcel));
      const plan = $('#instPlan');
      if (installments === 1) { plan.innerHTML = ''; return; }
      if (!f.amount) { plan.innerHTML = '<small class="muted">Digite o valor para ver as parcelas.</small>'; return; }
      const rows = planRows(), credit = isCredit(), acc = G.acc(f.accountId);
      const per = rows[rows.length - 1].amount, tot = perParcel ? f.amount * installments : f.amount;
      const line = (r) => `<div class="ip-row"><span class="pill">${r.n}/${installments}</span>
        <span class="ip-when">${credit ? `Fatura de ${G.monthName(r.invoice)}<small>vence ${G.shortDate(G.invoiceDue(acc, r.invoice))}</small>` : `${G.cap(G.monthName(G.monthKey(r.date)))}<small>${G.shortDate(r.date)}</small>`}</span>
        <b>${G.money(r.amount, { force: true })}</b></div>`;
      const show = rows.length <= 5 ? rows : [...rows.slice(0, 3), null, rows[rows.length - 1]];
      plan.innerHTML = `<div class="ip-head"><b>${installments}x de ${G.money(per, { force: true })}</b><span>compra de ${G.money(tot, { force: true })}</span></div>
        ${show.map((r) => (r ? line(r) : `<div class="ip-gap">+ ${rows.length - 4} parcela(s)</div>`)).join('')}
        <div class="ip-foot">${instCur > 1 ? `Serão lançadas ${rows.length} parcelas (da ${instCur}ª à ${installments}ª). As ${instCur - 1} já pagas ficam de fora.` : `Serão lançadas as ${rows.length} parcelas.`}</div>`;
    };
    G.$$('[data-s]', el).forEach((b) => (b.onclick = () => { installments = Math.max(1, Math.min(48, installments + Number(b.dataset.s))); if (installments > 1) setRepeat('none'); paintInst(); }));
    G.$$('[data-c]', el).forEach((b) => (b.onclick = () => {
      instCur = Math.max(1, Math.min(installments, instCur + Number(b.dataset.c)));
      paintInst();
    }));
    G.$$('#instVal .chip', el).forEach((b) => (b.onclick = () => { perParcel = b.dataset.v === '1'; paintInst(); }));
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
      if (f.pending) f.due = f.date;
      else if (isEdit && edit.pending) f.due = edit.date;
      const credit = isCredit();
      if (credit) { f.pending = false; delete f.due; } else delete f.invoice;
      if (!f.pending) delete f.pending;
      G.state.settings.lastAccount = f.accountId;
      if (isEdit) {
        if (f.splits && f.splits.length && f.amount !== edit.amount) {
          // mudou o total de uma nota dividida: reparte proporcionalmente
          const k = f.amount / edit.amount; let acc = 0;
          f.splits.forEach((sp, i) => { sp.amount = i === f.splits.length - 1 ? f.amount - acc : Math.round(sp.amount * k); acc += sp.amount; });
        }
        G.updateTx(edit.id, f);
        const t = G.state.tx.find((x) => x.id === edit.id);
        if (!f.pending) delete t.pending;
        if (credit) delete t.due; else delete t.invoice;
        if (repeat !== 'none' && !t.recurringId) {
          // virou conta fixa depois de lançado: este lançamento é a primeira ocorrência
          const r = { id: G.uid(), type: f.type, amount: f.amount, desc: (f.desc || G.cat(f.categoryId).name).replace(/\s*\(\d+\/\d+\)$/, ''), categoryId: f.categoryId, accountId: f.accountId, toAccountId: f.toAccountId, freq: repeat, day: Number((f.due || f.date).slice(8, 10)), start: f.due || f.date, done: { [f.due || f.date]: t.id } };
          G.state.recurring.push(r); t.recurringId = r.id;
          G.toast('Salvo — e agora se repete ' + ({ monthly: 'todo mês', weekly: 'toda semana', yearly: 'todo ano' })[repeat]);
        } else G.toast('Alterações salvas');
      } else if (installments > 1) {
        const group = G.uid(), name = f.desc || G.cat(f.categoryId).name, today = G.today();
        // no cartão cada parcela leva a SUA fatura gravada; fora dele, parcela futura entra como a pagar
        for (const r of planRows()) {
          const tx = { ...f, amount: r.amount, date: r.date, desc: `${name} (${r.n}/${installments})`, installment: { group, n: r.n, total: installments } };
          if (r.invoice) tx.invoice = r.invoice;
          else if (r.date > today) { tx.pending = true; tx.due = r.date; } else { delete tx.pending; delete tx.due; }
          G.addTx(tx);
        }
        G.toast(instCur > 1 ? `${installments - instCur + 1} parcelas lançadas (da ${instCur}ª à ${installments}ª)` : `${installments} parcelas lançadas`);
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
    // um toque duplo (ou toque + Enter) rodava o salvar duas vezes e lançava as parcelas em dobro
    let saving = false;
    // mesma compra parcelada já lançada neste cartão, com parcelas nas mesmas faturas: pergunta antes
    const sameExisting = () => {
      if (isEdit || installments < 2) return null;
      const nm = G.norm(desc.value.trim() || G.cat(f.categoryId).name), rows = planRows(), credit = isCredit();
      const acc = G.acc(f.accountId), mine = new Set(rows.map((r) => r.invoice || G.monthKey(r.date)));
      const hit = G.state.tx.find((t) => t.installment && t.accountId === f.accountId && G.norm(G.baseName(t)) === nm
        && mine.has(credit ? G.txInvoiceKey(acc, t) : G.monthKey(t.date)));
      return hit ? G.planOf(hit.installment.group) : null;
    };
    const guarded = async (after) => {
      if (saving || !validate()) return;
      saving = true;
      const dup = sameExisting();
      if (dup && !(await G.confirm('Essa compra já está lançada?', `Já existe <b>${G.esc(G.baseName(dup[0]))}</b> em ${dup[0].installment.total}x de ${G.money(dup[0].amount)} neste ${isCredit() ? 'cartão' : 'conta'}, com parcelas nas mesmas faturas. Lançar de novo vai repetir as parcelas.`, { ok: 'Lançar mesmo assim' }))) { saving = false; return; }
      persist(); after();
    };
    $('#save').onclick = () => guarded(() => s.close());
    const sn = $('#saveNew');
    if (sn) sn.onclick = () => guarded(() => {
      const keep = { type: f.type, accountId: f.accountId, date: f.date };
      s.close(); setTimeout(() => G.openAdd({ type: keep.type, preset: { accountId: keep.accountId, date: keep.date } }), 280);
    });
    if (isEdit) {
      $('#del').onclick = () => { s.close(); G.deleteTx(edit.id); };
      $('#dup').onclick = () => {
        const copy = { ...JSON.parse(JSON.stringify(edit)), date: G.today() };
        delete copy.id; delete copy.installment; delete copy.recurringId; delete copy.createdAt;
        G.addTx(copy); G.save(); G.render(); s.close(); G.toast('Duplicado com a data de hoje');
      };
      const stop = $('#stopRec');
      if (stop) stop.onclick = async () => {
        if (!(await G.confirm('Parar de repetir?', 'Os lançamentos já feitos continuam. Só deixam de aparecer os próximos.', { ok: 'Parar' }))) return;
        rec.end = G.today(); G.save(); s.close(); G.render(); G.toast('Não se repete mais');
      };
      G.bindPayBanner(el, edit, s);
      const op = $('#openPlan');
      if (op) op.onclick = () => { s.close(); setTimeout(() => G.openPlan(edit.installment.group), 200); };
    }

    paintAmt(); paintType(); paintDate(); paintInst(); paintStatus();
    if (f.desc) autoCat();
  };
})(window.G);
