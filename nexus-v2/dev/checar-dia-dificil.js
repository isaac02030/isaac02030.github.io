/* Confere a tela do dia difícil: o toque «Fiz o mínimo» é a ação principal,
   a frase é opcional, o pedido manda minimum_done: true e a tela usa o visual
   novo do Hoje (papel liso, sem cartão com sombra, sem marcas de página de IA).
   Também sobe o mock local e prova os casos negados.
   Rode na raiz do repositório: node nexus-v2/dev/checar-dia-dificil.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var spawn = require("child_process").spawn;

var PORTA = 3098;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

var html = ler("dia-dificil.html");
var js = ler("dia-dificil.js");
var css = ler("dia-dificil.css");
var api = ler("api.js");
var sw = ler("sw.js");

/* ---------- Pedido ---------- */
var pedido = api.slice(api.indexOf("registrarDiaDificil"), api.indexOf("criarMissao"));
if (!/difficult:\s*true/.test(pedido) || !/minimum_done:\s*true/.test(pedido)) {
  falhas.push("registrarDiaDificil não manda difficult: true e minimum_done: true");
}

/* ---------- Ação principal e frase opcional ---------- */
if (!/<button type="submit" class="btn btn-primario btn-grande" id="btn-registrar"[^>]*data-texto="Fiz o mínimo"/.test(html)) {
  falhas.push("o botão principal não é «Fiz o mínimo»");
}
if (html.indexOf('<span class="btn-rotulo">Fiz o mínimo</span>') === -1) falhas.push("o rótulo do botão não diz «Fiz o mínimo»");
if (!/<label for="nota">[^<]*<span class="opcional">\(opcional\)<\/span><\/label>/.test(html)) {
  falhas.push("a frase não tem o rótulo «(opcional)»");
}
var campo = html.slice(html.indexOf("<textarea"), html.indexOf("</textarea>"));
if (/aria-required|required/.test(campo)) falhas.push("a frase ainda é obrigatória no campo");
var envio = js.slice(js.indexOf("async function enviar"), js.indexOf("function ligarLinks"));
if (/notaEscrita\(\)\s*\)\s*return|TEXTO_VAZIO|validarNota/.test(envio) || /validarNota|TEXTO_VAZIO/.test(js)) {
  falhas.push("a tela ainda bloqueia o envio sem frase");
}
if (envio.indexOf("definirCarregando(true)") === -1 || js.indexOf("botao.disabled = ligado") === -1) {
  falhas.push("o botão não fica desabilitado durante o envio");
}
if (!/id="alerta" class="alerta" role="alert"/.test(html) || !/id="alerta-erro" class="alerta" role="alert"/.test(html)) {
  falhas.push("os erros precisam de role=alert");
}
[
  "Para marcar o dia difícil, confirme que fez o mínimo do contrato e tente de novo.",
  "Sem internet. Tente de novo quando a conexão voltar. O que você escreveu continua aqui.",
  "Não foi possível registrar agora. Tente de novo.",
  "Dia difícil registrado. O mínimo de hoje era pequeno, e valeu."
].forEach(function (frase) {
  if (js.indexOf(frase) === -1) falhas.push("falta a frase «" + frase + "»");
});
if (html.indexOf("O mínimo de hoje continua valendo:") === -1) falhas.push("falta o mínimo de hoje");
var ordem = ['id="titulo"', 'id="bloco-minimo"', 'for="nota"', 'id="btn-registrar"', 'id="link-ajuda"'];
var ultimo = -1;
ordem.forEach(function (peca) {
  var i = html.indexOf(peca);
  if (i === -1) falhas.push("falta " + peca);
  else if (i < ultimo) falhas.push(peca + " fora da ordem");
  else ultimo = i;
});
if (html.indexOf('href="crise.html"') === -1) falhas.push("falta o link de ajuda no HTML");

var trechoRede = js.slice(js.indexOf("function semRedeAgora"), js.indexOf("function icone"));
if (trechoRede.indexOf("NexusAbas.emDev()") === -1) falhas.push("?rede=off precisa ficar só em localhost, 127.0.0.1 e [::1]");

