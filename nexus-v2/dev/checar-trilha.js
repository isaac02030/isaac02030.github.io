/* Confere a trilha de luz dos 30 dias (spec da Clara, visual/spec-trilha-de-luz.md):
   3 linhas de 10, fio entre os dias da mesma linha, ponta em hoje, estados
   (feito, difícil, livre, falta, hoje, futuro), o resumo único para o leitor
   de tela, o claro sem brilho, sem animação e o Dia 30 com a trilha real.
   Casos negados: a falta nunca é vermelha; nada de luz além das 4; o leitor
   de tela não ouve 30 itens.
   Rode na raiz do repositório: node nexus-v2/dev/checar-trilha.js */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

/* ---------- DOM mínimo para rodar trilha.js ---------- */
function elemento(tag) {
  var el = {
    tagName: tag, filhos: [], atributos: {}, estilo: {}, classes: [],
    get className() { return this.classes.join(" "); },
    set className(v) { this.classes = String(v).split(/\s+/).filter(Boolean); },
    classList: null,
    style: { setProperty: function (k, v) { el.estilo[k] = v; } },
    setAttribute: function (k, v) { this.atributos[k] = String(v); },
    removeAttribute: function (k) { delete this.atributos[k]; },
    appendChild: function (f) { this.filhos.push(f); },
    replaceChildren: function () { this.filhos = Array.prototype.slice.call(arguments); }
  };
  el.classList = { add: function (c) { if (el.classes.indexOf(c) === -1) el.classes.push(c); } };
  return el;
}
var janela = {};
vm.runInNewContext(ler("trilha.js"), { window: janela, document: { createElement: elemento }, Math: Math });
var T = janela.NexusTrilha;
if (!T) {
  console.log("FALHOU:\n- trilha.js não define window.NexusTrilha");
  process.exit(1);
}

function livresDe(lista) {
  return function (d) { return lista.indexOf(d) !== -1; };
}
var MEIO = { duracao: 30, hoje: 14, feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13], dificeis: [6], ehLivre: livresDe([5, 12, 19, 26]), hojeFeito: false };
var FEITO = Object.assign({}, MEIO, { feitos: MEIO.feitos.concat([14]), hojeFeito: true });

function pintado(dados) {
  var ol = elemento("ol");
  T.pintar(ol, dados);
  return ol;
}
function itemDo(ol, dia) {
  return ol.filhos[dia - 1];
}
function tem(li, classe) {
  return li.classes.indexOf(classe) !== -1;
}

/* Estados. */
var e = T.estados(MEIO);
var esperado = { 1: "f", 5: "l", 6: "d", 9: "x", 12: "l", 13: "f", 14: "h", 15: "o", 19: "l", 30: "o" };
Object.keys(esperado).forEach(function (d) {
  if (e[d - 1].estado !== esperado[d]) falhas.push("estado do dia " + d + ": veio " + e[d - 1].estado + ", esperado " + esperado[d]);
});

/* Geometria e fios. */
var ol = pintado(MEIO);
if (ol.filhos.length !== 30) falhas.push("a trilha tem 30 dias");
[10, 20].forEach(function (d) {
  if (!tem(itemDo(ol, d), "lk-fim")) falhas.push("sem fio entre o dia " + d + " e o " + (d + 1) + " (a trilha recomeça na linha de baixo)");
});
[[1, "on"], [4, "dim"], [5, "dim"], [8, "off"], [9, "off"], [13, "on"], [14, "off"], [15, "off"]].forEach(function (p) {
  if (!tem(itemDo(ol, p[0]), "lk-" + p[1])) falhas.push("fio do dia " + p[0] + " ao seguinte: esperado " + p[1] + " (" + itemDo(ol, p[0]).className + ")");
});
if (!tem(itemDo(ol, 14), "ponta-esq") || !tem(itemDo(ol, 14), "e-hoje")) falhas.push("a ponta acesa fica à esquerda de hoje antes do registro");
var olFeito = pintado(FEITO);
if (!tem(itemDo(olFeito, 14), "ponta-dir") || !tem(itemDo(olFeito, 14), "lk-dim")) falhas.push("depois do registro, a ponta vai à direita e o fio de amanhã fica a 38%");
var dia1 = pintado({ duracao: 30, hoje: 1, feitos: [], dificeis: [] });
if (tem(itemDo(dia1, 1), "ponta-esq")) falhas.push("no dia 1 não há fio antes de hoje (sem ponta à esquerda)");
var dia11 = pintado({ duracao: 30, hoje: 11, feitos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], dificeis: [] });
if (tem(itemDo(dia11, 11), "ponta-esq")) falhas.push("no começo de uma linha não há fio antes de hoje");

