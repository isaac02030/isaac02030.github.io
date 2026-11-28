/* Confere a v51: o terceiro cartão do passo 1 ("outro" com text_note), a
   exemplo das áreas fora dos botões e a lista fechada de categorias.
   Caso negado: qualquer valor fora de aprendizagem/fitness/outro volta vazio
   e nunca vira categoria da missão. Rode na raiz: node nexus-v2/dev/checar-outro-objetivo.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var raiz = path.join(__dirname, "..");
var falhas = [];
var PORTA = 3105;

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + JSON.stringify(veio) + ", esperado " + JSON.stringify(esperado));
}
function fn(fonte, nome) {
  var i = fonte.indexOf("function " + nome + "(");
  if (i === -1) return "";
  var fim = fonte.indexOf("\n}\n", i);
  return fim === -1 ? "" : fonte.slice(i, fim + 2);
}

var html = ler("onboarding.html");
var js = ler("onboarding.js");
var css = ler("onboarding.css");
var sw = ler("sw.js");

/* ---------- Passo 1: três cartões, o terceiro com outro ---------- */
var grupoCategorias = html.slice(html.indexOf('id="grupo-categoria"'), html.indexOf("</fieldset>", html.indexOf('id="grupo-categoria"')));
if ((grupoCategorias.match(/name="categoria"/g) || []).length !== 3) falhas.push("o passo 1 precisa de exatamente três cartões");
if (grupoCategorias.indexOf('<input type="radio" name="categoria" value="outro">') === -1) falhas.push("falta o rádio value=outro");
if (grupoCategorias.indexOf("<span class=\"carta-nome\">Outro objetivo</span>") === -1) falhas.push("falta o título Outro objetivo");
if (grupoCategorias.indexOf("Meditar, escrever ou tocar um instrumento.") === -1) falhas.push("falta a ajuda curta do cartão");
if (html.indexOf('<p id="objetivo-dica" class="dica">Ex.: Praticar inglês todos os dias</p>') === -1) falhas.push("a dica inicial do objetivo mudou");

