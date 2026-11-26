/* Confere Pessoas bloqueadas (spec da Clara, parte 2) e o mock local.
   A lista só devolve quem eu bloqueei. O desbloqueio usa o blockId.
   O DELETE é idempotente: 200 { unblocked: true } também se a linha não existe.
   Fora de localhost, 127.0.0.1 e [::1] o mock responde 404 e não apaga.
   Rode na raiz do repositório: node nexus-v2/dev/checar-bloqueados.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3097;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"])\/\/.*$/gm, "$1");
}

var html = ler("pessoas-bloqueadas.html");
var js = ler("pessoas-bloqueadas.js");
var css = ler("pessoas-bloqueadas.css");
var api = ler("api.js");
var sw = ler("sw.js");
var mock = ler(path.join("dev", "mock-api.js"));
var ajustes = ler("ajustes.html");
var ajustesJs = ler("ajustes.js");

var janela = {};
vm.runInNewContext(ler("bloqueados-textos.js"), { window: janela });
var TEXTOS = janela.NexusBloqueados && janela.NexusBloqueados.TEXTOS;
if (!TEXTOS) falhas.push("bloqueados-textos.js não define NexusBloqueados");

var ESPERADOS = {
  titulo: "Pessoas bloqueadas",
  voltar: "Voltar",
  apoio: "Quem está nesta lista não forma Duo nem Rival com você.",
  bloqueioEm: "Bloqueio em {data}",
  desbloquear: "Desbloquear",
  desbloquearQuem: "Desbloquear {apelido}",
  confirmarTitulo: "Desbloquear {apelido}?",
  confirmarTexto: "Vocês poderão voltar a formar Duo ou Rival. A conversa antiga não volta. Depois, só dá para bloquear de novo se vocês formarem dupla outra vez.",
  cancelar: "Cancelar",
  desbloqueando: "Desbloqueando…",
  desbloqueada: "Pessoa desbloqueada.",
  vazio: "Você não bloqueou ninguém.",
  vazioApoio: "Para bloquear alguém, use as opções de uma mensagem no chat.",
  carregando: "Carregando a lista…",
  semRede: "Sem internet. A lista não abriu.",
  erro: "Não foi possível abrir a lista. Tente de novo.",
  muitasLista: "Você pediu a lista muitas vezes. Espere um pouco e tente de novo.",
  tentar: "Tentar de novo",
  semRedeDesbloquear: "Sem internet. O desbloqueio não foi feito.",
  erroDesbloquear: "Não foi possível desbloquear agora. Tente de novo.",
  indisponivelDesbloquear: "O desbloqueio ainda não está disponível. Tente de novo mais tarde.",
  muitasDesbloquear: "Você tentou desbloquear muitas vezes. Espere um pouco e tente de novo."
};
if (TEXTOS) {
  Object.keys(ESPERADOS).forEach(function (k) {
    if (TEXTOS[k] !== ESPERADOS[k]) falhas.push("texto «" + k + "» mudou");
  });
}

/* A linha fica em Ajustes, abaixo de Meus dados, e abre uma tela própria. */
var iMeus = ajustes.indexOf('id="link-meus-dados"');
var iLinha = ajustes.indexOf('id="link-pessoas-bloqueadas"');
if (iMeus === -1 || iLinha === -1 || iLinha < iMeus) falhas.push("a linha Pessoas bloqueadas fica abaixo de Meus dados");
if (ajustes.indexOf(">Pessoas bloqueadas<") === -1) falhas.push("falta o texto da linha em Ajustes");
if (ajustes.indexOf('href="pessoas-bloqueadas.html"') === -1) falhas.push("a linha não abre pessoas-bloqueadas.html");
if (!/link-pessoas-bloqueadas"\)\.href = "pessoas-bloqueadas\.html"/.test(ajustesJs)) falhas.push("Ajustes não leva o tema para a tela");
if (html.indexOf('id="titulo"') === -1 || html.indexOf("Pessoas bloqueadas") === -1) falhas.push("falta o título");
if (html.indexOf('href="ajustes.html"') === -1) falhas.push("falta o link Voltar para Ajustes");
if (!/NexusAbas\.iniciar\("ajustes"\)/.test(js)) falhas.push("a aba Ajustes precisa continuar ativa");

var limpo = semComentarios(html);
if (/btn-luz|urso|linearGradient|logo-fita/i.test(limpo)) falhas.push("tela sóbria: sem luz e sem urso");
if (/btn-perigo|btn-contorno-perigo|--danger/.test(limpo + css)) falhas.push("desbloquear não usa vermelho");
if (/gradient|box-shadow|animation|@keyframes|transition/i.test(css)) falhas.push("a tela não tem degradê, sombra nem animação");
if (!/#alerta-lista[^>]*role="alert"/.test(html) || !/#alerta-desbloquear[^>]*role="alert"/.test(html.replace(/\s+/g, " "))) {
  if (!/id="alerta-lista" class="alerta alerta-neutro" role="alert"/.test(html)) falhas.push("o erro da lista precisa de role=alert na caixa neutra");
  if (!/id="alerta-desbloquear" class="alerta alerta-neutro" role="alert"/.test(html)) falhas.push("o erro do diálogo precisa de role=alert na caixa neutra");
}
if (!/role="alertdialog"/.test(html)) falhas.push("a confirmação precisa ser um alertdialog");
if (!/id="aviso-lista"[^>]*role="status"/.test(html)) falhas.push("o sucesso precisa de role=status");
if (!/aria-live="polite"/.test(html)) falhas.push("carregando e o sucesso avisam com calma");

var dialogo = html.slice(html.indexOf('id="dialogo-desbloquear"'), html.indexOf("</dialog>", html.indexOf('id="dialogo-desbloquear"')));
var iCancelar = dialogo.indexOf('id="btn-cancelar-desbloquear"');
var iConfirmar = dialogo.indexOf('id="btn-confirmar-desbloquear"');
if (iCancelar === -1 || iConfirmar === -1 || iCancelar > iConfirmar) falhas.push("no diálogo, Cancelar vem primeiro");
var classeCancelar = dialogo.slice(Math.max(0, iCancelar - 80), iCancelar);
var classeConfirmar = dialogo.slice(Math.max(0, iConfirmar - 90), iConfirmar);
if (classeCancelar.indexOf("btn-primario") === -1) falhas.push("Cancelar é o botão cheio");
if (classeConfirmar.indexOf("btn-secundario") === -1) falhas.push("Desbloquear no diálogo é contorno");
if (/btn-primario/.test(classeConfirmar)) falhas.push("negado: Desbloquear não pode ser o botão cheio");

if (!/\.pessoa \{[\s\S]*?min-height: 56px;/.test(css)) falhas.push("cada pessoa precisa de pelo menos 56 px");
if (!/#btn-tentar,\s*\.btn-desbloquear,\s*\.dialogo-botoes \.btn \{[\s\S]*?min-height: 48px;/.test(css)) falhas.push("os alvos de Desbloquear, Cancelar e Tentar de novo têm 48 px");
if (!/\.pessoa \{[\s\S]*?flex-wrap: wrap;/.test(css)) falhas.push("a 200% a linha precisa poder quebrar");

/* Sem internet não chama o servidor. O botão trava antes do envio.
   Só o 200 { unblocked: true } tira a linha. O id é o blockId. */
var carregar = js.slice(js.indexOf("async function carregar"), js.indexOf("function abrirConfirmacao"));
var iRede = carregar.indexOf("if (semRedeAgora())");
var iApi = carregar.indexOf("NexusApi.listarBloqueios");
if (iRede === -1 || iApi === -1 || iRede > iApi) falhas.push("sem internet a lista não pode chamar o servidor");
var textoLista = js.slice(js.indexOf("function textoDaLista"), js.indexOf("async function carregar"));
if (carregar.indexOf("textoDaLista(resultado)") === -1 || textoLista.indexOf("status === 429") === -1 || textoLista.indexOf("status === 503") === -1) falhas.push("a lista precisa tratar 429 e 503");
if (js.indexOf("NexusComunidade") === -1 || js.indexOf("TEXTOS.indisponivel") === -1) falhas.push("o 503 da lista usa a frase que já está na comunidade");
if (carregar.indexOf('setAttribute("aria-disabled"') === -1 && js.indexOf('setAttribute("aria-disabled"') === -1) falhas.push("Tentar de novo usa aria-disabled enquanto carrega");
var confirmar = js.slice(js.indexOf("async function confirmarDesbloqueio"), js.indexOf("function iniciar"));
var iTrava = confirmar.indexOf("definirDesbloqueando(true)");
var iEspera = confirmar.indexOf("await NexusApi.desbloquear");
var iRedeDes = confirmar.indexOf("if (semRedeAgora())");
if (iRedeDes === -1 || iEspera === -1 || iRedeDes > iEspera) falhas.push("sem internet o desbloqueio não pode chamar o servidor");
if (iTrava === -1 || iTrava > iEspera) falhas.push("os botões travam antes do envio");
if (confirmar.indexOf("resultado.dados.unblocked === true") === -1) falhas.push("a linha só sai depois de unblocked: true");
var textoDesbloqueio = js.slice(js.indexOf("function textoDoDesbloqueio"), js.indexOf("async function confirmarDesbloqueio"));
if (confirmar.indexOf("textoDoDesbloqueio(resultado)") === -1 || textoDesbloqueio.indexOf("status === 429") === -1 || textoDesbloqueio.indexOf("status === 503") === -1) falhas.push("o diálogo precisa tratar 429 e 503");
var travar = js.slice(js.indexOf("function definirDesbloqueando"), js.indexOf("function destinoDepois"));
if (travar.indexOf("confirmar.disabled = ligado") === -1 || travar.indexOf("cancelar.disabled = ligado") === -1) falhas.push("os dois botões ficam desabilitados durante o envio");
if (travar.indexOf('"desbloqueando"') === -1) falhas.push("o botão muda para Desbloqueando…");
if (js.indexOf('ocupado === "sim") evento.preventDefault()') === -1) falhas.push("Esc não fecha o diálogo enquanto envia");
if (/user_id|blocked_id|item\.id\b|pessoa\.id\b/.test(js)) falhas.push("a tela não pode usar o id da pessoa");
if (js.indexOf("item.block_id") === -1 || js.indexOf("NexusApi.desbloquear(blockId)") === -1) falhas.push("o desbloqueio tem de usar o block_id");
if (js.indexOf("return db - da") === -1) falhas.push("a lista não ordena do mais recente para o mais antigo");
if (!/NexusAbas\.emDev\(\)/.test(js.slice(js.indexOf("function semRedeAgora"), js.indexOf("function focar")))) falhas.push("?rede=off precisa ficar só em localhost, 127.0.0.1 e [::1]");

if (api.indexOf('caminhoComCenario("/api/users/me/blocks")') === -1) falhas.push("api.js não chama GET /api/users/me/blocks");
if (api.indexOf('"/api/users/me/blocks/" + encodeURIComponent(blockId)') === -1) falhas.push("api.js não chama DELETE com o blockId");
if (sw.indexOf('CACHE = "nexus-v2-v42"') === -1) falhas.push("o cache não está em nexus-v2-v42");
["./bloqueados-textos.js", "./pessoas-bloqueadas.html", "./pessoas-bloqueadas.css", "./pessoas-bloqueadas.js"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});

var trechoMock = mock.slice(mock.indexOf("var bloqueiosPorPessoa"), mock.indexOf("function negar(acesso)"));
if (trechoMock.indexOf("pedidoDeDesenvolvimento") === -1) falhas.push("o mock não limita a origem ao desenvolvimento");
if (trechoMock.indexOf("unblocked: true") === -1) falhas.push("o mock não responde unblocked: true");
if (trechoMock.indexOf("Pessoa Leste") === -1 || trechoMock.indexOf("Pessoa Oeste") === -1) falhas.push("o mock precisa dos apelidos de teste");
["bloqueados-vazio", "bloqueados-erro", "bloqueados-503", "bloqueados-429", "bloqueados-lento", "desbloqueio-erro", "desbloqueio-503", "desbloqueio-429", "desbloqueio-lento"].forEach(function (c) {
  if (mock.indexOf(c) === -1) falhas.push("falta o cenário " + c);
});

function pedir(metodo, caminho, token, origem) {
  return new Promise(function (resolver) {
    var cab = { Accept: "application/json" };
    if (token) cab.Authorization = "Bearer " + token;
    if (origem !== false) cab.Origin = origem || "http://127.0.0.1";
    var req = http.request({ host: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: cab }, function (res) {
      var texto = "";
      res.on("data", function (p) { texto += p; });
      res.on("end", function () {
        var json = {};
        try { json = JSON.parse(texto || "{}"); } catch (e) { json = {}; }
        resolver({ status: res.statusCode, dados: json, cache: res.headers["cache-control"] || "" });
      });
    });
    req.on("error", function () { resolver({ status: 0, dados: {}, cache: "" }); });
    req.end();
  });
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + JSON.stringify(veio) + ", esperado " + JSON.stringify(esperado));
}
function chaves(obj) {
  return Object.keys(obj || {}).sort().join(",");
}
function pedirJson(metodo, caminho, corpo, token, origem) {
  return new Promise(function (resolver) {
    var dados = corpo ? JSON.stringify(corpo) : "";
    var cab = { Accept: "application/json", "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) };
    if (token) cab.Authorization = "Bearer " + token;
    if (origem !== false) cab.Origin = origem || "http://127.0.0.1";
    var req = http.request({ host: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: cab }, function (res) {
      var texto = "";
      res.on("data", function (p) { texto += p; });
      res.on("end", function () {
        var json = {};
        try { json = JSON.parse(texto || "{}"); } catch (e) { json = {}; }
        resolver({ status: res.statusCode, dados: json, cache: res.headers["cache-control"] || "" });
      });
    });
    req.on("error", function () { resolver({ status: 0, dados: {}, cache: "" }); });
    req.end(dados);
  });
}

async function tokenDe(email) {
  return (await pedirJson("POST", "/api/users/login", { email: email, password: "123456" })).dados.token;
}

async function casosDoMock() {
  igual("sem token", (await pedir("GET", "/api/users/me/blocks")).status, 401);
  igual("apagar sem token", (await pedir("DELETE", "/api/users/me/blocks/1001")).status, 401);

  var a = await tokenDe("leste@exemplo.com");
  var b = await tokenDe("oeste@exemplo.com");
  var listaA = await pedir("GET", "/api/users/me/blocks", a);
  igual("lista 200", listaA.status, 200);
  igual("sem cache", listaA.cache, "no-store");
  var blocos = listaA.dados.blocks || [];
  igual("duas pessoas", blocos.length, 2);
  igual("mais recente primeiro", blocos[0] && blocos[0].username, "Pessoa Leste");
  igual("a outra depois", blocos[1] && blocos[1].username, "Pessoa Oeste");
  igual("data recente", blocos[0] && blocos[0].created_at, "2026-11-23T12:00:00.000Z");
  igual("só os três campos", chaves(blocos[0]), "block_id,created_at,username");
  if (JSON.stringify(listaA.dados).indexOf("user_id") !== -1 || JSON.stringify(listaA.dados).indexOf("email") !== -1) {
    falhas.push("a lista expõe id da pessoa ou e-mail");
  }
  var idMeu = String(blocos[0].block_id);
  var listaB = await pedir("GET", "/api/users/me/blocks", b);
  var idOutro = String(listaB.dados.blocks[0].block_id);
  if (idMeu === idOutro) falhas.push("dois usuários não podem dividir o mesmo block_id no teste");

  var cruzado = await pedir("DELETE", "/api/users/me/blocks/" + idOutro, a);
  igual("linha de outra pessoa: 200", cruzado.status, 200);
  igual("linha de outra pessoa: unblocked", cruzado.dados.unblocked, true);
  var outraDepois = await pedir("GET", "/api/users/me/blocks", b);
  igual("a linha dela continua", (outraDepois.dados.blocks || []).length, 2);

  var sumiu = await pedir("DELETE", "/api/users/me/blocks/999999", a);
  igual("id que não existe: 200", sumiu.status, 200);
  igual("id que não existe: unblocked", sumiu.dados.unblocked, true);
  igual("a minha lista não mudou", (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks.length, 2);

  igual("id inválido", (await pedir("DELETE", "/api/users/me/blocks/abc", a)).status, 400);
  igual("id zero", (await pedir("DELETE", "/api/users/me/blocks/0", a)).status, 400);

  var fora = await pedir("DELETE", "/api/users/me/blocks/" + idMeu, a, "https://exemplo.com");
  igual("fora do localhost: 404", fora.status, 404);
  igual("fora do localhost não apaga", (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks.length, 2);
  igual("sem origem: 404", (await pedir("GET", "/api/users/me/blocks", a, false)).status, 404);

  var primeira = await pedir("DELETE", "/api/users/me/blocks/" + idMeu, a);
  igual("desbloquear", primeira.status, 200);
  igual("desbloquear: unblocked", primeira.dados.unblocked, true);
  var restou = (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks;
  igual("saiu uma", restou.length, 1);
  igual("ficou a mais antiga", restou[0] && restou[0].username, "Pessoa Oeste");
  var segunda = await pedir("DELETE", "/api/users/me/blocks/" + idMeu, a);
  igual("desbloquear de novo: 200", segunda.status, 200);
  igual("desbloquear de novo: unblocked", segunda.dados.unblocked, true);
  igual("a outra continua", (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks.length, 1);

  igual("vazio", (await pedir("GET", "/api/users/me/blocks?cenario=bloqueados-vazio", a)).dados.blocks.length, 0);
  igual("vazio não apaga a lista", (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks.length, 1);
  igual("erro", (await pedir("GET", "/api/users/me/blocks?cenario=bloqueados-erro", a)).status, 500);
  igual("503 da lista", (await pedir("GET", "/api/users/me/blocks?cenario=bloqueados-503", a)).status, 503);
  igual("429 da lista", (await pedir("GET", "/api/users/me/blocks?cenario=bloqueados-429", a)).status, 429);
  var idRestante = String(restou[0].block_id);
  igual("erro ao desbloquear não apaga", (await pedir("DELETE", "/api/users/me/blocks/" + idRestante + "?cenario=desbloqueio-erro", a)).status, 500);
  igual("503 ao desbloquear", (await pedir("DELETE", "/api/users/me/blocks/" + idRestante + "?cenario=desbloqueio-503", a)).status, 503);
  igual("429 ao desbloquear", (await pedir("DELETE", "/api/users/me/blocks/" + idRestante + "?cenario=desbloqueio-429", a)).status, 429);
  igual("depois dos erros a pessoa continua", (await pedir("GET", "/api/users/me/blocks", a)).dados.blocks.length, 1);

  var localhost = await pedir("GET", "/api/users/me/blocks", a, "http://localhost");
  igual("origem localhost", localhost.status, 200);
}

function esperarMock(tentativas) {
  return pedir("GET", "/api/notifications/vapid-key", null, false).then(function (r) {
    if (r.status === 200 || tentativas <= 0) return;
    return new Promise(function (ok) { setTimeout(ok, 150); }).then(function () { return esperarMock(tentativas - 1); });
  });
}

(async function () {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarMock(40);
    await casosDoMock();
  } finally {
    filho.kill();
  }
  if (falhas.length) {
    console.log("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: pessoas bloqueadas, confirmação, 429, 503, sem internet e mock só em localhost");
})();
