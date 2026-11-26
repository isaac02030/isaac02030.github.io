/* Confere a tela Hoje do guia visual v2.1 e a fonte hospedada.
   Rode na raiz do repositório: node nexus-v2/dev/checar-hoje.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

var html = ler("hoje.html");
var js = ler("hoje.js");
var css = ler("hoje.css");
var tokens = ler("tokens.css");
var abas = ler("abas.css");
var sw = ler("sw.js");

/* Fonte: um arquivo variável, servido pelo app, com a licença ao lado. */
var fonte = path.join(raiz, "fonts", "Figtree-Variable.woff2");
if (!fs.existsSync(fonte)) {
  falhas.push("falta fonts/Figtree-Variable.woff2");
} else if (fs.readFileSync(fonte).slice(0, 4).toString("latin1") !== "wOF2") {
  falhas.push("fonts/Figtree-Variable.woff2 não é um woff2");
}
var licenca = path.join(raiz, "fonts", "OFL.txt");
if (!fs.existsSync(licenca) || fs.readFileSync(licenca, "utf8").indexOf("SIL Open Font License, Version 1.1") === -1) {
  falhas.push("falta a licença SIL OFL 1.1 em fonts/OFL.txt");
}
if (tokens.indexOf('url("fonts/Figtree-Variable.woff2") format("woff2")') === -1 || tokens.indexOf("font-weight: 400 700;") === -1) {
  falhas.push("o @font-face não usa o arquivo variável com pesos 400 a 700");
}
if (sw.indexOf('"./fonts/Figtree-Variable.woff2"') === -1) falhas.push("o cache não guarda a fonte");
if (sw.indexOf('CACHE = "nexus-v2-v38"') === -1) falhas.push("o cache não está em nexus-v2-v38");

