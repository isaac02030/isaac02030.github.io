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
var checkinJs = ler("checkin.js");
var vm = require("vm");
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
  "Dia difícil registrado. O mínimo de hoje era pequeno, e você o cumpriu."
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

/* ---------- Contagem com os números dos dados (revisão da Clara) ---------- */
function carregarFuncoes(fonte, nomes) {
  var trechos = [];
  ["var LIMITE_DIFICEIS", "var TEXTO_SEGUIDOS_REGRA", "var CAMPOS_DE_CRISE_NA_RESPOSTA"].forEach(function (inicio) {
    var i = fonte.indexOf(inicio);
    if (i !== -1) trechos.push(fonte.slice(i, fonte.indexOf(";", i) + 1));
  });
  nomes.forEach(function (nome) {
    var i = fonte.indexOf("function " + nome + "(");
    if (i === -1) return;
    var fim = fonte.indexOf("\n}\n", i);
    trechos.push(fonte.slice(i, fim + 3));
  });
  var caixa = {};
  vm.runInNewContext(trechos.join("\n") + "\nthis.f = { " + nomes.map(function (n) {
    return n + ": typeof " + n + " === 'function' ? " + n + " : null";
  }).join(", ") + " };", caixa);
  return caixa.f;
}
var fDia = carregarFuncoes(js, ["numeroValido", "textoApoio", "respostaIndicaCrise"]);
if (!fDia.textoApoio) {
  falhas.push("falta textoApoio");
} else {
  var casosTexto = [
    [{ difficult_days: [1, 2], difficult_days_used: 2, difficult_days_remaining: 2 }, "Você tem 4 dias difíceis nesta missão e já usou 2. Restam 2. No máximo 2 seguidos."],
    [{ difficult_days: [5], difficult_days_used: 1, difficult_days_remaining: 3 }, "Você tem 4 dias difíceis nesta missão e já usou 1. Restam 3. No máximo 2 seguidos."],
    [{ difficult_days: [], difficult_days_used: 0, difficult_days_remaining: 4 }, "Você tem 4 dias difíceis nesta missão e ainda não usou nenhum. Restam 4. No máximo 2 seguidos."],
    [{ difficult_days: [1, 3, 5] }, "Você tem 4 dias difíceis nesta missão e já usou 3. Restam 1. No máximo 2 seguidos."],
    [{}, "Você tem 4 dias difíceis nesta missão. No máximo 2 seguidos."]
  ];
  casosTexto.forEach(function (caso) {
    var texto = fDia.textoApoio(caso[0]);
    if (texto !== caso[1]) falhas.push("contagem: esperado «" + caso[1] + "», veio «" + texto + "»");
  });
}
if (/destes dias|Ainda restam/.test(js)) falhas.push("o texto antigo da contagem voltou");

/* ---------- Sucesso com saída (revisão da Clara) ---------- */
var sucesso = html.slice(html.indexOf('id="vista-sucesso"'), html.indexOf("</section>", html.indexOf('id="vista-sucesso"')));
if (!/<a class="btn btn-primario btn-grande" id="btn-sucesso-hoje" href="hoje\.html">Voltar para Hoje<\/a>/.test(sucesso)) {
  falhas.push("o sucesso não tem o botão «Voltar para Hoje»");
}
if (!/\.sucesso\s*\{[^}]*color:\s*var\(--text\)/.test(css) || !/\.sucesso \.icone\s*\{[^}]*color:\s*var\(--success\)/.test(css)) {
  falhas.push("a mensagem de sucesso precisa de --text com o ícone em --success");
}

