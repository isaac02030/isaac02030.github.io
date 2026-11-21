/* Confere que o mock de estender o ciclo não responde fora do desenvolvimento.
   Rode na raiz do repositório: node nexus-v2/dev/checar-extend-dev.js */

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

var dia = ler("dia-30.js");
var htmlDia = ler("dia-30.html");
var cssDia = ler("dia-30.css");
var api = ler("api.js");
var mockSrc = ler(path.join("dev", "mock-api.js"));
var sw = ler("sw.js");
var abas = ler("abas.js");

if (dia.indexOf("NexusApi.estenderMissao") === -1) {
  falhas.push("a tela não chama estenderMissao");
}
if (dia.indexOf("continue-solo") !== -1 || dia.indexOf("porta-aberta") !== -1 || dia.indexOf("/abandon") !== -1) {
  falhas.push("a tela usa uma rota que não é o extend");
}
if (dia.indexOf("Não foi possível abrir os próximos 36 dias. Tente de novo.") === -1) {
  falhas.push("falta o erro de continuar");
}
if (dia.indexOf("Sem internet. O ciclo já terminou; continuar fica para quando a conexão voltar.") === -1) {
  falhas.push("falta o aviso sem internet");
}
if (dia.indexOf('sessionStorage.setItem(CHAVE_ADIAR_FIM, "1")') === -1) {
  falhas.push("Agora não não volta para o Hoje");
}
if (htmlDia.indexOf(">Agora não<") === -1) falhas.push("falta o botão Agora não");
if (htmlDia.indexOf(">Encerrar esta missão<") !== -1) falhas.push("o botão ainda diz que encerra a missão");
if (htmlDia.indexOf("TODO") === -1 || htmlDia.indexOf("Encerrar esta missão") === -1 || htmlDia.indexOf("Sair da conta") === -1) {
  falhas.push("falta o TODO para quando existir a rota de encerrar");
}
if (htmlDia.indexOf('id="marcas"') === -1 || htmlDia.indexOf('href="hoje.css"') === -1) {
  falhas.push("a grade não reaproveita a do Hoje");
}
if (htmlDia.indexOf('role="alert"') === -1) falhas.push("o aviso de continuar não nasce como alert");
if (dia.indexOf('setAttribute("role", "alert")') === -1) falhas.push("os erros não usam role alert");
var continuar = dia.slice(dia.indexOf("async function continuar"), dia.indexOf("function modeloDe"));
if (continuar.indexOf("esconderAviso") !== -1) falhas.push("o erro some ao tocar de novo antes da resposta");
if (continuar.indexOf("definirCarregando(true)") === -1 || dia.indexOf("botao.disabled = true") === -1) {
  falhas.push("Continuar mais 36 dias não fica desabilitado enquanto envia");
}
if (continuar.indexOf('ocupado === "sim"') === -1) falhas.push("um segundo toque ainda pode enviar");
var ritmo = cssDia.slice(cssDia.indexOf(".ritmo"), cssDia.indexOf("}", cssDia.indexOf(".ritmo")));
if (ritmo.indexOf("var(--text)") === -1 || ritmo.indexOf("600") === -1 || ritmo.indexOf("--text-muted") !== -1) {
  falhas.push("a frase de resultado não está em texto com peso 600");
}
if (api.indexOf('"/extend"') === -1 && api.indexOf("\"/extend\"") === -1) {
  falhas.push("api.js não chama POST /api/missions/:id/extend");
}
if (api.indexOf("days: 36") === -1) falhas.push("o corpo não manda days: 36");
if (api.indexOf("/continue-solo") !== -1) falhas.push("api.js reutiliza continue-solo");
if (sw.indexOf('CACHE = "nexus-v2-v21"') === -1) falhas.push("o cache não está em nexus-v2-v21");
if (sw.indexOf("./dia-30.html") === -1 || sw.indexOf("./dia-30.css") === -1 || sw.indexOf("./dia-30.js") === -1) {
  falhas.push("o cache não inclui a tela do fim");
}
if (abas.indexOf('host === "localhost"') === -1 || abas.indexOf('host === "127.0.0.1"') === -1 || abas.indexOf('host === "[::1]"') === -1) {
  falhas.push("o desenvolvimento não inclui localhost, 127.0.0.1 e [::1]");
}
if (mockSrc.indexOf("if (!pedidoDeDesenvolvimento(req))") === -1) {
  falhas.push("o mock não recusa o extend fora do desenvolvimento");
}
["localhost", "127.0.0.1", "[::1]"].forEach(function (host) {
  if (mockSrc.indexOf('host === "' + host + '"') === -1) {
    falhas.push("o mock não cita " + host);
  }
});

