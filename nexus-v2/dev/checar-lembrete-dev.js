/* Confere que o mock do lembrete não responde fora do desenvolvimento.
   Rode na raiz do repositório: node nexus-v2/dev/checar-lembrete-dev.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var spawn = require("child_process").spawn;

var PORTA = 3099;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

var ajustes = ler("ajustes.js");
var mockSrc = ler(path.join("dev", "mock-api.js"));
var abas = ler("abas.js");

if (ajustes.indexOf("if (!NexusAbas.emDev())") === -1) {
  falhas.push("Ajustes não recusa salvar fora do desenvolvimento");
}
var guarda = ajustes.lastIndexOf("guardarLembreteLocal(hora)");
var aceite = ajustes.indexOf("if (!resultado.ok)");
if (guarda === -1 || aceite === -1 || guarda < aceite) {
  falhas.push("o horário local pode ser gravado sem o servidor aceitar");
}
if (abas.indexOf('host === "localhost"') === -1 || abas.indexOf('host === "127.0.0.1"') === -1 || abas.indexOf('host === "[::1]"') === -1) {
  falhas.push("o desenvolvimento não inclui localhost, 127.0.0.1 e [::1]");
}
if (mockSrc.indexOf("if (!pedidoDeDesenvolvimento(req))") === -1) {
  falhas.push("o mock não recusa o lembrete fora do desenvolvimento");
}
["localhost", "127.0.0.1", "[::1]"].forEach(function (host) {
  if (mockSrc.indexOf('host === "' + host + '"') === -1) {
    falhas.push("o mock não cita " + host);
  }
});

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

async function provar() {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarServidor(filho);
    var entrada = await pedir("POST", "/api/users/login", {
      email: "lembrete-dev@exemplo.com",
      password: "senha123"
    });
    var token = entrada.json && entrada.json.token;
    if (!token) {
      falhas.push("não foi possível entrar no mock para o teste do lembrete");
      return;
    }
    var corpo = { reminder_time: "21:30", timezone: "America/Sao_Paulo" };
    var auth = { Authorization: "Bearer " + token };

    async function salvar(origem) {
      var headers = Object.assign({}, auth);
      if (origem) headers.Origin = origem;
      return pedir("PUT", "/api/users/me/reminder", corpo, headers);
    }

    var locais = [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://[::1]:8080"
    ];
    for (var i = 0; i < locais.length; i++) {
      var ok = await salvar(locais[i]);
      if (ok.status !== 200 || !ok.json || ok.json.reminder_time !== "21:30") {
        falhas.push("o mock recusou uma origem de desenvolvimento: " + locais[i] + " (" + ok.status + ")");
      }
    }

    var deFora = [
      "",
      "https://isaac02030.github.io",
      "https://exemplo.com",
      "http://localhost.exemplo.com"
    ];
    for (var j = 0; j < deFora.length; j++) {
      var ruim = await salvar(deFora[j]);
      if (ruim.status === 200 || (ruim.json && ruim.json.reminder_time)) {
        falhas.push("o mock respondeu o lembrete fora do desenvolvimento: " + (deFora[j] || "(sem origem)"));
      }
    }
  } finally {
    filho.kill();
  }
}

provar().then(function () {
  if (falhas.length) {
    console.error(falhas.join("\n"));
    process.exit(1);
  }
  console.log("ok: o lembrete falso só responde em localhost, 127.0.0.1 e [::1]");
}).catch(function (erro) {
  console.error(erro && erro.message ? erro.message : erro);
  process.exit(1);
});