/* Leitor de tela: um resumo só, nada de 30 itens. */
var resumo = "Trilha dos 30 dias. Dia 14 é hoje. Feitos: 9. Difícil: 1. Dias livres: 2. Sem registro: 1. Hoje ainda não foi registrado.";
if (ol.atributos.role !== "img" || ol.atributos["aria-label"] !== resumo) falhas.push("resumo do leitor de tela: veio «" + ol.atributos["aria-label"] + "»");
if (!/Hoje já foi registrado\.$/.test(olFeito.atributos["aria-label"])) falhas.push("depois do registro, o resumo diz «Hoje já foi registrado.»");
if (ol.filhos.some(function (li) { return li.atributos["aria-hidden"] !== "true"; })) falhas.push("cada dia é aria-hidden (o leitor ouve só o resumo)");
var hojeJs = semComentarios(ler("hoje.js"));
var pintarRegua = hojeJs.slice(hojeJs.indexOf("function pintarRegua"), hojeJs.indexOf("function hojeEhDificil"));
if (/saltar|so-leitor/.test(pintarRegua)) falhas.push("negado: o Hoje não repete o resumo em texto escondido");
if (!/NexusTrilha\.pintar\(caixa/.test(pintarRegua)) falhas.push("o Hoje desenha a trilha");

/* Dia 30: a trilha inteira e real. */
var FIM = { duracao: 30, hoje: 31, feitos: [1, 2, 3, 4, 6, 7, 8, 10, 11, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24, 25, 27, 28, 29, 30], dificeis: [6, 20], ehLivre: livresDe([5, 12, 19, 26]), hojeFeito: true };
var olFim = pintado(FIM);
if (!tem(itemDo(olFim, 30), "ultimo") || !tem(olFim, "trilha-fim")) falhas.push("no Dia 30, o último quadrado recebe o halo maior");
if (olFim.filhos.some(function (li) { return tem(li, "ponta-esq") || tem(li, "ponta-dir"); })) falhas.push("no Dia 30 não há ponta de hoje");
var c = T.contagem(FIM);
if (c.feitos !== 22 || c.dificeis !== 2 || c.livres !== 4 || c.faltas !== 2) falhas.push("contagem do Dia 30 errada: " + JSON.stringify(c));
if (!/^Trilha dos 30 dias\. Feitos: 22\. Difíceis: 2\. Dias livres: 4\. Sem registro: 2\.$/.test(olFim.atributos["aria-label"])) falhas.push("resumo do Dia 30: «" + olFim.atributos["aria-label"] + "»");
var d30 = ler("dia-30.html");
var d30js = semComentarios(ler("dia-30.js"));
if (d30js.indexOf('var TEXTO_FALHAS = "Houve dias sem registro, e você chegou ao fim mesmo assim."') === -1) falhas.push("a frase de reserva do Dia 30");
if (d30js.indexOf('var TEXTO_UMA_FALTA = "Houve 1 dia sem registro, e você chegou ao fim mesmo assim."') === -1) falhas.push("a frase de 1 dia sem registro");
if (d30js.indexOf('var TEXTO_FALTAS = "Houve {n} dias sem registro, e você chegou ao fim mesmo assim."') === -1) falhas.push("a frase de vários dias sem registro");
if (d30js.indexOf('n.faltas + " sem registro"') === -1 || d30js.indexOf('"Sem registro"') === -1) falhas.push("a contagem e a legenda do Dia 30 dizem sem registro");
if (!/<ol class="trilha30" id="marcas" role="img"><\/ol>/.test(d30)) falhas.push("o Dia 30 mostra a trilha");
if (!/hoje: duracao \+ 1/.test(d30js)) falhas.push("o Dia 30 mostra a trilha encerrada");
if (!/if \(!faltas\) return TEXTO_CUMPRIU;/.test(d30js) || !/if \(faltas === 1\) return TEXTO_UMA_FALTA;/.test(d30js)) falhas.push("a segunda frase do Dia 30 diz só o que é verdade (sem falta, uma, várias)");
if (!/<img class="urso-dia30 so-escuro"[^>]*alt="" aria-hidden="true"/.test(d30)) falhas.push("o urso do Dia 30 é decorativo e só no escuro");

/* Dia sem check-in: a palavra é «sem registro» (ou «Sem registro» no começo da frase
   e na legenda, como «Feito»). Não vale «sem registros», «Sem Registro» nem «falta». */
function literais(nome) {
  return semComentarios(ler(nome)).match(/"(?:\\.|[^"\\])*"/g) || [];
}
["hoje.js", "missao.js", "dia-30.js", "trilha.js", "hoje.html", "missao.html", "dia-30.html"].forEach(function (nome) {
  literais(nome).forEach(function (s) {
    (s.match(/sem registros?/gi) || []).forEach(function (p) {
      if (p !== "sem registro" && p !== "Sem registro") falhas.push(nome + ": a palavra do dia sem check-in divergiu em " + s);
    });
    if (/\bfaltas?\b/i.test(s) && !/fato-falta|data de nascimento/i.test(s)) {
      falhas.push(nome + ": «falta» no texto do dia sem check-in: " + s);
    }
  });
});
[
  ["hoje.js", '" dias sem registro."'],
  ["hoje.js", '"Ontem não houve registro."'],
  ["missao.js", '" sem registro"'],
  ["missao.js", '"sem registro"'],
  ["missao.js", '"hoje, ainda sem registro"'],
  ["missao.js", '"Sem registro"'],
  ["dia-30.js", '"Houve dias sem registro, e você chegou ao fim mesmo assim."'],
  ["dia-30.js", '"Houve 1 dia sem registro, e você chegou ao fim mesmo assim."'],
  ["dia-30.js", '"Houve {n} dias sem registro, e você chegou ao fim mesmo assim."'],
  ["dia-30.js", '" sem registro"'],
  ["dia-30.js", '"Sem registro"'],
  ["trilha.js", '"Sem registro: "']
].forEach(function (par) {
  if (literais(par[0]).indexOf(par[1]) === -1) falhas.push(par[0] + ": falta a frase " + par[1]);
});

