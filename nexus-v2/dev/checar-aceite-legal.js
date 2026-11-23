/* Confere o aceite dos Termos e da Privacidade (PR 28 do servidor):
   - cadastro com a caixa DESMARCADA, links para ler, versões «beta-1» no envio
     e os erros legal_acceptance_required e legal_version_outdated;
   - tela de reaceitação quando o login ou o /me trazem needs_acceptance;
   - termos.html e privacidade.html: abrem sem login e sem internet, com a
     faixa «Rascunho beta-1», só os dois marcadores e nenhuma nota interna;
   - em todas as chamadas com login: 401 session_ended limpa a sessão e volta
     ao login; 503 auth_unavailable mostra o aviso e não apaga nada.
   Também prova os casos negados (no navegador simulado e no mock).
   Rode na raiz do repositório: node nexus-v2/dev/checar-aceite-legal.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3095;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

function semComentarios(js) {
  return js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

var APROVADOS = {
  erroCadastro: "Para criar a conta, marque que você leu e aceita os termos e a política de privacidade.",
  erroReaceite: "Para continuar, marque que você leu e aceita os termos e a política de privacidade.",
  /* Ajustado na revisão da Clara (o servidor ainda manda «Recarregue a página»). */
  versaoMudou: "Os termos ou a política de privacidade mudaram. Atualize a página (ou feche e abra o app) para ver a versão atual e aceite de novo.",
  falhaAceite: "Não foi possível guardar seu aceite. Tente de novo.",
  sessaoEncerrada: "Sessão encerrada. Entre de novo.",
  sessaoIndisponivel: "Não foi possível conferir sua sessão agora. Tente de novo em instantes."
};

var index = ler("index.html");
var login = ler("login.js");
var api = ler("api.js");
var textos = ler("legal-textos.js");
var sw = ler("sw.js");
var css = ler("login.css") + "\n" + ler("base.css");
var legalCss = ler("legal.css");

/* ---------- Textos num lugar só ---------- */
var janelaTextos = {};
vm.runInNewContext(textos, { window: janelaTextos, document: { querySelectorAll: function () { return []; } } });
var L = janelaTextos.NexusLegal;
if (!L) falhas.push("legal-textos.js não define window.NexusLegal");
else {
  if (L.VERSAO_TERMOS !== "beta-1" || L.VERSAO_PRIVACIDADE !== "beta-1") falhas.push("as versões no site não são beta-1 (precisam ser iguais às do servidor)");
  Object.keys(APROVADOS).forEach(function (chave) {
    if (L.TEXTOS[chave] !== APROVADOS[chave]) falhas.push("legal-textos.js: o texto aprovado «" + chave + "» mudou");
  });
  if (L.DO_SERVIDOR.aceiteFaltando !== "legal_acceptance_required" || L.DO_SERVIDOR.versaoAntiga !== "legal_version_outdated") falhas.push("códigos do servidor errados em legal-textos.js");
  /* Cada frase aprovada aparece só em legal-textos.js e (as da sessão) em api.js. */
  ["login.js", "index.html", "hoje.js", "ajustes.js", "comunidade.js"].forEach(function (nome) {
    var codigo = semComentarios(ler(nome));
    Object.keys(APROVADOS).forEach(function (chave) {
      if (codigo.indexOf(APROVADOS[chave]) !== -1) falhas.push(nome + " repete o texto «" + chave + "» (deve vir de legal-textos.js)");
    });
  });
}
if (semComentarios(api).indexOf(APROVADOS.sessaoEncerrada) === -1 || semComentarios(api).indexOf(APROVADOS.sessaoIndisponivel) === -1) {
  falhas.push("api.js não tem os textos aprovados da sessão");
}

