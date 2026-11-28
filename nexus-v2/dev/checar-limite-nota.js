/* Confere o limite de 280 caracteres na frase do check-in e do dia difícil:
   maxlength="280" nos dois campos, contador discreto «120 de 280», aviso só
   no limite, rascunho antigo longo barrado antes do envio, a mensagem do
   servidor tratada nas duas telas e o mock com o mesmo limite (caracteres
   reais). Também prova os casos negados e que a crise vem antes do limite.
   Rode na raiz do repositório: node nexus-v2/dev/checar-limite-nota.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3097;
var raiz = path.join(__dirname, "..");
var falhas = [];
var MSG = "A frase passou de 280 caracteres. Encurte um pouco e envie de novo.";

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}

var modulo = ler("nota-limite.js");
var sw = ler("sw.js");

/* ---------- As duas telas ---------- */
[["checkin.html", "checkin.js"], ["dia-dificil.html", "dia-dificil.js"]].forEach(function (par) {
  var html = ler(par[0]);
  var js = ler(par[1]);
  var campo = html.slice(html.indexOf("<textarea"), html.indexOf("</textarea>"));
  if (!/maxlength="280"/.test(campo)) falhas.push(par[0] + ": o campo não tem maxlength=\"280\"");
  if (!/aria-describedby="[^"]*nota-contador/.test(campo)) falhas.push(par[0] + ": o contador não está no aria-describedby");
  if (html.indexOf('<p id="nota-contador" class="contador">0 de 280</p>') === -1) falhas.push(par[0] + ": falta o contador «0 de 280»");
  var contador = html.slice(html.indexOf('id="nota-contador"') - 3, html.indexOf("</p>", html.indexOf('id="nota-contador"')));
  if (/aria-live|role=/.test(contador)) falhas.push(par[0] + ": o contador não pode falar a cada tecla");
  if (!/<p id="nota-limite-aviso" class="so-leitor" aria-live="polite"><\/p>/.test(html)) falhas.push(par[0] + ": falta o aviso de limite para leitor de tela");
  var iModulo = html.indexOf('<script src="nota-limite.js"></script>');
  var iTela = html.indexOf('<script src="' + par[1] + '"></script>');
  if (iModulo === -1 || iModulo > iTela) falhas.push(par[0] + ": nota-limite.js precisa vir antes de " + par[1]);
  if (js.indexOf(MSG.replace("A frase", "A nota")) === -1 && js.indexOf(MSG) === -1) falhas.push(par[1] + ": falta a mensagem calma do limite");
  if (!/erro === NexusNota\.MSG_SERVIDOR/.test(js)) falhas.push(par[1] + ": a tela não trata o 400 do limite do servidor");
  if (!/NexusNota\.passou\(/.test(js)) falhas.push(par[1] + ": rascunho longo não é barrado antes do envio");
  if (!/NexusNota\.ligar\("nota", "nota-contador", "nota-limite-aviso"\)/.test(js)) falhas.push(par[1] + ": o contador não está ligado");
  var aplicar = js.slice(js.indexOf("function aplicarRascunho"), js.indexOf("\n}\n", js.indexOf("function aplicarRascunho")));
  if (aplicar.indexOf("atualizarContador()") === -1) falhas.push(par[1] + ": o contador não se atualiza com o rascunho");
  var limpar = js.slice(js.indexOf("function limparNota"), js.indexOf("\n}\n", js.indexOf("function limparNota")));
  if (limpar.indexOf("atualizarContador()") === -1) falhas.push(par[1] + ": o contador não volta a 0 ao limpar");
});

/* Crise antes do limite nas telas: crise é tratada antes do 400 do limite. */
[ "checkin.js", "dia-dificil.js" ].forEach(function (nome) {
  var js = ler(nome);
  var trata = js.slice(js.indexOf("function tratarResposta"));
  var iCrise = trata.indexOf("respostaIndicaCrise(dados)");
  var iLimite = trata.indexOf("NexusNota.MSG_SERVIDOR");
  if (iCrise === -1 || iLimite === -1 || iCrise > iLimite) falhas.push(nome + ": a crise precisa ser tratada antes do limite");
});

/* ---------- Cache ---------- */
if (sw.indexOf('"./nota-limite.js"') === -1) falhas.push("sw.js não guarda nota-limite.js");
if (sw.indexOf('CACHE = "nexus-v2-v54"') === -1) falhas.push("o cache não está em nexus-v2-v54");

