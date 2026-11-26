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
var titulo = html.indexOf(">Ajustes<");
if (ajuda < 0 || titulo < 0 || ajuda > titulo) {
  falhas.push("o link Precisa de ajuda agora? não está no topo");
}
if (html.indexOf('class="marca"') !== -1) {
  falhas.push("Ajustes não deve ter a marca grande; o Hoje também não tem");
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

/* Instrução do iPhone numa chave só (dados-textos.js), em 3 passos, igual no
   começo da missão (revisão da Clara). Negado: o parágrafo longo repetido. */
var passosIphone = '<p data-texto-dados="iphoneIntro"></p>';
["iphonePasso1", "iphonePasso2", "iphonePasso3"].forEach(function (k) { passosIphone += '<li data-texto-dados="' + k + '"></li>'; });
[html, ler("onboarding.html")].forEach(function (pagina, i) {
  var limpa = pagina.replace(/\s+/g, "").replace(/<olclass="passos-iphone">|<\/ol>/g, "");
  if (limpa.indexOf(passosIphone.replace(/\s+/g, "")) === -1) falhas.push((i ? "onboarding" : "ajustes") + ": a instrução do iPhone não usa a chave única em 3 passos");
  if (/toque em Compartilhar e depois em/.test(pagina)) falhas.push("negado: o parágrafo longo do iPhone ainda está repetido na página");
});
var dadosTextos = ler("dados-textos.js");
if (dadosTextos.indexOf('iphonePasso3: "Toque em “Adicionar à Tela de Início”."') === -1 || dadosTextos.indexOf("iOS 16.4") === -1) falhas.push("faltam os textos do iPhone em dados-textos.js");
if (html.indexOf("Horário do lembrete") === -1) falhas.push("falta o horário do lembrete");
if (html.indexOf("Sair da conta?") === -1) falhas.push("falta a pergunta Sair da conta?");
if (html.indexOf(">Conta<") === -1) falhas.push("o bloco da saída deve se chamar Conta");
if (html.indexOf(">Sair<") === -1 || html.indexOf(">Cancelar<") === -1) {
  falhas.push("faltam os botões Sair e Cancelar");
}
if (html.indexOf('id="btn-cancelar"') === -1 || html.indexOf('id="btn-sair"') === -1) {
  falhas.push("faltam os ids dos botões de confirmação");
}
var inicioConfirma = html.indexOf('id="confirma-sair"');
var trechoBotoes = html.slice(inicioConfirma, html.indexOf("</section>", inicioConfirma));
var classeCancelar = trechoBotoes.slice(Math.max(0, trechoBotoes.indexOf('id="btn-cancelar"') - 80), trechoBotoes.indexOf('id="btn-cancelar"'));
var classeSair = trechoBotoes.slice(Math.max(0, trechoBotoes.indexOf('id="btn-sair"') - 80), trechoBotoes.indexOf('id="btn-sair"'));
if (classeCancelar.indexOf("btn-primario") === -1) falhas.push("Cancelar precisa ser o botão preenchido");
if (classeSair.indexOf("btn-secundario") === -1) falhas.push("Sair precisa ser o botão de contorno");
if (html.indexOf('role="alertdialog"') === -1) falhas.push("a confirmação precisa ser um alertdialog");
if (html.indexOf("Sua missão continua salva na sua conta.") === -1) {
  falhas.push("falta a frase verdadeira sobre sair");
}
if (html.indexOf('id="bloco-iphone"') === -1 || html.indexOf('id="bloco-iphone"') > 0 && html.slice(html.indexOf('id="bloco-iphone"'), html.indexOf('id="bloco-iphone"') + 80).indexOf("hidden") === -1) {
  falhas.push("o bloco do iPhone deve começar escondido");
}

var textoOff = "Não foi possível salvar agora. Tente de novo quando houver rede.";
if (js.indexOf(textoOff) === -1) falhas.push("falta o erro de salvar sem rede");
if (js.indexOf("Horário salvo.") === -1) falhas.push("falta a confirmação de horário salvo");
if (js.indexOf("NexusApi.saveReminderTime") === -1) falhas.push("a tela não usa saveReminderTime");
if (js.indexOf("if (!NexusAbas.emDev())") === -1) {
  falhas.push("fora do desenvolvimento a tela ainda pode dizer que salvou");
}
if (js.indexOf('setAttribute("role", erro ? "alert" : "status")') === -1) {
  falhas.push("o erro de salvar não usa role alert");
}
if (js.indexOf('focar(document.getElementById("btn-cancelar"))') === -1) {
  falhas.push("o foco da confirmação não vai para Cancelar");
}
if (js.indexOf("ehIOS") === -1 || js.indexOf("iPhone|iPad|iPod") === -1) {
  falhas.push("o recado do iPhone não detecta iOS");
}
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

if (sw.indexOf('CACHE = "nexus-v2-v38"') === -1) falhas.push("o cache não está em nexus-v2-v38");
if (sw.indexOf("./ajustes.css") === -1 || sw.indexOf("./ajustes.js") === -1) {
  falhas.push("o cache não inclui os arquivos novos de Ajustes");
}
if (sw.indexOf("./ajustes.html") === -1) falhas.push("o cache não inclui ajustes.html");

if (mock.indexOf("lembrete-erro") === -1 || mock.indexOf("lembrete-lento") === -1) {
  falhas.push("o mock não tem os cenários do lembrete");
}
if (mock.indexOf("pedidoDeDesenvolvimento") === -1 || mock.indexOf('host === "localhost"') === -1 || mock.indexOf('host === "[::1]"') === -1) {
  falhas.push("o mock do lembrete não limita a origem ao desenvolvimento");
}

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}

console.log("ok: Ajustes sem IA, com lembrete, iPhone e saída");
