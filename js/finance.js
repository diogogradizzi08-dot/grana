/* Grana — as contas: saldos, faturas, recorrências, orçamento e a caça aos vazamentos.
   Nenhuma tela faz conta por conta própria: todas perguntam aqui. */
(function (G) {
  // um lançamento dividido (nota de mercado) conta em cada categoria pela sua parte
  G.parts = (t) => (t.splits && t.splits.length ? t.splits.map((s) => ({ categoryId: s.categoryId, amount: s.amount })) : [{ categoryId: t.categoryId, amount: t.amount }]);

  G.txInMonth = (key) => G.state.tx.filter((t) => t.date.startsWith(key));
  G.txBetween = (from, to) => G.state.tx.filter((t) => t.date >= from && t.date <= to);

  G.totals = (list) => {
    let income = 0, expense = 0;
    for (const t of list) { if (t.type === 'income') income += t.amount; else if (t.type === 'expense') expense += t.amount; }
    return { income, expense, net: income - expense };
  };
  G.monthTotals = (key) => G.totals(G.txInMonth(key));

  G.byCategory = (list, kind) => {
    const m = {};
    for (const t of list) {
      if (t.type !== kind) continue;
      for (const p of G.parts(t)) {
        const e = m[p.categoryId] || (m[p.categoryId] = { categoryId: p.categoryId, amount: 0, count: 0 });
        e.amount += p.amount; e.count++;
      }
    }
    return Object.values(m).sort((a, b) => b.amount - a.amount);
  };

  // ---------- contas ----------
  G.accountBalance = (accId, upTo = null) => {
    const a = G.acc(accId);
    let b = a.initial || 0;
    for (const t of G.state.tx) {
      if (upTo && t.date > upTo) continue;
      if (t.pending) continue; // a pagar: o dinheiro ainda está na conta
      if (t.type === 'income' && t.accountId === accId) b += t.amount;
      else if (t.type === 'expense' && t.accountId === accId) b -= t.amount;
      else if (t.type === 'transfer') { if (t.accountId === accId) b -= t.amount; if (t.toAccountId === accId) b += t.amount; }
    }
    return b;
  };
  // patrimônio disponível: contas e dinheiro, sem o cartão (o cartão aparece como fatura)
  G.totalBalance = () => G.sum(G.activeAccounts().filter((a) => a.type !== 'credit'), (a) => G.accountBalance(a.id, G.today()));

  // ---------- fluxo de caixa futuro ----------
  // Tudo o que vai entrar e sair das contas (sem o cartão) entre hoje e `days` dias à frente:
  // lançamentos a pagar/receber (inclusive os atrasados), lançamentos agendados, contas fixas
  // ainda não confirmadas e faturas de cartão que vencem no período.
  // Compra no cartão não entra sozinha: ela sai da conta quando a fatura vence.
  G.forecast = (days = 30) => {
    const today = G.today(), end = G.addDays(today, days);
    const isCash = (id) => { const a = G.acc(id); return a.type !== 'credit' && !a.archived; };
    const effect = (type, amount, accountId, toAccountId) => {
      if (type === 'income') return isCash(accountId) ? amount : 0;
      if (type === 'expense') return isCash(accountId) ? -amount : 0;
      return (isCash(toAccountId) ? amount : 0) - (isCash(accountId) ? amount : 0);
    };
    const items = [];
    for (const t of G.state.tx) {
      const late = t.pending && t.date <= today;
      if (!late && (t.date <= today || t.date > end)) continue;
      const v = effect(t.type, t.amount, t.accountId, t.toAccountId);
      if (!v) continue;
      items.push({ kind: t.pending ? (late ? 'late' : 'pending') : 'scheduled', date: late ? today : t.date, origDate: t.date, value: v, desc: t.desc || G.cat(t.categoryId).name, categoryId: t.categoryId, type: t.type, tx: t });
    }
    for (const r of G.state.recurring) {
      if (r.paused) continue;
      for (const d of G.occurrences(r, G.addMonths(G.monthKey(today), -2) + '-01', end)) {
        if ((r.done || {})[d]) continue;
        const v = effect(r.type, r.amount, r.accountId, r.toAccountId);
        if (!v) continue;
        const late = d <= today;
        items.push({ kind: late ? 'late' : 'recurring', date: late ? today : d, origDate: d, value: v, desc: r.desc, categoryId: r.categoryId, type: r.type, rec: r });
      }
    }
    // faturas: o que ainda falta pagar de cada fatura com vencimento no período
    for (const a of G.activeAccounts().filter((x) => x.type === 'credit')) {
      for (let i = -1; i <= Math.ceil(days / 28) + 1; i++) {
        const key = G.addMonths(G.currentInvoiceKey(a), i);
        const inv = G.invoice(a.id, key);
        if (inv.due <= today || inv.due > end || inv.total <= 0) continue;
        const paid = G.sum(G.state.tx.filter((t) => t.type === 'transfer' && t.toAccountId === a.id && !t.pending && t.date > G.addDays(inv.closing, -10) && t.date <= inv.due), (t) => t.amount);
        const scheduled = items.some((x) => x.tx && x.tx.type === 'transfer' && x.tx.toAccountId === a.id && x.origDate > G.addDays(inv.closing, -10) && x.origDate <= inv.due);
        const left = inv.total - paid;
        if (left > 0 && !scheduled) items.push({ kind: inv.closing > today ? 'invoice-open' : 'invoice', date: inv.due, origDate: inv.due, value: -left, desc: `Fatura ${a.name} (${G.monthName(key, false)})`, account: a, invoiceKey: key });
      }
    }
    items.sort((x, y) => x.date.localeCompare(y.date) || x.value - y.value);
    // saldo dia a dia
    const start = G.totalBalance();
    const series = [];
    let bal = start, idx = 0, min = { value: start, date: today };
    for (let i = 0; i <= days; i++) {
      const d = G.addDays(today, i);
      while (idx < items.length && items[idx].date === d) bal += items[idx++].value;
      series.push(bal);
      if (bal < min.value) min = { value: bal, date: d };
    }
    const income = G.sum(items.filter((x) => x.value > 0), (x) => x.value);
    const expense = -G.sum(items.filter((x) => x.value < 0), (x) => x.value);
    return { start, end: bal, income, expense, items, series, min, days };
  };

  // ---------- cartão de crédito ----------
  // a fatura leva o nome do mês em que FECHA: compra depois do fechamento cai na fatura seguinte
  G.invoiceKey = (acc, date) => {
    const day = Number(date.slice(8, 10));
    const key = G.monthKey(date);
    return day > (acc.closingDay || 31) ? G.addMonths(key, 1) : key;
  };
  G.invoiceDue = (acc, key) => {
    const due = acc.dueDay || 10, close = acc.closingDay || 1;
    return G.dateInMonth(due > close ? key : G.addMonths(key, 1), due);
  };
  G.invoice = (accId, key) => {
    const acc = G.acc(accId);
    const items = G.state.tx.filter((t) => t.accountId === accId && t.type === 'expense' && G.invoiceKey(acc, t.date) === key);
    const credits = G.state.tx.filter((t) => t.accountId === accId && t.type === 'income' && G.invoiceKey(acc, t.date) === key);
    return { key, items, total: G.sum(items, (t) => t.amount) - G.sum(credits, (t) => t.amount), due: G.invoiceDue(acc, key), closing: G.dateInMonth(key, acc.closingDay || 1) };
  };
  G.currentInvoiceKey = (acc) => G.invoiceKey(acc, G.today());

  // ---------- recorrências (salário, aluguel, assinaturas) ----------
  G.occurrences = (r, from, to) => {
    const out = [];
    const start = r.start > from ? r.start : from;
    const end = r.end && r.end < to ? r.end : to;
    if (start > end) return out;
    if (r.freq === 'weekly') {
      let d = r.start;
      while (d < start) d = G.addDays(d, 7);
      for (; d <= end; d = G.addDays(d, 7)) out.push(d);
    } else {
      const step = r.freq === 'yearly' ? 12 : 1;
      let m = G.monthKey(r.start);
      for (let i = 0; i < 600; i++, m = G.addMonths(m, step)) {
        const d = G.dateInMonth(m, r.day || Number(r.start.slice(8, 10)));
        if (d > end) break;
        if (d >= start) out.push(d);
      }
    }
    return out;
  };
  // vencidas e ainda não confirmadas (olha só os últimos 3 meses — mais que isso é ruído)
  G.pendingRecurring = () => {
    const t = G.today(), from = G.addMonths(G.monthKey(t), -2) + '-01';
    const out = [];
    for (const r of G.state.recurring) {
      if (r.paused) continue;
      for (const d of G.occurrences(r, from, t)) if (!(r.done || {})[d]) out.push({ r, date: d });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };
  // o que ainda vai entrar/sair até o fim do mês
  G.upcomingRecurring = (key) => {
    const t = G.today(), last = G.dateInMonth(key, 31);
    const from = key + '-01' > t ? key + '-01' : G.addDays(t, 1);
    const out = [];
    for (const r of G.state.recurring) {
      if (r.paused) continue;
      for (const d of G.occurrences(r, from, last)) if (!(r.done || {})[d]) out.push({ r, date: d });
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  };
  // payDate: quando o dinheiro saiu de fato (pode ser antes do vencimento)
  G.confirmRecurring = (r, date, amount = r.amount, payDate = date) => {
    const tx = G.addTx({ type: r.type, amount, date: payDate, due: payDate !== date ? date : undefined, desc: r.desc, categoryId: r.categoryId, accountId: r.accountId, toAccountId: r.toAccountId, recurringId: r.id, source: 'recurring' });
    r.done = r.done || {}; r.done[date] = tx.id;
    return tx;
  };
  G.skipRecurring = (r, date) => { r.done = r.done || {}; r.done[date] = 'skip'; };
  G.monthlyEquivalent = (r) => (r.freq === 'weekly' ? Math.round(r.amount * 52 / 12) : r.freq === 'yearly' ? Math.round(r.amount / 12) : r.amount);

  // ---------- orçamento ----------
  G.budgetStatus = (key) => {
    const spent = {};
    for (const e of G.byCategory(G.txInMonth(key), 'expense')) spent[e.categoryId] = e.amount;
    const rows = Object.entries(G.state.budgets).filter(([, v]) => v > 0).map(([categoryId, limit]) => ({ categoryId, limit, spent: spent[categoryId] || 0 }));
    const isCurrent = key === G.monthKey(G.today());
    const dim = G.daysInMonth(key);
    const day = isCurrent ? Number(G.today().slice(8, 10)) : dim;
    const expected = day / dim; // fração do mês que já passou
    for (const r of rows) {
      r.ratio = r.spent / r.limit;
      r.projected = isCurrent && day >= 5 ? Math.round(r.spent / expected) : r.spent;
      r.state = r.ratio >= 1 ? 'over' : (r.ratio > expected + 0.15 && r.ratio > 0.5) ? 'fast' : 'ok';
    }
    rows.sort((a, b) => b.ratio - a.ratio);
    return { rows, limit: G.sum(rows, (r) => r.limit), spent: G.sum(rows, (r) => r.spent), expected };
  };

  // ---------- séries para gráficos ----------
  G.cashflow = (endKey, months = 6) => {
    const out = [];
    for (let i = months - 1; i >= 0; i--) {
      const k = G.addMonths(endKey, -i);
      out.push({ key: k, ...G.monthTotals(k) });
    }
    return out;
  };
  // gasto acumulado dia a dia — compara o ritmo deste mês com o do anterior
  G.dailyCumulative = (key) => {
    const days = G.daysInMonth(key), arr = new Array(days).fill(0);
    for (const t of G.txInMonth(key)) if (t.type === 'expense') arr[Number(t.date.slice(8, 10)) - 1] += t.amount;
    let acc = 0;
    return arr.map((v) => (acc += v));
  };
  G.topMerchants = (list, n = 8) => {
    const m = {};
    for (const t of list) {
      if (t.type !== 'expense' || !t.desc) continue;
      const k = G.norm(t.desc.replace(/\s*\(\d+\/\d+\)$/, ''));
      if (!k) continue;
      const e = m[k] || (m[k] = { desc: t.desc.replace(/\s*\(\d+\/\d+\)$/, ''), amount: 0, count: 0, categoryId: t.categoryId });
      e.amount += t.amount; e.count++;
    }
    return Object.values(m).sort((a, b) => b.amount - a.amount).slice(0, n);
  };
  G.byWeekday = (list) => {
    const arr = new Array(7).fill(0);
    for (const t of list) if (t.type === 'expense') arr[G.parseDate(t.date).getDay()] += t.amount;
    return arr;
  };
  G.byAccount = (list) => {
    const m = {};
    for (const t of list) if (t.type === 'expense') m[t.accountId] = (m[t.accountId] || 0) + t.amount;
    return Object.entries(m).map(([accountId, amount]) => ({ accountId, amount })).sort((a, b) => b.amount - a.amount);
  };

  // ---------- VAZAMENTOS: o que está saindo sem você perceber ----------
  G.leaks = (key) => {
    const out = [];
    const list = G.txInMonth(key).filter((t) => t.type === 'expense');
    const totalOut = G.sum(list, (t) => t.amount);

    // 1. ritmo do mês: no passo atual, quanto vai sair até o fim?
    const isCurrent = key === G.monthKey(G.today());
    if (isCurrent) {
      const day = Number(G.today().slice(8, 10)), dim = G.daysInMonth(key);
      const prevKey = G.addMonths(key, -1);
      const prevTotals = G.monthTotals(prevKey);
      const fixedAhead = G.sum(G.upcomingRecurring(key).filter((u) => u.r.type === 'expense'), (u) => u.r.amount);
      // variável projetada pelo ritmo + o que ainda é fixo e certo
      const variable = totalOut - G.sum(list.filter((t) => t.recurringId), (t) => t.amount);
      const projected = totalOut + (day >= 5 ? Math.round(variable / day * (dim - day)) : 0) + fixedAhead;
      const income = G.monthTotals(key).income + G.sum(G.upcomingRecurring(key).filter((u) => u.r.type === 'income'), (u) => u.r.amount);
      if (day >= 5 && income > 0 && projected > income) {
        out.push({ id: 'pace', level: 'high', icon: 'flame', title: 'No ritmo atual, o mês fecha no vermelho', value: projected - income,
          text: `Projeção de ${G.money(projected)} em despesas contra ${G.money(income)} de receitas previstas.`, filter: null });
      } else if (day >= 5 && prevTotals.expense > 0 && projected > prevTotals.expense * 1.15) {
        out.push({ id: 'pace', level: 'mid', icon: 'trend', title: 'Gastando mais rápido que no mês passado', value: projected - prevTotals.expense,
          text: `Projeção de ${G.money(projected)} contra ${G.money(prevTotals.expense)} em ${G.monthName(prevKey)}.`, filter: null });
      }
    }

    // 2. categorias muito acima da sua média dos últimos 3 meses
    // média só dos meses que têm lançamentos — mês vazio (antes de começar a usar o app) não é mês barato
    const avg = {};
    const past = [1, 2, 3].map((i) => G.txInMonth(G.addMonths(key, -i))).filter((l) => l.length);
    for (const l of past) for (const e of G.byCategory(l, 'expense')) avg[e.categoryId] = (avg[e.categoryId] || 0) + e.amount / past.length;
    if (Object.keys(avg).length) {
      for (const e of G.byCategory(list, 'expense')) {
        const a = avg[e.categoryId] || 0;
        if (a > 0 && e.amount > a * 1.3 && e.amount - a > 10000) {
          out.push({ id: 'cat-' + e.categoryId, level: 'mid', icon: 'arrowUp', title: `${G.cat(e.categoryId).name} ${G.pct(e.amount / a - 1)} acima da sua média`, value: e.amount - a,
            text: `${G.money(e.amount)} neste mês; sua média é ${G.money(Math.round(a))}.`, filter: { categoryId: e.categoryId } });
        }
      }
    }

    // 3. gotejamento: muitas compras pequenas que somam muito
    const small = list.filter((t) => t.amount <= 5000 && !t.recurringId);
    const smallByCat = G.groupBy(small, (t) => t.categoryId);
    for (const [cid, arr] of Object.entries(smallByCat)) {
      const s = G.sum(arr, (t) => t.amount);
      if (arr.length >= 6 && s >= 15000) {
        out.push({ id: 'drip-' + cid, level: 'mid', icon: 'drop', title: `${arr.length} gastos pequenos em ${G.cat(cid).name}`, value: s,
          text: `Cada um parece nada, juntos somam ${G.money(s)} no mês — cerca de ${G.money(s * 12)} por ano.`, filter: { categoryId: cid, max: 5000 } });
      }
    }

    // 4. tarifas, juros e multas: dinheiro que não compra nada
    const fees = list.filter((t) => t.categoryId === 'tarifas' || /tarifa|juros|iof|multa|anuidade|encargo|mora/.test(G.norm(t.desc)));
    if (fees.length) {
      const s = G.sum(fees, (t) => t.amount);
      out.push({ id: 'fees', level: s > 5000 ? 'high' : 'low', icon: 'bank', title: 'Tarifas, juros e multas', value: s,
        text: `${fees.length} cobrança(s) que não compram nada. Vale negociar o pacote do banco ou pagar em dia.`, filter: { fees: true } });
    }

    // 5. delivery e apps de transporte: os campeões de vazamento
    const apps = list.filter((t) => t.categoryId === 'delivery');
    if (apps.length >= 3 && !out.some((o) => o.id === 'cat-delivery')) {
      const s = G.sum(apps, (t) => t.amount);
      out.push({ id: 'delivery', level: s > 40000 ? 'mid' : 'low', icon: 'coffee', title: `${apps.length} pedidos de delivery`, value: s,
        text: `Média de ${G.money(Math.round(s / apps.length))} por pedido — ${G.money(s * 12)} por ano neste ritmo.`, filter: { categoryId: 'delivery' } });
    }

    // 6. possíveis cobranças em dobro
    const dups = [];
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if (b.date > G.addDays(a.date, 2)) break;
      if (a.amount === b.amount && a.amount >= 1000 && G.norm(a.desc) === G.norm(b.desc) && G.norm(a.desc) && !a.installment) dups.push(b);
    }
    if (dups.length) {
      out.push({ id: 'dups', level: 'high', icon: 'copy', title: `${dups.length} possível(is) cobrança(s) em dobro`, value: G.sum(dups, (t) => t.amount),
        text: 'Mesmo valor e mesma descrição em até 2 dias. Confira se não foi lançado — ou cobrado — duas vezes.', filter: { ids: dups.map((t) => t.id) } });
    }

    // 7. assinaturas: o que se repete todo mês com valor parecido
    const subs = G.detectSubscriptions(key);
    if (subs.length) {
      const s = G.sum(subs, (x) => x.amount);
      out.push({ id: 'subs', level: 'low', icon: 'repeat', title: `${subs.length} gasto(s) que se repetem todo mês`, value: s,
        text: `${G.money(s * 12)} por ano. Ainda usa todos? ${subs.slice(0, 3).map((x) => x.desc).join(', ')}${subs.length > 3 ? '…' : ''}`, filter: { subs: subs.map((x) => G.norm(x.desc)) } });
    }

    const rank = { high: 0, mid: 1, low: 2 };
    return out.sort((a, b) => rank[a.level] - rank[b.level] || b.value - a.value);
  };

  // mesma descrição em pelo menos 3 dos últimos 4 meses, com valor dentro de ±20%
  G.detectSubscriptions = (key) => {
    const months = [0, 1, 2, 3].map((i) => G.addMonths(key, -i));
    const seen = {};
    months.forEach((m, idx) => {
      for (const t of G.txInMonth(m)) {
        if (t.type !== 'expense' || t.installment || !t.desc) continue;
        const k = G.norm(t.desc);
        if (!k) continue;
        const e = seen[k] || (seen[k] = { desc: t.desc, months: new Set(), amounts: [], categoryId: t.categoryId, last: 0 });
        e.months.add(idx); e.amounts.push(t.amount);
        if (idx === 0) e.last = t.amount;
      }
    });
    return Object.values(seen).filter((e) => {
      if (e.months.size < 3 || !e.months.has(0) && !e.months.has(1)) return false;
      const avg = G.sum(e.amounts) / e.amounts.length;
      return e.amounts.every((a) => Math.abs(a - avg) <= avg * 0.2) && e.amounts.length <= e.months.size + 1;
    }).map((e) => ({ desc: e.desc, amount: e.last || e.amounts[e.amounts.length - 1], categoryId: e.categoryId })).sort((a, b) => b.amount - a.amount);
  };

  // filtro genérico usado quando o usuário toca num alerta
  G.applyFilter = (list, f) => {
    if (!f) return list;
    return list.filter((t) => {
      if (f.ids) return f.ids.includes(t.id);
      if (f.type && t.type !== f.type) return false;
      if (f.categoryId && !G.parts(t).some((p) => p.categoryId === f.categoryId)) return false;
      if (f.accountId && t.accountId !== f.accountId && t.toAccountId !== f.accountId) return false;
      if (f.max && t.amount > f.max) return false;
      if (f.fees && !(t.categoryId === 'tarifas' || /tarifa|juros|iof|multa|anuidade|encargo|mora/.test(G.norm(t.desc)))) return false;
      if (f.subs && !f.subs.includes(G.norm(t.desc))) return false;
      if (f.q) {
        const q = G.norm(f.q);
        const hay = G.norm(t.desc + ' ' + (t.notes || '') + ' ' + G.cat(t.categoryId).name + ' ' + (t.items || []).map((i) => i.name).join(' '));
        const qv = G.parseMoney(f.q);
        if (!(q && hay.includes(q)) && !(qv && Math.abs(t.amount - qv) < 100)) return false;
      }
      return true;
    });
  };
})(window.G);