/* ---------- CSS discreto ---------- */
var base = ler("base.css");
var regra = base.slice(base.indexOf(".contador {"), base.indexOf("}", base.indexOf(".contador {")));
if (!regra) falhas.push("falta a regra .contador");
if (/danger|#[0-9a-f]{3,6}|animation|transition/i.test(regra)) falhas.push(".contador não pode ter cor de alarme nem animação");
var limite = base.slice(base.indexOf(".contador.no-limite"), base.indexOf("}", base.indexOf(".contador.no-limite")));
if (/danger|warn|animation/i.test(limite)) falhas.push("no limite, o contador não pode virar alarme");

/* ---------- O módulo, num DOM falso ---------- */
function elemento(valor) {
  var classes = {};
  var ouvintes = {};
  return {
    value: valor || "",
    textContent: "",
    classList: { toggle: function (c, ligado) { classes[c] = !!ligado; }, has: function (c) { return !!classes[c]; } },
    addEventListener: function (tipo, f) { ouvintes[tipo] = f; },
    disparar: function (tipo) { if (ouvintes[tipo]) ouvintes[tipo](); }
  };
}
var els = { nota: elemento(""), "nota-contador": elemento(), "nota-limite-aviso": elemento() };
var caixa = { window: {}, document: { getElementById: function (id) { return els[id] || null; } } };
vm.runInNewContext(modulo, caixa);
var N = caixa.window.NexusNota;
if (!N) {
  falhas.push("nota-limite.js não expõe NexusNota");
} else {
  if (N.LIMITE !== 280) falhas.push("o limite não é 280");
  if (N.MSG_SERVIDOR !== MSG) falhas.push("a mensagem do servidor mudou: «" + N.MSG_SERVIDOR + "»");
  if (N.passou("a".repeat(280))) falhas.push("280 não pode passar do limite");
  if (!N.passou("a".repeat(281))) falhas.push("281 tem de passar do limite");
  var atualizar = N.ligar("nota", "nota-contador", "nota-limite-aviso");
  if (els["nota-contador"].textContent !== "0 de 280") falhas.push("vazio: esperado «0 de 280», veio «" + els["nota-contador"].textContent + "»");
  els.nota.value = "x".repeat(120);
  els.nota.disparar("input");
  if (els["nota-contador"].textContent !== "120 de 280") falhas.push("esperado «120 de 280», veio «" + els["nota-contador"].textContent + "»");
  if (els["nota-limite-aviso"].textContent !== "") falhas.push("o aviso falou antes do limite");
  els.nota.value = "x".repeat(280);
  els.nota.disparar("input");
  if (els["nota-contador"].textContent !== "280 de 280") falhas.push("esperado «280 de 280»");
  if (!els["nota-contador"].classList.has("no-limite")) falhas.push("no limite, falta a classe no-limite");
  if (els["nota-limite-aviso"].textContent !== "Chegou ao limite de 280 caracteres.") falhas.push("no limite, o aviso para leitor de tela não falou");
  /* O aviso fala uma vez só ao chegar em 280, mesmo com várias teclas;
     o contador nunca é região viva (conferido no HTML acima). */
  var falas = 0;
  var ultimo = els["nota-limite-aviso"].textContent;
  els.nota.value = "";
  atualizar();
  ultimo = els["nota-limite-aviso"].textContent;
  for (var n = 1; n <= 280; n += 1) {
    els.nota.value = "x".repeat(n);
    els.nota.disparar("input");
    if (els["nota-limite-aviso"].textContent !== ultimo) {
      ultimo = els["nota-limite-aviso"].textContent;
      if (ultimo) falas += 1;
    }
  }
  /* Teclas a mais no limite (o maxlength não deixa o valor crescer). */
  for (var extra = 0; extra < 5; extra += 1) {
    els.nota.disparar("input");
    if (els["nota-limite-aviso"].textContent !== ultimo) { ultimo = els["nota-limite-aviso"].textContent; if (ultimo) falas += 1; }
  }
  if (falas !== 1) falhas.push("o aviso de limite falou " + falas + " vezes ao digitar até 280 (esperado 1)");
  var css = ler("checkin.css");
  if (!/textarea\[aria-invalid="true"\]:focus-visible \{[^}]*outline: 2px solid var\(--danger\);[^}]*outline-offset: -1px;/.test(css)) falhas.push("campo com erro e foco: falta o anel único");
  els.nota.value = "";
  atualizar();
  if (els["nota-contador"].textContent !== "0 de 280" || els["nota-limite-aviso"].textContent !== "") falhas.push("ao limpar, o contador não voltou a 0");
}

