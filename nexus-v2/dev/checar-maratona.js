/* Confere a tela da Maratona da comunidade (PR 46 do servidor, migração 017).
   1. Uma linha na comunidade e uma tela própria, sem botão de sair, sem
      ranking individual e sem nome de pessoa (só contagens do grupo).
   2. Visual sóbrio: sem «·», sem urso, sem barra colorida em cartão, sem
      innerHTML, alvos de 44 px, papel #EEF1EC no claro e preto no escuro.
   3. Rotas do mock: listar, criar, abrir, entrar, registrar o dia, 503 calmo,
      crise sem gravar, cheia, limite, dia repetido e criação dupla.
   Rode na raiz do repositório: node nexus-v2/dev/checar-maratona.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3101;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + JSON.stringify(veio) + ", esperado " + JSON.stringify(esperado));
}

var NOVOS = ["maratona.html", "maratona.css", "maratona.js", "maratona-textos.js", "maratona-comunidade.js"];
var html = ler("maratona.html");
var comunidadeHtml = ler("comunidade.html");
var css = ler("maratona.css");
var js = ler("maratona.js");
var linhaJs = ler("maratona-comunidade.js");
var textosJs = ler("maratona-textos.js");
var comunidadeJs = ler("comunidade.js");
var sw = ler("sw.js");

/* ---------- Estrutura e cache ---------- */
if (sw.indexOf('CACHE = "nexus-v2-v50"') === -1) falhas.push("o cache não está em nexus-v2-v50");
NOVOS.forEach(function (nome) {
  if (sw.indexOf('"./' + nome + '"') === -1) falhas.push("sw.js sem " + nome);
});
["linha-maratona", "maratona-nome", "maratona-quando", "maratona-pessoas", "btn-maratona-entrar",
  "link-maratona-criar", "alerta-maratona", "dialogo-maratona", "btn-entrar-maratona", "btn-agora-nao-maratona"
].forEach(function (id) {
  if (comunidadeHtml.indexOf('id="' + id + '"') === -1) falhas.push("comunidade.html sem #" + id);
});
if (comunidadeHtml.indexOf('href="maratona.css"') === -1 || comunidadeHtml.indexOf('src="maratona-textos.js"') === -1 || comunidadeHtml.indexOf('src="maratona-comunidade.js"') === -1) {
  falhas.push("comunidade.html não carrega os arquivos da Maratona");
}
if (comunidadeJs.indexOf("NexusApi.listarMaratonas(slugAtual)") === -1 || comunidadeJs.indexOf("NexusMaratonaLinha.pintar(") === -1 || comunidadeJs.indexOf("NexusMaratonaLinha.iniciar()") === -1) {
  falhas.push("comunidade.js não liga a linha da Maratona");
}
if (js.indexOf("resposta.dados.marathon") === -1 || js.indexOf("resposta.dados.maratona") !== -1) {
  falhas.push("a tela não lê a chave marathon do servidor");
}
if ((js.match(/mostrarVista\("aviso"\)/g) || []).length < 3) {
  falhas.push("um erro 503 ou sem rede ficou preso na vista de carregando");
}
if ((html.match(/btn-luz/g) || []).length !== 1) falhas.push("a tela da Maratona tem mais de uma luz no HTML");
if (!/id="trilha"[^>]*role="img"/.test(html) || html.indexOf('id="resumo-trilha"') === -1) falhas.push("tela sem trilha e resumo acessível");
if (!/<dialog/.test(html) || html.indexOf('data-texto-maratona="dialogoTitulo"') === -1) falhas.push("falta o diálogo de entrada");
if (comunidadeHtml.indexOf('data-texto-maratona="dialogoTitulo"') === -1) falhas.push("a comunidade não tem o diálogo de entrada");

