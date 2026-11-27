/* Confere a crise no contrato (PR 47 do servidor): POST /api/missions com
   alerta de crise em qualquer texto responde 200 com { crisis: true } e NÃO
   cria a missão. A tela do contrato (onboarding.js) tem de:
   - abrir a ajuda (crise.html) no lugar da tela, sem seguir para o Hoje;
   - não guardar nada: rascunho apagado do sessionStorage e do localStorage,
     campos e estado vazios;
   - nunca tratar um 200 sem a missão como missão criada.
   Casos negados: crise não cria, não guarda rascunho, abre a ajuda; um mutante
   sem o ramo da crise tem de reprovar; contrato comum cria normal.
   Também confere que os outros pontos que mexem em missão não mandam texto
   livre (aceitar convite, estender).
   Rode na raiz do repositório: node nexus-v2/dev/checar-crise-contrato.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3099;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}
function trecho(fonte, nome) {
  var i = fonte.indexOf("function " + nome + "(");
  if (i === -1) return "";
  var j = fonte.indexOf("\n}\n", i);
  return fonte.slice(i, j + 2);
}

/* ---------- 1. O fluxo de criar: ordem dos ramos ---------- */
function conferirFluxo(fonte) {
  var erros = [];
  var f = semComentarios(trecho(fonte, "criarAMissao"));
  if (!f) return ["onboarding.js: criarAMissao não encontrada"];
  var pedido = f.indexOf("await NexusApi.criarMissao(pedido)");
  var crise = f.search(/if \(resultado\.ok && resultado\.dados && resultado\.dados\.crisis === true\) \{\s*indo = true;\s*apagarContratoDoAparelho\(\);\s*abrirAjudaDoContrato\(\);\s*return;\s*\}/);
  var sucesso = f.indexOf('location.href = "hoje.html"');
  var aviso = f.indexOf("inscreverSeAceito()");
  var lembrete = f.indexOf("guardarLembreteLocal(");
  if (pedido === -1) erros.push("criarAMissao não chama a API");
  if (crise === -1) erros.push("crise: falta o ramo que apaga o contrato e abre a ajuda");
  if (crise !== -1 && (crise < pedido || crise > sucesso || crise > aviso || crise > lembrete)) erros.push("crise: o ramo tem de vir logo depois do pedido, antes do aviso, do lembrete e do Hoje");
  if (!/if \(!resultado\.ok \|\| !resultado\.dados \|\| !resultado\.dados\.mission\) \{\s*mostrarAviso\(alerta, "falha", TEXTO_FALHA_MISSAO\);/.test(f)) erros.push("sem a missão na resposta, não conta como criada");
  return erros;
}
var onboarding = ler("onboarding.js");
falhas = falhas.concat(conferirFluxo(onboarding));
/* Mutantes: sem o ramo da crise; e com o ramo depois do sucesso. */
var semRamo = onboarding.replace(/    if \(resultado\.ok && resultado\.dados && resultado\.dados\.crisis === true\) \{[\s\S]*?\n    \}\n/, "");
if (semRamo === onboarding) falhas.push("caso negado não mudou nada (ajuste a checagem): sem o ramo da crise");
else if (!conferirFluxo(semRamo).length) falhas.push("caso negado não reprovou: sem o ramo da crise");
var semMissao = onboarding.replace("if (!resultado.ok || !resultado.dados || !resultado.dados.mission) {", "if (!resultado.ok) {");
if (semMissao === onboarding || !conferirFluxo(semMissao).length) falhas.push("caso negado não reprovou: 200 sem missão tratado como criada");

/* ---------- 2. Apagar e abrir a ajuda, de verdade, num DOM falso ---------- */
function rodar(fonte, busca) {
  var sessao = { nexus_v2_onboarding: '{"title":"texto de teste"}', nexus_v2_tema: "x" };
  var local = { nexus_v2_onboarding: '{"title":"texto de teste"}', nexus_v2_token: "t" };
  function armazem(obj) {
    return { removeItem: function (k) { delete obj[k]; }, getItem: function (k) { return obj[k] || null; }, setItem: function (k, v) { obj[k] = String(v); } };
  }
  var campos = [{ value: "texto de teste" }, { value: "outro texto" }];
  var resetados = 0;
  var foi = [];
  var caixa = {
    sessionStorage: armazem(sessao), localStorage: armazem(local),
    CHAVE_RASCUNHO: "nexus_v2_onboarding",
    estado: { title: "texto de teste", why_it_matters: "x", daily_minimum: "y", category: "fitness", passo: 4 },
    rascunhoExistia: true,
    URLSearchParams: URLSearchParams,
    location: { search: busca, replace: function (u) { foi.push(["replace", u]); }, assign: function (u) { foi.push(["assign", u]); }, set href(u) { foi.push(["href", u]); } },
    document: {
      querySelectorAll: function (sel) {
        if (sel === "form") return [{ reset: function () { resetados++; } }, { reset: function () { resetados++; } }];
        return campos;
      }
    }
  };
  vm.runInNewContext(trecho(fonte, "apagarContratoDoAparelho") + trecho(fonte, "abrirAjudaDoContrato") +
    "apagarContratoDoAparelho(); abrirAjudaDoContrato();", caixa);
  return { sessao: sessao, local: local, estado: caixa.estado, campos: campos, resetados: resetados, foi: foi };
}
try {
  var r = rodar(onboarding, "?tema=escuro&cenario=x");
  if (r.sessao.nexus_v2_onboarding || r.local.nexus_v2_onboarding) falhas.push("crise: o rascunho continua no aparelho");
  if (!r.local.nexus_v2_token || !r.sessao.nexus_v2_tema) falhas.push("crise: só o rascunho sai (a sessão e o tema ficam)");
  if (r.estado.title || r.estado.why_it_matters || r.estado.daily_minimum || r.estado.passo !== 1) falhas.push("crise: o estado do contrato fica vazio");
  if (r.campos.some(function (c) { return c.value; }) || r.resetados !== 2) falhas.push("crise: os campos ficam vazios");
  if (JSON.stringify(r.foi) !== JSON.stringify([["replace", "crise.html?tema=escuro"]])) falhas.push("crise: a ajuda abre no lugar da tela, só com o tema (veio " + JSON.stringify(r.foi) + ")");
  if (JSON.stringify(rodar(onboarding, "?tema=<x>").foi) !== JSON.stringify([["replace", "crise.html"]])) falhas.push("crise: tema estranho não vai para a URL");
} catch (e) {
  falhas.push("não deu para rodar a limpeza da crise: " + e.message);
}

/* ---------- 3. Outros pontos que mexem em missão: sem texto livre ---------- */
var api = ler("api.js");
var aceitar = api.slice(api.indexOf("aceitarConvite: function"), api.indexOf("},", api.indexOf("aceitarConvite: function")));
if (/title|daily_minimum|why_it_matters|note|subject/.test(aceitar)) falhas.push("aceitar convite passou a mandar texto livre: trate a crise lá também");
var estender = api.slice(api.indexOf("estenderMissao: function"), api.indexOf("}", api.indexOf("estenderMissao: function") + 80) + 1);
if (!/days: 36/.test(estender) || /title|note/.test(estender)) falhas.push("estender passou a mandar texto livre: trate a crise lá também");
fs.readdirSync(raiz).filter(function (n) { return /\.js$/.test(n) && n !== "api.js" && n !== "onboarding.js"; }).forEach(function (n) {
  if (/NexusApi\.criarMissao\(/.test(ler(n))) falhas.push(n + " também cria missão: trate a crise lá");
});

/* ---------- 4. Visual: a ajuda continua calma ---------- */
var crise = semComentarios(ler("crise.html"));
if (/\burso|btn-luz/.test(crise)) falhas.push("crise.html: sem urso e sem luz");
var sw = ler("sw.js");
if (sw.indexOf('CACHE = "nexus-v2-v48"') === -1) falhas.push("o cache não está em nexus-v2-v48");

/* ---------- 5. Mock: crise não cria; contrato comum cria ---------- */
function pedir(metodo, caminho, corpo, token) {
  return new Promise(function (resolve, reject) {
    var dados = corpo ? JSON.stringify(corpo) : "";
    var headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) };
    if (token) headers.Authorization = "Bearer " + token;
    var req = http.request({ hostname: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: headers }, function (res) {
      var bruto = "";
      res.on("data", function (p) { bruto += p; });
      res.on("end", function () {
        var json = {};
        try { json = JSON.parse(bruto || "{}"); } catch (e) { json = {}; }
        resolve({ status: res.statusCode, json: json });
      });
    });
    req.on("error", reject);
    if (dados) req.write(dados);
    req.end();
  });
}
function esperarMock(n) {
  return pedir("GET", "/api/notifications/vapid-key").catch(function () {
    if (n <= 0) throw new Error("mock não subiu");
    return new Promise(function (r) { setTimeout(r, 100); }).then(function () { return esperarMock(n - 1); });
  });
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + veio + ", esperado " + esperado);
}
var BASE = { category: "aprendizagem", daily_minimum: "Uma página", why_it_matters: "Quero ler mais", proof_mode: "study_note" };
async function casos() {
  igual("sem login", (await pedir("POST", "/api/missions", Object.assign({ title: "crise-teste" }, BASE))).status, 401);
  var token = (await pedir("POST", "/api/users/login", { email: "contrato@exemplo.com", password: "123456" })).json.token;
  var r = await pedir("POST", "/api/missions", Object.assign({ title: "crise-teste" }, BASE), token);
  igual("crise no título: 200", r.status, 200);
  igual("crise no título: crisis", r.json.crisis, true);
  igual("crise no título: sem missão", r.json.mission, undefined);
  r = await pedir("POST", "/api/missions", Object.assign({}, BASE, { title: "Ler", why_it_matters: "crise-teste" }), token);
  igual("crise no porquê: crisis", r.json.crisis, true);
  igual("crise: nenhuma missão criada", ((await pedir("GET", "/api/missions", null, token)).json || []).length, 0);
  r = await pedir("POST", "/api/missions", Object.assign({ title: "Ler uma página" }, BASE), token);
  igual("contrato comum cria", r.status, 201);
  igual("contrato comum: com a missão", !!(r.json.mission && r.json.mission.id), true);
  igual("contrato comum: sem crise", r.json.crisis, undefined);
}

var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
  env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
  stdio: "ignore"
});
esperarMock(50).then(casos).catch(function (e) {
  falhas.push("mock: " + e.message);
}).then(function () {
  filho.kill();
  if (falhas.length) {
    console.error("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: crise no contrato abre a ajuda, não cria missão nem guarda rascunho; contrato comum cria; casos negados");
});
