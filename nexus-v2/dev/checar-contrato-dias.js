/* Confere a escolha dos dias da missão (spec da Clara, 21/11/2026) e o mock local.
   Rode na raiz do repositório: node nexus-v2/dev/checar-contrato-dias.js

   Casos negados: menos de 3 dias não envia nada; dia repetido ou fora de 1 a 7
   é recusado; 503 sem a migração não cria missão; sem login dá 401; check-in
   num dia livre não grava (free_day: true). */

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var http = require("http");
var spawn = require("child_process").spawn;

var raiz = path.join(__dirname, "..");
var PORTA = 3096;
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}

function semComentarios(texto) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
}

/* ---------- 1. A lógica pura (dias-da-missao.js) ---------- */

var fonteDias = ler("dias-da-missao.js");
var caixa = { window: {} };
vm.runInNewContext(fonteDias, caixa);
var D = caixa.window.NexusDias;
if (!D) {
  console.error("dias-da-missao.js não expõe window.NexusDias");
  process.exit(1);
}

function igual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pedidoDe(lista) {
  var r = D.pedido(lista);
  return { ok: r.ok, campo: r.campo === undefined ? "(sem)" : r.campo };
}

/* Negados: nada vai ao servidor. */
[[], [1], [1, 3], [1, 1, 3], [0, 8], ["x", null], null, undefined, [1, 3, 3, 3]].forEach(function (lista) {
  var r = D.pedido(lista);
  if (r.ok !== false) falhas.push("pedido(" + JSON.stringify(lista) + ") devia ser negado");
  if (r.campo !== undefined) falhas.push("pedido(" + JSON.stringify(lista) + ") negado não pode levar o campo");
  if (r.erro !== "Escolha pelo menos 3 dias por semana.") falhas.push("pedido negado sem a frase calma");
});
/* Os 7: o campo fica de fora (null = não envia). */
if (!igual(pedidoDe([7, 6, 5, 4, 3, 2, 1]), { ok: true, campo: null })) falhas.push("com os 7 dias, mission_weekdays não pode ir");
if (!igual(pedidoDe([5, 1, 3]), { ok: true, campo: [1, 3, 5] })) falhas.push("3 dias devem ir em ordem: [1, 3, 5]");
if (!igual(pedidoDe([1, 2, 3, 4, 5]), { ok: true, campo: [1, 2, 3, 4, 5] })) falhas.push("segunda a sexta deve ir [1..5]");

if (D.daMissao([1, 2, 3, 4, 5, 6, 7]) !== null) falhas.push("os 7 guardados valem como todos os dias (null)");
if (D.daMissao([1, 3]) !== null || D.daMissao([1, 1, 3]) !== null || D.daMissao("1,3,5") !== null) falhas.push("dado estranho do servidor vale como todos os dias");
if (!igual(D.daMissao([5, 3, 1]), [1, 3, 5])) falhas.push("daMissao não ordena");

if (D.resumo([1, 3, 5]) !== "seg, qua e sex") falhas.push("resumo de 3 dias: «seg, qua e sex»");
if (D.resumo([1, 2, 3, 4, 5, 6, 7]) !== "todos os dias") falhas.push("resumo dos 7: «todos os dias»");
if (D.contador(5) !== "5 dias por semana." || D.contador(1) !== "1 dia por semana." || D.contador(0) !== "0 dias por semana.") falhas.push("contador com plural errado");