/* ---------- Mock local: sucesso e casos negados ---------- */
function pedir(metodo, caminho, corpo, cabecalhos) {
  return new Promise(function (resolve, reject) {
    var dados = corpo ? JSON.stringify(corpo) : "";
    var headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(dados)
    };
    Object.keys(cabecalhos || {}).forEach(function (chave) {
      headers[chave] = cabecalhos[chave];
    });
    var req = http.request({
      hostname: "127.0.0.1",
      port: PORTA,
      path: caminho,
      method: metodo,
      headers: headers
    }, function (res) {
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

async function entrar(email) {
  var resposta = await pedir("POST", "/api/users/login", { email: email, password: "senha123" });
  return resposta.json && resposta.json.token;
}

async function entrar(email) {
  var resposta = await pedir("POST", "/api/users/login", { email: email, password: "senha123" });
  return resposta.json && resposta.json.token;
}

async function provar() {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarServidor(filho);
    var dono = await entrar("limite-a@exemplo.com");
    var outro = await entrar("limite-b@exemplo.com");
    if (!dono || !outro) {
      falhas.push("não foi possível entrar no mock");
      return;
    }
    var criada = await pedir("POST", "/api/missions", {
      title: "Caminhar todo dia",
      category: "outro",
      daily_minimum: "Dez minutos",
      why_it_matters: "Quero ter fôlego",
      mode: "solo",
      duration_days: 30,
      proof_mode: "self_report"
    }, { Authorization: "Bearer " + dono });
    var id = criada.json && criada.json.mission && criada.json.mission.id;
    if (!id) {
      falhas.push("não foi possível criar a missão de teste");
      return;
    }
    function registrar(token, corpo) {
      var headers = token ? { Authorization: "Bearer " + token } : {};
      return pedir("POST", "/api/checkins", Object.assign({ mission_id: id }, corpo), headers);
    }

    var semLogin = await registrar(null, { note: "a".repeat(281) });
    if (semLogin.status !== 401) falhas.push("sem login a nota longa não deu 401 (deu " + semLogin.status + ")");

    var deOutro = await registrar(outro, { note: "a".repeat(281) });
    if (deOutro.status !== 404) falhas.push("outra pessoa com nota longa não recebeu 404 (deu " + deOutro.status + ")");

    var longa = await registrar(dono, { note: "a".repeat(281) });
    if (longa.status !== 400 || longa.json.error !== MSG) falhas.push("281 caracteres não deu 400 com a mensagem calma");

    var longaEmoji = await registrar(dono, { difficult: true, minimum_done: true, note: "💪".repeat(281) });
    if (longaEmoji.status !== 400) falhas.push("281 emojis no dia difícil não deu 400");

    var cabe = await registrar(dono, { difficult: true, minimum_done: true, note: "💪".repeat(280) });
    if (cabe.status !== 201) falhas.push("280 emojis (280 caracteres reais) não passou (deu " + cabe.status + ")");

    var tokenCrise = await entrar("post-crise@exemplo.com");
    var missoesCrise = await pedir("GET", "/api/missions", null, { Authorization: "Bearer " + tokenCrise });
    var idCrise = Array.isArray(missoesCrise.json) && missoesCrise.json[0] && missoesCrise.json[0].id;
    var comCrise = await pedir("POST", "/api/checkins", {
      mission_id: idCrise, note: "b".repeat(400)
    }, { Authorization: "Bearer " + tokenCrise });
    if (comCrise.status !== 201 || comCrise.json.crisis !== true) falhas.push("nota longa com crise não abriu a ajuda (o limite veio antes)");
    if (comCrise.json.checkin && comCrise.json.checkin.note !== null) falhas.push("com crise, o mock guardou a nota longa");
  } finally {
    filho.kill();
  }
}

provar().then(function () {
  if (falhas.length) {
    console.error("falhou:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: limite de 280 caracteres no check-in e no dia difícil, com casos negados");
}).catch(function (erro) {
  console.error("falhou: " + erro.message);
  process.exit(1);
});
