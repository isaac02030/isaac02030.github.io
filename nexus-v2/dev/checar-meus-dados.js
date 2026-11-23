/* Confere a pergunta da nota no check-in, Ajustes › Meus dados, a confirmação
   dos lembretes no começo da missão e a exclusão da conta (PR 26, 27 e 29 do
   servidor), com os casos negados:
   - sem consentimento, a nota não fica guardada e o Hoje não a mostra;
   - excluir com senha errada não apaga nada (nem no servidor, nem no aparelho);
   - o interruptor de novidades não aparece.
   Rode na raiz do repositório: node nexus-v2/dev/checar-meus-dados.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3094;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"])\/\/.*$/gm, "$1");
}

var janela = {};
vm.runInNewContext(ler("dados-textos.js"), { window: janela, document: { querySelectorAll: function () { return []; } } });
var T = janela.NexusDados && janela.NexusDados.TEXTOS;
if (!T) falhas.push("dados-textos.js não define window.NexusDados");

/* Textos aprovados (PR 26, 27 e 29) e os da spec, iguais letra a letra. */
var ESPERADOS = {
  carregarEscolhaErro: "Não foi possível carregar sua escolha sobre as notas. Tente de novo.",
  guardarEscolhaErro: "Não foi possível guardar sua escolha. Tente de novo.",
  desligarApaga: "Desligar apaga as notas já guardadas.",
  carregarAvisosErro: "Não foi possível carregar suas escolhas de avisos. Tente de novo.",
  salvarErro: "Não foi possível salvar. Tente de novo.",
  querLembretes: "Quero receber lembretes do meu registro diário neste aparelho.",
  excluirAdmin: "A conta de administração não pode ser excluída por aqui.",
  excluirMuitas: "Muitas tentativas com a senha errada. Sua conta não foi excluída. Tente de novo em 15 minutos.",
  sim: "Sim, guardar minhas notas",
  nao: "Não guardar",
  perguntaTitulo: "Guardar suas notas?",
  excluidaTitulo: "Sua conta foi excluída",
  senhaRotulo: "Digite sua senha para confirmar",
  falarTexto: "Dúvidas ou pedidos sobre seus dados? Escreva para {email}."
};
if (T) {
  Object.keys(ESPERADOS).forEach(function (k) {
    if (T[k] !== ESPERADOS[k]) falhas.push("dados-textos.js: o texto «" + k + "» mudou");
  });
  if (Object.keys(T).some(function (k) { return /novidade|news/i.test(k); })) falhas.push("não pode haver texto de novidades: o interruptor fica escondido");
}

