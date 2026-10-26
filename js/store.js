/* Grana — onde os dados moram: no próprio aparelho (IndexedDB), nunca num servidor.
   O estado inteiro fica em memória e é gravado em lote logo depois de cada mudança. */
(function (G) {
  const DB_NAME = 'grana', STORE = 'kv', KEY = 'state';
  let db = null;

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function idbGet(key) {
    return new Promise((resolve, reject) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  function idbSet(key, val) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
    });
  }

  G.freshState = () => ({
    version: 1,
    accounts: G.DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    categories: G.DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    tx: [],
    recurring: [],
    budgets: {},
    goals: [],
    rules: {},
    settings: { theme: 'auto', hideValues: false, name: '', geminiKey: '', aiModel: '', lastBackup: null, onboarded: false },
  });

  // completa campos que versões novas acrescentam, sem perder nada do que já existe
  function migrate(s) {
    const f = G.freshState();
    for (const k of Object.keys(f)) if (s[k] == null) s[k] = f[k];
    s.settings = { ...f.settings, ...s.settings };
    return s;
  }

  G.loadState = async () => {
    try {
      db = await openDb();
      const s = await idbGet(KEY);
      G.state = s ? migrate(s) : G.freshState();
    } catch (e) {
      console.error(e);
      G.state = G.freshState();
      G.storageBroken = true;
    }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    return G.state;
  };

  const flush = G.debounce(() => { if (db) idbSet(KEY, G.state).catch((e) => console.error(e)); }, 250);
  const listeners = [];
  G.onChange = (fn) => listeners.push(fn);
  G.save = () => { flush(); listeners.forEach((fn) => fn()); };

  // ---------- desfazer: guarda uma cópia antes de mudanças destrutivas ----------
  let undoSnap = null;
  G.snapshot = () => { undoSnap = JSON.stringify(G.state); };
  G.undo = () => { if (!undoSnap) return false; const keep = G.state.settings; G.state = JSON.parse(undoSnap); G.state.settings = keep; undoSnap = null; G.save(); return true; };

  // ---------- consultas ----------
  G.cat = (id) => G.state.categories.find((c) => c.id === id) || { id: 'outros', name: 'Sem categoria', icon: '❔', color: '#94A3B8', kind: 'expense' };
  G.acc = (id) => G.state.accounts.find((a) => a.id === id) || { id, name: 'Conta removida', type: 'checking', color: '#94A3B8' };
  G.cats = (kind) => G.state.categories.filter((c) => c.kind === kind && !c.archived);
  G.activeAccounts = () => G.state.accounts.filter((a) => !a.archived);

  // categorias mais usadas primeiro — é o que torna o lançamento rápido
  G.catsByUse = (kind) => {
    const count = {};
    const recent = G.state.tx.slice(-400);
    for (const t of recent) if (t.type === kind) count[t.categoryId] = (count[t.categoryId] || 0) + 1;
    return G.cats(kind).slice().sort((a, b) => (count[b.id] || 0) - (count[a.id] || 0));
  };

  // ---------- aprendizado: "Padaria do Zé" → Padaria e café ----------
  G.learn = (desc, categoryId, type) => {
    const k = G.norm(desc);
    if (!k || type === 'transfer') return;
    G.state.rules[type + ':' + k] = categoryId;
  };
  G.suggestCategory = (desc, type) => {
    const k = G.norm(desc);
    if (!k) return null;
    const r = G.state.rules;
    if (r[type + ':' + k]) return r[type + ':' + k];
    // regra aprendida que comece igual ("uber" pega "uber trip help")
    for (const key in r) {
      const [t, d] = key.split(':');
      if (t === type && d.length >= 4 && (k.startsWith(d) || d.startsWith(k))) return r[key];
    }
    return G.guessCategory(desc, type);
  };
  // sugestões para o campo de descrição: o que já foi digitado antes, mais frequente primeiro
  G.descSuggestions = (prefix, type) => {
    const p = G.norm(prefix);
    if (p.length < 2) return [];
    const seen = new Map();
    for (let i = G.state.tx.length - 1; i >= 0 && seen.size < 60; i--) {
      const t = G.state.tx[i];
      if (t.type !== type || !t.desc) continue;
      const d = t.desc.replace(/\s*\(\d+\/\d+\)$/, '');
      const n = G.norm(d);
      if (!n.includes(p)) continue;
      const e = seen.get(n) || { desc: d, categoryId: t.categoryId, amount: t.amount, accountId: t.accountId, count: 0 };
      e.count++; seen.set(n, e);
    }
    return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  };

  // ---------- gravação ----------
  G.addTx = (t) => {
    const tx = { id: G.uid(), createdAt: Date.now(), source: 'manual', ...t };
    G.state.tx.push(tx);
    if (tx.categoryId) G.learn(tx.desc, tx.categoryId, tx.type);
    return tx;
  };
  G.updateTx = (id, patch) => {
    const t = G.state.tx.find((x) => x.id === id);
    if (!t) return;
    Object.assign(t, patch);
    if (t.categoryId) G.learn(t.desc, t.categoryId, t.type);
  };
  G.removeTx = (ids) => {
    const set = new Set([].concat(ids));
    G.state.tx = G.state.tx.filter((t) => !set.has(t.id));
  };

  // ---------- backup ----------
  G.exportBackup = () => JSON.stringify({ app: 'grana', exportedAt: new Date().toISOString(), state: { ...G.state, settings: { ...G.state.settings, geminiKey: '' } } });
  G.importBackup = (text) => {
    const data = JSON.parse(text);
    const s = data.state || data;
    if (!s || !Array.isArray(s.tx) || !Array.isArray(s.accounts)) throw new Error('Arquivo não parece um backup do Grana.');
    const keepKey = G.state.settings.geminiKey;
    G.state = migrate(s);
    if (!G.state.settings.geminiKey) G.state.settings.geminiKey = keepKey;
    G.save();
  };
})(window.G);