/* Dia 1 numa segunda (1): o Dia 3 é quarta, o Dia 8 é segunda de novo. */
if (D.semanaDoDia(1, 3) !== 3 || D.semanaDoDia(1, 8) !== 1 || D.semanaDoDia(7, 2) !== 1) falhas.push("semanaDoDia errado");
var ehDaMissao = D.verificador([1, 3, 5], 1);
if (!ehDaMissao(1) || ehDaMissao(2) || !ehDaMissao(3) || ehDaMissao(6) || !ehDaMissao(8)) falhas.push("verificador errado para seg, qua e sex");
if (!D.verificador(null, 1)(2) || !D.verificador([1, 3, 5], null)(2)) falhas.push("sem dias (ou sem o Dia 1), todo dia é da missão");
if (D.proximoNome([1, 3, 5], 1, 2, 30) !== "quarta-feira") falhas.push("próximo dia depois de uma terça devia ser quarta-feira");
if (D.proximoNome([1, 3, 5], 1, 30, 30) !== "") falhas.push("sem próximo dia até o fim, a frase some");
/* Frase do dia livre no check-in: Dia 1 numa segunda, hoje é o Dia 2 (terça). */
var segunda = new Date(2026, 10, 16, 0, 0, 0);
var frase = D.fraseDiaLivre({ started_at: segunda.toISOString(), duration_days: 30, mission_weekdays: [1, 3, 5] }, null, segunda.getTime() + 25 * 60 * 60 * 1000);
if (frase !== "Hoje é dia livre. Não precisa de check-in. O próximo dia da missão é quarta-feira.") falhas.push("frase do dia livre no check-in errada: " + frase);
var fraseSeq = D.fraseDiaLivre({ started_at: segunda.toISOString(), duration_days: 30 }, [1, 3, 5], segunda.getTime() + 25 * 60 * 60 * 1000);
if (fraseSeq !== frase) falhas.push("a frase do dia livre precisa usar os dias da sequência");
if (D.fraseDiaLivre(null, null) !== "Hoje é dia livre. Não precisa de check-in.") falhas.push("sem missão, a frase do dia livre fica só com a primeira parte");
if (!D.erroDoServidor("Escolha pelo menos 3 dias da missão por semana.") || D.erroDoServidor("Erro interno.")) falhas.push("erroDoServidor errado");

/* ---------- 2. Textos aprovados (seção 8 da spec), num lugar só ---------- */

var aprovados = {
  titulo: "Em quais dias da semana?",
  apoio: "Escolha de 3 a 7 dias. Nos outros dias você não faz check-in e não recebe lembrete. Esses dias não contam como dia sem registro.",
  contadorVarios: "{n} dias por semana.",
  erroMinimo: "Escolha pelo menos 3 dias por semana.",
  atalhoTodos: "Todos os dias",
  atalhoUteis: "Segunda a sexta",
  hojeLivre: "Hoje é dia livre. Não precisa de check-in.",
  proximoDia: "O próximo dia da missão é {dia}.",
  legendaLivre: "Dia livre",
  legendaMissao: "Dia da missão",
  tituloPlano: "Plano dos 30 dias",
  indisponivel: "A escolha dos dias ainda não está disponível. Você pode começar a missão com todos os dias ou tentar mais tarde.",
  comecarComTodos: "Começar com todos os dias",
  avisoLembrete: "O aviso só toca nos dias da missão.",
  semRedeMissao: "Sem internet. A missão não foi criada. Tente de novo quando a conexão voltar."
};
Object.keys(aprovados).forEach(function (chave) {
  if (D.TEXTOS[chave] !== aprovados[chave]) falhas.push("texto «" + chave + "» diferente do aprovado");
});

/* Nenhum outro arquivo da tela repete as frases: trocar é num lugar só. */
fs.readdirSync(raiz).forEach(function (nome) {
  if (!/\.(html|js)$/.test(nome) || nome === "dias-da-missao.js") return;
  var texto = semComentarios(ler(nome));
  ["Em quais dias da semana?", "Escolha pelo menos 3 dias por semana.", "Hoje é dia livre. Não precisa de check-in.", "O aviso só toca nos dias da missão.", "Começar com todos os dias", "Segunda a sexta"].forEach(function (frase) {
    if (texto.indexOf(frase) !== -1) falhas.push(nome + " repete «" + frase + "» (o texto fica só em dias-da-missao.js)");
  });
});

/* ---------- 3. Começo da missão (onboarding) ---------- */

var html = ler("onboarding.html");
var js = ler("onboarding.js");
var css = ler("onboarding.css");
var jsLimpo = semComentarios(js);