/* ---------- Regras proibidas ---------- */
var fonteTela = semComentarios(html + js + linhaJs + textosJs + comunidadeHtml + comunidadeJs);
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(fonteTela)) falhas.push("texto de terceiros entrou por innerHTML");
if (/Sair da maratona|Sair da Maratona/i.test(fonteTela)) falhas.push("botão «Sair da maratona» é proibido");
if (/ranking individual|ranking/i.test(semComentarios(textosJs + js + linhaJs))) falhas.push("a Maratona mostra ranking individual");
if (/[·•]/.test(semComentarios(textosJs + html + linhaJs))) falhas.push("marca de separação «·» na Maratona");
if (/urso|bear/i.test(semComentarios(textosJs + html + css + linhaJs))) falhas.push("urso na tela da Maratona");
if (/@exemplo\.com|username|apelido/i.test(semComentarios(textosJs + html + css + linhaJs))) falhas.push("nome de pessoa na tela da Maratona");
if (/overflow-wrap:\s*anywhere|word-break/.test(css)) falhas.push("CSS parte palavras; use quebra de linha");
if (/border-left:\s*[2-9]|box-shadow:\s*0[^;]*,/.test(css)) falhas.push("cartão com barra colorida ou sombra");
if (!/--target:\s*44px/.test(ler("tokens.css"))) falhas.push("alvo mínimo não é 44 px");
if (!/\.linha-maratona-acoes \.btn[\s\S]*?min-height:\s*var\(--target\)/.test(css)) falhas.push("botões da linha sem 44 px");
if (!/\.formulario-maratona input[\s\S]*?min-height:\s*var\(--target\)/.test(css)) falhas.push("campos sem 44 px");
if (!/@media \(prefers-contrast: more\)/.test(css) || !/@media \(forced-colors: active\)/.test(css)) falhas.push("falta contraste alto e cores forçadas");
if (ler("tokens.css").indexOf("--papel: #EEF1EC") === -1 || !/\[data-theme="dark"\][\s\S]*?--bg:\s*#000000/.test(ler("tokens.css"))) falhas.push("papel claro ou fundo escuro errado");

/* ---------- Textos puros, num lugar só ---------- */
var janela = {};
vm.runInNewContext(ler("comunidade-textos.js") + "\n" + textosJs, { window: janela });
var M = janela.NexusMaratonaTextos;
if (!M || !M.TEXTOS) falhas.push("maratona-textos.js não carregou");
else {
  igual("nome do dia", M.quando({ phase: "active", day: 3, duration_days: 7 }), "Dia 3 de 7");
  igual("antes de começar", M.quando({ phase: "upcoming", day_number: -2, starts_in_days: 2 }), "Começa em 2 dias");
  igual("grupo no singular", M.preencher(M.TEXTOS.grupoHojeUm, { feitos: 1, total: 1 }), "Hoje, 1 de 1 pessoa cumpriu o dia.");
  igual("erro 503", M.erroDoServidor("unavailable"), M.TEXTOS.indisponivel);
  var trilha = M.estadosDaTrilha(
    { phase: "active", day: 3, duration_days: 4 },
    { participants: 10, days: [{ day: 1, done: 9 }, { day: 2, done: 2 }, { day: 3, done: 0 }] }
  );
  igual("trilha: 4 dias", trilha.length, 4);
  igual("trilha: feito", trilha[0].estado, "f");
  igual("trilha: pouca gente", trilha[1].estado, "p");
  igual("trilha: falta do grupo", trilha[2].estado, "x");
  igual("trilha: futuro", trilha[3].estado, "o");
  if (trilha[0].hoje || trilha[2].hoje !== true) falhas.push("ponta da trilha no dia errado");
}

/* ---------- Rotas do mock ---------- */
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
/* Nenhum nome de pessoa em qualquer resposta da Maratona. */
function semNome(nome, json) {
  var ruim = [];
  (function andar(v) {
    if (Array.isArray(v)) return v.forEach(andar);
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
      if (/username|apelido|user_id|email|ranking/i.test(k)) ruim.push(k);
      andar(v[k]);
    });
  })(json);
  if (ruim.length) falhas.push(nome + ": resposta com nome/ranking (" + ruim.join(", ") + ")");
}
function temCenario(caminho, nome) {
  return caminho + (caminho.indexOf("?") === -1 ? "?" : "&") + "cenario=" + nome;
}

