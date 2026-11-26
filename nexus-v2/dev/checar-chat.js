/* Confere a tela do chat do Duo/Rival (spec da Clara, visual/spec-chat-duo.md).
   - A conversa mora na Missão; em Hoje, só a linha de mensagem nova.
   - «Enviada» só depois do servidor; sem «visto».
   - Crise: nada aparece como enviado, o campo volta vazio, a ajuda abre.
   - Sem par, a conversa não abre (nem pede as mensagens).
   - O aviso de mensagem começa desligado (só «yes» do servidor liga).
   - Luz: só o botão «Enviar»; sem urso; balões planos.
   Casos negados ao longo do arquivo (procure «negado»).
   Rode na raiz do repositório: node nexus-v2/dev/checar-chat.js */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
}
function trecho(texto, inicio, fim) {
  var i = texto.indexOf(inicio);
  var j = texto.indexOf(fim, i + 1);
  return i === -1 ? "" : texto.slice(i, j === -1 ? undefined : j);
}

/* ---------- NexusChat (chat-textos.js), rodando de verdade ---------- */
var guardado = {};
var janela = {};
vm.runInNewContext(ler("chat-textos.js"), {
  window: janela,
  document: { querySelectorAll: function () { return []; } },
  localStorage: {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(guardado, k) ? guardado[k] : null; },
    setItem: function (k, v) { guardado[k] = String(v); }
  }
});
var X = janela.NexusChat;
guardado.nexus_v2_user = JSON.stringify({ username: "eu-teste" });

if (!X.temPar({ mode: "parceiro", partner_name: "Ana", status: "active" })) falhas.push("Duo ativo tem conversa");
if (!X.temPar({ mode: "rival", partner_name: "Ana", status: "active" })) falhas.push("Rival ativo tem conversa");
[
  { mode: "solo", partner_name: "Ana", status: "active" },
  { mode: "parceiro", partner_name: null, status: "active" },
  { mode: "parceiro", partner_name: "Ana", status: "completed" },
  {}
].forEach(function (m, i) {
  if (X.temPar(m)) falhas.push("negado: sem par ativo não há conversa (caso " + i + ")");
});

var lista = [
  { id: 1, sender_name: "Ana" }, { id: 2, sender_name: "eu-teste" }, { id: 3, sender_name: "Ana" }
];
if (X.contarNovas(7, lista) !== 2) falhas.push("conta só as mensagens da outra pessoa como novas");
X.marcarVista(7, lista);
if (X.contarNovas(7, lista) !== 0) falhas.push("depois de abrir a conversa, nada é novo");
if (X.contarNovas(7, lista.concat([{ id: 4, sender_name: "eu-teste" }])) !== 0) falhas.push("negado: minha própria mensagem nunca é «nova»");
if (Object.keys(guardado).some(function (k) { return k.indexOf("nexus_v2_") !== 0; })) falhas.push("o que fica no aparelho usa o prefixo nexus_v2_ (sai com a sessão)");

if (X.nomeDoOutro({ user_name: "eu-teste", partner_name: "Ana" }) !== "Ana") falhas.push("dono: o outro é o par");
if (X.nomeDoOutro({ user_name: "Ana", partner_name: "eu-teste" }) !== "Ana") falhas.push("parceiro: o outro é o dono");
if (!X.souParceiroNaMissaoDoOutro({ user_name: "Ana", partner_name: "eu-teste" })) falhas.push("parceiro na missão da outra pessoa recebe o aviso de que sai da missão");
if (X.souParceiroNaMissaoDoOutro({ user_name: "eu-teste", partner_name: "Ana" })) falhas.push("negado: dono não recebe o aviso de saída");
if (X.tamanho("💪".repeat(280)) !== 280) falhas.push("emoji conta 1 caractere, como o servidor");
if (X.erroDoServidor("qualquer coisa do servidor") !== "") falhas.push("negado: erro desconhecido do servidor não aparece cru na tela");
if (X.erroDoServidor("Você enviou muitas mensagens nesta hora. Espere um pouco e envie de novo.") === "") falhas.push("o 429 aprovado aparece");

/* ---------- Textos ---------- */
var tudo = [ler("chat-textos.js"), ler("conversa.html"), ler("conversa.js")].join("\n");
if (/\bvisto\b|«visto»|Visto/.test(semComentarios(tudo).replace(/\/\/.*$/gm, ""))) falhas.push("negado: sem «visto» no chat");
if (/Que tal|Claro!|Aqui está|[\u{1F300}-\u{1FAFF}]/u.test(semComentarios(ler("chat-textos.js")))) falhas.push("negado: sinais de texto de IA ou emoji nos textos do chat");
["Ainda não há mensagens. Escreva a primeira.", "Sem internet. A mensagem não foi enviada.", "Enviando…", "Enviada",
  "Mensagem nova de {nome}.", "Bloquear esta pessoa?", "Abrir a conversa",
  "A missão continua só com você."
].forEach(function (t) {
  if (ler("chat-textos.js").indexOf(t) === -1) falhas.push("falta o texto aprovado/proposto: «" + t + "»");
});