/* ---------- Cadastro ---------- */
var cadastro = index.slice(index.indexOf('id="form-cadastro"'), index.indexOf("</form>", index.indexOf('id="form-cadastro"')));
var bloco = cadastro.slice(cadastro.indexOf('<fieldset class="campo-aceite"'), cadastro.indexOf("</fieldset>", cadastro.indexOf('<fieldset class="campo-aceite"')));
if (!bloco) falhas.push("o cadastro não tem o bloco «Termos e privacidade»");
var caixa = (bloco.match(/<input[^>]*type="checkbox"[^>]*>/) || [""])[0];
if (!caixa) falhas.push("o cadastro não tem a caixa de aceite");
if (/\schecked/.test(caixa)) falhas.push("a caixa de aceite começa marcada (precisa começar desmarcada)");
if (!/aria-required="true"/.test(caixa)) falhas.push("a caixa de aceite não está marcada como obrigatória");
if (!/aria-describedby="[^"]*cadastro-aceite-erro/.test(caixa)) falhas.push("o erro da caixa não está no aria-describedby");
if (!/<legend data-texto-legal="aceiteLegenda"><\/legend>/.test(bloco)) falhas.push("o bloco do aceite não tem a legenda");
var rotulo = bloco.slice(bloco.indexOf("<label"), bloco.indexOf("</label>"));
if (/<a\s/.test(rotulo)) falhas.push("há link dentro do rótulo da caixa (o toque no link marcaria a caixa)");
if (!/href="termos\.html"/.test(bloco) || !/href="privacidade\.html"/.test(bloco)) falhas.push("faltam os links para ler os Termos e a Privacidade no cadastro");
if (/target="_blank"/.test(bloco)) falhas.push("os links do cadastro não podem abrir outra aba (no PWA ela some)");
if (!/id="cadastro-aceite-erro" class="erro-campo" role="alert" hidden/.test(bloco)) falhas.push("o erro da caixa não tem role=alert");
if (cadastro.indexOf("campo-aceite") > cadastro.indexOf('id="btn-criar"')) falhas.push("o aceite precisa vir antes de «Criar conta»");
if (cadastro.indexOf("campo-aceite") < cadastro.indexOf('id="cadastro-data"')) falhas.push("o aceite precisa vir depois da data de nascimento");
if (/opcional|lembrete|novidade/i.test(bloco)) falhas.push("os opcionais (lembretes, novidades) ficam fora deste PR");
var ordem = ["comunidade-textos.js", "legal-textos.js", "api.js", "login.js"].map(function (n) { return index.indexOf('<script src="' + n + '"></script>'); });
if (ordem.some(function (i) { return i === -1; }) || ordem[1] > ordem[2] || ordem[2] > ordem[3]) falhas.push("index.html: legal-textos.js precisa vir antes de api.js e login.js");

var envio = login.slice(login.indexOf("async function enviarCadastro"));
if (!/caixaAceite\.checked \? "" : TEXTOS_LEGAIS\(\)\.TEXTOS\.erroCadastro/.test(envio)) falhas.push("o cadastro não barra a caixa desmarcada antes de enviar");
if (!/terms_version: versoesAceitas\(\)\.terms_version/.test(envio) || !/privacy_version: versoesAceitas\(\)\.privacy_version/.test(envio)) falhas.push("o cadastro não manda as versões aceitas");
if (!/terms_version: dados\.terms_version/.test(api) || !/privacy_version: dados\.privacy_version/.test(api)) falhas.push("api.js não manda as versões no cadastro");
if (!/aviso\.onde === "aceite"/.test(envio)) falhas.push("o 400 legal_acceptance_required não volta para a caixa");
var mapa = login.slice(login.indexOf("function mensagemDaApi"), login.indexOf("function mostrarVista"));
if (mapa.indexOf("DO_SERVIDOR.aceiteFaltando") === -1 || mapa.indexOf("DO_SERVIDOR.versaoAntiga") === -1) falhas.push("login.js não trata os dois códigos do aceite");
if (!/if \(campo\.type === "checkbox"\) campo\.checked = false;/.test(login)) falhas.push("depois do 403 do menor a caixa não é desmarcada");

/* Rascunho do cadastro ao abrir os textos: só nome e e-mail. Negado: a data
   de nascimento e a senha nunca vão para o sessionStorage. */
var rascunho = login.slice(login.indexOf("var CAMPOS_RASCUNHO"), login.indexOf(";", login.indexOf("var CAMPOS_RASCUNHO")));
if (rascunho !== 'var CAMPOS_RASCUNHO = ["cadastro-nome", "cadastro-email"]') falhas.push("o rascunho do cadastro guarda mais que nome e e-mail: " + rascunho);
var guarda = login.slice(login.indexOf("function guardarRascunhoCadastro"), login.indexOf("function restaurarRascunhoCadastro"));
if (/cadastro-(dia|mes|ano|senha|confirma)|birth|nascimento/.test(guarda)) falhas.push("o rascunho do cadastro não pode guardar a data nem a senha");
(function () {
  /* Roda guardarRascunhoCadastro de verdade, com os campos preenchidos. */
  var valores = { "cadastro-nome": "Leitora", "cadastro-email": "leitora@exemplo.com", "cadastro-dia": "07", "cadastro-mes": "03", "cadastro-ano": "1995", "cadastro-senha": "senha123", "cadastro-confirma": "senha123" };
  var guardado = {};
  var ctx = {
    document: { getElementById: function (id) { return { value: valores[id] || "" }; } },
    sessionStorage: { setItem: function (k, v) { guardado[k] = v; } },
    JSON: JSON
  };
  vm.runInNewContext(rascunho + ";\nvar CHAVE_RASCUNHO_CADASTRO = \"nexus_v2_cadastro_rascunho\";\n" + guarda + "\nguardarRascunhoCadastro();", ctx);
  var texto = guardado.nexus_v2_cadastro_rascunho || "";
  if (!/Leitora/.test(texto)) falhas.push("o rascunho do cadastro não guardou o nome");
  if (/1995|"07"|"03"|senha123/.test(texto)) falhas.push("o rascunho do cadastro guardou a data de nascimento ou a senha");
})();