/* «Ver dia a dia» abre a lista. A seta é decorativa e o nome acessível não muda. */
var sumario = (ler("missao.html").match(/<summary>[\s\S]*?<\/summary>/) || [""])[0];
if (!/^<summary>Ver dia a dia<svg /.test(sumario)) falhas.push("«Ver dia a dia» continua com esse nome e ganha a seta");
if (!/aria-hidden="true"/.test(sumario) || /aria-label/.test(sumario)) falhas.push("a seta é decorativa e não muda o nome acessível");
var missaoCss = semComentarios(ler("missao.css"));
if (!/\.dia-a-dia summary \{[^}]*min-height:\s*48px/.test(missaoCss) || !/\.dia-a-dia summary \{[^}]*min-width:\s*48px/.test(missaoCss)) {
  falhas.push("«Ver dia a dia» continua com alvo de pelo menos 48px");
}
if (!/\.dia-a-dia\[open\] summary \.seta \{[^}]*transform:\s*rotate\(90deg\)/.test(missaoCss)) falhas.push("a seta gira ao abrir a lista");
if (!/@media \(prefers-reduced-motion: reduce\) \{\s*\.dia-a-dia summary \.seta \{\s*transition:\s*none;\s*\}/.test(missaoCss)) {
  falhas.push("a seta respeita prefers-reduced-motion");
}

/* Casos negados: a falta nunca é vermelha; sem animação. */
var css = semComentarios(ler("trilha.css"));
if (/--danger|#FF8A80|#9B1C1C|red\b/i.test(css)) falhas.push("negado: a trilha nunca usa vermelho");
var falta = css.slice(css.indexOf(".trilha30 .s-x i {"), css.indexOf("/* Hoje"));
if (!/var\(--text-muted\)/.test(falta)) falhas.push("a falta é apagada (--text-muted), com o traço");
if (/@keyframes|animation|transition/.test(css)) falhas.push("negado: a trilha não tem animação");
if (!/@media \(prefers-contrast: more\)/.test(css) || !/@media \(forced-colors: active\)/.test(css)) falhas.push("a trilha mantém as formas com mais contraste e com cores do sistema");
if (!/\.trilha30 \.s-l i\s*\{[^}]*border-style:\s*dotted/.test(css) || !/\.trilha30 \.s-d i::after/.test(css)) falhas.push("livre pontilhado e difícil com ponto (forma, não só cor)");

/* No claro: pinho, sem brilho. */
var tokens = ler("tokens.css");
var raizTokens = tokens.slice(tokens.indexOf(":root {"), tokens.indexOf("}", tokens.indexOf(":root {")));
["--trilha-a: var(--accent);", "--trilha-b: var(--accent);", "--glow-fio: none;", "--glow-hoje: none;", "--glow-fim: none;"].forEach(function (t) {
  if (raizTokens.indexOf(t) === -1) falhas.push("no claro, a trilha fica em pinho e sem brilho: falta " + t);
});
if (!/--trilha-a: #2DF2D0;[\s\S]*--trilha-b: #3DD8FF;/.test(tokens)) falhas.push("no escuro, a trilha vai de aqua a ciano");

/* Orçamento de luz no Hoje: trilha (1), botão, aba e urso. */
var hoje = semComentarios(ler("hoje.html"));
var luzesHoje = [/class="trilha30" id="regua"/, /urso-hoje/, /abas/].filter(function (r) { return r.test(hoje); }).length + (/btn-luz/.test(hojeJs) ? 1 : 0);
if (luzesHoje !== 4) falhas.push("o Hoje tem 4 luzes: trilha, botão, aba e urso (veio " + luzesHoje + ")");
if (/trilha30/.test(semComentarios(ler("checkin.html") + ler("dia-dificil.html") + ler("crise.html") + ler("meus-dados.html")))) falhas.push("negado: check-in, dia difícil e telas sóbrias não mostram a trilha");

/* O último texto do Hoje nunca fica sob o botão fixo (a 200% também): o fim
   da tela reserva abas + botão + respiro. */
if (!/padding-bottom: calc\(var\(--altura-abas\) \+ var\(--safe-bottom\) \+ var\(--altura-botao\) \+ var\(--space-5\) \+ var\(--space-4\) \+ var\(--space-4\)\);/.test(ler("hoje.css"))) falhas.push("o fim do Hoje reserva espaço para abas, botão e respiro");

var sw = ler("sw.js");
["./trilha.js", "./trilha.css"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});

if (falhas.length) {
  console.log("FALHOU:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: trilha de luz (3x10, fio, ponta, estados), resumo único, claro sem brilho, Dia 30 real e casos negados");