/* ---------- Meus dados ---------- */
var md = ler("meus-dados.html");
var mdCodigo = semComentarios(md);
var mdJs = ler("meus-dados.js");
if (/novidade|news|sw-novidades/i.test(mdCodigo)) falhas.push("meus-dados.html: o interruptor de novidades não pode aparecer");
if (/news/.test(semComentarios(mdJs))) falhas.push("meus-dados.js não pode mexer em novidades");
["sw-notas", "sw-lembretes"].forEach(function (id) {
  var botao = (md.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>')) || [""])[0];
  if (!/role="switch"/.test(botao)) falhas.push(id + ": falta role=switch");
  if (!/aria-checked="false"/.test(botao)) falhas.push(id + ": precisa começar desligado (aria-checked=false)");
});
if (!/id="notas-estado" data-texto-dados="desligado"/.test(md) || !/id="lembretes-estado" data-texto-dados="desligado"/.test(md)) falhas.push("o estado do interruptor precisa estar em texto, não só na cor");
if (!/data-texto-dados="desligarApaga"/.test(md)) falhas.push("falta «Desligar apaga as notas já guardadas.»");
if (!/id="falar-texto"/.test(md) || !/D\.texto\("falarTexto"\)\.split\("\{email\}"\)/.test(mdJs) || !/link\.href = "mailto:" \+ email/.test(mdJs)) falhas.push("falta o contato de privacidade com link mailto:");
/* O e-mail de privacidade vem só de dados-textos.js (contatoEmail) e nenhum marcador sobra. */
if (!T || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(T.contatoEmail || "")) falhas.push("dados-textos.js: falta o e-mail de privacidade (contatoEmail)");
["meus-dados.html", "meus-dados.js", "dados-textos.js", "conta-excluida.html", "termos.html", "privacidade.html"].forEach(function (nome) {
  if (/\[(E-MAIL|NOME)[^\]]*\]/.test(ler(nome))) falhas.push(nome + ": sobrou marcador entre colchetes");
});
["meus-dados.html", "meus-dados.js", "dados-textos.js", "conta-excluida.html", "checkin.html"].forEach(function (nome) {
  /* Só o e-mail de privacidade, e só em dados-textos.js. */
  var enderecos = ler(nome).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || [];
  if (enderecos.some(function (e) { return nome !== "dados-textos.js" || !T || e !== T.contatoEmail; })) falhas.push(nome + ": e-mail fora do lugar (só o de privacidade, em dados-textos.js)");
  if (/urso/i.test(semComentarios(ler(nome)))) falhas.push(nome + ": sem urso nestas telas");
});
/* Interruptor só muda depois do servidor; nada de «Pronto» antes. */
var alternar = mdJs.slice(mdJs.indexOf("async function alternar"), mdJs.indexOf("/* ---------- Excluir conta"));
if (alternar.indexOf("estado[qual] = queroLigar") < alternar.indexOf("await NexusApi")) falhas.push("o interruptor muda antes de o servidor confirmar");
if (/confirm\(/.test(alternar)) falhas.push("ligar e desligar não pedem confirmação");
/* Diálogo de exclusão. */
var dialogo = md.slice(md.indexOf('id="dialogo-excluir"'), md.indexOf("</dialog>", md.indexOf('id="dialogo-excluir"')));
var iCancelar = dialogo.indexOf('id="btn-cancelar-excluir"');
var iExcluir = dialogo.indexOf('id="btn-confirmar-excluir"');
if (iCancelar === -1 || iExcluir === -1 || iCancelar > iExcluir) falhas.push("no diálogo, «Cancelar» vem primeiro");
if (!/id="btn-cancelar-excluir" autofocus/.test(dialogo)) falhas.push("o foco inicial do diálogo é «Cancelar»");
if (!/autocomplete="current-password"/.test(dialogo)) falhas.push("a senha do diálogo usa autocomplete=current-password");
if (!/id="btn-confirmar-excluir" disabled/.test(dialogo)) falhas.push("«Excluir minha conta» começa desabilitado (sem senha)");
var cssMd = ler("meus-dados.css");
var perigo = cssMd.slice(cssMd.indexOf(".btn-perigo {"), cssMd.indexOf("}", cssMd.indexOf(".btn-perigo {")));
if (!/background: transparent/.test(perigo) || !/color: var\(--danger\)/.test(perigo)) falhas.push("excluir: só texto e contorno em --danger, sem fundo vermelho");
if (/background(-color)?:\s*var\(--danger\)/.test(cssMd)) falhas.push("nenhum fundo vermelho em Meus dados");
[["meus-dados.css", cssMd]].forEach(function (par) {
  if (/gradient/i.test(par[1])) falhas.push(par[0] + ": sem gradiente");
  if (/box-shadow:(?!\s*(inset|none))/.test(par[1])) falhas.push(par[0] + ": sem sombra");
  if (/text-transform:\s*uppercase/.test(par[1])) falhas.push(par[0] + ": sem caixa alta");
  if (/animation|@keyframes|transition/.test(par[1])) falhas.push(par[0] + ": sem animação");
});
/* Excluir: limpar o aparelho só depois do «deleted: true» do servidor. */
var envio = mdJs.slice(mdJs.indexOf("async function enviarExclusao"), mdJs.indexOf("function iniciar"));
var iOk = envio.indexOf("resultado.dados.deleted === true");
var iLimpa = envio.indexOf("limparAparelho()");
if (iOk === -1 || iLimpa === -1 || iLimpa < iOk || envio.indexOf("limparAparelho()", iLimpa + 1) !== -1) falhas.push("o aparelho só é limpo depois da exclusão confirmada (senha errada não limpa nada)");
["wrong_password", "password_required", "too_many_attempts", "admin_account"].forEach(function (c) {
  if (mdJs.indexOf('"' + c + '"') === -1) falhas.push("meus-dados.js não trata " + c);
});
if (!/conta-excluida\.html/.test(envio)) falhas.push("depois de excluir, abre «Sua conta foi excluída»");
var excluida = ler("conta-excluida.html");
if (/api\.js|nexus_v2_token/.test(excluida)) falhas.push("conta-excluida.html é pública: sem sessão");
if (!/href="privacidade\.html"/.test(excluida) || !/href="index\.html"/.test(excluida)) falhas.push("conta-excluida.html: faltam os links para a Política e o início");
/* Ajustes leva a Meus dados. */
if (!/id="link-meus-dados" href="meus-dados\.html"/.test(ler("ajustes.html"))) falhas.push("Ajustes não tem a linha «Meus dados»");
if (!/NexusAbas\.iniciar\("ajustes"\)/.test(mdJs)) falhas.push("em Meus dados a aba Ajustes continua ativa");

/* ---------- Check-in: a pergunta da nota ---------- */
var ck = ler("checkin.html");
var pergunta = ck.slice(ck.indexOf('id="vista-pergunta"'), ck.indexOf("</section>", ck.indexOf('id="vista-pergunta"')));
var botoes = pergunta.match(/<button[^>]*>/g) || [];
if (botoes.length !== 2) falhas.push("a pergunta da nota tem duas respostas");
else {
  var classe = function (b) { return (b.match(/class="([^"]*)"/) || [])[1]; };
  if (classe(botoes[0]) !== classe(botoes[1]) || /btn-primario/.test(botoes[0])) falhas.push("«Sim» e «Não guardar» precisam ser iguais (nenhum cheio)");
  if (!/data-texto-dados="sim"/.test(botoes[0]) || !/data-texto-dados="nao"/.test(botoes[1])) falhas.push("a ordem é «Sim, guardar minhas notas» e depois «Não guardar»");
}
if (!/href="privacidade\.html#secao-5"/.test(pergunta)) falhas.push("falta «Como tratamos seus dados»");
var ckJs = ler("checkin.js");
var nao = ckJs.slice(ckJs.indexOf("function responderNao"), ckJs.indexOf("}\n", ckJs.indexOf("function responderNao")) + 2);
if (/await/.test(nao)) falhas.push("«Não guardar» não espera o servidor");
if (!/escolhaNota === null/.test(ckJs)) falhas.push("a pergunta só aparece quando nunca houve resposta");
if (!/dados\.note_saved !== true\) nexusEsquecerNotasLocais\(\)/.test(ckJs)) falhas.push("sem note_saved, a nota sai da cópia do dia");
var hoje = ler("hoje.js");
if (!/if \(modelo\.nota\) \{[\s\S]{0,400}Ver a nota de hoje/.test(hoje)) falhas.push("«Ver a nota de hoje» só aparece com nota guardada");

/* ---------- Começo da missão: confirmação dos lembretes ---------- */
var ob = ler("onboarding.html");
var caixa = (ob.match(/<input id="quero-lembretes"[^>]*>/) || [""])[0];
if (!caixa || /checked/.test(caixa)) falhas.push("a confirmação dos lembretes falta ou começa marcada");
var obJs = ler("onboarding.js");
if (!/if \(document\.getElementById\("quero-lembretes"\)\.checked\) \{[\s\S]{0,80}NexusApi\.mudarLembretes\(true\)/.test(obJs)) falhas.push("os lembretes só ligam com a confirmação marcada");
if ((obJs.match(/mudarLembretes\(/g) || []).length !== 1) falhas.push("o começo da missão liga os lembretes em um lugar só");
var inscrever = obJs.slice(obJs.indexOf("async function inscreverSeAceito"), obJs.indexOf("function travarPasso4"));
if (/mudarLembretes/.test(inscrever)) falhas.push("ativar o push sozinho não pode ligar os lembretes");

/* ---------- Ajustes da revisão (Argos e Clara, PR 24) ---------- */
/* Desligar as notas: só pela confirmação, com Cancelar primeiro e em foco. */
var dlg = md.slice(md.indexOf('id="dialogo-desligar"'), md.indexOf("</dialog>", md.indexOf('id="dialogo-desligar"')));
if (!dlg) falhas.push("falta a confirmação de desligar as notas");
else {
  var iC = dlg.indexOf('id="btn-cancelar-desligar"'), iD = dlg.indexOf('id="btn-confirmar-desligar"');
  if (iC === -1 || iD === -1 || iC > iD || !/id="btn-cancelar-desligar" autofocus/.test(dlg)) falhas.push("na confirmação de desligar, «Cancelar» vem primeiro e com o foco");
  if (!/id="btn-confirmar-desligar"[^>]*/.test(dlg) || !/class="btn btn-perigo" id="btn-confirmar-desligar"/.test(dlg)) falhas.push("«Desligar e apagar» só em contorno vermelho");
}
var tocar = mdJs.slice(mdJs.indexOf("function tocarInterruptor"), mdJs.indexOf("/* O interruptor só muda"));
if (!/estado\.notas && !estado\.ocupado\.notas\) \{\s*pedirParaDesligarNotas\(\)/.test(tocar)) falhas.push("desligar as notas precisa da confirmação");
if (!/if \(qual === "notas" && !queroLigar && confirmado !== true\) return;/.test(mdJs)) falhas.push("negado: desligar as notas sem confirmar não pode chamar o servidor");
if (!/notes_deleted > 0 \? "notasDesligouApagou" : "notasDesligou"/.test(mdJs)) falhas.push("o sucesso de desligar diz se apagou as notas");
if (T && T.aceitoEm.indexOf("(hora de Lisboa)") === -1) falhas.push("a hora do aceite diz «(hora de Lisboa)»");
if (!/timeZone: "Europe\/Lisbon"/.test(mdJs)) falhas.push("a hora do aceite é mostrada em Lisboa");
if (!/estadoAviso === "pendente"/.test(mdJs) || !/D\.texto\("ligadoSemPermissao"\)/.test(mdJs)) falhas.push("lembretes ligados sem permissão do aparelho precisam dizer isso");
/* Notas no aparelho: sem «sim», nada de rascunho nem de cópia (vm com api.js). */
["checkin.js", "dia-dificil.js"].forEach(function (nome) {
  var js = ler(nome);
  var g = js.slice(js.indexOf("function guardarRascunho"), js.indexOf("try {", js.indexOf("function guardarRascunho")));
  if (!/if \(!nexusPodeGuardarRascunhoDaNota\(\)\) return;/.test(g)) falhas.push(nome + ": o rascunho da nota só fica com o «sim» confirmado");
});
(function () {
  function armazem(inicial) {
    var d = Object.assign({}, inicial);
    return { d: d, getItem: function (k) { return k in d ? d[k] : null; }, setItem: function (k, v) { d[k] = String(v); }, removeItem: function (k) { delete d[k]; }, get length() { return Object.keys(d).length; }, key: function (i) { return Object.keys(d)[i]; } };
  }
  var local = armazem({ nexus_v2_hoje: JSON.stringify({ id: 1, nota: "nota antiga" }), nexus_v2_tema: "escuro" });
  var sessao = armazem({ nexus_v2_rascunho_checkin: JSON.stringify({ note: "rascunho" }) });
  var ctx = { localStorage: local, sessionStorage: sessao, JSON: JSON, location: { pathname: "/nexus-v2/index.html", search: "" }, document: undefined, navigator: { onLine: true }, URLSearchParams: URLSearchParams, setTimeout: setTimeout };
  vm.runInNewContext(ler("api.js"), ctx);
  if (ctx.nexusPodeGuardarRascunhoDaNota()) falhas.push("sem escolha, o rascunho não pode ser guardado");
  ctx.nexusLembrarEscolhaNota(null);
  if (JSON.parse(local.d.nexus_v2_hoje).nota) falhas.push("sem «sim», a nota sai da cópia do dia (cópia de antes da escolha)");
  if (sessao.d.nexus_v2_rascunho_checkin) falhas.push("sem «sim», o rascunho da nota sai");
  ctx.nexusLembrarEscolhaNota("yes");
  if (!ctx.nexusPodeGuardarRascunhoDaNota()) falhas.push("com «sim» confirmado, o rascunho pode ser guardado");
  ctx.nexusLembrarEscolhaNota("no");
  if (ctx.nexusPodeGuardarRascunhoDaNota()) falhas.push("depois de «não», o rascunho volta a não ser guardado");
})();
if (!/nexusLembrarEscolhaNota\("no"\);\s*chave = resultado\.dados\.notes_deleted/.test(mdJs)) falhas.push("depois de desligar, as cópias locais da nota saem");
/* Começo da missão: um caminho só. */
if (!/id="btn-aviso" hidden data-texto-dados="permitirAvisos"/.test(ob)) falhas.push("o pedido de permissão começa escondido e se chama «Permitir avisos neste aparelho»");
if (!/var quer = document\.getElementById\("quero-lembretes"\)\.checked;\s*if \(!quer\) \{/.test(obJs)) falhas.push("sem a caixa marcada, nada de pedido de permissão");
if (!/var querAviso = document\.getElementById\("quero-lembretes"\)\.checked &&/.test(obJs)) falhas.push("a inscrição do aparelho só com a caixa marcada");
if (/te lembramos/.test(ob + obJs)) falhas.push("o título usa «você»: «Quando lembramos você?»");

/* ---------- Acabamento (fila do PR 25) ---------- */
/* Dia difícil: a mesma linha de apoio do check-in, com os textos aprovados. */
var dd = ler("dia-dificil.html");
var ddJs = ler("dia-dificil.js");
if (!/<p id="nota-guarda" class="dica" hidden><\/p>/.test(dd)) falhas.push("dia difícil: falta a linha de apoio sobre guardar a nota (começa escondida)");
if (dd.indexOf('<script src="dados-textos.js"></script>') === -1) falhas.push("dia difícil: falta dados-textos.js");
if (!/NexusApi\.escolhaDaNota\(\)/.test(ddJs) || !/NexusDados\.texto\(escolhaNota === "yes" \? "apoioSim" : "apoioNao"\)/.test(ddJs)) falhas.push("dia difícil: a linha usa a escolha lida no servidor e os textos do check-in");
if (!/linha\.hidden = true;/.test(ddJs.slice(ddJs.indexOf("function pintarApoioDaNota")))) falhas.push("negado: sem saber a escolha, a linha do dia difícil não aparece");
if (/perguntaTitulo|btn-guardar-notas/.test(dd + ddJs)) falhas.push("dia difícil: sem a pergunta (ela fica no check-in)");
/* Lembretes bloqueados: o rótulo diz isso. */
if (!T || T.ligadoBloqueado !== "Ligado, mas o navegador bloqueou os avisos") falhas.push("falta «Ligado, mas o navegador bloqueou os avisos»");
if (!/nexusEstadoDoAviso\(\) === "bloqueado"\) estadoTexto = D\.texto\("ligadoBloqueado"\)/.test(mdJs)) falhas.push("lembretes bloqueados: o rótulo diz que o navegador bloqueou");
/* Sem suporte: o rótulo diz isso, e a frase de baixo explica o iPhone. */
if (!T || T.ligadoSemSuporte !== "Ligado, mas este navegador não mostra avisos" || T.lembretesSemSuporte !== "No iPhone, só funciona com o Nexus adicionado à Tela de Início.") falhas.push("faltam os textos do estado sem suporte");
if (!/nexusEstadoDoAviso\(\) === "sem-suporte"\) estadoTexto = D\.texto\("ligadoSemSuporte"\)/.test(mdJs)) falhas.push("negado: sem suporte, o rótulo não pode dizer só «Ligado»");
/* E-mail: o ponto final fica junto do endereço, numa linha própria com respiro. */
if (!/linha\.append\(link, document\.createTextNode\(partes\[1\] \|\| ""\)\)/.test(mdJs)) falhas.push("o ponto final fica na mesma linha do e-mail");
var linkCss = cssMd.slice(cssMd.indexOf(".link-email {"), cssMd.indexOf("}", cssMd.indexOf(".link-email {")));
if (!/display: inline;/.test(linkCss)) falhas.push("o link do e-mail é inline (caixa atômica deixa o «.» sozinho)");
if (!/\.linha-email \{[\s\S]*?padding-block: var\(--space-3\);/.test(cssMd)) falhas.push("a linha do e-mail tem respiro para o anel de foco");

/* ---------- Cache ---------- */
var sw = ler("sw.js");
["./dados-textos.js", "./meus-dados.html", "./meus-dados.css", "./meus-dados.js", "./conta-excluida.html"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});

/* ---------- Mock ---------- */
function pedir(metodo, caminho, corpo, token) {
  return new Promise(function (resolver) {
    var dados = corpo ? JSON.stringify(corpo) : "";
    var cab = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) };
    if (token) cab.Authorization = "Bearer " + token;
    var req = http.request({ host: "127.0.0.1", port: PORTA, path: caminho, method: metodo, headers: cab }, function (res) {
      var texto = "";
      res.on("data", function (p) { texto += p; });
      res.on("end", function () {
        var json = {};
        try { json = JSON.parse(texto); } catch (e) {}
        resolver({ status: res.statusCode, dados: json });
      });
    });
    req.on("error", function () { resolver({ status: 0, dados: {} }); });
    req.end(dados);
  });
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + JSON.stringify(veio) + ", esperado " + JSON.stringify(esperado));
}
async function entrar(email) {
  return (await pedir("POST", "/api/users/login", { email: email, password: "123456" })).dados.token;
}
async function missaoDe(token) {
  var criada = await pedir("POST", "/api/missions", { title: "Ler", category: "aprendizagem", daily_minimum: "1 página", why_it_matters: "x", mode: "solo", proof_mode: "self_report" }, token);
  return criada.dados && criada.dados.mission && criada.dados.mission.id;
}
function notaDoProgresso(progresso) {
  var grupos = progresso && progresso.progress ? Object.keys(progresso.progress).map(function (k) { return progresso.progress[k]; }) : [];
  var notas = [];
  grupos.forEach(function (g) { (g.checkins || []).forEach(function (c) { if (c.note) notas.push(c.note); }); });
  return notas;
}

