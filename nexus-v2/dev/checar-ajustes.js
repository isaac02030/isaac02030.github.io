/* Confere a tela Ajustes sem as partes de IA.
   Rode na raiz do repositório: node nexus-v2/dev/checar-ajustes.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

var html = ler("ajustes.html");
var js = ler("ajustes.js");
var css = ler("ajustes.css");
var api = ler("api.js");
var sw = ler("sw.js");
var mock = ler(path.join("dev", "mock-api.js"));

var ajuda = html.indexOf("Precisa de ajuda agora?");
var marca = html.indexOf(">Nexus<");
var titulo = html.indexOf(">Ajustes<");
if (ajuda < 0 || marca < 0 || titulo < 0 || ajuda > marca || ajuda > titulo) {
  falhas.push("o link Precisa de ajuda agora? não está no topo");
}

if (html.indexOf("// TODO") === -1 || html.indexOf("O que o Grande Irmão sabe de você") === -1) {
  falhas.push("falta o TODO do Grande Irmão");
}
var semComentario = html.replace(/<!--[\s\S]*?-->/g, "");
if (semComentario.indexOf("Grande Irmão") !== -1) {
  falhas.push("a tela mostra texto do Grande Irmão");
}
if (/type\s*=\s*"checkbox"|role\s*=\s*"switch"/i.test(semComentario)) {
  falhas.push("há um interruptor na tela");
}

var textoIphone = "No iPhone, o aviso só chega se o Nexus estiver na Tela de Início. No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início” (iOS 16.4 ou posterior).";
if (html.indexOf(textoIphone) === -1) falhas.push("o texto de instalar no iPhone mudou");
if (html.indexOf("Horário do lembrete") === -1) falhas.push("falta o horário do lembrete");
if (html.indexOf("Sair da conta?") === -1) falhas.push("falta a pergunta Sair da conta?");
if (html.indexOf(">Sair<") === -1 || html.indexOf(">Cancelar<") === -1) {
  falhas.push("faltam os botões Sair e Cancelar");
}

var textoOff = "Não foi possível salvar agora. Tente de novo quando houver rede.";
if (js.indexOf(textoOff) === -1) falhas.push("falta o erro de salvar sem rede");
if (js.indexOf("Horário salvo.") === -1) falhas.push("falta a confirmação de horário salvo");
if (js.indexOf("NexusApi.saveReminderTime") === -1) falhas.push("a tela não usa saveReminderTime");
if (js.indexOf("nexus_v2_token") === -1 || js.indexOf("nexus_v2_user") === -1) {
  falhas.push("a saída não limpa a sessão");
}
if (js.indexOf("alerta-falha") !== -1 || css.indexOf("--danger") !== -1) {
  falhas.push("a tela usa a cor de alarme");
}
if (css.indexOf("min-height: var(--target)") === -1) {
  falhas.push("os botões de confirmar a saída não usam o alvo de 44px");
}

if (api.indexOf('"/api/users/me/reminder"') === -1 && api.indexOf("\"/api/users/me/reminder\"") === -1) {
  falhas.push("api.js não chama PUT /api/users/me/reminder");
}
if (api.indexOf("caminhoComCenario(\"/api/users/me/reminder\")") === -1) {
  falhas.push("o lembrete não repassa o cenário ao mock");
}

if (sw.indexOf('CACHE = "nexus-v2-v16"') === -1) falhas.push("o cache não está em nexus-v2-v16");
if (sw.indexOf("./ajustes.css") === -1 || sw.indexOf("./ajustes.js") === -1) {
  falhas.push("o cache não inclui os arquivos novos de Ajustes");
}
if (sw.indexOf("./ajustes.html") === -1) falhas.push("o cache não inclui ajustes.html");

if (mock.indexOf("lembrete-erro") === -1 || mock.indexOf("lembrete-lento") === -1) {
  falhas.push("o mock não tem os cenários do lembrete");
}

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}

console.log("ok: Ajustes sem IA, com lembrete, iPhone e saída");
