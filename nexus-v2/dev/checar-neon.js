/* Confere o modo escuro neon (decisões de 23/11; spec da Clara,
   visual/spec-modo-escuro-neon.md):
   - contraste do texto no escuro medido pela fórmula WCAG 2.x (AA);
   - o claro não mudou;
   - a luz (degradê e halo) só nos 4 pontos permitidos;
   - casos negados: nenhuma luz nem urso nas telas sóbrias (crise, erro,
     denúncia, equipe, exclusão, consentimentos, termos);
   - logo v2, ícones do PWA, theme-color #000 no escuro e cache.
   Rode na raiz do repositório: node nexus-v2/dev/checar-neon.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

var tokens = ler("tokens.css");

function bloco(seletor) {
  var i = tokens.indexOf(seletor + " {");
  if (i === -1) return "";
  return tokens.slice(i, tokens.indexOf("}", i));
}
function valores(texto) {
  var v = {};
  semComentarios(texto).replace(/--([a-z0-9-]+):\s*([^;]+);/g, function (_, k, val) { v[k] = val.trim(); });
  return v;
}

var escuro = valores(bloco('[data-theme="dark"]'));
var escuroSistema = valores(bloco(':root:not([data-theme="light"])'));
var claro = valores(bloco(":root"));

/* ---------- Contraste no escuro (WCAG 2.x) ---------- */
function luminancia(hex) {
  var h = hex.replace("#", "");
  var c = [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
  c = c.map(function (x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function razao(a, b) {
  var l1 = luminancia(a), l2 = luminancia(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
var PARES = [
  ["text", "bg", 4.5], ["text", "surface", 4.5], ["text", "surface-2", 4.5],
  ["text-muted", "bg", 4.5], ["text-muted", "surface", 4.5], ["text-muted", "surface-2", 4.5],
  ["accent", "bg", 4.5], ["accent", "surface", 4.5], ["neon-cyan", "bg", 4.5],
  ["accent-text", "accent", 4.5], ["accent-text", "neon-cyan", 4.5],
  ["danger", "bg", 4.5], ["danger", "surface", 4.5],
  ["border", "bg", 3], ["border", "surface", 3], ["border", "surface-2", 3]
];
var medidas = [];
PARES.forEach(function (p) {
  var a = escuro[p[0]], b = escuro[p[1]];
  if (!/^#[0-9A-Fa-f]{6}$/.test(a || "") || !/^#[0-9A-Fa-f]{6}$/.test(b || "")) {
    falhas.push("token sem cor hexadecimal no escuro: --" + p[0] + " ou --" + p[1]);
    return;
  }
  var r = razao(a, b);
  medidas.push(p[0] + "/" + p[1] + " " + r.toFixed(2));
  if (r < p[2]) falhas.push("contraste baixo no escuro: --" + p[0] + " sobre --" + p[1] + " = " + r.toFixed(2) + " (mínimo " + p[2] + ")");
});
/* Meio do degradê com a tinta do botão. */
if (razao("#021013", "#34E5E6") < 4.5) falhas.push("tinta do botão no meio do degradê abaixo de 4,5");
if (escuro.bg !== "#000000") falhas.push("o fundo do escuro é preto de verdade (#000000)");
if (escuro.text === "#FFFFFF") falhas.push("texto não pode ser #FFF puro no preto");
/* O escuro do sistema e o escolhido têm os mesmos valores. */
Object.keys(escuro).forEach(function (k) {
  if (escuroSistema[k] !== escuro[k]) falhas.push("--" + k + " difere entre o escuro do sistema e o escolhido");
});
/* Uma dupla de cores só: nada de violeta, rosa ou roxo no degradê. */
if (!/^linear-gradient\(100deg, #2DF2D0 0%, #3DD8FF 100%\)$/.test(escuro.grad || "")) falhas.push("o degradê é só aqua → ciano");

/* ---------- O claro não mudou ---------- */
var CLARO = { bg: "var(--papel)", surface: "#FFFFFF", "surface-2": "#E3E8E1", text: "#1C1916", "text-muted": "#5C574F", accent: "#0B5F52", border: "#7A756C", grad: "var(--accent)", "glow-btn": "none", "glow-2": "none", "glow-aba": "none", "glow-urso": "none", "aba-luz": "transparent" };
Object.keys(CLARO).forEach(function (k) {
  if (claro[k] !== CLARO[k]) falhas.push("o claro mudou: --" + k + " = " + claro[k]);
});
if (claro.pauta !== "color-mix(in srgb, var(--border) 22%, transparent)") falhas.push("o claro continua com as linhas do caderno");
if (escuro.pauta !== "transparent") falhas.push("no escuro, as linhas do caderno saem");
if (!/@media \(prefers-contrast: more\), \(forced-colors: active\)/.test(tokens)) falhas.push("mais contraste: sem halo e sem degradê");

/* ---------- A luz só nos 4 pontos ---------- */
/* Trilha de luz (uma luz só: fio, hoje, ponta e o último do Dia 30). */
var PERMITIDOS = [".btn-luz", ".btn-luz:hover", ".logo-fita", ".urso-hoje", '.aba[aria-current="page"]::before',
  ".trilha30 .lk-on::after", ".trilha30 .e-hoje i", ".trilha30 .ponta-esq::before,\n.trilha30 .ponta-dir::before", ".trilha30 .ultimo i",
  ".dia-30 .btn-primario.btn-luz", ".urso-dia30"];
fs.readdirSync(raiz).filter(function (n) { return /\.css$/.test(n) && n !== "tokens.css"; }).forEach(function (nome) {
  var css = semComentarios(ler(nome));
  var re = /([^{}]+)\{([^{}]*)\}/g, m;
  while ((m = re.exec(css))) {
    var corpo = m[2];
    /* Luz = degradê neon, halo ou brilho. Degradê de estrutura (linhas, meio
       quadrado) com as cores comuns não conta. */
    if (!/var\(--(grad|glow-[a-z0-9]+|aba-luz|neon-[a-z]+)\)|drop-shadow|#2DF2D0|#3DD8FF/i.test(corpo)) continue;
    var sel = m[1].trim();
    if (PERMITIDOS.indexOf(sel) === -1) falhas.push(nome + ": luz fora dos 4 pontos em «" + sel.replace(/\s+/g, " ") + "»");
  }
});

/* ---------- Casos negados: telas sóbrias ---------- */
var SOBRIAS = ["crise.html", "equipe.html", "termos.html", "privacidade.html", "conta-excluida.html", "meus-dados.html", "comunidade.html", "offline.html", "ajustes.html", "dia-dificil.html", "missao.html", "grande-irmao.html"];
SOBRIAS.forEach(function (nome) {
  var html = semComentarios(ler(nome));
  if (/btn-luz/.test(html)) falhas.push(nome + ": tela sóbria sem botão de luz");
  if (/urso/i.test(html)) falhas.push(nome + ": o urso não aparece em tela sóbria");
  if (/fita-|logo-fita|linearGradient/.test(html)) falhas.push(nome + ": logo sem degradê nem halo em tela sóbria");
});
["crise.css", "legal.css", "meus-dados.css", "comunidade.css"].forEach(function (nome) {
  var css = semComentarios(ler(nome));
  if (/var\(--(grad|glow-[a-z0-9]+|aba-luz|neon-[a-z]+)\)|drop-shadow|#2DF2D0|#3DD8FF|box-shadow:\s*0 0 \d/i.test(css)) falhas.push(nome + ": tela sóbria sem brilho nem degradê");
});
/* Partes sóbrias dentro de telas com luz. */
function secao(html, id) {
  var i = html.indexOf('id="' + id + '"');
  if (i === -1) return "";
  return html.slice(i, html.indexOf("</section>", i));
}
var index = semComentarios(ler("index.html"));
["vista-reaceite", "vista-menor"].forEach(function (id) {
  var s = secao(index, id);
  if (!s) falhas.push("index.html: falta a seção " + id);
  if (/btn-luz|urso|linearGradient|logo-fita/.test(s)) falhas.push("index.html: " + id + " é sóbria (consentimento ou erro)");
});
var checkin = semComentarios(ler("checkin.html"));
["vista-pergunta", "vista-erro"].forEach(function (id) {
  if (/btn-luz|urso/.test(secao(checkin, id))) falhas.push("checkin.html: " + id + " é sóbria");
});
var hoje = semComentarios(ler("hoje.html"));
["vista-erro", "vista-vazia", "vista-carregando"].forEach(function (id) {
  if (/urso|btn-luz/.test(secao(hoje, id))) falhas.push("hoje.html: " + id + " sem urso e sem luz");
});
if (!/<img class="urso-hoje so-escuro" id="urso-hoje" src="icons\/urso-firme\.svg" alt="" aria-hidden="true"/.test(secao(hoje, "vista-dia"))) falhas.push("hoje.html: o urso (decorativo) fica só no dia, no escuro");
if ((hoje.match(/<img class="urso-hoje/g) || []).length !== 1) falhas.push("hoje.html: o urso aparece uma vez só");
/* Orçamento: no máximo um botão de luz por vista. */
fs.readdirSync(raiz).filter(function (n) { return /\.html$/.test(n); }).forEach(function (nome) {
  var html = semComentarios(ler(nome));
  html.split(/<section\b/).forEach(function (parte, i) {
    var n = (parte.match(/btn-luz/g) || []).length;
    if (n > 1) falhas.push(nome + ": mais de um botão de luz na mesma vista (parte " + i + ")");
  });
});
var hojeJs = ler("hoje.js");
if ((hojeJs.match(/btn-luz/g) || []).length !== 1) falhas.push("hoje.js: o botão de luz é só o «Registrar o dia» do Hoje");

/* Regra do botão principal (revisão da Clara, PR 27): plano em Dia difícil e
   Missão; com degradê em Hoje, Check-in, Entrar, Cadastro, Contrato e Dia 30. */
["dia-dificil.html", "missao.html", "dia-dificil.js", "missao.js"].forEach(function (nome) {
  if (/btn-luz/.test(semComentarios(ler(nome)))) falhas.push(nome + ": o principal é plano aqui");
});
[["checkin.html", 1], ["index.html", 2], ["onboarding.html", 4], ["dia-30.html", 1]].forEach(function (par) {
  if ((semComentarios(ler(par[0])).match(/btn-luz/g) || []).length !== par[1]) falhas.push(par[0] + ": o principal tem degradê (um por vista)");
});
/* Seleção sem aqua cheio no escuro; no claro, como sempre. */
if (escuro["sel-fundo"] !== "var(--surface)" || escuro["sel-borda"] !== "2px") falhas.push("no escuro, o dia escolhido tem fundo escuro e borda aqua de 2 px");
if (claro["sel-fundo"] !== "var(--accent)" || claro["sel-borda"] !== "1px") falhas.push("no claro, o dia escolhido continua cheio");
if (!/\.dia input:checked \+ \.dia-caixa \{[\s\S]*?background: var\(--sel-fundo\);/.test(ler("onboarding.css"))) falhas.push("onboarding.css: o dia escolhido usa os tokens --sel-*");

/* ---------- Logo, ícones, theme-color e cache ---------- */
["index.html", "onboarding.html", "offline.html", "recuperacao.html"].forEach(function (nome) {
  var html = ler(nome);
  if (!/class="logo so-claro"/.test(html) || !/class="logo so-escuro"/.test(html)) falhas.push(nome + ": falta o logo v2 (claro e escuro)");
  if (/<p class="marca">Nexus<\/p>/.test(html)) falhas.push(nome + ": sobrou a marca só em texto");
  if (!/<span class="so-leitor">Nexus<\/span>/.test(html)) falhas.push(nome + ": o logo precisa do nome para leitor de tela");
});
var manifesto = JSON.parse(ler("manifest.webmanifest"));
if (manifesto.theme_color !== "#000000" || manifesto.background_color !== "#000000") falhas.push("manifest: theme_color e background_color #000000");
[["icons/icon-192.png", 192], ["icons/icon-512.png", 512]].forEach(function (par) {
  var d = fs.readFileSync(path.join(raiz, par[0]));
  if (d.readUInt32BE(16) !== par[1] || d.readUInt32BE(20) !== par[1]) falhas.push(par[0] + ": tamanho errado");
});
fs.readdirSync(raiz).filter(function (n) { return /\.(html|js)$/.test(n); }).forEach(function (nome) {
  if (/#161411/.test(ler(nome))) falhas.push(nome + ": theme-color antigo do escuro (#161411); agora #000000");
});
var sw = ler("sw.js");
if (sw.indexOf('CACHE = "nexus-v2-v34"') === -1) falhas.push("o cache não está em nexus-v2-v34");
["./icons/urso-firme.svg", "./icons/urso-contente.svg"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});

if (falhas.length) {
  console.log("FALHOU:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("contraste no escuro: " + medidas.join("; "));
console.log("ok: modo escuro neon, 4 pontos de luz, telas sóbrias sem brilho nem urso, logo v2 e ícones");
