/* Leitura inteligente: foto ou PDF de nota de mercado, NF, boleto, contracheque.
   Dois motores:
   - IA do Google (Gemini) com a chave GRÁTIS do próprio usuário: lê qualquer documento,
     entende item por item e classifica. É o modo recomendado.
   - Leitor local (Tesseract, roda no aparelho, sem internet depois de baixado): mais
     limitado, lê o texto e o app interpreta por regras. Serve de reserva e é 100% privado. */
(function (G) {
  const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  G.openScan = (hint = 'auto') => {
    const hasKey = !!G.state.settings.geminiKey;
    const s = G.sheet(`
      <div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">Ler documento</h3><span style="width:40px"></span></div>
      <p class="muted center">Fotografe ou envie o arquivo. O app lê, separa os itens e classifica — você só confere.</p>
      <div class="scan-types">
        <button data-h="receipt" class="${hint === 'receipt' ? 'on' : ''}"><span>🛒</span><b>Nota de mercado</b><small>cupom, NFC-e</small></button>
        <button data-h="payslip" class="${hint === 'payslip' ? 'on' : ''}"><span>💼</span><b>Contracheque</b><small>holerite</small></button>
        <button data-h="bill" class="${hint === 'bill' ? 'on' : ''}"><span>📄</span><b>Boleto</b><small>condomínio, escola, contas</small></button>
        <button data-h="invoice" class="${hint === 'invoice' ? 'on' : ''}"><span>🧾</span><b>Nota fiscal</b><small>NF-e, DANFE, fatura</small></button>
        <button data-h="auto" class="${hint === 'auto' ? 'on' : ''}"><span>✨</span><b>Descobrir sozinho</b><small>qualquer um</small></button>
      </div>
      <div class="scan-actions">
        <label class="btn primary big">${G.icon('camera', 20)} Tirar foto<input type="file" accept="image/*" capture="environment" hidden id="camIn"></label>
        <label class="btn ghost big">${G.icon('upload', 20)} Escolher arquivo<input type="file" accept="image/*,application/pdf" hidden id="fileIn"></label>
      </div>
      <div class="engine-note ${hasKey ? 'ok' : ''}">${hasKey
        ? `${G.icon('sparkles', 18)}<span><b>Leitura com IA ativada.</b> Lê notas amassadas, PDF e contracheques de qualquer empresa.</span>`
        : `${G.icon('info', 18)}<span><b>Leitor básico (sem IA).</b> Funciona com fotos nítidas de cupom, boleto e holerite. Para ler muito melhor — inclusive PDF — ative a IA grátis em <a href="#" id="goKey">Ajustes → Leitura inteligente</a>.</span>`}</div>`, { wide: true });
    let docHint = hint;
    G.$$('.scan-types button', s.el).forEach((b) => (b.onclick = () => { docHint = b.dataset.h; G.$$('.scan-types button', s.el).forEach((x) => x.classList.toggle('on', x === b)); }));
    const go = s.el.querySelector('#goKey'); if (go) go.onclick = (e) => { e.preventDefault(); s.close(); G.go('settings'); setTimeout(() => G.openAiSetup(), 300); };
    const onFile = (e) => { const file = e.target.files[0]; if (!file) return; s.close(); process(file, docHint); };
    s.el.querySelector('#camIn').onchange = onFile;
    s.el.querySelector('#fileIn').onchange = onFile;
  };

  // ---------- processamento ----------
  async function process(file, hint) {
    const busy = G.sheet(`<div class="scan-busy"><div class="scan-anim">${G.icon('scan', 46)}<i></i></div>
      <h3 class="sheet-title" id="busyT">Lendo o documento…</h3><p class="muted" id="busyS">Isso leva alguns segundos.</p></div>`);
    const setMsg = (t, sub) => { const a = busy.el.querySelector('#busyT'), b = busy.el.querySelector('#busyS'); if (a) a.textContent = t; if (b && sub != null) b.textContent = sub; };
    let preview = null;
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      let data, mime;
      if (isPdf) { data = await fileToBase64(file); mime = 'application/pdf'; }
      else { const img = await shrinkImage(file, 1800); data = img.base64; mime = 'image/jpeg'; preview = img.url; }
      let result;
      if (G.state.settings.geminiKey) {
        setMsg('A IA está lendo o documento…', 'Separando itens e classificando.');
        result = await readWithGemini(data, mime, hint);
      } else {
        if (isPdf) throw new Error('O leitor básico não lê PDF. Tire uma foto do documento ou ative a leitura com IA em Ajustes.');
        setMsg('Lendo o texto da imagem…', 'Na primeira vez o leitor é baixado (~10 MB).');
        const text = await ocrLocal(preview, (p) => setMsg('Lendo o texto da imagem… ' + Math.round(p * 100) + '%', null));
        result = parseLocal(text, hint);
      }
      busy.close();
      review(normalize(result), preview);
    } catch (e) {
      console.error(e);
      busy.close();
      G.sheet(`<div class="center"><div class="big-ic warn">${G.icon('alert', 36)}</div><h3 class="sheet-title">Não consegui ler</h3><p class="muted">${G.esc(e.message || String(e))}</p>
        <div class="row-btns"><button class="btn ghost" data-close>Fechar</button><button class="btn primary" id="again">Tentar de novo</button></div></div>`).el.querySelector('#again').onclick = () => { G.closeTopSheet(); G.openScan(hint); };
    }
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
  }
  // fotos de celular têm 12 MP; 1800 px de lado é mais que suficiente para ler e sobe rápido
  function shrinkImage(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const out = c.toDataURL('image/jpeg', 0.86);
        URL.revokeObjectURL(url);
        res({ base64: out.split(',')[1], url: out });
      };
      img.onerror = () => rej(new Error('Não consegui abrir a imagem.'));
      img.src = url;
    });
  }

  // ---------- motor 1: Gemini ----------
  function prompt(hint) {
    const exp = G.cats('expense').map((c) => c.id + ' = ' + c.name).join('; ');
    const inc = G.cats('income').map((c) => c.id + ' = ' + c.name).join('; ');
    return `Você é um assistente de finanças pessoais no Brasil. Leia o documento (foto ou PDF) e devolva SOMENTE um JSON válido.
Tipo provável indicado pelo usuário: ${hint} (receipt = cupom/nota de mercado, payslip = contracheque/holerite, bill = boleto bancário ou de concessionária, invoice = nota fiscal/fatura, auto = descubra).

Categorias de DESPESA (use o id): ${exp}
Categorias de RECEITA (use o id): ${inc}

Formato:
{
 "docType": "receipt" | "payslip" | "invoice" | "bill" | "other",
 "kind": "expense" | "income",
 "merchant": "nome curto e legível do estabelecimento ou empresa (ex.: 'Carrefour', não a razão social inteira)",
 "date": "AAAA-MM-DD (data da compra, emissão ou competência do pagamento)",
 "total": número em reais (valor efetivamente pago, já com descontos),
 "paymentMethod": "dinheiro" | "debito" | "credito" | "pix" | "boleto" | null,
 "items": [ { "name": "nome legível do produto/serviço, sem códigos, por extenso (ex.: 'Detergente Ypê 500ml')", "qty": número, "amount": valor total do item em reais já com desconto do item, "category": "id da categoria" } ],
 "discount": desconto geral da nota em reais (0 se não houver),
 "barcode": "boleto: a linha digitável completa, só os dígitos (47 ou 48), ou null",
 "payslip": null ou { "employer": "empresa", "reference": "mês de referência AAAA-MM", "gross": total de vencimentos, "net": valor líquido,
    "earnings": [ { "name": "Salário base / Horas extras / Adicional noturno / Férias / 13º...", "amount": n, "category": "id de RECEITA" } ],
    "deductions": [ { "name": "INSS / IRRF / Vale-transporte / Plano de saúde...", "amount": n, "category": "id de DESPESA" } ] }
}
Regras:
- Valores em número com ponto decimal (12.5), nunca texto.
- Nota de mercado: liste TODOS os itens. Classifique cada item: alimentos = mercado; limpeza = casa; higiene/cosméticos = higiene; bebida alcoólica = bebidas; ração = pets; remédio = farmacia; pão/padaria = padaria.
- A soma dos items menos "discount" deve bater com "total".
- Contracheque: docType "payslip", kind "income", total = líquido. INSS, IRRF e contribuições = impostos; plano de saúde/odontológico = saude; vale-transporte = transporte; vale-refeição/alimentação descontado = restaurante; pensão alimentícia = filhos; empréstimo consignado = dividas; adiantamento salarial = outros. Em "items" repita as linhas de earnings.
- Conta de luz/água/internet/telefone = contas; boleto de condomínio/aluguel = moradia.
- BOLETO (docType "bill"): "merchant" = o BENEFICIÁRIO/CEDENTE (quem recebe: ex. 'Condomínio Edifício Aurora', 'Colégio X'), NUNCA o banco emissor (Itaú, Bradesco, Caixa…) e NUNCA o pagador/sacado (que é o próprio usuário). "date" = data de VENCIMENTO. "total" = "Valor do documento" (ou "Valor cobrado", se preenchido). Ignore os campos de desconto, juros, multa e acréscimos que estejam em branco ou zerados — são campos do formulário, não itens. Se o boleto tiver demonstrativo/composição (ex. condomínio: taxa condominial, fundo de reserva, água, gás, rateio de obra), liste cada linha em "items" (taxa condominial/fundo de reserva/obra = moradia; água/gás/luz = contas); senão, "items" tem UMA linha com a descrição do que se paga (ex. 'Condomínio outubro/2026') e o total.
- Se um campo não existir, use null. Não invente itens.`;
  }

  async function readWithGemini(base64, mime, hint) {
    const key = G.cleanKey(G.state.settings.geminiKey);
    const models = [...new Set(G.state.settings.aiModel ? [G.state.settings.aiModel, ...MODELS] : MODELS)];
    let lastErr, listed = false;
    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt(hint) }, { inline_data: { mime_type: mime, data: base64 } }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      }).catch(() => { throw new Error('Sem internet? A leitura com IA precisa de conexão.'); });
      if (res.status === 404) {
        lastErr = new Error('Modelo indisponível: ' + model);
        if (!listed) { listed = true; for (const m of await listModels(key)) if (!models.includes(m)) models.push(m); }
        continue;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (body.error && body.error.message) || res.statusText;
        if ((res.status === 400 && /api key/i.test(msg)) || res.status === 403) throw new Error(explain(res.status, msg, reasonOf(body.error || {})) + ' Ajuste em Mais, Ajustes, Leitura inteligente.');
        if (res.status === 429) throw new Error('Limite grátis da IA atingido por agora. Espere um minuto e tente de novo.');
        lastErr = new Error('Erro da IA: ' + msg); continue;
      }
      const text = (((body.candidates || [])[0] || {}).content || { parts: [] }).parts.map((p) => p.text || '').join('');
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      try { const r = JSON.parse(json); G.state.settings.aiModel = model; return r; } catch (e) { lastErr = new Error('A IA respondeu num formato inesperado. Tente outra foto.'); }
    }
    throw lastErr || new Error('Não foi possível usar a IA.');
  }

  // limpa o que vem junto ao colar (espaços, quebras de linha, aspas, caracteres invisíveis)
  G.cleanKey = (k) => String(k || '').replace(/[\s\u200B-\u200D\uFEFF"'`]/g, '');

  // traduz a resposta do Google para algo que dá para agir
  function explain(status, msg, reason) {
    const m = String(msg || '');
    if (reason === 'API_KEY_INVALID' || /api key not valid|api_key_invalid/i.test(m)) return 'O Google diz que essa chave não existe. Confira se copiou a chave inteira, ou gere uma nova em aistudio.google.com/apikey.';
    if (/expired/i.test(m)) return 'Essa chave expirou. Gere uma nova em aistudio.google.com/apikey.';
    if (/referer|referrer|blocked|ip address|android|ios app/i.test(m)) return 'A chave tem uma restrição de uso (site, app ou IP) que bloqueia o Grana. No Google Cloud, em Credenciais, deixe a chave sem restrição de aplicativo — ou crie outra pelo AI Studio.';
    if (reason === 'SERVICE_DISABLED' || /has not been used|is disabled|not enabled/i.test(m)) return 'A API do Gemini está desligada no projeto dessa chave. O jeito mais fácil: crie a chave pelo aistudio.google.com/apikey, que já liga tudo sozinho.';
    if (/location is not supported|user location/i.test(m)) return 'O Google não liberou a IA grátis para a sua região ou conta.';
    if (/billing/i.test(m) && status !== 429) return 'O projeto dessa chave pede faturamento. Crie a chave pelo aistudio.google.com/apikey num projeto novo (grátis).';
    if (status === 403) return 'A chave não tem permissão para usar o Gemini (' + m + ').';
    return 'O Google respondeu: ' + m + ' (código ' + status + ').';
  }
  const reasonOf = (err) => ((err.details || []).find((d) => d.reason) || {}).reason;

  // modelos que a chave pode usar, perguntados ao próprio Google (os nomes mudam com o tempo)
  async function listModels(key) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
      if (!res.ok) return [];
      const b = await res.json();
      return (b.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => /flash/.test(n) && !/image|tts|audio|live|thinking|embedding/.test(n))
        .sort((a, b) => (b.includes('latest') - a.includes('latest')) || b.localeCompare(a));
    } catch (e) { return []; }
  }

  // testa a chave antes de salvar. Devolve { model, key, warn }.
  G.testGeminiKey = async (rawKey) => {
    const key = G.cleanKey(rawKey);
    // o formato só vira explicação quando o Google recusa (se ele mudar o formato, a chave boa passa)
    const shapeHint = () => /^AIza[0-9A-Za-z_-]{35}$/.test(key) ? ''
      : !key.startsWith('AIza') ? ' Ela também não tem cara de chave: as chaves do Google AI começam com "AIza". Talvez tenha copiado o nome ou o número do projeto.'
      : ` Ela tem ${key.length} caracteres, e o normal é 39: faltou ou sobrou um pedaço ao copiar. Use o botão de copiar ao lado da chave no AI Studio.`;
    const queue = MODELS.slice(), tried = new Set();
    let listed = false, limited = null;
    while (queue.length) {
      const model = queue.shift();
      if (tried.has(model)) continue;
      tried.add(model);
      let res;
      try {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda só: ok' }] }] }),
        });
      } catch (e) { throw new Error('Não consegui falar com o Google. Confira a internet e tente de novo.'); }
      if (res.ok) return { model, key };
      const b = await res.json().catch(() => ({}));
      const err = b.error || {}, msg = err.message || res.statusText;
      // modelo aposentado ou fora do plano: pergunta ao Google quais existem
      if (res.status === 404 || (res.status === 400 && /model/i.test(msg) && !/api key/i.test(msg))) {
        if (!listed) { listed = true; queue.push(...(await listModels(key))); }
        continue;
      }
      // limite ou servidor cheio: a chave É válida, então salva assim mesmo
      if (res.status === 429 || res.status === 503 || res.status === 500) { limited = limited || model; continue; }
      throw new Error(explain(res.status, msg, reasonOf(err)) + (res.status === 400 ? shapeHint() : ''));
    }
    if (limited) return { model: limited, key, warn: 'Chave aceita! O Google está no limite grátis agora; a leitura volta a funcionar em alguns minutos.' };
    throw new Error('A chave foi aceita, mas nenhum modelo de IA está liberado para ela. Crie a chave pelo aistudio.google.com/apikey.');
  };

  // ---------- motor 2: leitor local ----------
  async function ocrLocal(imgUrl, onProgress) {
    if (!window.Tesseract) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        sc.onload = res; sc.onerror = () => rej(new Error('Não consegui baixar o leitor. Na primeira vez é preciso internet.'));
        document.head.appendChild(sc);
      });
    }
    const r = await window.Tesseract.recognize(imgUrl, 'por', { logger: (m) => m.status === 'recognizing text' && onProgress(m.progress) });
    return r.data.text || '';
  }

  const MONEY_END = /(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})\s*[A-Z]?\s*$/;
  function parseLocal(text, hint) {
    const lines = text.split(/\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const all = G.norm(text);
    const isPayslip = hint === 'payslip' || (hint === 'auto' && /contracheque|holerite|recibo de pagamento|demonstrativo de pagamento|vencimentos|proventos/.test(all));
    const dm = text.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    const date = dm ? (dm[3].length === 2 ? '20' + dm[3] : dm[3]) + '-' + dm[2] + '-' + dm[1] : G.today();
    const merchant = (lines.find((l) => /[A-Za-z]{3}/.test(l) && !/cnpj|cpf|ie:|endere|rua |av\.|documento/i.test(l)) || '').slice(0, 40);
    if (isPayslip) return parsePayslipText(lines, date, merchant);
    const isBill = hint === 'bill' || (hint !== 'receipt' && (/linha digitavel|beneficiario|cedente|nosso numero|ficha de compensacao|recibo do pagador|sacado/.test(all) || !!findBarcode(text)));
    if (isBill) return parseBillText(text, lines);

    let total = 0;
    const items = [];
    for (const l of lines) {
      const n = G.norm(l);
      const m = l.match(MONEY_END);
      if (!m) continue;
      const v = G.parseMoney(m[1]) / 100;
      if (/valor a pagar|valor pago|total r|valor total|^total/.test(n)) { if (v > total) total = v; continue; }
      if (/troco|subtotal|sub total|desconto|dinheiro|cartao|credito|debito|pix|tributos|lei|icms|pis|cofins|qtd|itens|acrescimo/.test(n)) continue;
      const name = l.replace(MONEY_END, '').replace(/^\d{1,4}\s+/, '').replace(/\d{6,14}/g, '').replace(/\d+[,.]?\d*\s*(un|kg|lt|l|pc|cx|g)\s*(x|\*)?\s*[\d.,]*/ig, '').replace(/\s+/g, ' ').trim();
      if (name.length < 3 || v <= 0) continue;
      items.push({ name: G.cap(name.toLowerCase()), qty: 1, amount: v, category: G.guessItemCategory(name) });
    }
    if (!total) total = items.reduce((a, i) => a + i.amount, 0);
    const kind = hint === 'invoice' ? (G.guessCategory(merchant) || 'outros') : null;
    if (!items.length && total) items.push({ name: merchant || 'Compra', qty: 1, amount: total, category: kind || 'outros' });
    if (kind && items.length > 0) items.forEach((i) => (i.category = G.guessCategory(i.name) || kind));
    return { docType: hint === 'invoice' ? 'invoice' : 'receipt', kind: 'expense', merchant, date, total, items, discount: 0, engine: 'local' };
  }

  // ---------- boleto ----------
  // A linha digitável carrega o valor (e, no boleto bancário, o vencimento) e tem dígitos
  // verificadores: quando eles conferem, o número é exato — melhor que qualquer leitura de rótulo.
  function findBarcode(text) {
    const cands = (text.match(/\d[\d .\-]{38,70}\d/g) || []).map((x) => x.replace(/\D/g, ''));
    // linha digitável quebrada em duas: tenta também a junção de linhas vizinhas
    const ls = text.split(/\n/).map((l) => l.replace(/\D/g, ''));
    for (let i = 0; i < ls.length - 1; i++) if (ls[i].length >= 20) cands.push(ls[i] + ls[i + 1]);
    for (const c of cands) { const d = decodeBarcode(c); if (d) return d; }
    return null;
  }
  const mod10 = (num) => { let sum = 0, w = 2; for (let i = num.length - 1; i >= 0; i--) { let p = Number(num[i]) * w; if (p > 9) p = Math.floor(p / 10) + (p % 10); sum += p; w = w === 2 ? 1 : 2; } return (10 - (sum % 10)) % 10; };
  const mod11Bank = (num) => { let sum = 0, w = 2; for (let i = num.length - 1; i >= 0; i--) { sum += Number(num[i]) * w; w = w === 9 ? 2 : w + 1; } const r = 11 - (sum % 11); return r === 0 || r === 10 || r === 11 ? 1 : r; };
  const mod11Conv = (num) => { let sum = 0, w = 2; for (let i = num.length - 1; i >= 0; i--) { sum += Number(num[i]) * w; w = w === 9 ? 2 : w + 1; } const r = sum % 11; return r === 0 || r === 1 ? 0 : 11 - r; };
  function decodeBarcode(d) {
    if (d.length === 47) {
      // bancário: AAABC.CCCCX DDDDD.DDDDDY EEEEE.EEEEEZ K UUUUVVVVVVVVVV
      const bar = d.slice(0, 4) + d[32] + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
      if (mod11Bank(bar.slice(0, 4) + bar.slice(5)) !== Number(bar[4])) return null;
      const fator = Number(d.slice(33, 37)), value = Number(d.slice(37, 47));
      let due = null;
      if (fator >= 1000) {
        // o fator recomeçou em 1000 em 22/02/2025; fica a data mais perto de hoje
        const a = G.addDays('1997-10-07', fator), b = G.addDays('2025-02-22', fator - 1000);
        const dist = (x) => Math.abs(G.parseDate(x) - new Date());
        due = dist(a) < dist(b) ? a : b;
      }
      return { kind: 'bank', value, due };
    }
    if (d.length === 48 && d[0] === '8') {
      const blocks = [0, 1, 2, 3].map((i) => d.slice(i * 12, i * 12 + 12));
      const ref = d[2];
      const check = ref === '6' || ref === '7' ? mod10 : mod11Conv;
      if (!blocks.every((b) => check(b.slice(0, 11)) === Number(b[11]))) return null;
      const bar = blocks.map((b) => b.slice(0, 11)).join('');
      const value = ref === '6' || ref === '8' ? Number(bar.slice(4, 15)) : 0;
      const segment = { 1: 'impostos', 2: 'contas', 3: 'contas', 4: 'contas', 5: 'impostos', 7: 'tarifas' }[bar[1]] || null;
      return { kind: 'convenio', value, due: null, segment };
    }
    return null;
  }
  G._decodeBarcode = decodeBarcode;

  function parseBillText(text, lines) {
    const n = lines.map((l) => G.norm(l));
    const moneyIn = (l) => { const m = l.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g); return m ? G.parseMoney(m[m.length - 1]) : 0; };
    const dateIn = (l) => { const m = l.match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : null; };
    // o valor pode estar na mesma linha do rótulo ou logo abaixo (formulário de boleto)
    const near = (re, get) => { for (let i = 0; i < n.length; i++) if (re.test(n[i])) for (let j = i; j <= Math.min(i + 2, n.length - 1); j++) { const v = get(lines[j]); if (v) return v; } return 0; };
    let value = near(/valor cobrado/, moneyIn) || near(/valor do documento|valor documento|valor a pagar|total a pagar|valor total/, moneyIn);
    let due = near(/vencimento/, dateIn) || null;
    const code = findBarcode(text);
    if (code && code.value) value = code.value;
    if (code && code.due) due = code.due;
    // beneficiário: o resto da linha do rótulo ou a linha de baixo — sem CNPJ, agência, endereço
    let merchant = '';
    for (let i = 0; i < n.length && !merchant; i++) {
      if (!/beneficiario|cedente/.test(n[i]) || /pagador|sacado/.test(n[i])) continue;
      const after = lines[i].split(/benefici[aá]rio|cedente/i)[1] || '';
      const cands = [after.replace(/^[^A-Za-zÀ-ú]*/, ''), lines[i + 1] || '', lines[i + 2] || ''];
      merchant = cands.map((c) => c.replace(/(cnpj|cpf)[:\s].*$/i, '').replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}.*$/, '').replace(/ag[eê]ncia.*$/i, '').trim())
        .find((c) => /[A-Za-zÀ-ú]{3}/.test(c) && !/c[oó]digo|ag[eê]ncia|endere|nosso|cnpj|cpf|^sacador/i.test(c)) || '';
    }
    merchant = merchant.replace(/\s+/g, ' ').slice(0, 50);
    const cat = G.guessCategory(merchant) || (code && code.segment) || 'outros';
    const ref = text.match(/(?:ref(?:er[eê]ncia)?|compet[eê]ncia)[:\s]*(\d{2})\/(\d{4})/i) || [];
    const label = merchant ? merchant + (ref[1] ? ` ${G.MONTHS[Number(ref[1]) - 1]}/${ref[2]}` : '') : 'Boleto';
    return { docType: 'bill', kind: 'expense', merchant: merchant || 'Boleto', date: due || G.today(), total: value / 100, items: value ? [{ name: label, qty: 1, amount: value / 100, category: cat }] : [], barcodeChecked: !!(code && code.value), engine: 'local' };
  }

  function parsePayslipText(lines, date, merchant) {
    const earnings = [], deductions = [];
    let net = 0;
    const EARN = /salario|ordenado|hora extra|horas extras|adicional|ferias|13|decimo|comissao|gratificacao|dsr|premio|bonus|abono|insalubridade|periculosidade|noturno/;
    const DED = /inss|irrf|imposto|vale transp|v transp|plano|saude|odonto|unimed|pensao|emprestimo|consignado|falta|atraso|adiantamento|contribuicao|sindical|refeicao|alimentacao|seguro|desconto|coparticipacao/;
    for (const l of lines) {
      const m = l.match(MONEY_END);
      if (!m) continue;
      const raw = l.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const v = G.parseMoney(m[1]) / 100;
      if (/liquido/.test(raw)) { net = Math.max(net, v); continue; }
      if (/total|base de calc|base calc|base inss|base irrf|base fgts|fgts|bruto|sal(ario)? contr|faixa/.test(raw)) continue;
      const name = G.cap(l.replace(MONEY_END, '').replace(MONEY_END, '').replace(/^\d{1,5}\s+/, '').replace(/\s\d+[,.]\d+\s*$/, '').trim().toLowerCase())
        .replace(/\b(inss|irrf|fgts|vt|vr|va|dsr|plr)\b/gi, (m) => m.toUpperCase());
      if (DED.test(raw)) deductions.push({ name, amount: v, category: dedCategory(raw) });
      else if (EARN.test(raw)) earnings.push({ name, amount: v, category: /ferias|13|decimo|bonus|premio|gratificacao|comissao|hora extra|horas extras|plr/.test(raw) ? 'adicionais' : 'salario' });
    }
    const gross = earnings.reduce((a, e) => a + e.amount, 0);
    const ded = deductions.reduce((a, e) => a + e.amount, 0);
    if (!net) net = gross - ded;
    return { docType: 'payslip', kind: 'income', merchant: merchant || 'Empresa', date, total: net, items: earnings, payslip: { employer: merchant, gross, net, earnings, deductions }, engine: 'local' };
  }
  function dedCategory(raw) {
    if (/inss|irrf|imposto|contribuicao|sindical/.test(raw)) return 'impostos';
    if (/plano|saude|odonto|unimed|coparticipacao/.test(raw)) return 'saude';
    if (/transp/.test(raw)) return 'transporte';
    if (/refeicao|alimentacao/.test(raw)) return 'restaurante';
    if (/pensao/.test(raw)) return 'filhos';
    if (/emprestimo|consignado/.test(raw)) return 'dividas';
    return 'outros';
  }

  // ---------- normalização: tudo em centavos, categorias válidas ----------
  function normalize(r) {
    const validExp = new Set(G.cats('expense').map((c) => c.id)), validInc = new Set(G.cats('income').map((c) => c.id));
    const kind = r.docType === 'payslip' ? 'income' : (r.kind === 'income' ? 'income' : 'expense');
    const fixCat = (c, k, name) => {
      const ok = k === 'income' ? validInc : validExp;
      if (ok.has(c)) return c;
      const g = k === 'income' ? G.guessCategory(name, 'income') : (r.docType === 'receipt' ? G.guessItemCategory(name) : G.guessCategory(name));
      return g && ok.has(g) ? g : (k === 'income' ? 'outras_receitas' : 'outros');
    };
    const cents = (v) => Math.round((Number(v) || 0) * 100);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') && r.date <= G.addDays(G.today(), r.docType === 'bill' ? 370 : 40) && r.date >= '2000-01-01' ? r.date : G.today();
    const out = {
      docType: r.docType || 'other', kind, date, engine: r.engine || 'ia',
      merchant: (r.merchant || '').trim() || (kind === 'income' ? 'Salário' : 'Compra'),
      total: cents(r.total),
      discount: cents(r.discount),
      items: (r.items || []).filter((i) => Number(i.amount) > 0).map((i) => ({ name: (i.name || 'Item').trim(), qty: i.qty || 1, amount: cents(i.amount), categoryId: fixCat(i.category, kind, i.name || '') })),
    };
    if (r.payslip) {
      const p = r.payslip;
      out.payslip = {
        employer: p.employer || out.merchant, reference: p.reference || '',
        earnings: (p.earnings || []).filter((e) => Number(e.amount) > 0).map((e) => ({ name: e.name, amount: cents(e.amount), categoryId: fixCat(e.category, 'income', e.name) })),
        deductions: (p.deductions || []).filter((e) => Number(e.amount) > 0).map((e) => ({ name: e.name, amount: cents(e.amount), categoryId: fixCat(e.category, 'expense', e.name) })),
      };
      out.payslip.gross = G.sum(out.payslip.earnings, (e) => e.amount) || cents(p.gross);
      out.payslip.net = cents(p.net) || out.payslip.gross - G.sum(out.payslip.deductions, (e) => e.amount);
      out.total = out.payslip.net;
    }
    // "CONDOMINIO EDIFICIO AURORA" → "Condominio Edificio Aurora"
    const SMALL = ['de', 'da', 'do', 'das', 'dos', 'e'], KEEP = ['LTDA', 'S/A', 'ME', 'EIRELI', 'SA'];
    const tidy = (x) => (x || '').split(' ').map((w, i) => (/^[A-ZÀ-Ú][A-ZÀ-Ú.\/]+$/.test(w) && !KEEP.includes(w)
      ? (i && SMALL.includes(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()) : w)).join(' ');
    out.merchant = tidy(out.merchant);
    if (out.docType === 'bill') out.items.forEach((i) => (i.name = tidy(i.name)));
    if (r.barcode) {
      const code = decodeBarcode(String(r.barcode).replace(/\D/g, ''));
      if (code && code.value) {
        if (out.items.length === 1) out.items[0].amount = code.value;
        out.total = code.value; out.barcodeChecked = true;
      }
      if (code && code.due) out.date = code.due;
    }
    if (r.barcodeChecked) out.barcodeChecked = true;
    if (!out.items.length && out.total && !out.payslip) out.items.push({ name: out.merchant, qty: 1, amount: out.total, categoryId: fixCat(null, kind, out.merchant) });
    if (!out.total) out.total = G.sum(out.items, (i) => i.amount) - out.discount;
    return out;
  }

  // ---------- conferência ----------
  function review(d, preview) {
    if (d.payslip) return reviewPayslip(d, preview);
    let mode = 'split';
    let accountId = G.state.settings.lastAccount || (G.activeAccounts()[0] || {}).id;
    const s = G.sheet(`
      <div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">Confira e salve</h3><span style="width:40px"></span></div>
      <div class="review-top">
        ${preview ? `<img class="review-img" src="${preview}" alt="">` : `<div class="review-img pdf">${G.icon('file', 34)}</div>`}
        <div class="review-meta">
          <span class="pill ${d.engine === 'local' ? '' : 'ai'}">${d.engine === 'local' ? 'leitor básico' : G.icon('sparkles', 12) + ' lido pela IA'}</span>
          <input id="rvMerchant" class="desc-input" value="${G.esc(d.merchant)}">
          <div class="review-line"><label class="chip">${G.icon('calendar', 16)}${d.docType === 'bill' ? '<small>vence</small>' : ''}<input type="date" id="rvDate" value="${d.date}"></label><b class="review-total" id="rvTotal"></b></div>
          ${d.barcodeChecked ? `<span class="pill ok">${G.icon('check', 12)} valor conferido pelo código de barras</span>` : ''}
        </div>
      </div>
      <div id="rvWarn"></div>
      <div class="sec-label">Por categoria</div><div id="rvSum"></div>
      <div class="sec-label">Itens <span class="muted">— toque na categoria para trocar</span></div>
      <div class="card flush" id="rvItems"></div>
      <button class="more-toggle" id="rvAdd">${G.icon('plus', 18)} Adicionar item</button>
      <div class="sec-label">${d.docType === 'bill' ? 'Pagar com' : 'Pago com'}</div><div id="rvAcc"></div>
      ${d.docType === 'bill' ? `<div class="sec-label">Situação</div>
        <div class="seg wide" id="rvStatus"><button data-s="pending">Pagar no vencimento</button><button data-s="paid">Já paguei</button></div>
        <label class="chip paid-date hidden" id="rvPaidWrap">${G.icon('calendar', 16)}<small>pago em</small><input type="date" id="rvPaid" value="${G.today()}" max="${G.today()}"></label>
        <p class="muted small" id="rvStatusTxt"></p>
        <label class="check"><input type="checkbox" id="rvRec"> Chega todo mês (condomínio, escola…) — criar conta fixa</label>` : ''}
      <div class="sec-label">Como lançar</div>
      <div class="seg wide" id="rvMode"><button data-m="split" class="on">1 lançamento dividido</button><button data-m="each">1 por categoria</button></div>
      <div class="add-foot"><button class="btn primary big" id="rvSave">Salvar</button></div>`, { wide: true, full: true });
    const el = s.el;
    const paint = () => {
      const sumItems = G.sum(d.items, (i) => i.amount);
      const totalNow = sumItems - d.discount;
      el.querySelector('#rvTotal').textContent = G.money(totalNow, { force: true });
      const diff = d.total - totalNow;
      el.querySelector('#rvWarn').innerHTML = d.total && Math.abs(diff) > 2
        ? `<div class="warn-box">${G.icon('alert', 18)}<span>Os itens somam ${G.money(totalNow, { force: true })}, mas a nota diz ${G.money(d.total, { force: true })}. <a href="#" id="fixDiff">Ajustar a diferença</a> ou confira os valores.</span></div>` : '';
      const fx = el.querySelector('#fixDiff');
      if (fx) fx.onclick = (e) => { e.preventDefault(); d.items.push({ name: diff > 0 ? 'Diferença (taxas/itens não lidos)' : 'Desconto', qty: 1, amount: diff, categoryId: (G.byCategory([{ type: 'expense', amount: 0, splits: d.items.map((i) => ({ categoryId: i.categoryId, amount: i.amount })) }], 'expense')[0] || {}).categoryId || 'outros' }); paint(); };
      const groups = {};
      d.items.forEach((i) => (groups[i.categoryId] = (groups[i.categoryId] || 0) + i.amount));
      const rows = Object.entries(groups).sort((a, b) => b[1] - a[1]);
      const tot = Math.max(1, G.sum(rows, (r) => r[1]));
      el.querySelector('#rvSum').innerHTML = `<div class="stack-bar">${rows.map(([c, v]) => `<i style="width:${v / tot * 100}%;background:${G.cat(c).color}"></i>`).join('')}</div>
        <div class="legend">${rows.map(([c, v]) => `<span>${G.cat(c).icon} ${G.esc(G.cat(c).name)} <b>${G.money(v, { force: true })}</b></span>`).join('')}</div>`;
      el.querySelector('#rvItems').innerHTML = d.items.map((i, idx) => `<div class="item-row" data-i="${idx}">
        <button class="item-cat" data-cat="${idx}">${G.catBadge(G.cat(i.categoryId), 34)}</button>
        <div class="item-main"><input class="item-name" data-n="${idx}" value="${G.esc(i.name)}"><small>${G.esc(G.cat(i.categoryId).name)}${i.qty > 1 ? ' · ' + String(i.qty).replace('.', ',') + ' un' : ''}</small></div>
        <input class="item-amt" data-a="${idx}" inputmode="decimal" value="${(i.amount / 100).toFixed(2).replace('.', ',')}">
        <button class="icon-btn sm" data-rm="${idx}">${G.icon('x', 16)}</button></div>`).join('') || '<div class="empty small">Nenhum item.</div>';
      G.$$('[data-cat]', el).forEach((b) => (b.onclick = () => pickCat('expense', d.items[b.dataset.cat].categoryId, (id) => {
        const it = d.items[b.dataset.cat];
        // mesma categoria para itens com o mesmo nome — e o app aprende
        it.categoryId = id; G.learn(it.name, id, 'item'); paint();
      })));
      G.$$('[data-n]', el).forEach((inp) => (inp.onchange = () => (d.items[inp.dataset.n].name = inp.value)));
      G.$$('[data-a]', el).forEach((inp) => (inp.onchange = () => { d.items[inp.dataset.a].amount = G.parseMoney(inp.value); paint(); }));
      G.$$('[data-rm]', el).forEach((b) => (b.onclick = () => { d.items.splice(Number(b.dataset.rm), 1); paint(); }));
    };
    // itens que o usuário já reclassificou antes voltam com a categoria dele
    d.items.forEach((i) => { const r = G.state.rules['item:' + G.norm(i.name)]; if (r) i.categoryId = r; });
    paint();
    el.querySelector('#rvAdd').onclick = () => { d.items.push({ name: 'Item', qty: 1, amount: 0, categoryId: 'mercado' }); paint(); };
    el.querySelector('#rvAcc').appendChild(G.accountChips(accountId, (id) => (accountId = id)));
    // boleto lido antes do vencimento costuma ser conta a pagar; depois, quase sempre já foi pago
    let billPaid = d.docType === 'bill' && d.date <= G.today();
    const paintStatus = () => {
      if (d.docType !== 'bill') return;
      G.$$('#rvStatus button', el).forEach((b) => b.classList.toggle('on', (b.dataset.s === 'paid') === billPaid));
      el.querySelector('#rvPaidWrap').classList.toggle('hidden', !billPaid);
      el.querySelector('#rvStatusTxt').textContent = billPaid ? 'Lançado na data do pagamento; o vencimento fica guardado.' : 'Fica "a pagar" na data do vencimento: aparece no fluxo de caixa do Início e não mexe no saldo até você marcar como pago.';
    };
    G.$$('#rvStatus button', el).forEach((b) => (b.onclick = () => { billPaid = b.dataset.s === 'paid'; paintStatus(); }));
    paintStatus();
    G.$$('#rvMode button', el).forEach((b) => (b.onclick = () => { mode = b.dataset.m; G.$$('#rvMode button', el).forEach((x) => x.classList.toggle('on', x === b)); }));
    el.querySelector('#rvSave').onclick = () => {
      const merchant = el.querySelector('#rvMerchant').value.trim() || d.merchant;
      const due = el.querySelector('#rvDate').value || d.date;
      const isBill = d.docType === 'bill';
      const date = isBill && billPaid ? (el.querySelector('#rvPaid').value || G.today()) : due;
      const status = isBill ? (billPaid ? { due } : { pending: true, due }) : {};
      if (d.discount) d.items.push({ name: 'Desconto', qty: 1, amount: -d.discount, categoryId: d.items[0] ? d.items[0].categoryId : 'outros' });
      const groups = {};
      d.items.forEach((i) => { (groups[i.categoryId] = groups[i.categoryId] || []).push(i); });
      const total = G.sum(d.items, (i) => i.amount);
      if (total <= 0) { G.toast('O total precisa ser maior que zero', { icon: 'alert' }); return; }
      const items = d.items.map((i) => ({ name: i.name, qty: i.qty, amount: i.amount, categoryId: i.categoryId }));
      const cats = Object.keys(groups);
      if (mode === 'split' || cats.length === 1) {
        const splits = cats.map((c) => ({ categoryId: c, amount: G.sum(groups[c], (i) => i.amount) })).filter((x) => x.amount).sort((a, b) => b.amount - a.amount);
        G.addTx({ type: d.kind, amount: total, date, desc: merchant, categoryId: splits[0].categoryId, accountId, splits: splits.length > 1 ? splits : undefined, items, source: 'scan', ...status });
      } else {
        for (const c of cats) {
          const amt = G.sum(groups[c], (i) => i.amount);
          if (amt > 0) G.addTx({ type: d.kind, amount: amt, date, desc: `${merchant} · ${G.cat(c).name}`, categoryId: c, accountId, items: groups[c], source: 'scan', ...status });
        }
      }
      const rec = el.querySelector('#rvRec');
      if (rec && rec.checked) {
        // o próximo boleto aparece no Início para confirmar; o valor pode ser ajustado na hora
        const main = cats.sort((a, b) => G.sum(groups[b], (i) => i.amount) - G.sum(groups[a], (i) => i.amount))[0];
        const last = G.state.tx[G.state.tx.length - 1];
        const r = { id: G.uid(), type: 'expense', amount: total, desc: merchant, categoryId: main, accountId, freq: 'monthly', day: Number(due.slice(8, 10)), start: due, done: { [due]: last.id } };
        G.state.recurring.push(r); last.recurringId = r.id;
      }
      G.state.settings.lastAccount = accountId;
      G.save(); G.render(); s.close();
      if (isBill) { G.toast(billPaid ? `Boleto de ${G.money(total)} pago em ${G.shortDate(date)}` : `Boleto de ${G.money(total)} a pagar em ${G.shortDate(due)}`, { icon: 'sparkles' }); return; }
      G.toast(`Nota de ${G.money(total)} lançada em ${cats.length} categoria(s)`, { icon: 'sparkles' });
    };
  }

  function reviewPayslip(d, preview) {
    const p = d.payslip;
    let mode = 'detail';
    let accountId = G.activeAccounts().find((a) => a.type === 'checking') ? G.activeAccounts().find((a) => a.type === 'checking').id : (G.activeAccounts()[0] || {}).id;
    const s = G.sheet(`
      <div class="add-head"><button class="icon-btn" data-close>${G.icon('x')}</button><h3 class="sheet-title" style="margin:0">Contracheque</h3><span style="width:40px"></span></div>
      <div class="review-top">
        ${preview ? `<img class="review-img" src="${preview}" alt="">` : `<div class="review-img pdf">${G.icon('file', 34)}</div>`}
        <div class="review-meta"><span class="pill ${d.engine === 'local' ? '' : 'ai'}">${d.engine === 'local' ? 'leitor básico' : G.icon('sparkles', 12) + ' lido pela IA'}</span>
          <input id="psEmp" class="desc-input" value="${G.esc(p.employer || d.merchant)}">
          <label class="chip">${G.icon('calendar', 16)}<input type="date" id="psDate" value="${d.date}"></label></div>
      </div>
      <div class="payslip-flow">
        <div><small>Bruto</small><b class="pos" id="psGross"></b></div><span>−</span>
        <div><small>Descontos</small><b class="neg" id="psDed"></b></div><span>=</span>
        <div><small>Líquido</small><b id="psNet"></b></div>
      </div>
      <div id="psBar"></div>
      <div class="sec-label">Vencimentos (o que você ganhou)</div><div class="card flush" id="psEarn"></div>
      <div class="sec-label">Descontos (para onde foi antes de cair na conta)</div><div class="card flush" id="psDeds"></div>
      <div class="sec-label">Caiu na conta</div><div id="psAcc"></div>
      <div class="sec-label">Como lançar</div>
      <div class="seg wide" id="psMode"><button data-m="detail" class="on">Bruto + descontos</button><button data-m="net">Só o líquido</button></div>
      <small class="muted block" id="psModeTxt"></small>
      <div class="add-foot"><button class="btn primary big" id="psSave">Salvar</button></div>`, { wide: true, full: true });
    const el = s.el;
    const lines = (arr, kind, key) => arr.map((e, i) => `<div class="item-row"><button class="item-cat" data-k="${key}" data-i="${i}">${G.catBadge(G.cat(e.categoryId), 34)}</button>
      <div class="item-main"><input class="item-name" data-nk="${key}" data-i="${i}" value="${G.esc(e.name)}"><small>${G.esc(G.cat(e.categoryId).name)}</small></div>
      <input class="item-amt" data-ak="${key}" data-i="${i}" inputmode="decimal" value="${(e.amount / 100).toFixed(2).replace('.', ',')}"><button class="icon-btn sm" data-rk="${key}" data-i="${i}">${G.icon('x', 16)}</button></div>`).join('') || '<div class="empty small">Nada lido aqui.</div>';
    const paint = () => {
      const gross = G.sum(p.earnings, (e) => e.amount), ded = G.sum(p.deductions, (e) => e.amount), net = gross - ded;
      el.querySelector('#psGross').textContent = G.money(gross, { force: true });
      el.querySelector('#psDed').textContent = G.money(ded, { force: true });
      el.querySelector('#psNet').textContent = G.money(net, { force: true });
      el.querySelector('#psBar').innerHTML = gross ? `<div class="stack-bar">${[...p.deductions.map((e) => [G.cat(e.categoryId).color, e.amount, e.name]), ['var(--income)', net, 'Líquido']].map(([c, v, n]) => `<i title="${G.esc(n)}" style="width:${Math.max(0, v) / gross * 100}%;background:${c}"></i>`).join('')}</div>
        <p class="muted small">De cada R$ 100 ganhos, R$ ${(ded / gross * 100).toFixed(0)} ficam em descontos.</p>` : '';
      el.querySelector('#psEarn').innerHTML = lines(p.earnings, 'income', 'earnings');
      el.querySelector('#psDeds').innerHTML = lines(p.deductions, 'expense', 'deductions');
      G.$$('[data-k]', el).forEach((b) => (b.onclick = () => { const arr = p[b.dataset.k]; pickCat(b.dataset.k === 'earnings' ? 'income' : 'expense', arr[b.dataset.i].categoryId, (id) => { arr[b.dataset.i].categoryId = id; paint(); }); }));
      G.$$('[data-nk]', el).forEach((i) => (i.onchange = () => (p[i.dataset.nk][i.dataset.i].name = i.value)));
      G.$$('[data-ak]', el).forEach((i) => (i.onchange = () => { p[i.dataset.ak][i.dataset.i].amount = G.parseMoney(i.value); paint(); }));
      G.$$('[data-rk]', el).forEach((b) => (b.onclick = () => { p[b.dataset.rk].splice(Number(b.dataset.i), 1); paint(); }));
      el.querySelector('#psModeTxt').textContent = mode === 'detail'
        ? 'Cada vencimento vira uma receita e cada desconto uma despesa (INSS, IR, plano…). O saldo da conta fica igual ao líquido, e as análises mostram quanto o salário perde no caminho.'
        : 'Um único lançamento com o valor líquido. Os detalhes ficam guardados na observação.';
    };
    paint();
    el.querySelector('#psAcc').appendChild(G.accountChips(accountId, (id) => (accountId = id)));
    G.$$('#psMode button', el).forEach((b) => (b.onclick = () => { mode = b.dataset.m; G.$$('#psMode button', el).forEach((x) => x.classList.toggle('on', x === b)); paint(); }));
    el.querySelector('#psSave').onclick = () => {
      const emp = el.querySelector('#psEmp').value.trim() || 'Salário';
      const date = el.querySelector('#psDate').value || d.date;
      const gross = G.sum(p.earnings, (e) => e.amount), ded = G.sum(p.deductions, (e) => e.amount);
      if (gross - ded <= 0 && mode === 'net') { G.toast('Líquido precisa ser maior que zero', { icon: 'alert' }); return; }
      const group = G.uid();
      if (mode === 'net') {
        const notes = 'Contracheque — ' + p.earnings.map((e) => `${e.name}: ${G.money(e.amount, { force: true })}`).concat(p.deductions.map((e) => `${e.name}: −${G.money(e.amount, { force: true })}`)).join(' · ');
        G.addTx({ type: 'income', amount: gross - ded, date, desc: emp, categoryId: 'salario', accountId, notes, source: 'scan', payslip: group });
      } else {
        p.earnings.forEach((e) => G.addTx({ type: 'income', amount: e.amount, date, desc: `${e.name} · ${emp}`, categoryId: e.categoryId, accountId, source: 'scan', payslip: group }));
        p.deductions.forEach((e) => G.addTx({ type: 'expense', amount: e.amount, date, desc: `${e.name} (contracheque)`, categoryId: e.categoryId, accountId, source: 'scan', payslip: group }));
      }
      G.save(); G.render(); s.close();
      G.toast(`Contracheque lançado: líquido de ${G.money(gross - ded)}`, { icon: 'sparkles' });
    };
  }

  // seletor de categoria compacto, por cima da conferência
  function pickCat(kind, selected, onPick) {
    const s = G.sheet(`<h3 class="sheet-title">Categoria</h3><div id="pc"></div>`);
    s.el.querySelector('#pc').appendChild(G.catGrid(kind, selected, (id) => { onPick(id); s.close(); }));
  }
  G.pickCat = pickCat;
})(window.G);