/* Nenhum arquivo do v2 pede fonte ou estilo a outro site. */
fs.readdirSync(raiz).forEach(function (nome) {
  if (!/\.(html|css|js|webmanifest)$/.test(nome)) return;
  var texto = ler(nome);
  if (/fonts\.googleapis|fonts\.gstatic|@import\s+url\(\s*["']?https?:/i.test(texto)) {
    falhas.push(nome + " pede fonte a outro site");
  }
  var antigo = texto.match(/figtree-(400|500|600|700)[a-z-]*\.woff2/);
  if (antigo) falhas.push(nome + " ainda aponta " + antigo[0]);
});

/* Papel: a cor fica numa linha só (--papel). #EEF1EC aprovado pelo dono do projeto em 20/11/2026. */
var papeis = tokens.match(/--papel:\s*#[0-9A-Fa-f]{6};/g) || [];
if (papeis.length !== 1 || papeis[0].indexOf("#EEF1EC") === -1) falhas.push("--papel precisa existir uma vez, com #EEF1EC");
if (/--bg:\s*#(F4EFE6|EEF1EC)/i.test(tokens)) falhas.push("o --bg claro precisa usar var(--papel), não a cor solta");

/* Hierarquia e textos da spec. */
var ordem = ['id="titulo-hoje"', 'id="dia-numero"', 'id="regua"', 'class="cartao-missao"', 'id="titulo-missao"', "O mínimo de hoje:", 'id="minimo"', 'id="estado"', 'id="linha-par"', 'id="acoes"'];
var ultimo = -1;
ordem.forEach(function (peca) {
  var i = html.indexOf(peca);
  if (i === -1) falhas.push("falta " + peca);
  else if (i < ultimo) falhas.push(peca + " fora da ordem da spec");
  else ultimo = i;
});
if (!/<h1[^>]*id="titulo-hoje"[^>]*tabindex="-1"[^>]*>Hoje<\/h1>/.test(html)) falhas.push("o h1 Hoje não recebe foco");
/* Trilha de luz (PR da trilha): um resumo só para o leitor (checar-trilha.js). */
if (!/<ol class="trilha30" id="regua" role="img"><\/ol>/.test(html)) falhas.push("a trilha é role=img com um resumo só");
if (html.indexOf('class="spinner"') !== -1) falhas.push("o carregando não pode ter nada girando");
if (html.indexOf("Abrindo o dia…") === -1) falhas.push("falta «Abrindo o dia…»");
if (html.indexOf("Você ainda não tem missão. Comece a primeira.") === -1 || html.indexOf(">Começar uma missão<") === -1) {
  falhas.push("falta o estado vazio");
}
if (!/id="faixa-rede" role="status"/.test(html)) falhas.push("a faixa de sem internet precisa de role=status");
if (!/id="alerta-erro" class="alerta" role="alert"/.test(html)) falhas.push("o erro precisa de role=alert");
if (!/id="alerta-registro" class="alerta alerta-rede" role="alert"/.test(html)) falhas.push("o aviso ao registrar sem internet precisa de role=alert");
if (!/id="estado" aria-live="polite"/.test(html)) falhas.push("o estado precisa de aria-live polite");

[
  "Ainda não registrou o dia.",
  "Registro feito. Palavra cumprida hoje.",
  "Dia difícil registrado. O mínimo de hoje era pequeno, e você o cumpriu.",
  "Sem internet. Mostrando o que o aparelho guardou.",
  "O registro não foi enviado. Tente de novo quando a conexão voltar.",
  "Não foi possível abrir o dia. Tente de novo.",
  "Ver a nota de hoje",
  " já registrou o dia de hoje."
].forEach(function (frase) {
  if (js.indexOf(frase) === -1) falhas.push("falta a frase «" + frase + "»");
});

/* Nada promete fila ou salvamento sem o servidor. */
[html, js].forEach(function (texto, i) {
  var nome = i === 0 ? "hoje.html" : "hoje.js";
  if (/fica para quando a conexão voltar|será enviado|Salvo\b|salvo\./.test(texto)) falhas.push(nome + " promete salvar ou enviar depois");
});
var semRede = js.slice(js.indexOf("function botaoRegistrarSemRede"), js.indexOf("function mostrarVista"));
if (/location|href|fetch|NexusApi|localStorage|sessionStorage/.test(semRede)) {
  falhas.push("o Registrar sem internet não pode navegar, enviar nem guardar");
}

/* Sem placar no Hoje. */
var jsSemComentario = js.replace(/\/\*[\s\S]*?\*\//g, "");
if (jsSemComentario.indexOf("/score") !== -1 || jsSemComentario.indexOf("placarDa") !== -1) falhas.push("o Hoje não pode chamar o placar");

/* Medidas da spec. */
var trilhaCss = ler("trilha.css");
if (!/grid-template-columns:\s*repeat\(9,\s*minmax\(28px,\s*35px\)\)\s*22px/.test(trilhaCss) || !/\.trilha30 i\s*\{[^}]*width:\s*22px/.test(trilhaCss)) {
  falhas.push("a trilha tem 10 colunas: quadrado de 22px e vão de até 13px (6px no mínimo)");
}
if (!/\.acao-fixa \.btn\s*\{[^}]*min-height:\s*48px/.test(css)) falhas.push("o botão principal não tem 48px");
if (!/\.acao-fixa\s*\{[^}]*bottom:\s*calc\(var\(--altura-abas\) \+ var\(--safe-bottom\)\)/.test(css)) {
  falhas.push("o botão não está colado acima das abas");
}
if (!/\.aba\s*\{[^}]*min-height:\s*56px/.test(abas)) falhas.push("as abas não têm 56px");
if (!/\.aba\s*\{[^}]*min-height:\s*56px/.test(abas) || /\.aba\s*\{[^}]*[^-]height:\s*56px/.test(abas)) falhas.push("a aba não pode ter altura fixa: o texto a 200% estoura");
if (!/max\(var\(--space-5\)/.test(css)) falhas.push("a margem lateral não é 24px");
var dificil = css.slice(css.indexOf(".estado-dificil"), css.indexOf("}", css.indexOf(".estado-dificil")));
if (dificil.indexOf("--danger") !== -1) falhas.push("o dia difícil não pode usar --danger");
if (/@keyframes|animation:/.test(css)) falhas.push("o Hoje não deve ter animação");

/* Revisão da Clara e do Argos no PR 15. */
if (!/--surface-2:\s*#E3E8E1;[\s\S]*--surface-2:\s*#E3E8E1;/.test(tokens) || /#EBE4D8/i.test(tokens)) falhas.push("--surface-2 claro precisa ser #E3E8E1 nos dois blocos");
if (!/\.cartao-missao\s*\{[^}]*box-shadow:\s*none/.test(css) || tokens.indexOf("--borda-cartao: #C5CDC6;") === -1) falhas.push("o cartão da missão no claro tem borda #C5CDC6 e sem sombra");
if (!/\.trilha30 \.s-x i::after\s*\{[^}]*transform:\s*rotate\(-35deg\)/.test(trilhaCss) || !/\.trilha30 \.s-x i\s*\{[^}]*border-color:\s*var\(--text-muted\)/.test(trilhaCss)) falhas.push("a falta tem o traço na diagonal e a borda --text-muted");
if (js.indexOf('"Sem internet. O registro') !== -1) falhas.push("o alerta repete «Sem internet» da faixa");
var trechoRede = js.slice(js.indexOf("function semRedeAgora"), js.indexOf("function icone"));
if (trechoRede.indexOf("hostDeDesenvolvimento()") === -1 || js.indexOf('host === "[::1]"') === -1) falhas.push("?rede=off precisa ficar só em localhost, 127.0.0.1 e [::1]");
var abasJs = ler("abas.js");
if (abasJs.indexOf("M12 15.5a3.5 3.5 0 1 0 0-7") !== -1) falhas.push("o ícone de Ajustes ainda é o sol");

/* Marcas de página gerada por IA (skill frontend-design): nada disso no Hoje. */
var textoTela = html + js;
if (/text-transform:\s*uppercase/.test(css)) falhas.push("rótulo em caixa alta");
if (/ · /.test(textoTela)) falhas.push("texto com pontinhos «A · B · C»");
if (/→/.test(textoTela)) falhas.push("seta «→» em botão ou link");
if (/border-left:\s*[0-9]+px solid var\(--accent\)/.test(css.slice(0, css.indexOf("Grade antiga")))) {
  falhas.push("caixa com barra colorida à esquerda");
}
if (/(radial|linear)-gradient\([^)]*var\(--accent/.test(css.slice(0, css.indexOf("Grade antiga")))) falhas.push("gradiente decorativo no acento");
if (css.indexOf("body:has(.tela-hoje)") === -1) falhas.push("as linhas de fundo voltaram ao Hoje");

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}

console.log("ok: tela Hoje do guia v2.1 e fonte Figtree hospedada");