/* ---------- Reaceitação ---------- */
var reaceite = index.slice(index.indexOf('id="vista-reaceite"'), index.indexOf("</section>", index.indexOf('id="vista-reaceite"')));
if (!reaceite) falhas.push("falta a tela de reaceitação");
else {
  if (!/<h1 class="titulo" id="titulo-reaceite" tabindex="-1" data-texto-legal="reaceiteTitulo">/.test(reaceite)) falhas.push("a reaceitação não tem o h1 que recebe o foco");
  var caixaR = (reaceite.match(/<input[^>]*type="checkbox"[^>]*>/) || [""])[0];
  if (!caixaR || /\schecked/.test(caixaR)) falhas.push("a caixa da reaceitação falta ou começa marcada");
  if (!/href="termos\.html"/.test(reaceite) || !/href="privacidade\.html"/.test(reaceite)) falhas.push("a reaceitação não tem os links para ler");
  var botoes = reaceite.match(/<button[^>]*class="btn [^"]*"/g) || [];
  if (botoes.length !== 2 || botoes[0].match(/class="([^"]*)"/)[1] !== botoes[1].match(/class="([^"]*)"/)[1]) falhas.push("«Continuar» e «Sair da conta» precisam ter o mesmo estilo");
  if (/Lembrar depois|Agora não/.test(reaceite)) falhas.push("a reaceitação não tem «Lembrar depois»");
}
if (!/precisaReaceitar\(resultado\.dados\)/.test(login)) falhas.push("o login não abre a reaceitação com needs_acceptance");
var envioR = login.slice(login.indexOf("async function enviarReaceite"), login.indexOf("function sairDaReaceite"));
if (!/if \(!caixa\.checked\)/.test(envioR)) falhas.push("a reaceitação não barra a caixa desmarcada");
if (!/NexusApi\.aceitarTermos\(versoesAceitas\(\)\)/.test(envioR)) falhas.push("a reaceitação não manda as versões");
if (!/sair\.disabled = true/.test(envioR) || !/definirCarregando\(botao, true\)/.test(envioR)) falhas.push("os botões da reaceitação não ficam desabilitados durante o envio");
if (envioR.indexOf("falhaAceite") === -1) falhas.push("a reaceitação não mostra a falha aprovada");
if (envioR.indexOf('mostrarAviso(alerta, "neutro", TEXTOS_LEGAIS().TEXTOS.falhaAceite)') === -1) falhas.push("a falha ao guardar o aceite precisa ser neutra (não vermelha)");
if (L && L.TEXTOS.reaceiteTexto !== "Para continuar, leia e aceite as versões novas. Elas valem a partir de " + L.DATA_VERSAO + ".") falhas.push("o texto da reaceitação não usa a data de vigência da fonte única");

/* ---------- Páginas de Termos e Privacidade ---------- */
var PROIBIDAS = ["isaac", "pirro", "dédalo", "maestro", "lacuna", "conferir:", "conferir com", "conferir de novo", "desconhecido", "decidir:", "hipótese",
  "aviso interno", "apagar antes de publicar", "testers", "pr 26", "legal/", ".md", "ver lacunas", "proposta do", "a aprovar", "urso", "[conferir"];
/* Desde 22/11 não sobra nenhum marcador: o e-mail de privacidade é o de
   dados-textos.js (contatoEmail), o mesmo de Meus dados. */
var MARCADORES = [];
var janelaDados = {};
vm.runInNewContext(ler("dados-textos.js"), { window: janelaDados, document: { querySelectorAll: function () { return []; } } });
var CONTATO = janelaDados.NexusDados ? janelaDados.NexusDados.TEXTOS.contatoEmail : "";
/* Nome do responsável (decisão do dono do projeto, 22/11): lido da própria
   página, nunca escrito aqui. É a única menção permitida; a expressão exata
   sai do texto antes da lista de palavras internas. */