fs.readdirSync(raiz).forEach(function (nome) {
  if (!/\.html$/i.test(nome)) return;
  var html = ler(nome);
  if (html.indexOf('<html lang="pt-BR">') === -1) {
    falhas.push(nome + " não tem lang=pt-BR no html");
  }
  var trechos = html.split("<input");
  for (var i = 1; i < trechos.length; i++) {
    var tag = trechos[i].slice(0, trechos[i].indexOf(">"));
    if (/type\s*=\s*"time"/i.test(tag) && tag.indexOf('lang="pt-BR"') === -1) {
      falhas.push(nome + " tem input de hora sem lang=pt-BR");
    }
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
      email: "extend-dev@exemplo.com",
      password: "senha123"
    });
    var token = entrada.json && entrada.json.token;
    if (!token) {
      falhas.push("não foi possível entrar no mock para o teste do extend");
      return;
    }
    var auth = { Authorization: "Bearer " + token, Origin: "http://localhost:8080" };
    var criada = await pedir("POST", "/api/missions", {
      title: "Ler uma página por dia",
      category: "aprendizagem",
      daily_minimum: "Uma página",
      why_it_matters: "Quero ler sem traduzir",
      mode: "solo",
      duration_days: 30,
      proof_mode: "study_note"
    }, auth);
    var id = criada.json && criada.json.mission && criada.json.mission.id;
    if (!id || criada.status !== 201) {
      falhas.push("não foi possível criar a missão de teste");
      return;
    }

    async function estender(origem, dias) {
      var headers = { Authorization: "Bearer " + token };
      if (origem) headers.Origin = origem;
      return pedir("POST", "/api/missions/" + id + "/extend", { days: dias == null ? 36 : dias }, headers);
    }

    var deFora = [
      "",
      "https://isaac02030.github.io",
      "https://exemplo.com",
      "http://localhost.exemplo.com"
    ];
    for (var j = 0; j < deFora.length; j++) {
      var ruim = await estender(deFora[j], 36);
      if (ruim.status === 200 || (ruim.json && ruim.json.days === 36)) {
        falhas.push("o mock respondeu o extend fora do desenvolvimento: " + (deFora[j] || "(sem origem)"));
      }
    }

    var leitura = await pedir("GET", "/api/missions/" + id, null, auth);
    var duracao = leitura.json && leitura.json.duration_days;
    if (duracao !== 30) {
      falhas.push("o extend de fora mudou a duração para " + duracao);
    }

    var diasErrados = await estender("http://localhost:8080", 30);
    if (diasErrados.status === 200) {
      falhas.push("o mock aceitou um extend que não é de 36 dias");
    }

    var locais = [
      "http://localhost:8080",
      "http://127.0.0.1:8080",
      "http://[::1]:8080"
    ];
    for (var i = 0; i < locais.length; i++) {
      var ok = await estender(locais[i], 36);
      var esperada = 30 + (i + 1) * 36;
      var veio = ok.json && ok.json.mission && ok.json.mission.duration_days;
      if (ok.status !== 200 || ok.json.days !== 36 || veio !== esperada) {
        falhas.push("o mock recusou uma origem de desenvolvimento: " + locais[i] + " (" + ok.status + ", " + veio + ")");
      }
    }

    var erro = await pedir("POST", "/api/missions/7/extend?cenario=extend-erro", { days: 36 }, auth);
    if (erro.status === 200 || (erro.json && erro.json.days === 36)) {
      falhas.push("extend-erro respondeu sucesso");
    }
    var depois = await pedir("GET", "/api/missions/7?cenario=extend-erro", null, auth);
    if (!depois.json || depois.json.duration_days !== 30) {
      falhas.push("extend-erro mudou a duração");
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
  console.log("ok: o extend falso só responde em localhost, 127.0.0.1 e [::1]");
}).catch(function (erro) {
  console.error(erro && erro.message ? erro.message : erro);
  process.exit(1);
});
