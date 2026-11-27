/* Confere a área na criação da missão (Mente, Corpo ou Rotina).
   Opcional: nenhuma vem marcada, e o pedido só leva area quando a pessoa escolhe.
   Rode na raiz do repositório: node nexus-v2/dev/checar-area.js

   Casos negados: outro valor dá 400 invalid_area e não cria missão;
   com o título "sem-area" e uma área, o mock responde 503 area_unavailable
   e também não cria. */

var fs = require("fs");
var path = require("path");
var http = require("http");
var spawn = require("child_process").spawn;

var raiz = path.join(__dirname, "..");
var PORTA = 3104;
var falhas = [];
var AREAS = ["mente", "corpo", "rotina"];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
}

var html = ler("onboarding.html");
var js = semComentarios(ler("onboarding.js"));
var css = ler("onboarding.css");
var api = semComentarios(ler("api.js"));

var objetivo = html.match(/<input id="objetivo"[^>]*>/);
if (!objetivo || objetivo[0] !== '<input id="objetivo" name="title" type="text" maxlength="255" autocomplete="off" aria-required="true" aria-describedby="objetivo-dica erro-objetivo">') {
  falhas.push("o campo do objetivo mudou");
}

var grupo = html.slice(html.indexOf('id="grupo-area"'), html.indexOf("</fieldset>", html.indexOf('id="grupo-area"')));
if (grupo.indexOf('id="grupo-area"') === -1) falhas.push("falta o grupo da área");
if (!/role="radiogroup"/.test(grupo)) falhas.push("o grupo da área precisa de role=radiogroup");
if (!/<legend class="areas-legenda">Área<\/legend>/.test(grupo)) falhas.push("falta a legenda curta «Área»");
AREAS.forEach(function (valor, i) {
  var rotulo = ["Mente", "Corpo", "Rotina"][i];
  var botao = '<button type="button" class="area" data-area="' + valor + '" aria-pressed="false">' + rotulo + "</button>";
  if (grupo.indexOf(botao) === -1) falhas.push("falta o botão " + rotulo + " com aria-pressed=false");
});
if ((grupo.match(/data-area="/g) || []).length !== 3) falhas.push("a área só pode ter os 3 valores");
if (/checked|aria-pressed="true"/.test(grupo)) falhas.push("nenhuma área pode vir marcada");
if (/<input[^>]*name="area"/.test(html)) falhas.push("a área não pode ir num campo escondido");

var criar = js.slice(js.indexOf("async function criarAMissao"), js.indexOf("function limparErroAoDigitar"));
if (criar.indexOf('pedido.area = estado.area') === -1) falhas.push("criar a missão precisa poder mandar a área");
if (!/if \(estado\.area === "mente" \|\| estado\.area === "corpo" \|\| estado\.area === "rotina"\) pedido\.area = estado\.area;/.test(criar)) {
  falhas.push("area só vai quando o valor é mente, corpo ou rotina");
}
var pedido = criar.slice(criar.indexOf("var pedido = {"), criar.indexOf("};", criar.indexOf("var pedido = {")));
if (/area\s*:/.test(pedido)) falhas.push("o pedido não pode trazer area já no objeto, só depois, se houver escolha");
var iArea = criar.indexOf('pedido.area = estado.area');
var iEnvio = criar.indexOf("NexusApi.criarMissao(");
if (!(iArea !== -1 && iEnvio !== -1 && iArea < iEnvio)) falhas.push("a área entra no pedido antes do envio");
var blocoSemDias = criar.slice(criar.indexOf("if (opcoes && opcoes.semDias)"), criar.indexOf("var conferido = NexusDias.pedido"));
if (/area/.test(blocoSemDias)) falhas.push("repetir sem os dias não pode mexer na área");
var iCodigo = criar.indexOf('codigo === "area_unavailable"');
var i503Dias = criar.indexOf("resultado.status === 503 && conferido.campo");
if (iCodigo === -1 || i503Dias === -1 || iCodigo > i503Dias) falhas.push("o 503 da área precisa ser tratado antes do 503 dos dias, sem reenviar sem a área");
if (criar.indexOf('mostrarAviso(alerta, "neutro", TEXTO_FALHA_MISSAO)') === -1) falhas.push("400 e 503 da área usam a frase que já existe, no aviso neutro");
if (js.indexOf('var valor = botao.getAttribute("aria-pressed") === "true" ? "" : botao.getAttribute("data-area")') === -1) {
  falhas.push("tocar de novo na área escolhida precisa desmarcar, sem texto novo");
}

if (!/if \(dados\.area === "mente" \|\| dados\.area === "corpo" \|\| dados\.area === "rotina"\) corpo\.area = dados\.area;/.test(api)) {
  falhas.push("api.js só pode mandar area com um dos 3 valores");
}
var corpoApi = api.slice(api.indexOf("criarMissao: function"), api.indexOf("chaveVapid:"));
if (/corpo\.area\s*=/.test(corpoApi.replace('if (dados.area === "mente" || dados.area === "corpo" || dados.area === "rotina") corpo.area = dados.area;', ""))) {
  falhas.push("api.js não pode mandar area fora da conferência dos 3 valores");
}

if (!/\.area \{[^}]*min-height:\s*48px/.test(css)) falhas.push("cada área precisa de alvo de 48px");
if (!/\.area\[aria-pressed="true"\] \{[^}]*border-color:\s*var\(--accent\);[^}]*background:\s*var\(--sel-fundo\);[^}]*color:\s*var\(--sel-texto\)/.test(css)) {
  falhas.push("a área escolhida usa o mesmo recorte dos dias (--sel-*)");
}
if (/outline:\s*none/.test(css.slice(css.indexOf(".areas {"), css.indexOf(".previa {")))) falhas.push("o foco da área não pode sumir");
if (/#2DF2D0|#3DD8FF|var\(--glow-|var\(--grad\)/.test(css.slice(css.indexOf(".areas {"), css.indexOf(".previa {")))) {
  falhas.push("a área não ganha luz própria");
}

if (ler("sw.js").indexOf('CACHE = "nexus-v2-v49"') === -1) falhas.push("o cache não está em nexus-v2-v49");

function pedir(metodo, caminho, corpo, cabecalhos) {
  return new Promise(function (resolve, reject) {
    var dados = corpo == null ? null : JSON.stringify(corpo);
    var headers = { Accept: "application/json" };
    if (dados) headers["Content-Type"] = "application/json";
    Object.keys(cabecalhos || {}).forEach(function (chave) { headers[chave] = cabecalhos[chave]; });
    var req = http.request({ hostname: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: headers }, function (res) {
      var bruto = "";
      res.on("data", function (parte) { bruto += parte; });
      res.on("end", function () {
        var json = {};
        try { json = JSON.parse(bruto || "{}"); } catch (erro) { json = {}; }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on("error", reject);
    if (dados) req.write(dados);
    req.end();
  });
}

function esperarServidor(filho) {
  return new Promise(function (resolve, reject) {
    var tentativas = 0;
    var timer = setInterval(function () {
      tentativas += 1;
      var req = http.request({ hostname: "127.0.0.1", port: PORTA, path: "/api/notifications/vapid-key", method: "GET" }, function (res) {
        res.resume();
        clearInterval(timer);
        resolve();
      });
      req.on("error", function () {
        if (tentativas > 40) {
          clearInterval(timer);
          reject(new Error("o mock não subiu"));
        }
      });
      req.end();
    }, 50);
    filho.on("exit", function (codigo) {
      if (codigo) reject(new Error("mock encerrou com " + codigo));
    });
  });
}

var base = { title: "Ler", category: "aprendizagem", daily_minimum: "Uma página", why_it_matters: "Quero", mode: "solo", duration_days: 30, proof_mode: "study_note" };

async function provarMock() {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarServidor(filho);
    var login = await pedir("POST", "/api/users/login", { email: "area-checar@exemplo.com", password: "senha123" });
    var auth = { Authorization: "Bearer " + (login.json && login.json.token) };

    var sem = await pedir("POST", "/api/missions", base, auth);
    if (sem.status !== 201 || sem.json.mission.area !== null || sem.json.mission.subject !== null) {
      falhas.push("sem area, a missão cria com area e subject null");
    }
    if (Object.prototype.hasOwnProperty.call(base, "area")) falhas.push("o pedido de teste sem escolha não pode levar area");

    for (var i = 0; i < AREAS.length; i++) {
      var criada = await pedir("POST", "/api/missions", Object.assign({}, base, { title: "Ler " + AREAS[i], area: AREAS[i] }), auth);
      if (criada.status !== 201 || criada.json.mission.area !== AREAS[i]) falhas.push("area " + AREAS[i] + " devia voltar na missão criada");
    }

    var antes = await pedir("GET", "/api/missions", null, auth);
    var quantas = Array.isArray(antes.json) ? antes.json.length : -1;
    var negados = ["saude", "Mente", "estudo", ""];
    for (var n = 0; n < negados.length; n++) {
      var ruim = await pedir("POST", "/api/missions", Object.assign({}, base, { title: "Negada", area: negados[n] }), auth);
      if (ruim.status !== 400 || !ruim.json || ruim.json.code !== "invalid_area") {
        falhas.push("area " + JSON.stringify(negados[n]) + " devia dar 400 invalid_area");
      }
    }
    var fora = await pedir("POST", "/api/missions", Object.assign({}, base, { title: "sem-area", area: "mente" }), auth);
    if (fora.status !== 503 || !fora.json || fora.json.code !== "area_unavailable") {
      falhas.push("sem a migração, com area, devia dar 503 area_unavailable");
    }
    var depois = await pedir("GET", "/api/missions", null, auth);
    if (!Array.isArray(depois.json) || depois.json.length !== quantas) falhas.push("um pedido negado de área criou missão");

    var livre = await pedir("POST", "/api/missions", Object.assign({}, base, { title: "sem-area" }), auth);
    if (livre.status !== 201 || livre.json.mission.area !== null) falhas.push("sem area, mesmo com o título de teste, a missão cria");
  } finally {
    filho.kill();
  }
}

provarMock().then(function () {
  if (falhas.length) {
    console.error(falhas.join("\n"));
    process.exit(1);
  }
  console.log("ok: área opcional, só mente, corpo ou rotina, e só quando escolhida");
}).catch(function (erro) {
  console.error(erro && erro.message ? erro.message : erro);
  process.exit(1);
});
