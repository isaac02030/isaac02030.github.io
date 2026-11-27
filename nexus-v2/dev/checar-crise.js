/* Confere a Tela 9 (crise) com o visual novo.
   1. Texto, números, links e rótulos de leitor de tela são EXATAMENTE os
      aprovados (lista abaixo). Qualquer mudança aqui precisa do sim do dono
      do projeto e de nova conferência nas fontes oficiais.
   2. Visual calmo: papel liso, sem cartão nem sombra, sem animação ou
      transição, sem cor de alarme, sem marcas de página gerada por IA.
   3. A ajuda abre SEM login (ou com a sessão vencida) e sem internet:
      nada manda para a entrada; «Voltar à missão» leva à entrada quem não
      está logado; o service worker serve crise.html offline mesmo com ?tema=.
   4. Casos negados: a checagem reprova cópias com um número trocado, um
      contato a menos, uma animação a mais e a volta da exigência de login.
   Rode na raiz do repositório: node nexus-v2/dev/checar-crise.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}

/* Texto que aparece na tela, na ordem do HTML (sem JS, Portugal primeiro). */
var TEXTO = [
  "Você não está sozinho nisso — Nexus",
  "Pular para o conteúdo",
  "Você não está sozinho nisso",
  "Esta tela não guarda nada sobre você.",
  "O Nexus não é um serviço de saúde. Se estiver em risco de vida agora, ligue para a emergência.",
  "Portugal",
  "Emergência (risco de vida)", "112",
  "Linha Nacional de Prevenção do Suicídio", "1411",
  "SNS 24, aconselhamento psicológico", "opção 4, 24h, psicólogos clínicos", "808 24 24 24",
  "SOS Voz Amiga", "todos os dias das 15h30 às 00h30", "213 544 545", "912 802 669", "963 524 660",
  "Brasil",
  "Emergência SAMU", "192",
  "CVV", "ligação gratuita, 24h", "188",
  "CVV chat", "seg a sex, das 8h à meia-noite; sáb, das 13h à meia-noite; dom, das 15h à meia-noite", "Abrir o chat do CVV",
  "Voltar à missão"
];

/* Cada link: href e aria-label. */
var LINKS = [
  ["#conteudo", ""],
  ["tel:112", "Ligar para Emergência, 112"],
  ["tel:1411", "Ligar para a Linha Nacional de Prevenção do Suicídio, 1411"],
  ["tel:+351808242424", "Ligar para o SNS 24, 808 24 24 24"],
  ["tel:+351213544545", "Ligar para o SOS Voz Amiga, 213 544 545"],
  ["tel:+351912802669", "Ligar para o SOS Voz Amiga, 912 802 669"],
  ["tel:+351963524660", "Ligar para o SOS Voz Amiga, 963 524 660"],
  ["tel:192", "Ligar para o SAMU, 192"],
  ["tel:188", "Ligar para o CVV, 188"],
  ["https://cvv.org.br/chat/", ""],
  ["missao.html", ""]
];

function semComentarios(html) {
  return html.replace(/<!--[\s\S]*?-->/g, "");
}

function textoVisivel(html) {
  var corpo = semComentarios(html)
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<svg[\s\S]*?<\/svg>/g, "");
  var titulo = (corpo.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
  var depoisDoHead = corpo.slice(corpo.indexOf("<body"));
  /* <span class="sem-quebra"> só muda a quebra de linha, não o texto. */
  depoisDoHead = depoisDoHead.replace(/<span class="sem-quebra">([^<]*)<\/span>/g, "$1");
  var partes = depoisDoHead.split(/<[^>]+>/).map(function (s) {
    return s.replace(/\s+/g, " ").trim();
  }).filter(Boolean);
  return [titulo.trim()].concat(partes);
}

function links(html) {
  var lista = [];
  var re = /<a\b([^>]*)>/g;
  var m;
  while ((m = re.exec(semComentarios(html)))) {
    var href = (m[1].match(/href="([^"]*)"/) || [])[1] || "";
    var rotulo = (m[1].match(/aria-label="([^"]*)"/) || [])[1] || "";
    lista.push([href, rotulo]);
  }
  return lista;
}