var RESPONSAVEL = ((ler("termos.html").match(/Quem responde pelo Nexus: ([^,<]+),/) || [])[1] || "").trim();
if (!RESPONSAVEL) falhas.push("termos.html: falta o responsável na seção 1");
if (RESPONSAVEL && ler("privacidade.html").indexOf("<p>" + RESPONSAVEL + " (pessoa física) é o responsável") === -1) falhas.push("privacidade.html: o responsável não é o mesmo dos Termos");
["termos.html", "privacidade.html"].forEach(function (nome) {
  var html = ler(nome);
  if (!/<html lang="pt-BR">/.test(html)) falhas.push(nome + ": falta lang pt-BR");
  if (!/<p class="faixa-rascunho">Rascunho beta-1<\/p>/.test(html)) falhas.push(nome + ": falta a faixa «Rascunho beta-1»");
  if ((html.match(/<h1[\s>]/g) || []).length !== 1) falhas.push(nome + ": precisa de um h1 só");
  if (/api\.js|login\.js|nexus_v2_token/.test(html)) falhas.push(nome + ": a página não pode depender de login");
  if (/<form|type="checkbox"|<button/.test(html)) falhas.push(nome + ": a página de leitura não tem botão de aceitar");
  if (/https?:\/\//.test(html)) falhas.push(nome + ": não carrega nada de fora");
  var enderecos = html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || [];
  if (!enderecos.length || enderecos.some(function (e) { return e !== CONTATO; })) falhas.push(nome + ": o único e-mail é o de privacidade (dados-textos.js)");
  if (html.indexOf('<a href="mailto:' + CONTATO + '">' + CONTATO + "</a>") === -1) falhas.push(nome + ": o e-mail de privacidade é um link mailto:");
  if (!/<a class="voltar" id="voltar" href="index\.html">Voltar<\/a>/.test(html)) falhas.push(nome + ": falta «Voltar» (sem JavaScript, leva ao início)");
  var texto = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ");
  if (RESPONSAVEL) texto = texto.split(RESPONSAVEL).join(" ");
  texto = texto.toLowerCase();
  PROIBIDAS.forEach(function (p) {
    if (texto.indexOf(p) !== -1) falhas.push(nome + ": sobrou texto interno «" + p + "»");
  });
  var depoisDaFaixa = texto.slice(texto.indexOf("rascunho beta-1") + 15);
  if (depoisDaFaixa.indexOf("rascunho") !== -1) falhas.push(nome + ": sobrou nota de rascunho no texto");
  (html.replace(/<script[\s\S]*?<\/script>/g, "").match(/\[[^\]]*\]/g) || []).forEach(function (c) {
    if (MARCADORES.indexOf(c) === -1) falhas.push(nome + ": sobrou colchete " + c);
  });
  if (/\[(E-MAIL|NOME)[^\]]*\]/.test(html)) falhas.push(nome + ": sobrou marcador entre colchetes");
  /* Índice: cada link aponta para um h2 que existe. */
  var alvos = (html.match(/<li><a href="#(secao-\d+)">/g) || []).map(function (l) { return l.match(/#(secao-\d+)/)[1]; });
  if (!alvos.length) falhas.push(nome + ": falta o índice «Neste texto»");
  alvos.forEach(function (id) {
    if (html.indexOf('<h2 id="' + id + '">') === -1) falhas.push(nome + ": o índice aponta para #" + id + ", que não existe");
  });
  if (!/<table/.test(html) === false) falhas.push(nome + ": tabela com rolagem lateral no celular (use a lista)");
  if (sw.indexOf('"./' + nome + '"') === -1) falhas.push("sw.js não guarda " + nome + " (precisa abrir sem internet)");
});
if (ler("termos.html").indexOf("privacidade.html") === -1 || ler("privacidade.html").indexOf("termos.html") === -1) falhas.push("falta o link cruzado entre Termos e Privacidade");
/* Contatos de ajuda nos Termos: os mesmos números aprovados da tela de crise. */
var crise = ler("crise.html");
["188", "192", "112"].forEach(function (n) {
  if (ler("termos.html").indexOf(n) === -1) falhas.push("termos.html: falta o número " + n);
  if (crise.indexOf('tel:' + n) === -1) falhas.push("o número " + n + " não está na tela de crise aprovada");
});
if (ler("termos.html").indexOf("808 24 24 24") === -1 || crise.indexOf("tel:+351808242424") === -1) falhas.push("o SNS 24 dos Termos não bate com a tela de crise");
["./legal-textos.js", "./legal.css", "./legal-pagina.js"].forEach(function (a) {
  if (sw.indexOf('"' + a + '"') === -1) falhas.push("sw.js não guarda " + a);
});
if (!/url\.pathname\.match\(\/\\\/\(termos\|privacidade\)\\\.html\$\/\)/.test(sw)) falhas.push("o service worker não serve Termos e Privacidade offline com ?tema=");
if (!/\/\\\/crise\\\.html\$\/\.test\(url\.pathname\)/.test(sw)) falhas.push("o caminho da crise offline mudou");

/* Regra 11 e acessibilidade no CSS novo. */
var baseCss = ler("base.css");
[["legal.css", legalCss], ["login.css", ler("login.css").slice(ler("login.css").indexOf("/* Aceite dos termos"))], ["base.css (caixa)", baseCss.slice(baseCss.indexOf("/* Caixa de marcar desenhada"), baseCss.indexOf("/* ---------- Modo escuro neon") > baseCss.indexOf("/* Caixa de marcar desenhada") ? baseCss.indexOf("/* ---------- Modo escuro neon") : undefined)]].forEach(function (par) {
  var c = par[1];
  if (/gradient/i.test(c)) falhas.push(par[0] + ": sem gradiente");
  if (/box-shadow:(?!\s*(inset|none))/.test(c)) falhas.push(par[0] + ": sem sombra");
  if (/text-transform:\s*uppercase/.test(c)) falhas.push(par[0] + ": sem caixa alta");
  if (/text-align:\s*justify/.test(c)) falhas.push(par[0] + ": sem texto justificado");
  if (/animation|@keyframes/.test(c)) falhas.push(par[0] + ": sem animação");
});
if (!/line-height: 1\.6/.test(legalCss)) falhas.push("legal.css: a entrelinha do texto longo é 1,6");
if (!/scroll-margin-top/.test(legalCss)) falhas.push("legal.css: âncoras sem scroll-margin-top");
if (!/@media print/.test(legalCss)) falhas.push("legal.css: falta o CSS de impressão");
if (!/\.caixa-aceite input \{[\s\S]*?width: var\(--target\);[\s\S]*?height: var\(--target\);/.test(css)) falhas.push("a caixa de aceite não tem alvo de 44 px");
if (!/\.caixa-aceite input:focus-visible \+ label::before/.test(css)) falhas.push("a caixa de aceite não mostra o foco");
if (!/\.links-legais a \{[\s\S]*?min-height: var\(--target\);/.test(css)) falhas.push("os links para ler não têm 44 px");
if (!/\.links-legais \{[\s\S]*?gap: var\(--space-3\);/.test(css)) falhas.push("os dois links para ler precisam de 12 px entre eles");
/* Versão e vigência das páginas vêm da mesma fonte do cadastro (legal-textos.js). */
["termos.html", "privacidade.html"].forEach(function (nome) {
  if (L && ler(nome).indexOf('<p class="versao">Versão ' + L.VERSAO_TERMOS + " \u00B7 em vigor desde " + L.DATA_VERSAO + ".</p>") === -1) falhas.push(nome + ": a versão e a vigência não batem com legal-textos.js");
});
[index, ler("termos.html"), ler("privacidade.html"), textos].forEach(function (t) {
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t)) falhas.push("há emoji nas telas novas");
});

/* ---------- api.js num navegador simulado ---------- */
function novoArmazem(inicial) {
  var dados = Object.assign({}, inicial || {});
  return {
    dados: dados,
    get length() { return Object.keys(dados).length; },
    key: function (i) { return Object.keys(dados)[i] || null; },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(dados, k) ? dados[k] : null; },
    setItem: function (k, v) { dados[k] = String(v); },
    removeItem: function (k) { delete dados[k]; }
  };
}

function elemento(tag) {
  var el = {
    tagName: tag, id: "", className: "", hidden: false, filhos: [], atributos: {}, textContent: "",
    setAttribute: function (k, v) { this.atributos[k] = v; },
    insertBefore: function (novo) { this.filhos.unshift(novo); },
    appendChild: function (novo) { this.filhos.push(novo); },
    replaceChildren: function () { this.filhos = Array.prototype.slice.call(arguments); },
    closest: function () { return null; },
    querySelectorAll: function (sel) {
      var classe = sel.replace(/^\./, "");
      var achados = [];
      (function andar(lista) {
        lista.forEach(function (f) {
          if ((" " + f.className + " ").indexOf(" " + classe + " ") !== -1) achados.push(f);
          andar(f.filhos || []);
        });
      })(this.filhos);
      return achados;
    }
  };
  el.classList = {
    add: function (c) { if ((" " + el.className + " ").indexOf(" " + c + " ") === -1) el.className = (el.className + " " + c).trim(); },
    remove: function (c) { el.className = (" " + el.className + " ").replace(" " + c + " ", " ").trim(); }
  };
  return el;
}

function navegador(caminho, respostas, local) {
  var main = elemento("main");
  var trocas = [];
  var pedidos = [];
  var documento = {
    getElementById: function (id) {
      return main.filhos.find(function (f) { return f.id === id; }) || null;
    },
    createElement: elemento,
    querySelector: function (sel) { return sel === "main" ? main : null; },
    body: main
  };
  var contexto = {
    window: {},
    document: documento,
    navigator: { onLine: true },
    localStorage: novoArmazem(local),
    sessionStorage: novoArmazem({}),
    location: { pathname: caminho, search: "?tema=escuro", replace: function (u) { trocas.push(u); } },
    URLSearchParams: URLSearchParams,
    JSON: JSON,
    setTimeout: setTimeout,
    fetch: function (url, pedido) {
      pedidos.push({ url: url, pedido: pedido });
      var r = respostas.shift() || { status: 200, corpo: {} };
      return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: function () { return Promise.resolve(r.corpo); } });
    }
  };
  vm.runInNewContext(api, contexto);
  return { contexto: contexto, main: main, trocas: trocas, pedidos: pedidos };
}

