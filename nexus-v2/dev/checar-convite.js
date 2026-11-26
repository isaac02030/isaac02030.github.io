/* Confere o convite por link (Duo e Rival) e o placar do Rival em pontos.
   Casos negados: o token nunca vai na URL do servidor; o placar não aparece
   no Duo; sem login, a página de aceitar pede login e não chama o servidor;
   o token não fica guardado no aparelho.
   Rode na raiz do repositório: node nexus-v2/dev/checar-convite.js */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function trecho(texto, inicio, fim) {
  var i = texto.indexOf(inicio);
  var j = texto.indexOf(fim, i + 1);
  return i === -1 ? "" : texto.slice(i, j === -1 ? undefined : j);
}

var TOKEN = "Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3_-Ab3";

/* ---------- convite.js ---------- */
var janela = {};
vm.runInNewContext(ler("convite.js"), { window: janela, location: { origin: "https://site.exemplo", pathname: "/nexus-v2/missao.html" } });
var V = janela.NexusConvite;
var link = V.linkDoConvite(TOKEN);
if (link !== "https://site.exemplo/nexus-v2/aceitar-convite.html#t=" + TOKEN) falhas.push("o link do site leva o token no fragmento: " + link);
if (link.split("#")[0].indexOf(TOKEN) !== -1) falhas.push("negado: o token não vai no caminho nem na busca do link");
if (V.tokenDoFragmento("#t=" + TOKEN) !== TOKEN) falhas.push("lê o token do fragmento");
["", "#t=curto", "#t=" + TOKEN + "x", "?t=" + TOKEN, "#x=" + TOKEN].forEach(function (h) {
  if (V.tokenDoFragmento(h) !== "") falhas.push("negado: fragmento inválido não vira token: " + h);
});
if (V.linkDoConvite("curto") !== "") falhas.push("negado: token inválido não vira link");
if (V.textoDoErro({ status: 503 }) !== "O convite ainda não está disponível. Tente de novo mais tarde.") falhas.push("503 antes da 012 tem o texto aprovado");
if (V.textoDoErro({ status: 409, erro: "texto qualquer do servidor" }) !== "Não deu para concluir agora. Tente de novo daqui a pouco.") falhas.push("negado: erro desconhecido do servidor não aparece cru");
if (V.textoDoErro({ status: 410, erro: "Este convite venceu. Peça um novo a quem convidou." }) !== "Este convite venceu. Peça um novo a quem convidou.") falhas.push("o texto aprovado do servidor aparece");
if (V.textoPontos(30) !== "30 pontos" || V.textoPontos(1) !== "1 ponto") falhas.push("pontos no singular e no plural");
if (/[«»]/.test(Object.values(V.TEXTOS).join(" "))) falhas.push("negado: aspas « » nos textos do convite (use “ ”)");

/* ---------- api.js: o token só no corpo ---------- */
var pedidos = [];
var ctx = {
  navigator: { onLine: true },
  localStorage: { getItem: function () { return "teste-local.x"; }, setItem: function () {}, removeItem: function () {}, key: function () { return null; }, length: 0 },
  sessionStorage: { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {}, key: function () { return null; }, length: 0 },
  location: { search: "", hostname: "localhost", replace: function () {} },
  document: { querySelector: function () { return null; }, getElementById: function () { return null; } },
  window: {},
  setTimeout: setTimeout,
  URLSearchParams: URLSearchParams,
  fetch: function (url, pedido) {
    pedidos.push({ url: url, corpo: pedido.body || "" });
    return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({}); } });
  }
};
vm.runInNewContext(ler("api.js") + "\nthis.NexusApi = NexusApi;", ctx);
Promise.all([
  ctx.NexusApi.verConvite(TOKEN),
  ctx.NexusApi.aceitarConvite(TOKEN, 7),
  ctx.NexusApi.criarConvite(7, "rival"),
  ctx.NexusApi.cancelarConvite(3)
]).then(function () {
  /* api.js confere a sessão ao carregar (/api/users/me): só contam os do convite. */
  pedidos = pedidos.filter(function (p) { return p.url.indexOf("/api/invites") !== -1; });
  pedidos.forEach(function (p) {
    if (p.url.indexOf(TOKEN) !== -1) falhas.push("negado: o token foi na URL do servidor: " + p.url);
  });
  if (pedidos[0].corpo.indexOf(TOKEN) === -1 || !/\/api\/invites\/preview$/.test(pedidos[0].url)) falhas.push("a prévia leva o token no corpo");
  if (pedidos[1].corpo.indexOf(TOKEN) === -1 || JSON.parse(pedidos[1].corpo).mission_id !== 7) falhas.push("o aceite leva o token e a missão no corpo");
  if (JSON.parse(pedidos[2].corpo).kind !== "rival") falhas.push("criar manda o tipo");
  terminar();
});

