# Grana — controle financeiro pessoal

App instalável no celular e no tablet (PWA, igual ao PintaKids). Gratuito, sem
anúncio, sem servidor: **os dados ficam só no aparelho**.

## O que ele faz

**Lançar rápido**
- Botão **+** no meio da barra: Despesa, Receita, Ler nota ou Transferência.
- Valor num teclado próprio (digita `4590` → R$ 45,90, como no app do banco).
- Escreveu "uber", "ifood", "drogasil", "enel"… a categoria já vem marcada.
  E ele **aprende**: classificou "Padaria do Zé" uma vez, da próxima já sabe.
- Ao digitar a descrição, sugere lançamentos parecidos (com valor e conta).
- Categorias mais usadas aparecem primeiro.
- **Parcelado** (2x a 48x) e **repetir todo mês/semana/ano** em "Mais opções".
- **Tocar** num lançamento edita; **deslizar para a esquerda** apaga
  (com botão **Desfazer** por alguns segundos).

**Ler documentos (foto ou PDF)**
- **Nota de mercado**: lê item por item e separa por categoria
  (alimentos, limpeza, higiene, bebidas, pets…). Você confere, troca o que
  quiser e salva como um lançamento dividido ou um por categoria.
- **Contracheque**: separa vencimentos (salário, hora extra, férias…) e
  descontos (INSS, IR, plano de saúde, vale-transporte…). Mostra quanto do
  salário fica no caminho.
- **Nota fiscal, boleto, conta de luz/água/internet**.
- Dois leitores:
  - **IA do Google (recomendado, grátis)**: lê qualquer documento, inclusive
    PDF e nota amassada. Ative em **Mais → Ajustes → Leitura inteligente**
    (o app mostra o passo a passo: é só criar uma chave grátis em
    aistudio.google.com/apikey, sem cartão).
  - **Leitor básico**: roda no próprio aparelho, sem IA. Funciona com foto
    nítida de cupom e holerite; mais limitado.

**Entender o dinheiro**
- **Início**: saldo, quanto entrou e saiu no mês, contas fixas para confirmar,
  alertas, gastos por categoria, orçamento, fatura do cartão.
- **Análises**: para onde foi (com comparação ao mês anterior), de onde veio,
  fixos × variáveis, ritmo de gastos dia a dia, últimos 6 meses, onde você mais
  gasta, dia da semana em que mais gasta, por conta/cartão.
- **Vazamentos**: o app procura sozinho
  - mês que vai fechar no vermelho no ritmo atual;
  - categoria muito acima da sua média;
  - muitos gastos pequenos que somam muito ("cafezinho");
  - tarifas, juros e multas;
  - delivery em excesso;
  - cobranças em dobro;
  - assinaturas e gastos que se repetem todo mês.
  Tocar no alerta mostra os lançamentos que o causaram.

**Organizar** (em **Mais**)
- Contas e **cartões de crédito** (fatura por dia de fechamento, limite,
  "Pagar fatura").
- **Orçamento** por categoria, com sugestão pela sua média.
- **Metas e caixinhas** (mostra quanto guardar por mês até o prazo).
- **Contas fixas** (aluguel, salário, assinaturas): aparecem no Início para
  confirmar com um toque — e o app sugere transformar em fixa o que se repete.
- **Importar extrato** do banco (OFX ou CSV), ignorando o que já foi lançado.
- **Backup** e **exportar planilha (CSV)**.

## Instalar no celular e no tablet

O app precisa estar num endereço `https://` (GitHub Pages, como o PintaKids).
Depois de publicado:

1. Abra o endereço no **Chrome** do aparelho.
2. Menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**).
3. O ícone verde com a gota aparece na tela. Funciona sem internet
   (só a leitura com IA precisa de conexão).

## Importante sobre os dados

- Ficam **só no aparelho** em que foram lançados. Celular e tablet não se
  sincronizam sozinhos.
- Para passar de um para o outro: **Ajustes → Fazer backup** num aparelho,
  envie o arquivo para você mesmo (WhatsApp, e-mail, Drive) e
  **Restaurar backup** no outro.
- Faça backup de vez em quando (o app lembra depois de 30 dias). Desinstalar o
  app ou limpar os dados do Chrome apaga tudo.

## Para atualizar o app depois de uma mudança

Enviar os arquivos de novo para o GitHub e aumentar `VERSION` em `sw.js`.
Os aparelhos pegam a versão nova na próxima abertura com internet; os dados
não se perdem.