["1 de 4", "2 de 4", "3 de 4", "4 de 4"].forEach(function (passo) {
  if (html.indexOf("</span>" + passo + "</p>") === -1) falhas.push("falta o indicador «" + passo + "»");
});
if (/\d de 3</.test(html)) falhas.push("ainda há indicador «de 3»");
var ordem = ['id="passo-1"', 'id="passo-2"', 'id="previa-dias"', 'id="passo-3"', 'id="grupo-dias"', 'id="contador-dias"', 'id="erro-dias"', 'id="apoio-dias"', 'id="atalho-todos"', 'id="atalho-uteis"', 'id="passo-4"', 'data-texto-dias="avisoLembrete"', 'id="btn-comecar"'];
var ultimo = -1;
ordem.forEach(function (peca) {
  var i = html.indexOf(peca);
  if (i === -1) falhas.push("falta " + peca);
  else if (i < ultimo) falhas.push(peca + " fora da ordem da spec");
  else ultimo = i;
});
if (!/<fieldset class="dias" id="grupo-dias"[^>]*>\s*<legend[^>]*data-texto-dias="titulo"/.test(html)) falhas.push("o grupo dos dias precisa de fieldset com legend");
if (!/id="contador-dias"[^>]*aria-live="polite"/.test(html)) falhas.push("o contador precisa de aria-live polite");
if (!/id="erro-dias"[^>]*role="alert"/.test(html)) falhas.push("o aviso dos dias precisa de role=alert");
if (html.indexOf('<script src="dias-da-missao.js"></script>\n  <script src="onboarding.js">') === -1) falhas.push("onboarding.html precisa carregar dias-da-missao.js antes de onboarding.js");

if (jsLimpo.indexOf('caixa.type = "checkbox"') === -1) falhas.push("os dias precisam ser input type=checkbox nativos");
if (jsLimpo.indexOf('caixa.setAttribute("aria-label", NexusDias.LONGOS[i])') === -1) falhas.push("cada dia precisa do nome inteiro para o leitor de tela");
if (jsLimpo.indexOf("caixa.checked = true") === -1 || jsLimpo.indexOf("mission_weekdays: NexusDias.TODOS.slice()") === -1) falhas.push("o padrão são os 7 dias marcados");

/* Negado: o passo 3 e a criação conferem antes; com menos de 3, return sem enviar. */
function trecho(inicio, fim) {
  var i = jsLimpo.indexOf(inicio);
  var j = jsLimpo.indexOf(fim, i + 1);
  if (i === -1 || j === -1) return "";
  return jsLimpo.slice(i, j);
}
var passo3 = trecho("function enviarPasso3", "function mostrarIndisponivel");
if (!/var conferido = NexusDias\.pedido\(estado\.mission_weekdays\);\s*if \(!conferido\.ok\) \{[\s\S]*?focarGrupoDias\(\);\s*return;/.test(passo3)) falhas.push("o passo 3 precisa parar com menos de 3 dias e voltar o foco ao grupo");
if (/disabled/.test(passo3)) falhas.push("o Continuar do passo 3 não pode ser desabilitado");
var criar = trecho("async function criarAMissao", "function limparErroAoDigitar");
var iPedido = criar.indexOf("NexusDias.pedido(estado.mission_weekdays)");
var iRetorno = criar.indexOf("return;", iPedido);
var iEnvio = criar.indexOf("NexusApi.criarMissao(");
if (iPedido === -1 || iEnvio === -1 || !(iPedido < iRetorno && iRetorno < iEnvio)) falhas.push("criar a missão precisa conferir os dias e parar antes do envio");
if (!/if \(conferido\.campo\) pedido\.mission_weekdays = conferido\.campo;/.test(criar)) falhas.push("mission_weekdays só vai quando há de 3 a 6 dias");
if (!/resultado\.status === 503 && conferido\.campo/.test(criar)) falhas.push("falta tratar o 503");
if (!/resultado\.status === 400 && NexusDias\.erroDoServidor\(resultado\.erro\)/.test(criar)) falhas.push("falta mostrar o 400 do servidor no lugar do aviso");
if (criar.indexOf("criarAMissao({ semDias: true })") === -1) falhas.push("«Começar com todos os dias» precisa repetir sem o campo");
if (jsLimpo.indexOf('document.getElementById("btn-comecar").hidden = true;') === -1 || !/function fecharIndisponivel\(\)/.test(jsLimpo)) falhas.push("no 503, só um botão principal: «Começar a missão» some enquanto o alerta está aberto");
if (criar.indexOf("definirCarregando(botao, true)") === -1) falhas.push("o botão precisa ficar desabilitado durante o envio");

var api = semComentarios(ler("api.js"));
if (!/if \(Array\.isArray\(dados\.mission_weekdays\)\) corpo\.mission_weekdays = dados\.mission_weekdays\.slice\(\);/.test(api)) falhas.push("api.js só pode mandar mission_weekdays quando vier uma lista");

/* Visual novo dos passos 1 a 4: sem linhas, sem cartão com sombra. */
if (!/body:has\(\.tela-comeco\)\s*\{\s*background-image:\s*none;/.test(css)) falhas.push("as linhas de caderno voltaram ao começo");
if (/class="cartao"/.test(html)) falhas.push("o começo ainda usa o cartão com sombra");
/* Só o anel interno do círculo da carta (inset) é permitido: nada de sombra projetada. */
if (/box-shadow:(?!\s*(inset|none))/.test(css)) falhas.push("o começo não usa sombra");
if (!/\.carta\s*\{[^}]*border:\s*2px solid transparent;[^}]*border-radius:\s*var\(--radius-lg\);[^}]*background:\s*var\(--surface-2\)/.test(css)) falhas.push("a carta precisa ficar sem borda, raio 16, fundo --surface-2");
if (!/\.previa\s*\{[^}]*border-radius:\s*var\(--radius-lg\);[^}]*background:\s*var\(--surface-2\)/.test(css)) falhas.push("a prévia precisa de raio 16 e fundo --surface-2");
if (!/\.dia-caixa\s*\{[^}]*min-height:\s*56px/.test(css)) falhas.push("cada dia precisa de 56px de altura");
if (!/max\(44px, 2\.5rem\)/.test(css)) falhas.push("cada dia precisa de pelo menos 44px de largura");
/* No claro, --sel-fundo/--sel-texto são o acento e --accent-text (cheio, como
   sempre); no escuro neon, fundo escuro e borda aqua (checar-neon.js). */