/* ---------- Crise: a resposta com crisis: true abre a ajuda ---------- */
[["dia-dificil.js", js], ["checkin.js", checkinJs]].forEach(function (par) {
  var nome = par[0];
  var fonte = par[1];
  if (!/var CAMPOS_DE_CRISE_NA_RESPOSTA = \["crisis"\];/.test(fonte)) falhas.push(nome + ": a crise não está ligada");
  var trata = fonte.slice(fonte.indexOf("function tratarResposta"), fonte.indexOf("async function enviar"));
  var iCrise = trata.indexOf("respostaIndicaCrise(dados)");
  var iOk = trata.indexOf("if (resultado.ok)");
  if (iCrise === -1 || iOk === -1 || iCrise > iOk) falhas.push(nome + ": a crise precisa ser lida antes do sucesso e dos erros");
  var ir = fonte.slice(fonte.indexOf("function irParaCrise"), fonte.indexOf("}", fonte.indexOf("function irParaCrise")));
  if (ir.indexOf("limparRascunho()") === -1 || ir.indexOf("limparNota()") === -1) falhas.push(nome + ": a frase de crise fica no rascunho");
  if (ir.indexOf('"crise.html"') === -1) falhas.push(nome + ": a crise não abre crise.html");
  var f = carregarFuncoes(fonte, ["respostaIndicaCrise"]);
  if (!f.respostaIndicaCrise) {
    falhas.push(nome + ": falta respostaIndicaCrise");
  } else {
    if (f.respostaIndicaCrise({ crisis: true, crisis_level: "alto", checkin: {} }) !== true) falhas.push(nome + ": crisis: true não abre a ajuda");
    if (f.respostaIndicaCrise({ checkin: { difficult: true } }) !== false) falhas.push(nome + ": sem crisis a ajuda abre");
    if (f.respostaIndicaCrise({ crisis: "true" }) !== false) falhas.push(nome + ": crisis em texto não pode abrir a ajuda");
    if (f.respostaIndicaCrise({ crisis_level: "alto" }) !== false) falhas.push(nome + ": só crisis_level não basta");
  }
});

/* ---------- Visual novo do Hoje ---------- */
if (css.indexOf("body:has(.tela-dificil)") === -1 || !/body:has\(\.tela-dificil\)\s*\{[^}]*background-image:\s*none/.test(css)) {
  falhas.push("as linhas de caderno do fundo voltaram");
}
if (/class="[^"]*\bcartao\b/.test(html)) falhas.push("a tela ainda usa o cartão com sombra");
if (/box-shadow:\s*(?!none)/.test(css)) falhas.push("sombra na tela do dia difícil");
if (html.indexOf("checkin.css") !== -1) falhas.push("a tela ainda carrega checkin.css (barra sob o título)");
if (html.indexOf('class="spinner"') !== -1) falhas.push("nada pode girar na tela");
if (!/\.btn-grande\s*\{[^}]*min-height:\s*48px/.test(css)) falhas.push("o botão principal não tem 48px");
if (/height:\s*[0-9]+px/.test(css.replace(/min-height:\s*[0-9]+px/g, "").replace(/(width|height):\s*(24|28)px/g, ""))) {
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
if (sw.indexOf('CACHE = "nexus-v2-v39"') === -1) falhas.push("o cache não está em nexus-v2-v39");
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
    if ("crisis" in ok.json) falhas.push("sem crise, a resposta não pode trazer crisis");

    var tokenCrise = await entrar("post-crise@exemplo.com");
    var missoesCrise = await pedir("GET", "/api/missions", null, { Authorization: "Bearer " + tokenCrise });
    var idCrise = Array.isArray(missoesCrise.json) && missoesCrise.json[0] && missoesCrise.json[0].id;
    var comCrise = await pedir("POST", "/api/checkins", {
      mission_id: idCrise, difficult: true, minimum_done: true, note: "frase de teste"
    }, { Authorization: "Bearer " + tokenCrise });
    if (comCrise.status !== 201 || comCrise.json.crisis !== true) falhas.push("o cenário post-crise não devolve crisis: true");
    if (comCrise.json.checkin && comCrise.json.checkin.note !== null) falhas.push("com crise, o mock guardou a nota");
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