function conferir(html, cssBruto, sw) {
  var falhas = [];
  var css = cssBruto.replace(/\/\*[\s\S]*?\*\//g, "");

  /* ---------- 1. Texto e números iguais ---------- */
  var visto = textoVisivel(html);
  if (JSON.stringify(visto) !== JSON.stringify(TEXTO)) {
    var i = 0;
    while (i < Math.max(visto.length, TEXTO.length) && visto[i] === TEXTO[i]) i += 1;
    falhas.push("o texto da tela mudou (posição " + i + "): esperado «" + TEXTO[i] + "», veio «" + visto[i] + "»");
  }
  if (JSON.stringify(links(html)) !== JSON.stringify(LINKS)) falhas.push("um número, link ou rótulo de leitor de tela mudou");
  if (!/target="_blank" rel="noopener">Abrir o chat do CVV<\/a>/.test(html)) falhas.push("o chat do CVV perdeu target/rel");
  if ((html.match(/<span class="sem-quebra">meia-noite<\/span>/g) || []).length !== 3) falhas.push("cada «meia-noite» precisa estar em <span class=\"sem-quebra\">");
  if (!/class="btn-ligar btn-chat" href="https:\/\/cvv\.org\.br\/chat\/"/.test(html)) falhas.push("o botão do chat do CVV perdeu a classe btn-chat");
  if (/btn-chat[^>]*>[^<]*<svg/.test(html)) falhas.push("o botão do chat do CVV não pode ter ícone de telefone");
  if (html.indexOf("Conferidos em 19/11/2026") === -1) falhas.push("sumiu a data de conferência dos números");
  ["https://www.sns24.gov.pt/", "https://cvv.org.br/ligue-188/", "https://www.sosvozamiga.org/contactos"].forEach(function (fonte) {
    if (html.indexOf(fonte) === -1) falhas.push("sumiu a fonte " + fonte);
  });
  if (!/pt-br[\s\S]*insertBefore\(brasil/.test(html)) falhas.push("pt-BR deixou de pôr o Brasil primeiro");

  /* ---------- 2. Visual calmo, sem cara de IA ---------- */
  if (!/<main class="tela-crise" id="conteudo">/.test(html)) falhas.push("a tela não usa o papel liso (.tela-crise)");
  if (/class="[^"]*cartao/.test(html)) falhas.push("a tela ainda usa cartão");
  if (!/body:has\(\.tela-crise\)\s*\{\s*background-image:\s*none;/.test(css)) falhas.push("as linhas de fundo não foram tiradas");
  if (/box-shadow|--shadow/.test(css)) falhas.push("crise.css não pode ter sombra");
  if (/@keyframes|animation:(?!\s*none)|transition:(?!\s*none)/.test(css)) falhas.push("crise.css não pode ter animação nem transição");
  if (!/\.tela-crise \*\s*\{[^}]*transition:\s*none !important;[^}]*animation:\s*none !important;/.test(css)) falhas.push("falta desligar animação e transição na tela toda");
  if (/--danger|#9B1C1C|#FF8A80|\bred\b|crimson|orange/i.test(css)) falhas.push("crise.css não pode ter cor de alarme");
  if (/gradient/i.test(css)) falhas.push("crise.css não pode ter gradiente");
  if (/text-transform:\s*uppercase|letter-spacing:\s*0\.[1-9]/i.test(css)) falhas.push("crise.css não pode ter caixa alta espaçada");
  if (/border-left:\s*[2-9]/.test(css)) falhas.push("crise.css não pode ter barra colorida à esquerda");
  if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(html)) falhas.push("emoji como ícone na tela de crise");
  if (/\.crise-titulo::after|\.titulo::after/.test(css)) falhas.push("o traço decorativo embaixo do título voltou");
  var aviso = css.slice(css.indexOf(".aviso-saude"), css.indexOf("}", css.indexOf(".aviso-saude")));
  if (aviso.indexOf("var(--text-body)") === -1) falhas.push("o aviso de saúde precisa estar em tamanho de corpo");
  if (!/\.btn-chat \{[^}]*font: var\(--text-body\);[^}]*font-weight: 600;/.test(css)) falhas.push("o botão do chat do CVV precisa da fonte do corpo, peso 600");
  if (!/\.sem-quebra \{\s*white-space: nowrap;/.test(css)) falhas.push("falta .sem-quebra com white-space: nowrap");
  if (!/\.btn-ligar \{[^}]*min-height: var\(--target\)/.test(css)) falhas.push("o botão de ligar precisa de 44 px");
  if (/fetch\(|XMLHttpRequest|NexusApi/.test(html)) falhas.push("a tela de crise não pode pedir nada à rede");

  /* ---------- Cache ---------- */
  if (sw.indexOf('"./crise.html"') === -1 || sw.indexOf('"./crise.css"') === -1) falhas.push("a tela de crise saiu do cache (precisa abrir sem internet)");
  if (sw.indexOf('CACHE = "nexus-v2-v49"') === -1) falhas.push("o cache não está em nexus-v2-v49");

  /* ---------- 3. Abre sem login e sem internet ---------- */
  if (/location\.(replace|assign)\(|location\.href\s*=/.test(semComentarios(html))) falhas.push("a tela de crise não pode mandar ninguém para outra página ao abrir (precisa abrir sem login)");
  if (!/voltar\.href = \(logado \? "missao\.html" : "\.\/"\)/.test(html)) falhas.push("sem login, «Voltar à missão» precisa levar à entrada");
  if (!/\/crise\\\.html\$\/\.test\(url\.pathname\)[\s\S]*caches\.match\("\.\/crise\.html"\)/.test(sw)) falhas.push("o service worker não serve a crise offline quando a URL tem ?tema=");

  /* Todos os contatos com o mesmo desenho; número sem estourar a tela. */
  if (!/\.contato \{[^}]*flex-direction: column;/.test(css)) falhas.push("os contatos não estão todos com o mesmo alinhamento");
  if (/\.btn-ligar \{[^}]*white-space: nowrap/.test(css)) falhas.push("o número com nowrap estoura em 320 px a 200%");
  return falhas;
}

var html = ler("crise.html");
var css = ler("crise.css");
var sw = ler("sw.js");
var falhas = conferir(html, css, sw);

/* Casos negados: a checagem tem de reprovar cópias erradas. */
var erradas = [
  ["número trocado (188 → 189)", html.replace("<span>188</span>", "<span>189</span>"), css],
  ["tel: trocado", html.replace('href="tel:1411"', 'href="tel:1414"'), css],
  ["contato a menos", html.replace(/<li class="contato">\s*<div class="contato-texto">\s*<p class="contato-nome">CVV chat[\s\S]*?<\/li>/, ""), css],
  ["texto de ajuda mudado", html.replace("ligue para a emergência", "ligue já para a emergência"), css],
  ["animação a mais", html, css + "\n.btn-ligar { animation: pulsar 1s infinite; }"],
  ["cor de alarme", html, css + "\n.pais { color: var(--danger); }"],
  ["cartão com sombra", html, css + "\n.crise { box-shadow: var(--shadow); }"],
  ["exige login de novo", html.replace("(function () {\n      var tema", "(function () {\n      if (!localStorage.getItem(\"nexus_v2_token\")) { location.replace(\"./\"); return; }\n      var tema"), css]
];
erradas.forEach(function (caso) {
  if (caso[1] === html && caso[2] === css) {
    falhas.push("a cópia errada não mudou nada (ajuste a checagem): " + caso[0]);
    return;
  }
  if (!conferir(caso[1], caso[2], sw).length) falhas.push("caso negado não reprovou: " + caso[0]);
});

if (falhas.length) {
  console.error("falhou:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: tela de crise com o visual novo, texto e números iguais, e casos negados");
