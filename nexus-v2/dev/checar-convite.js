/* Confere o convite por link (Duo e Rival) e o placar do Rival em pontos.
   Casos negados: o token nunca vai na URL do servidor; o placar não aparece
   no Duo; sem login, a página de aceitar pede login e não chama o servidor;
   o token não fica guardado no aparelho (só nesta aba, durante o login,
   e some ao voltar); sem «Aceitar» depois de uma recusa definitiva.
   Rode na raiz do repositório: node nexus-v2/dev/checar-convite.js */

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
if (/localStorage/.test(semComentarios(ler("convite.js")))) falhas.push("negado: convite.js não usa o localStorage");
if (/localStorage\.(setItem|removeItem)/.test(semComentarios(ler("aceitar-convite.js")))) falhas.push("negado: a página de aceitar só lê a sessão no localStorage, não grava");
if (/localStorage[^;]*convite|convite[^;]*localStorage/i.test(semComentarios(ler("login.js")))) falhas.push("negado: o convite nunca vai para o localStorage no login");
/* Só a aba, só durante o login: um setItem, em convite.js, na chave do convite pendente. */
var gravacoes = [];
["convite.js", "aceitar-convite.js"].forEach(function (n) {
  (semComentarios(ler(n)).match(/sessionStorage\.setItem\([^)]*\)/g) || []).forEach(function (g) { gravacoes.push(n + ": " + g); });
});
/* login.js tem outras chaves da aba (rascunho do cadastro, aceite): nenhuma é o convite. */
(semComentarios(ler("login.js")).match(/(session|local)Storage\.setItem\([^,]*/g) || []).forEach(function (g) {
  if (/CONVITE|convite|PENDENTE|token/i.test(g) && !/nexus_v2_token|CHAVE_TOKEN/.test(g)) gravacoes.push("login.js: " + g);
});
if (gravacoes.length !== 1 || gravacoes[0] !== "convite.js: sessionStorage.setItem(CHAVE_PENDENTE, token)") falhas.push("negado: só o convite pendente vai para o sessionStorage: " + gravacoes.join(" | "));
var aba = {};
var abaStorage = { getItem: function (k) { return k in aba ? aba[k] : null; }, setItem: function (k, v) { aba[k] = String(v); }, removeItem: function (k) { delete aba[k]; } };
var localTocado = false;
var localFalso = { getItem: function () { localTocado = true; return null; }, setItem: function () { localTocado = true; }, removeItem: function () { localTocado = true; } };
var janela2 = {};
vm.runInNewContext(ler("convite.js"), { window: janela2, sessionStorage: abaStorage, localStorage: localFalso, location: { origin: "https://site.exemplo", pathname: "/" } });
var V2 = janela2.NexusConvite;
V2.guardarParaOLogin("curto");
if (Object.keys(aba).length) falhas.push("negado: token inválido não vai para a aba");
V2.guardarParaOLogin(TOKEN);
if (aba.nexus_v2_convite_pendente !== TOKEN || V2.pendente() !== TOKEN) falhas.push("o token fica na aba durante o login");
V2.apagarPendente();
if (Object.keys(aba).length || V2.pendente() !== "") falhas.push("o token some da aba ao voltar");
aba.nexus_v2_convite_pendente = "lixo";
if (V2.pendente() !== "") falhas.push("negado: valor inválido na aba não vira token");
if (localTocado) falhas.push("negado: o convite nunca toca no localStorage");
var lerToken = trecho(aceitar, "function lerTokenEApagar(", "\n}\n");
if (!/V\.pendente\(\);\s*V\.apagarPendente\(\);/.test(lerToken)) falhas.push("a página de aceitar apaga o token da aba assim que abre");
var aceitarFn = trecho(aceitar, "async function aceitar(", "function iniciar(");
if (!/accepted === true\) \{\s*tokenAtual = "";\s*V\.apagarPendente\(\);/.test(aceitarFn)) falhas.push("depois de aceitar, o token some da aba");
var iniciarFn = trecho(aceitar, "function iniciar(", "\n}\n");
if (!/link-entrar"\)\.addEventListener\("click", function \(\) \{\s*V\.guardarParaOLogin\(tokenAtual\);/.test(iniciarFn)) falhas.push("o token só vai para a aba ao tocar em Entrar");
var login = semComentarios(ler("login.js"));
var seguir = trecho(login, "async function seguirDepoisDaSessao(", "NexusApi.listarMissoes");
if (!/NexusConvite\.pendente\(\)\) \{\s*location\.href = "aceitar-convite\.html" \+ location\.search;/.test(seguir)) falhas.push("depois de entrar, o convite pendente abre de novo");
if (ler("index.html").indexOf('<script src="convite.js"></script>') === -1) falhas.push("a entrada carrega convite.js");

/* ---------- Recusa definitiva: sem «Aceitar» ---------- */
if (!/res\.status < 500 && res\.status !== 429\) \{\s*document\.getElementById\("btn-aceitar"\)\.hidden = true;/.test(aceitarFn)) falhas.push("negado: depois de 403 (18+ ou bloqueio), 409 ou 410, o botão Aceitar some");
if (!/id="link-agora-nao" href="hoje\.html"/.test(htmlAceitar)) falhas.push("«Agora não» ao lado de Aceitar, indo para Hoje");
if (/NexusApi/.test(trecho(iniciarFn, "link-agora-nao", "\n"))) falhas.push("negado: «Agora não» não chama o servidor");
if (V.TEXTOS.agoraNao !== "Agora não") falhas.push("texto «Agora não»");
if (!/^Ao aceitar, /.test(V.TEXTOS.explicaRivalMinha) || !/^Ao aceitar, /.test(V.TEXTOS.explicaRivalNova)) falhas.push("no Rival, diz antes que aceitar muda a missão");
if (!/Não vê as suas notas\.$/.test(V.TEXTOS.veDuo) || !/os seus pontos\. Não vê as suas notas\.$/.test(V.TEXTOS.veRival)) falhas.push("a prévia diz o que a outra pessoa vê (e nunca a nota)");
if (V.TEXTOS.missaoDuo !== "Missão: {titulo}") falhas.push("no Duo é «Missão:»");
if (!/dia difícil também\. O dia livre não pontua\./.test(V.TEXTOS.pontos)) falhas.push("o dia difícil conta 10 e o dia livre não");
if (!/\(hora de Lisboa\)/.test(V.validade("2026-07-01T22:30:00Z")) || V.validade("2026-07-01T22:30:00Z").indexOf("01/07 às 23:30") === -1) falhas.push("a validade vem na hora de Lisboa: " + V.validade("2026-07-01T22:30:00Z"));
if (V.validade("2026-01-10T23:30:00Z").indexOf("10/01 às 23:30") === -1) falhas.push("a validade no inverno (Lisboa = UTC): " + V.validade("2026-01-10T23:30:00Z"));
if (V.validade("lixo") !== "") falhas.push("negado: data inválida não vira validade");
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
if (ler("missao.html").indexOf('data-texto-convite="regraPontos"') === -1 || V.TEXTOS.regraPontos !== "10 pontos por dia cumprido. O dia difícil conta; o dia livre não.") falhas.push("o placar diz a regra dos pontos");
var css = semComentarios(ler("missao.css"));
var placarCss = trecho(css, ".placar {", "}");
if (/border|background/.test(placarCss)) falhas.push("negado: o placar não é cartão dentro de cartão");
if (!/\.placar-linha \+ \.placar-linha \{\s*border-top: 1px solid var\(--border-soft\);/.test(css)) falhas.push("o placar tem divisória entre as duas linhas");
if (/placar[^{]*(ganh|perd|lider|frente)/i.test(css) || /placar-(ganhando|perdendo)/.test(missao)) falhas.push("negado: sem cor de ganhando/perdendo no placar");
var htmlMissao = ler("missao.html");
if (!/id="aviso-copia" role="status"/.test(htmlMissao)) falhas.push("«Link copiado.» num role=status");
if (!/id="btn-compartilhar"/.test(htmlMissao) || V.TEXTOS.compartilhar !== "Compartilhar" || V.TEXTOS.copiado !== "Link copiado.") falhas.push("Compartilhar e «Link copiado.»");

/* ---------- Cache ---------- */
var sw = ler("sw.js");
["./convite.js", "./aceitar-convite.html", "./aceitar-convite.css", "./aceitar-convite.js"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});
if (sw.indexOf('CACHE = "nexus-v2-v51"') === -1) falhas.push("o cache não está em nexus-v2-v51");

function terminar() {
  if (falhas.length) {
    console.log("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: convite por link (token no corpo e no fragmento, login, token só na aba durante o login, sem Aceitar após recusa) e placar do Rival em pontos, com casos negados");
}
