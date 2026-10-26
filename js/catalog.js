/* Categorias, contas iniciais e o dicionário que classifica sozinho
   (descrição de lançamento e item de nota fiscal). */
(function (G) {
  G.DEFAULT_CATEGORIES = [
    // despesas
    { id: 'mercado', name: 'Mercado', kind: 'expense', icon: '🛒', color: '#16A34A' },
    { id: 'restaurante', name: 'Restaurantes', kind: 'expense', icon: '🍽️', color: '#EA580C' },
    { id: 'delivery', name: 'Delivery', kind: 'expense', icon: '🛵', color: '#DC2626' },
    { id: 'padaria', name: 'Padaria e café', kind: 'expense', icon: '☕', color: '#A16207' },
    { id: 'moradia', name: 'Moradia', kind: 'expense', icon: '🏠', color: '#7C3AED' },
    { id: 'contas', name: 'Contas da casa', kind: 'expense', icon: '💡', color: '#CA8A04' },
    { id: 'transporte', name: 'Transporte', kind: 'expense', icon: '🚌', color: '#2563EB' },
    { id: 'combustivel', name: 'Combustível', kind: 'expense', icon: '⛽', color: '#0369A1' },
    { id: 'saude', name: 'Saúde', kind: 'expense', icon: '🩺', color: '#E11D48' },
    { id: 'farmacia', name: 'Farmácia', kind: 'expense', icon: '💊', color: '#DB2777' },
    { id: 'educacao', name: 'Educação', kind: 'expense', icon: '📚', color: '#4F46E5' },
    { id: 'lazer', name: 'Lazer', kind: 'expense', icon: '🎉', color: '#C026D3' },
    { id: 'assinaturas', name: 'Assinaturas', kind: 'expense', icon: '📺', color: '#9333EA' },
    { id: 'compras', name: 'Compras', kind: 'expense', icon: '🛍️', color: '#0891B2' },
    { id: 'vestuario', name: 'Vestuário', kind: 'expense', icon: '👕', color: '#0D9488' },
    { id: 'casa', name: 'Casa e limpeza', kind: 'expense', icon: '🧽', color: '#65A30D' },
    { id: 'higiene', name: 'Higiene e beleza', kind: 'expense', icon: '🧴', color: '#EC4899' },
    { id: 'bebidas', name: 'Bebidas', kind: 'expense', icon: '🍺', color: '#D97706' },
    { id: 'pets', name: 'Pets', kind: 'expense', icon: '🐾', color: '#B45309' },
    { id: 'filhos', name: 'Filhos', kind: 'expense', icon: '🧸', color: '#F97316' },
    { id: 'viagem', name: 'Viagem', kind: 'expense', icon: '✈️', color: '#0EA5E9' },
    { id: 'presentes', name: 'Presentes e doações', kind: 'expense', icon: '🎁', color: '#F43F5E' },
    { id: 'impostos', name: 'Impostos', kind: 'expense', icon: '🏛️', color: '#64748B' },
    { id: 'tarifas', name: 'Tarifas e juros', kind: 'expense', icon: '🏦', color: '#991B1B' },
    { id: 'dividas', name: 'Empréstimos e dívidas', kind: 'expense', icon: '📉', color: '#7F1D1D' },
    { id: 'investir', name: 'Investimentos', kind: 'expense', icon: '📈', color: '#047857' },
    { id: 'outros', name: 'Outros', kind: 'expense', icon: '📦', color: '#78716C' },
    // receitas
    { id: 'salario', name: 'Salário', kind: 'income', icon: '💼', color: '#15803D' },
    { id: 'adicionais', name: 'Bônus, 13º e férias', kind: 'income', icon: '⭐', color: '#16A34A' },
    { id: 'beneficios', name: 'Benefícios (VR/VA)', kind: 'income', icon: '🎫', color: '#22C55E' },
    { id: 'extra', name: 'Renda extra', kind: 'income', icon: '🧰', color: '#0D9488' },
    { id: 'rendimentos', name: 'Rendimentos', kind: 'income', icon: '💹', color: '#059669' },
    { id: 'vendas', name: 'Vendas', kind: 'income', icon: '🏷️', color: '#0891B2' },
    { id: 'reembolso', name: 'Reembolsos', kind: 'income', icon: '↩️', color: '#2563EB' },
    { id: 'outras_receitas', name: 'Outras receitas', kind: 'income', icon: '💰', color: '#65A30D' },
  ];

  G.DEFAULT_ACCOUNTS = [
    { id: 'conta', name: 'Conta corrente', type: 'checking', color: '#0E7C66', initial: 0 },
    { id: 'carteira', name: 'Carteira', type: 'cash', color: '#CA8A04', initial: 0 },
  ];

  G.ACCOUNT_TYPES = {
    checking: { label: 'Conta corrente', icon: 'bank' },
    savings: { label: 'Poupança / reserva', icon: 'piggy' },
    cash: { label: 'Dinheiro', icon: 'wallet' },
    credit: { label: 'Cartão de crédito', icon: 'card' },
    invest: { label: 'Investimentos', icon: 'trend' },
  };

  G.PALETTE = ['#0E7C66', '#16A34A', '#65A30D', '#CA8A04', '#D97706', '#EA580C', '#DC2626', '#E11D48', '#DB2777', '#C026D3', '#9333EA', '#7C3AED', '#4F46E5', '#2563EB', '#0369A1', '#0891B2', '#0D9488', '#64748B', '#78716C', '#1F2937'];
  G.EMOJIS = ['🛒', '🍽️', '🛵', '☕', '🏠', '💡', '🚌', '⛽', '🚗', '🩺', '💊', '📚', '🎉', '📺', '🛍️', '👕', '🧽', '🧴', '🍺', '🐾', '🧸', '✈️', '🎁', '🏛️', '🏦', '📉', '📈', '📦', '💼', '⭐', '🎫', '🧰', '💹', '🏷️', '↩️', '💰', '🎮', '🏋️', '💇', '📱', '💻', '🔧', '🎵', '⚽', '🍕', '🍔', '🍷', '🚕', '🅿️', '🧾', '💳', '🏥', '🦷', '👶', '🎓', '🌱', '🔌', '📦', '❤️', '⛪'];

  // Palavra-chave → categoria. Vale para descrição ("UBER *TRIP") e para item de nota ("DET LIQ YPE").
  // A ordem importa: a primeira regra que casar vence.
  G.KEYWORDS = [
    ['delivery', /\b(ifood|i food|rappi|ze delivery|aiqfome|delivery)\b/],
    ['transporte', /\b(uber|99 ?pop|99app|cabify|taxi|metro|metr[oô]|onibus|bilhete unico|sptrans|brt|pedagio|sem parar|conectcar|veloe|estacionamento|estapar|zona azul)\b/],
    ['combustivel', /\b(posto|shell|ipiranga|petrobras|br mania|combustivel|gasolina|etanol|diesel|alcool comum)\b/],
    ['assinaturas', /\b(netflix|spotify|disney|hbo|max|prime video|amazon prime|globoplay|youtube premium|deezer|apple com|icloud|google one|paramount|crunchyroll|chatgpt|openai|microsoft 365|xbox|playstation|psn|nintendo|kindle unlimited|gympass|wellhub|totalpass|smart fit|smartfit)\b/],
    ['farmacia', /\b(drogasil|droga raia|raia|drogaria|farmacia|pague menos|panvel|drogao|ultrafarma|dipirona|paracetamol|ibuprofeno|loratadina|amoxicilina|vitamina|medicamento|remedio)\b/],
    ['saude', /\b(unimed|amil|bradesco saude|sulamerica|hapvida|notredame|plano de saude|consulta|clinica|laboratorio|exame|hospital|dentista|odonto|psicolog|fisioterap)\b/],
    ['contas', /\b(enel|light|cemig|copel|celesc|coelba|cpfl|energisa|equatorial|sabesp|cedae|copasa|sanepar|comgas|naturgy|agua e esgoto|energia eletrica|conta de luz|vivo|claro|tim|oi fibra|net servicos|internet|telefone|celular recarga)\b/],
    ['moradia', /\b(aluguel|condominio|iptu|imobiliaria|quinto andar|financiamento imob)\b/],
    ['padaria', /\b(padaria|panificadora|cafeteria|starbucks|cafe |pao de queijo|confeitaria|doceria)\b/],
    ['restaurante', /\b(restaurante|lanchonete|pizzaria|churrascaria|bar e|burger|mcdonald|mc donalds|bk |burger king|subway|outback|habib|giraffas|spoleto|madero|coco bambu|sushi|temakeria|hamburgueria)\b/],
    ['mercado', /\b(supermercado|mercado|atacadao|assai|carrefour|pao de acucar|extra|dia supermerc|big|sams club|makro|hortifruti|sacolao|acougue|oba)\b/],
    ['educacao', /\b(escola|colegio|faculdade|universidade|curso|udemy|alura|coursera|duolingo|livraria|mensalidade escolar|material escolar)\b/],
    ['lazer', /\b(cinema|cinemark|ingresso|sympla|eventim|show|teatro|parque|clube|boliche|bar |balada)\b/],
    ['vestuario', /\b(renner|riachuelo|c&a|cea|zara|hering|marisa|centauro|netshoes|nike|adidas|calcado|sapato|tenis|roupa)\b/],
    ['compras', /\b(amazon|mercado livre|mercadolivre|shopee|shein|aliexpress|magalu|magazine luiza|americanas|casas bahia|kabum|leroy|tok stok)\b/],
    ['pets', /\b(petz|cobasi|petshop|pet shop|veterinar|racao)\b/],
    ['viagem', /\b(hotel|pousada|airbnb|booking|decolar|latam|gol linhas|azul linhas|passagem aerea|rodoviaria)\b/],
    ['tarifas', /\b(tarifa|cesta de servicos|anuidade|juros|iof|multa|encargo|mora|cheque especial|ted|doc )\b/],
    ['impostos', /\b(inss|irrf|imposto|darf|ipva|licenciamento|detran|taxa municipal|das mei)\b/],
    ['dividas', /\b(emprestimo|consignado|financiamento|parcela acordo|acordo serasa)\b/],
    ['investir', /\b(aplicacao|tesouro direto|cdb|corretora|xp invest|rico|nuinvest|investimento)\b/],
    ['presentes', /\b(doacao|dizimo|oferta|vakinha|presente)\b/],
  ];

  // Itens de cupom de supermercado (abreviados como vêm na nota).
  G.ITEM_KEYWORDS = [
    ['bebidas', /\b(cerv|cerveja|chopp|heineken|brahma|skol|amstel|budweiser|stella|itaipava|original|vinho|vodka|whisky|whiskey|cachaca|gin|licor|espumante|ice )\b/],
    ['casa', /\b(det|detergente|sabao|sab po|amaciante|desinf|desinfetante|agua sanit|alvejante|limpador|multiuso|veja|esponja|pano|vassoura|rodo|saco lixo|saco p lixo|papel aluminio|filme pvc|guardanapo|papel toalha|inseticida|lustra|cera|ype|omo|ariel|brilhante|comfort|downy|pinho sol|lysoform|bombril|lampada|pilha|vela)\b/],
    ['higiene', /\b(shampoo|sh |cond |condicionador|sabonete|sab liq|creme dental|cr dent|escova dent|fio dental|desodorante|desod|absorvente|fralda|papel hig|pap hig|lenco umed|barbeador|aparelho barb|hidratante|protetor solar|cotonete|algodao|colgate|oral b|dove|rexona|nivea|pampers|huggies)\b/],
    ['pets', /\b(racao|pedigree|whiskas|golden|premier pet|areia gato|petisco|sache gato|sache cao)\b/],
    ['farmacia', /\b(dipirona|paracetamol|dorflex|neosaldina|eno|estomazil|band aid|curativo)\b/],
    ['padaria', /\b(pao frances|pao fr|paes|baguete|sonho|bolo )\b/],
  ];

  G.guessCategory = (text, kind = 'expense') => {
    const t = ' ' + G.norm(text) + ' ';
    if (!t.trim()) return null;
    if (kind === 'income') {
      const r = ' ' + (text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + ' ';
      if (/\b13|decimo|ferias|bonus|plr|participacao|hora extra|horas extras/.test(r)) return 'adicionais';
      if (/salario|folha|pagamento empresa|proventos|vencimentos/.test(t)) return 'salario';
      if (/13|decimo|ferias|bonus|plr|participacao/.test(t)) return 'adicionais';
      if (/rendimento|dividendo|juros sobre|jcp|cdb|tesouro/.test(t)) return 'rendimentos';
      if (/reembolso|estorno|devolucao/.test(t)) return 'reembolso';
      if (/vale refeicao|vale alimentacao|vr |va |alelo|sodexo|ticket|flash|caju|vr beneficios/.test(t)) return 'beneficios';
      if (/pix recebido|freela|servico/.test(t)) return 'extra';
      return null;
    }
    for (const [cat, re] of G.KEYWORDS) if (re.test(t)) return cat;
    return null;
  };

  // Item de nota de mercado: o padrão é Mercado; só sai dele o que é claramente outra coisa.
  G.guessItemCategory = (text) => {
    const t = ' ' + G.norm(text) + ' ';
    for (const [cat, re] of G.ITEM_KEYWORDS) if (re.test(t)) return cat;
    return 'mercado';
  };
})(window.G);