/* ---------- Áreas: exemplos em bloco próprio, fora dos botões ---------- */
var grupoAreas = html.slice(html.indexOf('id="grupo-area"'), html.indexOf("</fieldset>", html.indexOf('id="grupo-area"')));
if (grupoAreas.indexOf('id="areas-exemplos"') === -1) falhas.push("faltam os exemplos das áreas");
if ((grupoAreas.match(/data-area="/g) || []).length !== 3) falhas.push("o grupo de áreas continua com três botões");
if (/<button[^>]*>[^<]*(Estudo|idiomas|Treino|corrida|Sono|dinheiro)/.test(grupoAreas)) falhas.push("os exemplos não podem entrar dentro do botão da área");
var iExemplos = html.indexOf('id="areas-exemplos"');
iExemplos = html.indexOf(">", iExemplos) + 1;
var exemplos = html.slice(iExemplos, html.indexOf("</div>", iExemplos)).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
igual("linhas de exemplo", exemplos, "Mente: Estudo, idiomas, leitura Corpo: Treino, corrida, alimentação Rotina: Sono, organização, dinheiro e outros hábitos");
if (!/\.areas-exemplos \{[^}]*flex-direction: column/.test(css)) falhas.push("o bloco dos exemplos precisa ser uma coluna");
if (!/\.area \{[^}]*min-height:\s*48px/.test(css)) falhas.push("o alvo de 48px da área mudou");
if (!/\.areas-grade \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(css)) falhas.push("a 200% as áreas precisam seguir em uma coluna");

/* ---------- Código: lista fechada, dica e prova ---------- */
var lista = js.match(/var CATEGORIAS = \[[^\]]*\];/);
if (!lista || !/"outro"/.test(lista[0])) falhas.push("a lista de categorias não inclui outro");
if (!/categoriaValida\(dados\.category\)/.test(js) || !/return categoriaValida\(marcado\.value\)/.test(js)) {
  falhas.push("o rascunho e o rádio precisam usar a mesma lista fechada");
}
if (js.indexOf('dica.textContent = "Ex.: Meditar dez minutos por dia"') === -1) falhas.push("a dica do objetivo não muda com Outro");
if (js.indexOf("Escolha um caminho: estudo, academia ou outro objetivo.") === -1) falhas.push("o erro da categoria precisa citar o terceiro caminho");
if (!/estado\.category === "outro" \? "text_note"/.test(js)) falhas.push("outro objetivo precisa mandar proof_mode text_note");
if (sw.indexOf('CACHE = "nexus-v2-v56"') === -1) falhas.push("o cache não está em nexus-v2-v56");

/* Executa as três funções de verdade, com um DOM mínimo. */
var dica = { textContent: "" };
var marcado = null;
var trechos = [lista ? lista[0] : "", fn(js, "categoriaValida"), fn(js, "categoriaEscolhida"), fn(js, "atualizarExemplo")].join("\n");
var caixa = {
  document: {
    querySelector: function () { return marcado; },
    getElementById: function (id) { return id === "objetivo-dica" ? dica : null; }
  }
};
vm.runInNewContext(trechos + "\nthis.valida = categoriaValida; this.escolhida = categoriaEscolhida; this.dica = function () { atualizarExemplo(); return document.getElementById('objetivo-dica').textContent; };", caixa);
caixa.por = function (valor) { marcado = valor ? { value: valor } : null; };
if (typeof caixa.valida !== "function" || typeof caixa.escolhida !== "function") {
  falhas.push("não deu para rodar as funções de categoria de onboarding.js");
} else {
  ["aprendizagem", "fitness", "outro"].forEach(function (valor) {
    igual("aceita " + valor, caixa.valida(valor), valor);
    caixa.por(valor);
    igual("rádio " + valor, caixa.escolhida(), valor);
  });
  /* Caso negado: fora da lista, vazio, maiúsculas e objeto não viram categoria. */
  ["outra", "FITNESS", "estudo", "", null, 42, {}].forEach(function (valor) {
    igual("recusa " + JSON.stringify(valor), caixa.valida(valor), "");
    caixa.por(valor);
    igual("rádio recusa " + JSON.stringify(valor), caixa.escolhida(), "");
  });
  caixa.por("outro");
  igual("dica de outro", caixa.dica(), "Ex.: Meditar dez minutos por dia");
  caixa.por("fitness");
  igual("dica de fitness continua", caixa.dica(), "Ex.: Treinar cinco vezes por semana");
  caixa.por("aprendizagem");
  igual("dica de estudo continua", caixa.dica(), "Ex.: Praticar inglês todos os dias");
}

/* ---------- O mock aceita a prova text_note da categoria nova ---------- */
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
function esperarMock(n) {
  return pedir("GET", "/api/notifications/vapid-key").catch(function () {
    if (n <= 0) throw new Error("mock não subiu");
    return new Promise(function (r) { setTimeout(r, 100); }).then(function () { return esperarMock(n - 1); });
  });
}

var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
  env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
  stdio: "ignore"
});
esperarMock(50).then(async function () {
  var login = await pedir("POST", "/api/users/login", { email: "outro-checar@exemplo.com", password: "senha123" });
  var auth = { Authorization: "Bearer " + (login.json && login.json.token) };
  var missao = await pedir("POST", "/api/missions", {
    title: "Meditar", category: "outro", proof_mode: "text_note",
    daily_minimum: "Dez minutos", why_it_matters: "Acalmar a cabeça",
    mode: "solo", duration_days: 30
  }, auth);
  if (missao.status !== 201 || missao.json.mission.category !== "outro" || missao.json.mission.proof_mode !== "text_note") {
    falhas.push("o mock não aceitou outro com text_note: " + missao.status);
  }
}).catch(function (erro) {
  falhas.push("mock: " + erro.message);
}).then(function () {
  filho.kill();
  if (falhas.length) {
    console.error("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: Outro objetivo com text_note, exemplos das áreas fora dos chips, lista fechada com caso negado e cache v51");
});