/* ---------- Página de aceitar ---------- */
var aceitar = semComentarios(ler("aceitar-convite.js"));
var carregar = trecho(aceitar, "async function carregar(", "function definirAceitando(");
var semLogin = carregar.indexOf("if (!logado())");
var chamada = carregar.indexOf("NexusApi.verConvite");
if (semLogin === -1 || chamada === -1 || semLogin > chamada) falhas.push("negado: sem login, a prévia pede login antes de chamar o servidor");
if (!/mostrarVista\("entrar"\)/.test(carregar)) falhas.push("sem login, a página mostra o pedido para entrar");
if (!/history\.replaceState\(null, "", location\.pathname \+ location\.search\)/.test(aceitar)) falhas.push("o token sai da barra de endereço");
var htmlAceitar = semComentarios(ler("aceitar-convite.html"));
if (/location\.replace\("\.\/"/.test(htmlAceitar)) falhas.push("negado: a página de aceitar não manda para a entrada sem antes explicar");
if ((htmlAceitar.match(/btn-luz/g) || []).length !== 1) falhas.push("uma luz só na página de aceitar (o botão Aceitar)");
if (/urso/.test(htmlAceitar)) falhas.push("negado: sem urso na página de aceitar");
if (!/name="referrer" content="no-referrer"/.test(ler("aceitar-convite.html"))) falhas.push("a página de aceitar não manda referrer");

/* ---------- O token não fica no aparelho ---------- */
["convite.js", "aceitar-convite.js"].forEach(function (n) {
  if (/localStorage\.setItem|sessionStorage\.setItem/.test(semComentarios(ler(n)))) falhas.push("negado: " + n + " não guarda nada no aparelho");
});
var missao = ler("missao.js");
if (!/var link = "";\s*try \{\s*localStorage\.setItem\(CHAVE_CACHE/.test(missao)) falhas.push("negado: o link do convite não fica na cópia da Missão");
if (!/var NEXUS_CONVITE_POR_LINK = true;/.test(missao)) falhas.push("o convite por link está ligado");

/* ---------- Placar: só no Rival, em pontos ---------- */
var funcoes = trecho(missao, "function lerPontos(", "function textoDias(");
var caixa = {};
vm.runInNewContext(funcoes + "\nthis.linhas = linhasDoPlacar;", caixa);
var linhas = caixa.linhas({ points: { eu: 30, ana: 20 }, scores: { eu: 3, ana: 2 } }, "eu", "ana");
if (!linhas || linhas[0].pontos !== 30 || linhas[1].pontos !== 20) falhas.push("o placar mostra os pontos");
if (caixa.linhas({ scores: { eu: 3, ana: 2 } }, "eu", "ana") !== null) falhas.push("negado: sem points, não há placar (nunca dias como se fossem pontos)");
if (!/rival: temPar && modo === "rival" && ativa,/.test(missao)) falhas.push("o placar é só do Rival ativo");
var carregarMissao = trecho(missao, "async function carregar(", "function atualizarBarra(");
if (!/if \(base\.rival\) \{\s*var placar = await NexusApi\.placarDaMissao/.test(carregarMissao)) falhas.push("negado: no Duo, o placar nem é pedido");
if (ler("missao.html").indexOf('data-texto-convite="regraPontos"') === -1 || V.TEXTOS.regraPontos !== "10 pontos por dia cumprido.") falhas.push("o placar diz «10 pontos por dia cumprido.»");

/* ---------- Cache ---------- */
var sw = ler("sw.js");
["./convite.js", "./aceitar-convite.html", "./aceitar-convite.css", "./aceitar-convite.js"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});
if (sw.indexOf('CACHE = "nexus-v2-v40"') === -1) falhas.push("o cache não está em nexus-v2-v40");

function terminar() {
  if (falhas.length) {
    console.log("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: convite por link (token no corpo e no fragmento, login, nada guardado) e placar do Rival em pontos, com casos negados");
}