if (!/\.dia input:checked \+ \.dia-caixa\s*\{[^}]*background:\s*var\(--sel-fundo\);[^}]*color:\s*var\(--sel-texto\)/.test(css)) falhas.push("o dia marcado usa --sel-fundo e --sel-texto");
if (!/--sel-fundo: var\(--accent\);\n  --sel-texto: var\(--accent-text\);/.test(ler("tokens.css"))) falhas.push("no claro, o dia marcado é preenchido no acento com o texto em --accent-text");
if (!/\.dia input:focus-visible \+ \.dia-caixa\s*\{[^}]*outline:\s*2px solid[^}]*outline-offset:\s*2px/.test(css)) falhas.push("o foco do dia é um anel de 2px afastado 2");
if (!/var\(--dur-fast\)/.test(css) || /transform|scale\(/.test(css)) falhas.push("o toque muda a cor em 150ms, sem escala");
if (/\.dias-erro\s*\{[^}]*--danger/.test(css)) falhas.push("o aviso dos dias não usa vermelho");

/* ---------- 4. Hoje, Missão, check-in e dia difícil ---------- */

var hoje = semComentarios(ler("hoje.js"));
var hojeCss = ler("hoje.css");
if (hoje.indexOf("sequencia.today_is_mission_day === false") === -1) falhas.push("o Hoje precisa ler today_is_mission_day");
if (!/if \(modelo\.diaLivre === true\) return;/.test(hoje)) falhas.push("no dia livre não há botão de registrar");
/* Trilha de luz: o dia livre vem antes da falta (trilha.js) e é pontilhado. */
var trilhaJs = ler("trilha.js");
if (!/else if \(ehLivre\(dia\)\) estado = "l";\s*else if \(dia < hoje\) estado = "x";/.test(trilhaJs) || !/ehLivre: NexusRegistro\.livreDe\(modelo\)/.test(hoje)) falhas.push("o dia livre não pode virar dia sem registro na trilha");
if (!/\.trilha30 \.s-l i\s*\{[^}]*border-style:\s*dotted;[^}]*border-color:\s*var\(--text-muted\);/.test(ler("trilha.css"))) falhas.push("o dia livre na trilha é pontilhado em --text-muted, sem preenchimento");
var missaoHtml = ler("missao.html");
var missaoCss = ler("missao.css");
var missaoJs = semComentarios(ler("missao.js"));
if (/regua-plano|marca-plano|legenda-dias|pintarPlanoDias/.test(missaoHtml + missaoCss + missaoJs)) falhas.push("a régua do plano saiu da Missão");
if (missaoHtml.indexOf('id="trilha-missao"') === -1 || missaoHtml.indexOf('href="trilha.css"') === -1 || missaoHtml.indexOf('<script src="trilha.js"></script>') === -1) falhas.push("a Missão mostra o rastro");
if (missaoHtml.indexOf('id="dias-linha"') === -1 || !/NexusDias\.TEXTOS\.rotuloPrevia/.test(missaoJs)) falhas.push("a linha dos dias da semana fica");
if (!/NexusTrilha\.pintar/.test(missaoJs) || !/NexusRegistro\.checkinsMeus/.test(missaoJs) || !/NexusApi\.progressoDaMissao/.test(missaoJs)) falhas.push("a Missão usa a trilha, o progresso e as mesmas regras do Hoje");
if (missaoJs.indexOf("today_is_mission_day === false") === -1) falhas.push("a Missão precisa ler today_is_mission_day");
if (!/if \(modelo\.diaLivre === true\) mostrarLinha\("minimo", NexusDias\.TEXTOS\.hojeLivre\);\s*else mostrarLinha\("minimo"/.test(missaoJs)) falhas.push("num dia livre a Missão não mostra «O mínimo de hoje»");
["checkin.js", "dia-dificil.js"].forEach(function (nome) {
  var texto = semComentarios(ler(nome));
  if (!/resultado\.status === 400 && dados\.free_day === true\) \{\s*mostrarDiaLivre\(missaoAtual\);/.test(texto)) falhas.push(nome + " precisa mostrar a frase do dia livre (free_day), não erro");
  if (!/function mostrarDiaLivre\(missao\) \{\s*mostrarBloqueio\(NexusDias\.fraseDiaLivre\(missao, diasDaSequencia\)\);\s*document\.getElementById\("voltar"\)\.hidden = true;/.test(texto)) falhas.push(nome + ": no dia livre, frase do Hoje com o próximo dia e sem o «Voltar» repetido");
  if (texto.indexOf("sequencia.today_is_mission_day === false") === -1) falhas.push(nome + " precisa abrir o dia livre sem o formulário");
});
["onboarding.html", "hoje.html", "missao.html", "checkin.html", "dia-dificil.html"].forEach(function (nome) {
  if (ler(nome).indexOf('<script src="dias-da-missao.js"></script>') === -1) falhas.push(nome + " não carrega dias-da-missao.js");
});

var sw = ler("sw.js");
if (sw.indexOf('CACHE = "nexus-v2-v49"') === -1) falhas.push("o cache não está em nexus-v2-v49");
if (sw.indexOf('"./dias-da-missao.js"') === -1) falhas.push("o cache não guarda dias-da-missao.js");
if (sw.indexOf('"./registro-dias.js"') === -1) falhas.push("o cache não guarda registro-dias.js");
["hoje.html", "missao.html"].forEach(function (nome) {
  if (ler(nome).indexOf('<script src="registro-dias.js"></script>') === -1) falhas.push(nome + " não carrega registro-dias.js");
});

/* Marcas de página gerada por IA (regra 11). */
[["onboarding.html", html], ["onboarding.js", js], ["dias-da-missao.js", fonteDias]].forEach(function (par) {
  var limpo = semComentarios(par[1]);
  if (/ · /.test(limpo)) falhas.push(par[0] + ": texto com pontinhos «A · B»");
  if (/→/.test(limpo)) falhas.push(par[0] + ": seta «→»");
  if (/[\u{1F300}-\u{1FAFF}]/u.test(limpo)) falhas.push(par[0] + ": emoji");
});
if (/text-transform:\s*uppercase/.test(css)) falhas.push("rótulo em caixa alta no começo");
if (/border-left:\s*[0-9]+px solid var\(--accent\)/.test(css)) falhas.push("caixa com barra colorida à esquerda no começo");
if (/gradient\(/.test(css)) falhas.push("gradiente no começo");

/* ---------- 5. O mock local, com casos negados ---------- */

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

async function entrar(email) {
  var r = await pedir("POST", "/api/users/login", { email: email, password: "senha123" });
  return { Authorization: "Bearer " + (r.json && r.json.token) };
}

var base = { title: "Ler", category: "aprendizagem", daily_minimum: "Uma página", why_it_matters: "Quero", mode: "solo", duration_days: 30, proof_mode: "study_note" };
function missaoCom(extra) {
  return Object.assign({}, base, extra || {});
}

async function provarMock() {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarServidor(filho);
    var auth = await entrar("dias-checar@exemplo.com");

    var semLogin = await pedir("POST", "/api/missions", missaoCom({ mission_weekdays: [1, 3, 5] }));
    if (semLogin.status !== 401) falhas.push("sem login, criar missão devia dar 401 (deu " + semLogin.status + ")");

    var negados = [
      [[1, 3], "Escolha pelo menos 3 dias da missão por semana."],
      [[1, 1, 3], "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir."],
      [[0, 1, 2], "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir."],
      [[1, 2, 8], "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir."],
      ["1,3,5", "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir."]
    ];
    for (var i = 0; i < negados.length; i++) {
      var r = await pedir("POST", "/api/missions", missaoCom({ mission_weekdays: negados[i][0] }), auth);
      if (r.status !== 400 || r.json.error !== negados[i][1]) falhas.push("mock: " + JSON.stringify(negados[i][0]) + " devia dar 400 com a frase do servidor");
    }
    var sem = await pedir("POST", "/api/missions", missaoCom({ title: "sem-migracao", mission_weekdays: [1, 3, 5] }), auth);
    if (sem.status !== 503) falhas.push("mock: sem a migração, com dias, devia dar 503");
    var lista = await pedir("GET", "/api/missions", null, auth);
    if (!Array.isArray(lista.json) || lista.json.length !== 0) falhas.push("mock: um pedido negado criou missão");

    var todos = await pedir("POST", "/api/missions", missaoCom({ title: "sem-migracao" }), auth);
    if (todos.status !== 201 || todos.json.mission.mission_weekdays !== null) falhas.push("mock: sem o campo, cria com todos os dias (null), mesmo sem a migração");
    var tres = await pedir("POST", "/api/missions", missaoCom({ mission_weekdays: [5, 1, 3] }), auth);
    if (tres.status !== 201 || !igual(tres.json.mission.mission_weekdays, [1, 3, 5])) falhas.push("mock: 3 dias devem ficar [1, 3, 5]");
    var seq = await pedir("GET", "/api/checkins/" + tres.json.mission.id + "/streak", null, auth);
    if (typeof seq.json.today_is_mission_day !== "boolean" || !igual(seq.json.mission_weekdays, [1, 3, 5])) falhas.push("mock: a sequência precisa de today_is_mission_day e mission_weekdays");

    var livre = await entrar("dia-livre@exemplo.com");
    var seqLivre = await pedir("GET", "/api/checkins/7/streak", null, livre);
    if (seqLivre.json.today_is_mission_day !== false || seqLivre.json.recovery_needed !== false) falhas.push("mock: no cenário dia-livre, hoje é dia livre e não pede recuperação");
    var post = await pedir("POST", "/api/checkins", { mission_id: 7, note: "Li duas páginas em voz alta" }, livre);
    if (post.status !== 400 || post.json.free_day !== true) falhas.push("mock: check-in num dia livre devia dar 400 com free_day: true");
    var dificil = await pedir("POST", "/api/checkins", { mission_id: 7, note: "", difficult: true, minimum_done: true }, livre);
    if (dificil.status !== 400 || dificil.json.free_day !== true) falhas.push("mock: dia difícil num dia livre devia dar 400 com free_day: true");
    var depois = await pedir("GET", "/api/checkins/7/streak", null, livre);
    if (depois.json.today_done !== false) falhas.push("mock: o dia livre não pode ficar registrado");

    var outro = await entrar("outra-pessoa@exemplo.com");
    var alheio = await pedir("GET", "/api/checkins/" + tres.json.mission.id + "/streak", null, outro);
    if (alheio.status !== 404) falhas.push("mock: outra pessoa não vê a sequência (devia dar 404)");
  } finally {
    filho.kill();
  }
}

provarMock().then(function () {
  if (falhas.length) {
    console.error(falhas.join("\n"));
    process.exit(1);
  }
  console.log("ok: escolha dos dias da missão, dia livre e casos negados (2 dias não envia)");
}).catch(function (erro) {
  console.error(erro && erro.message ? erro.message : erro);
  process.exit(1);
});