var SESSAO = { nexus_v2_token: "t", nexus_v2_user: "{}", nexus_v2_hoje: "{\"nota\":\"x\"}", nexus_v2_missao: "{}", nexus_v2_tema: "escuro" };

async function casosDoNavegador() {
  /* 401 session_ended num pedido com login: limpa e volta ao login. */
  var b = navegador("/nexus-v2/missao.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }, { status: 401, corpo: { error: "Sessão encerrada. Entre de novo.", code: "session_ended" } }], SESSAO);
  await new Promise(function (r) { setTimeout(r, 5); });
  var r = await b.contexto.NexusApi.listarMissoes();
  if (!r.sessaoEncerrada) falhas.push("401 session_ended: o resultado não diz sessaoEncerrada");
  ["nexus_v2_token", "nexus_v2_user", "nexus_v2_hoje", "nexus_v2_missao"].forEach(function (k) {
    if (b.contexto.localStorage.getItem(k) !== null) falhas.push("401 session_ended: " + k + " ficou no aparelho");
  });
  if (b.contexto.localStorage.getItem("nexus_v2_tema") !== "escuro") falhas.push("401 session_ended: o tema não pode sair");
  if (b.contexto.sessionStorage.getItem("nexus_v2_aviso_login") !== "sessao_encerrada") falhas.push("401 session_ended: o aviso para o login não foi guardado");
  if (b.trocas.indexOf("./index.html?tema=escuro") === -1) falhas.push("401 session_ended: não voltou ao login (veio " + b.trocas.join(", ") + ")");

  /* Negado: 401 sem o código (ex.: sem token) não limpa nada. */
  var n = navegador("/nexus-v2/missao.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }, { status: 401, corpo: { error: "Acesso negado. Token não fornecido." } }], SESSAO);
  await new Promise(function (r2) { setTimeout(r2, 5); });
  await n.contexto.NexusApi.listarMissoes();
  if (n.contexto.localStorage.getItem("nexus_v2_token") !== "t" || n.trocas.length) falhas.push("401 sem code session_ended não pode apagar a sessão");

  /* Negado: 401 session_ended num pedido SEM login (o login errado) não limpa. */
  var semAuth = navegador("/nexus-v2/index.html", [{ status: 401, corpo: { error: "Credenciais inválidas.", code: "session_ended" } }], SESSAO);
  await semAuth.contexto.NexusApi.entrar("a@b.c", "x");
  if (semAuth.contexto.localStorage.getItem("nexus_v2_token") !== "t" || semAuth.trocas.length) falhas.push("pedido sem login não pode apagar a sessão");

  /* 503 auth_unavailable sem erro na tela: aviso aprovado no topo, com role=alert, sem apagar. */
  var i = navegador("/nexus-v2/missao.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }, { status: 503, corpo: { error: "x", code: "auth_unavailable" } }], SESSAO);
  await new Promise(function (r3) { setTimeout(r3, 5); });
  var r503 = await i.contexto.NexusApi.listarMissoes();
  await new Promise(function (r3b) { setTimeout(r3b, 400); });
  var aviso = i.main.filhos.find(function (f) { return f.id === "aviso-sessao"; });
  if (!aviso || aviso.atributos.role !== "alert" || !aviso.filhos[0] || aviso.filhos[0].textContent !== APROVADOS.sessaoIndisponivel) falhas.push("503 auth_unavailable: falta o aviso aprovado com role=alert");
  if (r503.erro !== APROVADOS.sessaoIndisponivel) falhas.push("503 auth_unavailable: o erro não é o texto aprovado");
  if (i.contexto.localStorage.getItem("nexus_v2_token") !== "t" || i.trocas.length) falhas.push("503 auth_unavailable não pode apagar a sessão nem trocar de tela");

  /* 503 auth_unavailable com o erro da própria tela: um aviso só (o da tela),
     e ele passa a neutro. Negado: o aviso do topo não aparece. */
  var t = navegador("/nexus-v2/missao.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }, { status: 503, corpo: { error: "x", code: "auth_unavailable" } }], SESSAO);
  await new Promise(function (r9) { setTimeout(r9, 5); });
  await t.contexto.NexusApi.listarMissoes();
  var erroDaTela = elemento("div");
  erroDaTela.className = "alerta alerta-falha";
  t.main.appendChild(erroDaTela);
  await new Promise(function (r10) { setTimeout(r10, 400); });
  var topo = t.main.filhos.find(function (f) { return f.id === "aviso-sessao"; });
  if (topo && !topo.hidden) falhas.push("503 com erro na tela: o aviso do topo não pode aparecer (dois avisos)");
  if (erroDaTela.className.indexOf("alerta-falha") !== -1 || erroDaTela.className.indexOf("alerta-neutro") === -1) falhas.push("503 com erro na tela: o erro da tela precisa ficar neutro");
  /* Um segundo 503 (como o do /me) não traz o aviso do topo de volta. */
  t.contexto.nexusAvisoDeSessao(APROVADOS.sessaoIndisponivel);
  await new Promise(function (r12) { setTimeout(r12, 400); });
  var topo2 = t.main.filhos.find(function (f) { return f.id === "aviso-sessao"; });
  if (topo2 && !topo2.hidden) falhas.push("503 repetido com erro na tela: o aviso do topo voltou");

  /* Negado: 503 sem o código (ex.: comunidade sem migração) não mostra o aviso da sessão. */
  var o = navegador("/nexus-v2/missao.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }, { status: 503, corpo: { error: "A comunidade ainda não está disponível." } }], SESSAO);
  await new Promise(function (r4) { setTimeout(r4, 5); });
  var erroComum = elemento("div");
  erroComum.className = "alerta alerta-falha";
  o.main.appendChild(erroComum);
  await o.contexto.NexusApi.listarMissoes();
  await new Promise(function (r11) { setTimeout(r11, 400); });
  if (o.main.filhos.some(function (f) { return f.id === "aviso-sessao"; })) falhas.push("503 sem auth_unavailable não pode mostrar o aviso da sessão");
  if (erroComum.className.indexOf("alerta-falha") === -1) falhas.push("503 sem auth_unavailable não muda o erro da tela");

  /* Reaceitação: /me com needs_acceptance leva à tela de aceite. */
  var p = navegador("/nexus-v2/hoje.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: true } } } }], SESSAO);
  await new Promise(function (r5) { setTimeout(r5, 5); });
  if (p.trocas.indexOf("./index.html?tema=escuro#aceitar-termos") === -1) falhas.push("needs_acceptance no /me não leva à reaceitação");
  if (!p.pedidos[0] || !/\/api\/users\/me$/.test(p.pedidos[0].url)) falhas.push("a conferência do aceite não usa o /me");

  /* Sem pendência: marca na aba e não pede de novo. */
  var q = navegador("/nexus-v2/hoje.html", [{ status: 200, corpo: { user: { legal: { needs_acceptance: false } } } }], SESSAO);
  await new Promise(function (r6) { setTimeout(r6, 5); });
  if (q.trocas.length || q.contexto.sessionStorage.getItem("nexus_v2_aceite_conferido") !== "sim") falhas.push("sem pendência, a tela segue e a aba fica marcada");

  /* Negado: sem sessão, na tela de entrar, ou sem internet, não confere nem troca. */
  var semToken = navegador("/nexus-v2/hoje.html", [], { nexus_v2_tema: "escuro" });
  var naEntrada = navegador("/nexus-v2/index.html", [], SESSAO);
  var naRaiz = navegador("/nexus-v2/", [], SESSAO);
  await new Promise(function (r7) { setTimeout(r7, 5); });
  [semToken, naEntrada, naRaiz].forEach(function (x, k) {
    if (x.pedidos.length || x.trocas.length) falhas.push("a conferência do aceite não deveria rodar (caso " + (k + 1) + ")");
  });
  var falhou = navegador("/nexus-v2/hoje.html", [{ status: 500, corpo: {} }], SESSAO);
  await new Promise(function (r8) { setTimeout(r8, 5); });
  if (falhou.trocas.length) falhas.push("com falha no /me a tela não pode ser trocada");
}

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
  if (veio !== esperado) falhas.push(nome + ": veio " + veio + ", esperado " + esperado);
}

async function casosDoMock() {
  var base = { username: "aceite", email: "aceite@exemplo.com", password: "123456", birth_date: "1995-03-07" };
  var sem = await pedir("POST", "/api/users/register", base);
  igual("cadastro sem aceite", sem.status, 400);
  igual("cadastro sem aceite (código)", sem.dados.code, "legal_acceptance_required");
  var velha = await pedir("POST", "/api/users/register", Object.assign({}, base, { terms_version: "beta-0", privacy_version: "beta-1" }));
  igual("cadastro com versão antiga", velha.status, 400);
  igual("cadastro com versão antiga (código)", velha.dados.code, "legal_version_outdated");
  var ok = await pedir("POST", "/api/users/register", Object.assign({}, base, { terms_version: "beta-1", privacy_version: "beta-1" }));
  igual("cadastro com aceite (nada foi criado antes)", ok.status, 201);
  igual("cadastro com aceite: sem pendência", ok.dados.user && ok.dados.user.legal && ok.dados.user.legal.needs_acceptance, false);

  var r = await pedir("POST", "/api/users/login", { email: "reaceitar@exemplo.com", password: "123456" });
  igual("login sem aceite: pendência", r.dados.user.legal.needs_acceptance, true);
  igual("reaceitar sem login", (await pedir("POST", "/api/users/me/legal-acceptance", { terms_version: "beta-1", privacy_version: "beta-1" })).status, 401);
  igual("reaceitar sem a caixa", (await pedir("POST", "/api/users/me/legal-acceptance", {}, r.dados.token)).dados.code, "legal_acceptance_required");
  igual("reaceitar versão antiga", (await pedir("POST", "/api/users/me/legal-acceptance", { terms_version: "beta-0", privacy_version: "beta-0" }, r.dados.token)).dados.code, "legal_version_outdated");
  var outro = await pedir("POST", "/api/users/login", { email: "aceite-antigo@exemplo.com", password: "123456" });
  igual("outra conta com aceite antigo", outro.dados.user.legal.needs_acceptance, true);
  igual("reaceitar", (await pedir("POST", "/api/users/me/legal-acceptance", { terms_version: "beta-1", privacy_version: "beta-1" }, r.dados.token)).status, 200);
  igual("depois de reaceitar, o /me não pede", (await pedir("GET", "/api/users/me", null, r.dados.token)).dados.user.legal.needs_acceptance, false);
  igual("o aceite de uma conta não vale para outra", (await pedir("GET", "/api/users/me", null, outro.dados.token)).dados.user.legal.needs_acceptance, true);
  var falha = await pedir("POST", "/api/users/login", { email: "aceite-falha@exemplo.com", password: "123456" });
  igual("reaceitar com falha do servidor", (await pedir("POST", "/api/users/me/legal-acceptance", { terms_version: "beta-1", privacy_version: "beta-1" }, falha.dados.token)).status, 500);

  var enc = await pedir("POST", "/api/users/login", { email: "sessao-encerrada@exemplo.com", password: "123456" });
  var encMe = await pedir("GET", "/api/missions", null, enc.dados.token);
  igual("sessão encerrada", encMe.status, 401);
  igual("sessão encerrada (código)", encMe.dados.code, "session_ended");
  var ind = await pedir("POST", "/api/users/login", { email: "sessao-indisponivel@exemplo.com", password: "123456" });
  var indMe = await pedir("GET", "/api/users/me", null, ind.dados.token);
  igual("sessão sem conferir", indMe.status, 503);
  igual("sessão sem conferir (código)", indMe.dados.code, "auth_unavailable");
}

function esperarMock(tentativas) {
  return pedir("GET", "/api/notifications/vapid-key").then(function (r) {
    if (r.status === 200 || tentativas <= 0) return;
    return new Promise(function (ok) { setTimeout(ok, 150); }).then(function () { return esperarMock(tentativas - 1); });
  });
}

(async function () {
  await casosDoNavegador();
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
  console.log("ok: aceite no cadastro, reaceitação, Termos e Privacidade offline, sessão encerrada e casos negados");
})();