/* Crise: o MESMO texto aprovado no servidor, num lugar só (revisão da Clara do PR 30). */
var CRISE_SERVIDOR = "Sua mensagem não foi enviada. Se você está passando por um momento difícil, veja os contatos de ajuda abaixo.";
if (X.TEXTOS.criseLinha !== CRISE_SERVIDOR) falhas.push("a linha de crise do chat é a mesma do servidor");
["conversa.js", "conversa.html", "crise.html", "hoje.js", "missao.js"].forEach(function (n) {
  if (ler(n).indexOf("Sua mensagem não foi enviada") !== -1) falhas.push("negado: o texto de crise do chat fica só em chat-textos.js (achado em " + n + ")");
});

/* ---------- Envio ---------- */
var js = semComentarios(ler("conversa.js"));
var envio = trecho(js, "async function enviar(", "/* ----------");
var crise = envio.indexOf("resultado.dados.crisis === true");
var ok = envio.indexOf("marcarEnviada(item");
if (crise === -1 || ok === -1 || crise > ok) falhas.push("negado: a crise é tratada antes de qualquer «Enviada»");
if (!/function abrirAjudaDoEnvio\(item\) \{\s*if \(item && item\.parentNode\) item\.remove\(\);\s*var campo = document\.getElementById\("campo-mensagem"\);\s*campo\.value = "";/.test(js)) falhas.push("negado: na crise o balão sai e o campo volta vazio");
if (!/location\.assign\("crise\.html" \+ busca\("de=chat&missao=/.test(js)) falhas.push("na crise, abre crise.html com a linha do chat");
var balao = trecho(js, "function balaoEnviando(", "function marcarEnviada(");
if (/TX\.enviada/.test(balao) || !/"enviando"/.test(balao)) falhas.push("negado: o balão novo nasce «Enviando…», nunca «Enviada»");
if (/TX\.enviada/.test(trecho(js, "function marcarFalha(", "function abrirAjudaDoEnvio("))) falhas.push("negado: falha não mostra «Enviada»");
if (/localStorage\.setItem|sessionStorage\.setItem\((?!"nexus_v2_aviso_missao")/.test(js)) falhas.push("negado: o texto da mensagem não é guardado no aparelho");
if (/rascunho/i.test(js)) falhas.push("negado: sem rascunho guardado do chat");
if (!/X\.tamanho\(texto\.trim\(\)\) > X\.LIMITE\) \{\s*mostrarErroDoCampo\(TX\.passou\);\s*return;/.test(js)) falhas.push("acima de 280: avisa e não envia");
if (/maxlength/.test(trecho(ler("conversa.html"), 'id="campo-mensagem"', ">"))) falhas.push("negado: o campo do chat não corta o texto (sem maxlength)");

/* ---------- Sem par não abre ---------- */
var abrir = trecho(js, "async function carregar(", "function pintarTopo(");
var semPar = abrir.indexOf("!X.temPar(missaoAtual)");
var pede = abrir.indexOf("NexusApi.listarMensagens");
if (semPar === -1 || pede === -1 || semPar > pede) falhas.push("negado: sem par, a conversa não abre nem pede as mensagens");

/* ---------- Bloquear ---------- */
var html = ler("conversa.html");
var dialogo = trecho(html, 'id="dialogo-bloquear"', "</dialog>");
if (dialogo.indexOf('id="btn-cancelar-bloquear"') === -1 || dialogo.indexOf('id="btn-cancelar-bloquear"') > dialogo.indexOf('id="btn-confirmar-bloquear"')) falhas.push("«Cancelar» vem antes de «Bloquear»");
if (!/document\.getElementById\("btn-cancelar-bloquear"\)\.focus\(\)/.test(js)) falhas.push("o foco começa em «Cancelar»");
if (!/btn-contorno-perigo/.test(dialogo) || /btn-primario[^"]*" id="btn-confirmar-bloquear"/.test(dialogo)) falhas.push("negado: «Bloquear» é contorno, nunca cheio");
if (!/resultado\.dados\.blocked === true/.test(js)) falhas.push("«Pessoa bloqueada.» só depois do servidor");

/* ---------- Luz e visual ---------- */
var htmlLimpo = semComentarios(html);
var luzes = (htmlLimpo.match(/btn-luz/g) || []).length;
if (luzes !== 1) falhas.push("a conversa tem uma luz de botão só («Enviar»): veio " + luzes);
if (/urso/.test(htmlLimpo) || /urso/.test(js)) falhas.push("negado: sem urso no chat");
var css = semComentarios(ler("conversa.css"));
var baloes = css.match(/\.(minha|dela)[^{]*\.balao[^{]*\{[^}]*\}/g) || [];
if (!baloes.length) falhas.push("faltam os estilos dos balões");
baloes.forEach(function (regra) {
  if (/gradient|box-shadow|--grad|--glow/.test(regra)) falhas.push("negado: balão sem degradê nem halo: " + regra.slice(0, 40));
});
if (/@keyframes|animation:\s*(?!none)[a-z]/.test(css)) falhas.push("negado: sem animação no chat");

/* Revisão da Clara do PR 30. */
var desativado = (css.match(/\.tela-conversa \.btn-enviar\[aria-disabled="true"\]\s*\{[^}]*\}/) || [""])[0];
if (!/box-shadow:\s*none/.test(desativado) || !/background:\s*var\(--surface-2\)/.test(desativado) || !/color:\s*var\(--text-muted\)/.test(desativado)) falhas.push("negado: «Enviar» desativado é neutro e sem halo");
if (!/function iconeTresPontos\(\)/.test(js) || !/ponto\.setAttribute\("r", "2\.25"\)/.test(js) || /DESENHOS\.tres/.test(js)) falhas.push("o «…» tem pontos cheios, visíveis");
if (!/\.texto-grande \.missao-conversa \{\s*display: none;/.test(css)) falhas.push("a 200%, o subtítulo some");
if (!/if \(resultado\.status === 400\) mostrarErroDoCampo\(textoDoErro\(resultado\)\);\s*else mostrarAvisoDoEnvio\(textoDoErro\(resultado\)\);/.test(js) || !/mostrarAviso\(aviso, "neutro", texto\)/.test(js)) falhas.push("negado: o 429 é caixa neutra, não erro de campo");

/* ---------- Missão e Hoje ---------- */
if (ler("missao.html").indexOf('id="bloco-conversa" hidden') === -1) falhas.push("«Abrir a conversa» começa escondido (só com par)");
if (!/if \(!X \|\| !missao \|\| !X\.temPar\(missao\) \|\| !ativa\)/.test(ler("missao.js"))) falhas.push("negado: Missão sem par não mostra «Abrir a conversa»");
if (ler("hoje.html").indexOf('id="linha-mensagem" href="conversa.html" hidden') === -1) falhas.push("a linha de Hoje começa escondida");
if (!/if \(X\.contarNovas\(missao\.id, lista\.dados\.messages\) < 1\) return;/.test(ler("hoje.js"))) falhas.push("negado: sem mensagem nova, Hoje fica igual");

/* ---------- Aviso de mensagem: começa desligado ---------- */
var md = ler("meus-dados.html");
if (!/id="sw-mensagens" role="switch" aria-checked="false"/.test(md)) falhas.push("negado: o interruptor de avisos de mensagem começa desligado");
var mdjs = ler("meus-dados.js");
if (!/mensagens: false/.test(mdjs) || !/estado\.mensagens = !!\(avisos\.messages && avisos\.messages\.choice === "yes"\);/.test(mdjs)) falhas.push("negado: só «yes» do servidor liga o aviso de mensagem");
if (!/\{ messages: ligado === true \}/.test(ler("api.js"))) falhas.push("o interruptor usa a chave messages");

/* ---------- Tela de ajuda e equipe ---------- */
var crisePagina = ler("crise.html");
if (!/de === "chat" && window\.NexusChat/.test(crisePagina) || !/voltarConversa/.test(crisePagina)) falhas.push("a ajuda mostra a linha do chat e «Voltar à conversa»");
if (!/\^\[1-9\]\\\\d\{0,9\}\$/.test(crisePagina) && !/\[1-9\]\\d\{0,9\}/.test(crisePagina)) falhas.push("negado: a volta à conversa só aceita id de missão numérico");
var equipe = semComentarios(ler("equipe.js"));
var item = trecho(equipe, "function itemDoChat(", "async function carregarChat(");
if (/reporter|sender|username|user_id/.test(item)) falhas.push("negado: a equipe não vê quem denunciou nem quem conversa");

/* ---------- Mock só em localhost e cache ---------- */
if (!/window\.NEXUS_CENARIO = hostDeDesenvolvimento\(\) \? parametro\("cenario"\) : "";/.test(js)) falhas.push("negado: ?cenario= só vale em localhost");
var sw = ler("sw.js");
["./conversa.html", "./conversa.css", "./conversa.js", "./chat-textos.js"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});
if (sw.indexOf('CACHE = "nexus-v2-v38"') === -1) falhas.push("o cache não está em nexus-v2-v38");

if (falhas.length) {
  console.log("FALHOU:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: chat do Duo/Rival (conversa, crise, sem par, bloquear, aviso desligado, luz) e casos negados");