async function casosDoMock() {
  var pessoa = (await pedir("POST", "/api/users/login", { email: "com-missao@exemplo.com", password: "123456" })).json.token;
  if (!pessoa) return falhas.push("login do mock não deu token");

  var lista = await pedir("GET", "/api/community-missions/leitura", null, pessoa);
  igual("listar: status", lista.status, 200);
  igual("listar: uma maratona", (lista.json.marathons || []).length, 1);
  igual("listar: pode criar", lista.json.can_create, true);
  semNome("listar", lista.json);
  var id = lista.json.marathons[0].id;

  var detalhe = await pedir("GET", "/api/community-missions/leitura/" + id, null, pessoa);
  igual("abrir: status", detalhe.status, 200);
  igual("abrir: dia", detalhe.json.marathon.day, 3);
  igual("abrir: grupo", detalhe.json.group.participants, 14);
  igual("abrir: feitos hoje", detalhe.json.group.today_done, 9);
  igual("abrir: participa", detalhe.json.me.is_participant, true);
  semNome("abrir", detalhe.json);

  var vazio = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-vazia"), null, pessoa);
  igual("vazia: lista", (vazio.json.marathons || []).length, 0);
  var indisponivel = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-503"), null, pessoa);
  igual("sem migração 017: status", indisponivel.status, 503);
  igual("sem migração 017: code", indisponivel.json.code, "unavailable");
  var antes = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-antes"), null, pessoa);
  igual("antes: fase", antes.json.marathons[0].phase, "upcoming");
  igual("antes: dias", antes.json.marathons[0].starts_in_days, 2);
  var encerrada = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-encerrada"), null, pessoa);
  igual("encerrada fora da lista", (encerrada.json.marathons || []).length, 0);
  var semMissao = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-sem-missao"), null, pessoa);
  igual("sem missão da área", semMissao.json.can_create, false);

  var registro = await pedir("POST", "/api/community-missions/leitura/" + id + "/checkin", null, pessoa);
  igual("registrar: status", registro.status, 201);
  igual("registrar: feito", registro.json.done, true);
  var repetido = await pedir("POST", "/api/community-missions/leitura/" + id + "/checkin", null, pessoa);
  igual("dia repetido: status", repetido.status, 409);
  igual("dia repetido: code", repetido.json.code, "already_done");
  var erro = await pedir("POST", temCenario("/api/community-missions/leitura/" + id + "/checkin", "maratona-registro-erro"), null, pessoa);
  igual("registro com erro: status", erro.status, 500);

  var cheia = await pedir("POST", temCenario("/api/community-missions/leitura/" + id + "/join", "maratona-cheia"), null, pessoa);
  igual("cheia: status", cheia.status, 409);
  igual("cheia: code", cheia.json.code, "full");

  /* Criar em outra comunidade: crise não grava e o limite de dias reprova. */
  var crise = await pedir("POST", temCenario("/api/community-missions/ingles-diario", "maratona-crise"),
    { title: "7 dias", description: "Ler", duration_days: 7, max_participants: 10 }, pessoa);
  igual("crise: status", crise.status, 200);
  igual("crise: salvo", crise.json.saved, false);
  var depoisDaCrise = await pedir("GET", "/api/community-missions/ingles-diario", null, pessoa);
  igual("crise: nada gravado", (depoisDaCrise.json.marathons || []).length, 0);
  var ruim = await pedir("POST", "/api/community-missions/ingles-diario",
    { title: "7 dias", description: "Ler", duration_days: 2, max_participants: 10 }, pessoa);
  igual("dias inválidos: status", ruim.status, 400);
  igual("dias inválidos: code", ruim.json.code, "invalid_days");
  var criada = await pedir("POST", "/api/community-missions/ingles-diario",
    { title: "7 dias de leitura", description: "Ler uma página", duration_days: 7, max_participants: 10 }, pessoa);
  igual("criar: status", criada.status, 201);
  igual("criar: quem cria entra", (await pedir("GET", "/api/community-missions/ingles-diario/" + criada.json.marathon.id, null, pessoa)).json.me.is_participant, true);
  var dupla = await pedir("POST", temCenario("/api/community-missions/ingles-diario", "maratona-ja-criou"),
    { title: "Outra", description: "Ler", duration_days: 7, max_participants: 10 }, pessoa);
  igual("duas maratonas: status", dupla.status, 409);
  igual("duas maratonas: code", dupla.json.code, "open_marathon");

  var semIdade = (await pedir("POST", "/api/users/login", { email: "sem-idade@exemplo.com", password: "123456" })).json.token;
  igual("sem 18+: maratona", (await pedir("GET", "/api/community-missions/leitura", null, semIdade)).status, 403);
}

var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
  env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
  stdio: "ignore"
});
esperarMock(50).then(casosDoMock).catch(function (erro) {
  falhas.push("mock: " + erro.message);
}).then(function () {
  filho.kill();
  if (falhas.length) {
    console.error("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: Maratona sem sair, sem ranking e sem nomes; textos, trilha, visual sóbrio e rotas do mock (503, crise, limite e dia repetido)");
});