/* ---------- Visual novo do Hoje ---------- */
if (css.indexOf("body:has(.tela-dificil)") === -1 || !/body:has\(\.tela-dificil\)\s*\{[^}]*background-image:\s*none/.test(css)) {
  falhas.push("as linhas de caderno do fundo voltaram");
}
if (/class="[^"]*\bcartao\b/.test(html)) falhas.push("a tela ainda usa o cartão com sombra");
if (/box-shadow:\s*(?!none)/.test(css)) falhas.push("sombra na tela do dia difícil");
if (html.indexOf("checkin.css") !== -1) falhas.push("a tela ainda carrega checkin.css (barra sob o título)");
if (html.indexOf('class="spinner"') !== -1) falhas.push("nada pode girar na tela");
if (!/\.btn-grande\s*\{[^}]*min-height:\s*48px/.test(css)) falhas.push("o botão principal não tem 48px");
if (/height:\s*[0-9]+px/.test(css.replace(/min-height:\s*[0-9]+px/g, "").replace(/(width|height):\s*24px/g, ""))) {
  falhas.push("altura fixa em px: o texto a 200% corta");
}
if (/@keyframes|animation:/.test(css)) falhas.push("a tela não deve ter animação");
if (css.indexOf("--danger") !== -1) falhas.push("o dia difícil não pode usar --danger");

/* Marcas de página gerada por IA (skill frontend-design). */
var textoTela = html + js;
if (/text-transform:\s*uppercase/.test(css)) falhas.push("rótulo em caixa alta");
if (/ · /.test(textoTela)) falhas.push("texto com pontinhos «A · B · C»");
if (/→/.test(textoTela)) falhas.push("seta «→» em botão ou link");
if (/border-left:\s*[0-9]+px solid/.test(css)) falhas.push("caixa com barra colorida à esquerda");
if (/(radial|linear)-gradient\([^)]*var\(--accent/.test(css)) falhas.push("gradiente decorativo no acento");
if (/::after\s*\{[^}]*background:\s*var\(--accent\)/.test(css)) falhas.push("tracinho decorativo no acento");
if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(textoTela)) falhas.push("emoji na tela");

/* ---------- Cache ---------- */
if (sw.indexOf('CACHE = "nexus-v2-v21"') === -1) falhas.push("o cache não está em nexus-v2-v21");
["./dia-dificil.html", "./dia-dificil.css", "./dia-dificil.js"].forEach(function (arquivo) {
  if (sw.indexOf('"' + arquivo + '"') === -1) falhas.push("o cache não guarda " + arquivo);
});

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

async function provar() {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarServidor(filho);
    var dono = await entrar("dia-dificil-a@exemplo.com");
    var outro = await entrar("dia-dificil-b@exemplo.com");
    if (!dono || !outro) {
      falhas.push("não foi possível entrar no mock");
      return;
    }
    var criada = await pedir("POST", "/api/missions", {
      title: "Ler uma página por dia",
      category: "aprendizagem",
      daily_minimum: "Uma página",
      why_it_matters: "Quero ler sem traduzir",
      mode: "solo",
      duration_days: 30,
      proof_mode: "study_note"
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

    var semLogin = await registrar(null, { difficult: true, minimum_done: true });
    if (semLogin.status !== 401) falhas.push("sem login o dia difícil não deu 401 (deu " + semLogin.status + ")");

    var deOutro = await registrar(outro, { difficult: true, minimum_done: true });
    if (deOutro.status !== 404) falhas.push("outra pessoa não recebeu 404 (deu " + deOutro.status + ")");

    var semMinimo = await registrar(dono, { difficult: true, note: "" });
    if (semMinimo.status !== 400 || !/confirme que fez o mínimo/.test(semMinimo.json.error || "")) {
      falhas.push("sem minimum_done o dia difícil não deu 400 com a mensagem calma");
    }

    var comum = await registrar(dono, { note: "li" });
    if (comum.status !== 400) falhas.push("o check-in comum deixou de exigir a prova");

    var ok = await registrar(dono, { difficult: true, minimum_done: true, note: "" });
    if (ok.status !== 201 || !ok.json.checkin || ok.json.checkin.difficult !== true) {
      falhas.push("o dia difícil sem frase e com minimum_done não foi aceito");
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
  console.log("ok: dia difícil com «Fiz o mínimo», frase opcional e casos negados");
}).catch(function (erro) {
  console.error("falhou: " + erro.message);
  process.exit(1);
});