async function casosDoMock() {
  /* Sem consentimento: a nota não fica e o progresso (que o Hoje lê) não a traz. */
  var t1 = await entrar("primeira-vez@exemplo.com");
  igual("primeira vez: sem resposta", (await pedir("GET", "/api/users/me/note-consent", null, t1)).dados.note_consent, null);
  var m1 = await missaoDe(t1);
  var c1 = await pedir("POST", "/api/checkins", { mission_id: m1, note: "nota de teste sem consentimento" }, t1);
  igual("sem consentimento: check-in feito", c1.status, 201);
  igual("sem consentimento: note_saved", c1.dados.note_saved, false);
  igual("sem consentimento: o Hoje não tem nota para mostrar", notaDoProgresso((await pedir("GET", "/api/checkins/" + m1, null, t1)).dados).length, 0);

  /* Com «sim»: a nota fica; desligar apaga e as próximas não ficam. */
  var t2 = await entrar("com-sim@exemplo.com");
  var m2 = await missaoDe(t2);
  var c2 = await pedir("POST", "/api/checkins", { mission_id: m2, note: "nota guardada com sim" }, t2);
  igual("com sim: note_saved", c2.dados.note_saved, true);
  igual("com sim: a nota aparece", notaDoProgresso((await pedir("GET", "/api/checkins/" + m2, null, t2)).dados).length, 1);
  var desligar = await pedir("DELETE", "/api/users/me/note-consent", null, t2);
  igual("desligar: grava «não»", desligar.dados.note_consent, "no");
  igual("desligar: apaga a nota guardada", desligar.dados.notes_deleted, 1);
  igual("desligar: nada sobra", notaDoProgresso((await pedir("GET", "/api/checkins/" + m2, null, t2)).dados).length, 0);
  igual("POST sem consent: true", (await pedir("POST", "/api/users/me/note-consent", {}, t2)).status, 400);
  igual("escolha sem login", (await pedir("GET", "/api/users/me/note-consent")).status, 401);

  /* Lembretes: nada nasce ligado; só true/false; a escolha é de cada um. */
  var a1 = await pedir("GET", "/api/users/me/notification-preferences", null, t1);
  igual("lembretes começam sem escolha", a1.dados.reminders && a1.dados.reminders.choice, null);
  igual("lembretes: «true» em texto não vale", (await pedir("PUT", "/api/users/me/notification-preferences", { reminders: "true" }, t1)).status, 400);
  igual("lembretes: ligar", (await pedir("PUT", "/api/users/me/notification-preferences", { reminders: true }, t1)).dados.reminders.choice, "yes");
  igual("lembretes: outra pessoa não muda", (await pedir("GET", "/api/users/me/notification-preferences", null, t2)).dados.reminders.choice, null);

  /* Excluir: senha errada, 429, admin e falha não apagam nada. */
  var t3 = await entrar("vai-sair@exemplo.com");
  igual("excluir sem senha", (await pedir("DELETE", "/api/users/me", {}, t3)).dados.code, "password_required");
  igual("excluir com senha errada", (await pedir("DELETE", "/api/users/me", { password: "errada" }, t3)).dados.code, "wrong_password");
  igual("depois da senha errada, a conta continua", (await pedir("GET", "/api/users/me", null, t3)).status, 200);
  igual("muitas tentativas", (await pedir("DELETE", "/api/users/me", { password: "muitas" }, t3)).status, 429);
  var tAdm = await entrar("admin@exemplo.com");
  igual("admin não se exclui aqui", (await pedir("DELETE", "/api/users/me", { password: "123456" }, tAdm)).dados.code, "admin_account");
  var tF = await entrar("excluir-falha@exemplo.com");
  igual("falha do servidor", (await pedir("DELETE", "/api/users/me", { password: "123456" }, tF)).status, 500);
  igual("excluir sem login", (await pedir("DELETE", "/api/users/me", { password: "123456" })).status, 401);
  igual("excluir", (await pedir("DELETE", "/api/users/me", { password: "123456" }, t3)).dados.deleted, true);
  var depois = await pedir("GET", "/api/users/me", null, t3);
  igual("depois de excluir: sessão encerrada", depois.dados.code, "session_ended");
}

function esperarMock(tentativas) {
  return pedir("GET", "/api/notifications/vapid-key").then(function (r) {
    if (r.status === 200 || tentativas <= 0) return;
    return new Promise(function (ok) { setTimeout(ok, 150); }).then(function () { return esperarMock(tentativas - 1); });
  });
}

(async function () {
  var filho = spawn(process.execPath, [path.join(__dirname, "mock-api.js")], {
    env: Object.assign({}, process.env, { NEXUS_MOCK_PORTA: String(PORTA) }),
    stdio: "ignore"
  });
  try {
    await esperarMock(40);
    await casosDoMock();
  } finally {
    filho.kill();
  }
  if (falhas.length) {
    console.log("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("ok: pergunta da nota, Meus dados, lembretes só com confirmação, exclusão da conta e casos negados");
})();
