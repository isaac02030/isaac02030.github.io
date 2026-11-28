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
var jsSemComentarios = semComentarios(js);

/* ---------- Estrutura e cache ---------- */
if (sw.indexOf('CACHE = "nexus-v2-v57"') === -1) falhas.push("o cache não está em nexus-v2-v57");
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
if (/<ol class="lista-maratonas"/.test(html) || !/<ul class="lista-maratonas"/.test(html)) falhas.push("a lista ainda usa ol e mostra número");
if (!/\.lista-maratonas\s*\{[^}]*list-style:\s*none/.test(css)) falhas.push("a lista ainda mostra marcador");
if (!/id="inicio-campo"[^>]*type="date"/.test(html)) falhas.push("o dia de início não usa seletor de data do aparelho");
if (jsSemComentarios.indexOf("toISOString") !== -1 || jsSemComentarios.indexOf("Europe/Lisbon") === -1) falhas.push("o intervalo do seletor não usa datas de Lisboa");
if (!/inicio < inicioMin \|\| inicio > inicioMax/.test(jsSemComentarios)) falhas.push("a validação não aplica o intervalo do seletor");
if (comunidadeHtml.indexOf('id="maratona-prefixo"') === -1 || !/prefixo"\)\.hidden = !titulo/.test(linhaJs)) falhas.push("o título sem nome repete «Maratona: Maratona»");
if (/id="texto-dia-maratona"/.test(html) === false) falhas.push("o detalhe não mostra «Dia 3 de 7» em texto");
if (!/class="linha-maratona"[^>]*/.test(comunidadeHtml) || !/border-top:\s*1px/.test(css)) falhas.push("a linha da comunidade não virou linha com divisória");
if ((html.match(/btn-luz/g) || []).length !== 1) falhas.push("a tela da Maratona tem mais de uma luz no HTML");
if (!/id="trilha"[^>]*role="img"/.test(html) || html.indexOf('id="resumo-trilha"') === -1) falhas.push("tela sem trilha e resumo acessível");
if (!/<dialog/.test(html) || html.indexOf('data-texto-maratona="dialogoTitulo"') === -1) falhas.push("falta o diálogo de entrada");
if (comunidadeHtml.indexOf('data-texto-maratona="dialogoTitulo"') === -1) falhas.push("a comunidade não tem o diálogo de entrada");
if (/id="btn-entrar-maratona"[^>]*btn-primario/.test(html + comunidadeHtml)) falhas.push("o diálogo dá peso de botão principal a «Entrar»");
if (!/\.dialogo-maratona \.botoes \.btn,\s*\n\.dialogo-maratona \.botoes \.btn:hover[\s\S]*?background:\s*var\(--surface\)/.test(css)) falhas.push("os botões do diálogo não têm o mesmo peso");

/* A trilha dos 30 dias usa --t em porcentagem; número deixa o color-mix
   inválido e os dias passados somem da imagem (21:25 do Orfeu). */
if (!/setProperty\("--t",\s*t\s*\+\s*"%"\)/.test(jsSemComentarios) || /toFixed\(2\)/.test(jsSemComentarios)) {
  falhas.push("a posição no degradê da trilha não é porcentagem");
}
if (!/\.trilha-maratona \.s-f i\s*\{[^}]*background:\s*var\(--trilha-a\)/.test(css)) falhas.push("o dia feito não tem fundo visível");
if (!/\.trilha-maratona \.lk-on::after\s*\{[^}]*background:\s*var\(--trilha-a\)/.test(css) ||
    !/\.trilha-maratona \.lk-dim::after\s*\{[^}]*background:\s*var\(--trilha-a\)/.test(css)) {
  falhas.push("o fio entre os dias não tem cor de apoio");
}
if (!/#vista-aviso \.alerta\s*\{[^}]*margin-bottom:\s*var\(--space-4\)/.test(css)) {
  falhas.push("o aviso e «Tentar de novo» não têm 16 px entre eles");
}

/* ---------- Regras proibidas ---------- */
var fonteTela = semComentarios(html + js + linhaJs + textosJs + comunidadeHtml + comunidadeJs);
if (/innerHTML|outerHTML|insertAdjacentHTML/.test(fonteTela)) falhas.push("texto de terceiros entrou por innerHTML");
if (/Sair da maratona|Sair da Maratona/i.test(fonteTela)) falhas.push("botão «Sair da maratona» é proibido");
if (/ranking individual|ranking/i.test(semComentarios(textosJs + js + linhaJs))) falhas.push("a Maratona mostra ranking individual");
if (/[·•]/.test(semComentarios(textosJs + html + linhaJs))) falhas.push("marca de separação «·» na Maratona");
if (/AAAA-MM-DD|caracteres/i.test(semComentarios(textosJs + html))) falhas.push("jargão de programador na tela da Maratona");
if (/urso|bear/i.test(semComentarios(textosJs + html + css + linhaJs))) falhas.push("urso na tela da Maratona");
if (/@exemplo\.com|username|apelido/i.test(semComentarios(textosJs + html + css + linhaJs))) falhas.push("nome de pessoa na tela da Maratona");
if (/overflow-wrap:\s*anywhere|word-break/.test(css)) falhas.push("CSS parte palavras; use quebra de linha");
if (/border-left:\s*[2-9]|box-shadow:\s*0[^;]*,/.test(css)) falhas.push("cartão com barra colorida ou sombra");
if (!/--target:\s*44px/.test(ler("tokens.css"))) falhas.push("alvo mínimo não é 44 px");
if (!/\.linha-maratona-acoes \.btn[\s\S]*?min-height:\s*var\(--target\)/.test(css)) falhas.push("botões da linha sem 44 px");
if (!/--colunas:\s*4/.test(css) || !/nth-child\(4n\)/.test(css)) falhas.push("a trilha não quebra em 4 + 3 telas estreitas");
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
  igual("encerrada sem data", M.quando({ phase: "ended", day: null, duration_days: 7 }), "");
  igual("prefixo da linha", M.TEXTOS.maratonaPrefixo, "Maratona: ");
  igual("máximo de pessoas", M.TEXTOS.campoPessoas, "Máximo de pessoas");
  igual("dia por fazer", M.TEXTOS.pendenteHoje, "Seu dia de hoje: ainda falta.");
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

  /* Caso negado: quem saiu deixa a lista de participantes, mas os check-ins
     ficam no total do grupo. Nunca «9 de 8», nem na frase, nem na trilha. */
  var excedente = M.contagemDoGrupo({ participants: 8, today_done: 9 });
  igual("grupo: total de participantes", excedente.total, 8);
  igual("grupo: 9 check-ins viram 8", excedente.feitos, 8);
  igual("grupo: frase limitada", M.preencher(M.TEXTOS.grupoHoje, excedente), "Hoje, 8 de 8 pessoas cumpriram o dia.");
  var trilhaExcedente = M.estadosDaTrilha(
    { phase: "active", day: 3, duration_days: 4 },
    { participants: 8, today_done: 9, days: [{ day: 1, done: 9 }, { day: 2, done: 9 }, { day: 3, done: 9 }] }
  );
  igual("trilha: 9 check-ins viram 8", trilhaExcedente[0].feitos, 8);
  if (trilhaExcedente.some(function (dia) { return dia.feitos > 8; })) falhas.push("a trilha mostra mais gente cumprindo do que participantes");
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
  /* Os prints de detalhe só mostraram «Entrar na maratona» porque o usuário
     não era participante. Os dois cenários agora são participantes de verdade. */
  var porFazer = await pedir("GET", temCenario("/api/community-missions/leitura/" + id, "maratona-por-fazer"), null, pessoa);
  igual("por fazer: participa", porFazer.json.me.is_participant, true);
  igual("por fazer: dia", porFazer.json.me.day_done, false);
  var diaFeito = await pedir("GET", temCenario("/api/community-missions/leitura/" + id, "maratona-dia-feito"), null, pessoa);
  igual("dia feito: participa", diaFeito.json.me.is_participant, true);
  igual("dia feito: estado", diaFeito.json.me.day_done, true);
  /* Quem saiu sai da lista, mas os check-ins ficam no total do grupo. */
  var excedenteMock = await pedir("GET", temCenario("/api/community-missions/leitura/" + id, "maratona-excedente"), null, pessoa);
  igual("excedente: participantes", excedenteMock.json.group.participants, 8);
  igual("excedente: check-ins no total", excedenteMock.json.group.today_done, 9);
  var convite = await pedir("GET", temCenario("/api/community-missions/leitura", "maratona-convite"), null, pessoa);
  igual("convite: ainda não participa", convite.json.marathons[0].is_participant, false);
  igual("convite: fase", convite.json.marathons[0].phase, "upcoming");
  igual("convite: começa em", convite.json.marathons[0].starts_in_days, 2);

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

/* ---------- A imagem vale mais que a medida: abra o detalhe no navegador ----------
   Confere que CADA marca do detalhe tem área pintada visível. Um mutante que
   tira a regra do dia feito tem de reprovar aqui. */
var PORTA_SITE = 3102;
var TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8" };

/* O navegador é opcional: num checkout limpo, sem Playwright, esta parte é
   pulada e o resto da checagem continua. Nada de pacote ou caminho fixo. */
function acharPlaywright() {
  var nomes = ["playwright", "playwright-core"];
  for (var i = 0; i < nomes.length; i++) {
    try {
      return require(nomes[i]).chromium;
    } catch (erro) {
      if (erro.code !== "MODULE_NOT_FOUND") throw erro;
    }
  }
  return null;
}

function servirSite() {
  var servidor = http.createServer(function (req, res) {
    var caminho = decodeURIComponent((req.url || "/").split("?")[0]);
    if (caminho.indexOf("/nexus-v2/") !== 0) {
      res.writeHead(404);
      return res.end();
    }
    var arquivo = path.join(raiz, "..", caminho);
    fs.readFile(arquivo, function (erro, dados) {
      if (erro) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(dados);
    });
  });
  return new Promise(function (resolve) {
    servidor.listen(PORTA_SITE, "127.0.0.1", function () { resolve(servidor); });
  });
}

var transparente = "rgba(0, 0, 0, 0)";
function pintadas(marcas) {
  return marcas.filter(function (m) {
    if (m.fundo !== transparente && m.fundo !== m.fundoPagina) return true;
    return parseFloat(m.borda) > 0 && m.bordaCor !== transparente && m.bordaCor !== m.fundoPagina;
  }).length;
}

var navegadorRodou = false;
async function casosDoNavegador() {
  var chromium = acharPlaywright();
  if (!chromium) {
    console.warn("aviso: checagem do navegador pulada: Playwright não encontrado");
    return;
  }
  navegadorRodou = true;
  var servidor = await servirSite();
  var navegador = null;
  try {
    var login = await pedir("POST", "/api/users/login", { email: "com-missao@exemplo.com", password: "123456" });
    var token = login.json.token;
    if (!token) throw new Error("login do navegador não deu token");
    var opcoes = { headless: true, args: ["--no-sandbox"] };
    if (process.env.NEXUS_CHROME) opcoes.executablePath = process.env.NEXUS_CHROME;
    navegador = await chromium.launch(opcoes);
    var contexto = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await contexto.addInitScript(function (dados) {
      try { localStorage.setItem("nexus_v2_token", dados.token); } catch (e) {}
    }, { token: token });
    await contexto.route("http://localhost:3000/**", async function (route) {
      var url = route.request().url().replace("http://localhost:3000", "http://127.0.0.1:" + PORTA);
      try {
        var resposta = await route.fetch({ url: url });
        await route.fulfill({ response: resposta });
      } catch (e) {
        await route.abort();
      }
    });
    var pagina = await contexto.newPage();
    await pagina.goto("http://127.0.0.1:" + PORTA_SITE + "/nexus-v2/maratona.html?c=leitura&m=1&tema=escuro", { waitUntil: "networkidle" });
    await pagina.waitForSelector("#vista-detalhe:not([hidden])", { timeout: 15000 });
    await pagina.waitForSelector("#trilha > li", { timeout: 15000 });

    var lerMarcas = function () {
      return pagina.evaluate(function () {
        var fundoPagina = getComputedStyle(document.body).backgroundColor;
        return Array.from(document.querySelectorAll("#trilha > li")).map(function (li) {
          var ci = getComputedStyle(li.querySelector("i"));
          return {
            classe: li.className,
            t: li.style.getPropertyValue("--t"),
            fundo: ci.backgroundColor,
            borda: ci.borderTopWidth,
            bordaCor: ci.borderTopColor,
            fio: getComputedStyle(li, "::after").backgroundColor,
            fundoPagina: fundoPagina
          };
        });
      });
    };
    var marcas = await lerMarcas();
    if (marcas.length !== 7) falhas.push("o detalhe no navegador não tem 7 marcas: tem " + marcas.length);
    if (pintadas(marcas) !== marcas.length) falhas.push("alguma marca do detalhe não tem área pintada visível");
    marcas.forEach(function (m, i) {
      if (!/%$/.test(m.t)) falhas.push("marca " + (i + 1) + " sem --t em porcentagem: " + m.t);
      if (m.classe.indexOf(" s-f ") !== -1 && m.fundo === transparente) falhas.push("dia " + (i + 1) + " feito ficou transparente");
      if ((m.classe.indexOf("lk-on") !== -1 || m.classe.indexOf("lk-dim") !== -1) && m.fio === transparente) {
        falhas.push("o fio do dia " + (i + 1) + " ficou transparente");
      }
    });
    /* Mutante: a mesma marca feita, sem a regra que pinta o quadrado. */
    await pagina.addStyleTag({ content: ".trilha-maratona .s-f i { background: var(--bg) !important; border-color: var(--bg) !important; }" });
    var mutante = await lerMarcas();
    if (pintadas(mutante) === mutante.length) falhas.push("o teste não reprovou o mutante sem a marca do dia feito");
    await contexto.close();
  } finally {
    if (navegador) await navegador.close();
    await new Promise(function (resolve) { servidor.close(resolve); });
  }
}

var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
  env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
  stdio: "ignore"
});
esperarMock(50).then(casosDoMock).then(casosDoNavegador).catch(function (erro) {
  falhas.push("mock/navegador: " + erro.message);
}).then(function () {
  filho.kill();
  if (falhas.length) {
    console.error("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: Maratona sem sair, sem ranking e sem nomes; textos, visual sóbrio, rotas do mock (503, crise, limite, dia repetido) e cenários de participante (por fazer/feito)" +
    (navegadorRodou ? "; trilha pintada no navegador (mutante reprovado)" : ""));
});
