/* Confere as telas da comunidade, 1.ª parte (spec da Clara de 27/11; rotas
   dos PRs 40 a 44 do servidor): lista por área, comunidade por dentro,
   criar comunidade, Meu mérito e ranking, e as portas na Missão e no Hoje.
   1. Textos novos num lugar só (comunidade-textos.js), sem marcas de texto de IA.
   2. Texto de terceiros só por textContent (nada de innerHTML nas telas novas).
   3. Regras de quem posta, rodadas de verdade (pintarPostar num DOM falso),
      com casos negados: a Alimentação não oferece postar; sem missão da área
      não posta; e um mutante (sem a linha da Alimentação) tem de reprovar.
   4. Criar bloqueado sem 30 dias, com «dia N de 30».
   5. Ninguém vê quem apoiou: só o total e o «apoiei».
   6. Mock: casos negados (sem login, Alimentação, sem missão, outra área,
      criar sem 30 dias, crise não grava, cursor inválido).
   Rode na raiz do repositório: node nexus-v2/dev/checar-comunidade-telas.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3098;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}

var NOVAS_JS = ["comunidade-base.js", "comunidade.js", "comunidades.js", "criar-comunidade.js", "merito.js", "titulo-novo.js", "novo-titulo.js"];
var NOVAS_HTML = ["comunidade.html", "comunidades.html", "criar-comunidade.html", "merito.html", "novo-titulo.html"];

/* ---------- Textos ---------- */
var textosFonte = ler("comunidade-textos.js");
function carregarTextos(fonte) {
  var janela = {};
  vm.runInNewContext(fonte, { window: janela });
  return janela.NexusComunidade;
}
var M = carregarTextos(textosFonte);
var inicioNovos = textosFonte.indexOf("NOVOS (telas da comunidade, 1.ª parte");
if (inicioNovos === -1) falhas.push("comunidade-textos.js: falta o bloco dos textos novos");
var blocoNovos = textosFonte.slice(inicioNovos, textosFonte.indexOf("};", inicioNovos));
var chavesNovas = [];
blocoNovos.replace(/\n\s+([a-zA-Z0-9]+): "/g, function (_, k) { chavesNovas.push(k); });
if (chavesNovas.length < 60) falhas.push("poucos textos novos encontrados (" + chavesNovas.length + ")");

/* Frases já aprovadas pelo dono do projeto (decisões de 27/11 e servidor). */
var APROVADOS = {
  criada: "Você criou esta comunidade. Denúncias vão para a equipe do Nexus.",
  rolarSozinha: "Registre o dia para a lista rolar sozinha.",
  maisCursor: "Não deu para carregar mais posts. Abra a comunidade de novo.",
  apoioProprio: "Você não pode apoiar o seu próprio post.",
  meritoErro: "Não deu para abrir o mérito agora. Tente de novo daqui a pouco.",
  criarBloqueado: "Criar uma comunidade abre depois que você concluir uma missão de 30 dias.",
  regraMerito: "Vale o número de missões. No empate, o tempo na comunidade.",
  criarDia: "Sua missão: dia {n} de 30."
};
Object.keys(APROVADOS).forEach(function (k) {
  if (M.TEXTOS[k] !== APROVADOS[k]) falhas.push("texto «" + k + "» diferente do aprovado");
});
/* Revisão da Clara: o aviso de só leitura é do site, não o do servidor. */
if (M.TEXTOS.soLeitura !== "Aqui, por enquanto, só dá para ler.") falhas.push("o aviso de só leitura é «Aqui, por enquanto, só dá para ler.»");
var TITULOS_APROVADOS = [["Iniciante", 1, 1], ["Praticante", 3, 2], ["Constante", 6, 3], ["Veterano", 12, 4], ["Referência", 24, 5]];
if (JSON.stringify(M.TITULOS.map(function (t) { return [t.nome, t.min, t.nivel]; })) !== JSON.stringify(TITULOS_APROVADOS)) falhas.push("os títulos (opção A) mudaram");

/* Sinais de texto de IA nos textos novos. */
function sinaisDeIa(valor) {
  var erros = [];
  if (/·|→|!/.test(valor)) erros.push("«·», «→» ou «!»");
  if (/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(valor)) erros.push("emoji");
  if (/\b(incrível|jornada|vibrante|Parabéns|Claro)\b/i.test(valor)) erros.push("palavra de anúncio");
  if (/não é só|mais do que/i.test(valor)) erros.push("fórmula «não é só X»");
  return erros;
}
chavesNovas.forEach(function (k) {
  sinaisDeIa(M.TEXTOS[k]).forEach(function (e) { falhas.push("texto «" + k + "» com " + e); });
});
if (!sinaisDeIa("Apoiar · 24").length || !sinaisDeIa("Bem-vindo!").length || !sinaisDeIa("Sua jornada").length) falhas.push("caso negado: a conferência de sinais de IA não reprova");

/* Num lugar só: frases novas com 16+ letras não se repetem em outra tela. */
var outros = fs.readdirSync(raiz).filter(function (n) { return /\.(js|html)$/.test(n) && n !== "comunidade-textos.js"; });
var conteudos = {};
outros.forEach(function (n) { conteudos[n] = semComentarios(ler(n)); });
chavesNovas.forEach(function (k) {
  var frase = M.TEXTOS[k];
  if (frase.length < 16 || /\{/.test(frase) || frase === "Começar uma missão") return;
  outros.forEach(function (n) {
    if (conteudos[n].indexOf('"' + frase + '"') !== -1 || conteudos[n].indexOf(">" + frase + "<") !== -1) falhas.push("«" + frase + "» repetida em " + n);
  });
});

/* Ajudantes: plurais, tempo e símbolo. */
var agora = new Date("2026-11-27T12:00:00Z");
[
  [M.contarPessoas(1), "1 pessoa"], [M.contarPessoas(42), "42 pessoas"], [M.contarPessoas(0), "0 pessoas"],
  [M.contarApoios(1), "1 apoio"], [M.contarApoios(24), "24 apoios"],
  [M.contarMissoes(1), "1 missão"], [M.contarMissoes(6), "6 missões"],
  [M.tempoCurto("2026-11-27T11:59:40Z", agora), "agora"], [M.tempoCurto("2026-11-27T11:48:00Z", agora), "12 min"],
  [M.tempoCurto("2026-11-27T09:00:00Z", agora), "3 h"], [M.tempoCurto("2026-11-25T11:00:00Z", agora), "2 d"],
  [M.tempoNaComunidade(0), "entrou hoje"], [M.tempoNaComunidade(1), "1 dia"], [M.tempoNaComunidade(45), "1 mês"],
  [M.tempoNaComunidade(240), "8 meses"], [M.tempoNaComunidade(1100), "3 anos"],
  [M.linhaDoProximo({ name: "Constante", missions: 6, missing: 3 }), "Próximo: Constante, com 6 missões. Faltam\u00A03."],
  [M.linhaDoProximo({ name: "Praticante", missions: 3, missing: 1 }), "Próximo: Praticante, com 3 missões. Falta\u00A01."],
  [M.linhaDoProximo(null), "Este é o último título."],
  [M.nomeDaArea("corpo"), "Corpo"], [M.nomeDaArea("outra"), ""],
  [M.iconeValido("📚"), true], [M.iconeValido("livro"), false], [M.iconeValido("📚x"), false], [M.iconeValido(""), false]
].forEach(function (par, i) {
  if (par[0] !== par[1]) falhas.push("ajudante " + i + ": veio «" + par[0] + "», esperado «" + par[1] + "»");
});

/* ---------- Telas: estrutura e segurança ---------- */
NOVAS_JS.forEach(function (n) {
  var js = semComentarios(ler(n));
  if (/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(js)) falhas.push(n + ": texto só por textContent (achei innerHTML ou parecido)");
  if (/\.supporters|supported_by\b|\.voters|who_supported/.test(js)) falhas.push(n + ": não se mostra quem apoiou");
});
NOVAS_HTML.forEach(function (n) {
  var html = ler(n);
  if (!/<html lang="pt-BR">/.test(html)) falhas.push(n + " sem lang=pt-BR");
  if (!/localStorage\.getItem\("nexus_v2_token"\)[\s\S]*location\.replace\("\.\/"/.test(html)) falhas.push(n + ": sem login, vai para a entrada");
  if (/fonts\.googleapis|gstatic/.test(html)) falhas.push(n + " pede fonte de fora");
  if (!/<nav class="abas" id="abas"/.test(html)) falhas.push(n + ": falta a barra de abas");
  if (/«[^»]*·|→/.test(semComentarios(html))) falhas.push(n + ": «·» ou «→» no texto");
});
var base = ler("comunidade-base.js");
if (!/window\.NEXUS_CENARIO = hostDeDesenvolvimento\(\) \? parametro\("cenario"\) : "";/.test(base)) falhas.push("comunidade-base.js: ?cenario= só em localhost");
if (!/var rede = hostDeDesenvolvimento\(\) \? parametro\("rede"\) : "";/.test(base)) falhas.push("comunidade-base.js: ?rede=off só em localhost");
["comunidades.js", "criar-comunidade.js", "merito.js"].forEach(function (n) {
  if (ler(n).indexOf("B.iniciarCenario();") === -1) falhas.push(n + ": ?cenario= tem de passar pelo filtro de localhost");
});

var comHtml = ler("comunidade.html");
var comJs = semComentarios(ler("comunidade.js"));
if (!/<textarea id="texto-post"[^>]*maxlength="280"/.test(comHtml)) falhas.push("postar: limite de 280");
if (comHtml.indexOf('<p class="contador" id="post-contador">0 de 280</p>') === -1) falhas.push("postar: falta o contador «0 de 280»");
if (comJs.indexOf('window.NexusNota.ligar("texto-post", "post-contador", "post-aviso")') === -1) falhas.push("postar: o contador é o mesmo do chat e do check-in");
if (!/botao\.disabled = ligado;\s*botao\.setAttribute\("aria-busy"/.test(comJs)) falhas.push("postar: botão desligado durante o envio");
if (!/<div id="alerta-post" class="alerta" role="alert"/.test(comHtml)) falhas.push("postar: erro com role=alert");
if (!/resultado\.ok && dados\.crisis === true\) \{\s*campo\.value = "";\s*atualizarContadorPost\(\);\s*B\.abrirAjuda\(\);/.test(comJs)) falhas.push("postar com crise: campo vazio e a ajuda abre");
if (!/resultado\.status === 429\) return mostrarAviso\(alerta, "falha", T\.postLimite\)/.test(comJs)) falhas.push("postar: limite de 3 com a frase da spec");
if (!/id="btn-anteriores"/.test(comHtml) || !/new IntersectionObserver/.test(comJs)) falhas.push("lista: «Ver anteriores» e a rolagem sozinha");
if (!/rolagemContinua = pagina\.dados\.continuous_scroll === true/.test(comJs)) falhas.push("a rolagem sozinha vem do servidor (continuous_scroll), nunca do aparelho");
if (!/aria-pressed/.test(comJs)) falhas.push("«Apoiar» liga e desliga com aria-pressed");
if (M.preencher(M.TEXTOS.apoiarRotulo, { apoios: M.contarApoios(24) }) !== "Apoiar, 24 apoios" || !/botao\.setAttribute\("aria-label", C\.preencher\(T\.apoiarRotulo/.test(comJs)) falhas.push("o nome do botão é «Apoiar, 24 apoios»");
/* Revisão do Argos + ajuste baixo do Orfeu: «Você» só por is_mine, sem
   apelido e sem user_id (a resposta da API não traz mais id de ninguém). */
var ehMeuFonte = comJs.slice(comJs.indexOf("function ehMeu("), comJs.indexOf("}", comJs.indexOf("function ehMeu(")) + 1);
if (!ehMeuFonte || /username|meuNome|user_id|meuId/.test(ehMeuFonte) || !/is_mine === true/.test(ehMeuFonte)) falhas.push("ehMeu: só is_mine, sem apelido nem id");
if (/var meuId|meuId =/.test(comJs)) falhas.push("comunidade.js não guarda mais o id do /me");
if (/nexus_v2_user/.test(comJs)) falhas.push("comunidade.js não lê o apelido guardado no aparelho");
/* Revisão da Clara: destaque só com 3 apoios ou mais, sem repetir em Recentes. */
if (!/var MINIMO_DESTAQUE = 3;/.test(comJs) || !/\(Number\(post\.supports\) \|\| 0\) < MINIMO_DESTAQUE\) return;/.test(comJs)) falhas.push("destaque só com 3 apoios ou mais");
if (!/if \(emDestaque\[String\(post\.id\)\]\) return;/.test(comJs)) falhas.push("o post em destaque não se repete em Recentes");
if (!/caixa\.classList\.toggle\("motivo-texto", soLeitura\)/.test(comJs)) falhas.push("só leitura: texto com divisória, sem caixa");
if (/role="tab"[\s\S]*abas|ABAS\.push/.test(comJs)) falhas.push("nada de aba falsa dentro da comunidade");
var abas = ler("abas.js");
if ((abas.match(/href: "[a-z-]+\.html"/g) || []).length !== 4) falhas.push("a barra precisa ter 4 abas");

var criarJs = semComentarios(ler("criar-comunidade.js"));
var criarHtml = ler("criar-comunidade.html");
if (!/if \(missoes < 1\) return abrirBloqueado\(/.test(criarJs)) falhas.push("criar: sem missão de 30 dias concluída, a tela fica bloqueada");
if (!/resposta\.code === "needs_completed_mission"/.test(criarJs)) falhas.push("criar: o 403 do servidor também bloqueia");
if (!/resultado\.ok && resposta\.crisis === true\) \{\s*apagarCampos\(\);\s*B\.abrirAjuda\(\);/.test(criarJs)) falhas.push("criar com crise: campos vazios e a ajuda abre");
if (!/maxlength="40"/.test(criarHtml) || !/maxlength="30"/.test(criarHtml) || !/maxlength="200"/.test(criarHtml)) falhas.push("criar: limites 40, 30 e 200");
if (!/id="campo-icone"[^>]*maxlength="8"/.test(criarHtml)) falhas.push("criar: ícone curto (só emoji)");
if (/sessionStorage|localStorage\.setItem/.test(criarJs + comJs)) falhas.push("rascunho de post ou de comunidade não fica guardado");
if (!/data-texto-comunidade="criada"/.test(criarHtml)) falhas.push("criar: a frase de quem criou");

var merJs = semComentarios(ler("merito.js"));
if (!/dados\.top/.test(merJs) || !/dados\.me/.test(merJs)) falhas.push("ranking: os 3 primeiros + a sua posição");
if (/coroa|crown|medalha|trof/i.test(merJs + ler("merito.html"))) falhas.push("mérito sem coroa, medalha ou troféu");

/* Saída da comunidade (fila do beta, item 3): link de texto no fim do feed,
   só para quem participa; confirmação curta com o foco em «Agora não».
   Sem luz nova, sem culpa e sem mexer nos posts de ninguém. */
if (!/id="link-sair"[^>]*data-texto-comunidade="sairDaComunidade" hidden/.test(comHtml)) falhas.push("saída: falta o link de texto no fim do feed, escondido de início");
if (!/id="dialogo-sair"[\s\S]*?id="titulo-dialogo-sair"[\s\S]*?data-texto-comunidade="sairTitulo"/.test(comHtml)) falhas.push("saída: falta a confirmação com título curto");
if (!/id="btn-sair-confirmar"[^>]*data-texto-comunidade="sairConfirmar"/.test(comHtml) || !/id="btn-sair-agora-nao"[^>]*data-texto-comunidade="agoraNao"/.test(comHtml)) falhas.push("saída: faltam «Sair» e «Agora não»");
if (!/btn-sair-agora-nao"\)\.focus\(\)/.test(comJs)) falhas.push("saída: o foco começa em «Agora não»");
if (!/pintarSaida\(souMembro\)/.test(comJs)) falhas.push("saída: o link só aparece para quem participa");
if (!/NexusApi\.sairDaComunidade\(slugAtual\)/.test(comJs)) falhas.push("saída: falta a chamada da API");
if (!/location\.assign\("comunidades\.html" \+ busca\(\)\)/.test(comJs)) falhas.push("saída: volta para a lista ao sair");
if (!/metodo: "DELETE", auth: true/.test(ler("api.js"))) falhas.push("saída: a chamada da API precisa ser DELETE com auth");
if (!/sairDaComunidade: function \(slug\)/.test(ler("api.js"))) falhas.push("api.js: falta sairDaComunidade");
var cssSaida = semComentarios(ler("comunidade.css"));
if (!/\.dialogo-sair \.botoes \{[\s\S]*?display: flex;[\s\S]*?gap: var\(--space-3\)/.test(cssSaida)) falhas.push("saída: «Sair» e «Agora não» precisam ficar lado a lado em 390 px");
if (!/\.dialogo-sair \.botoes \.btn \{[\s\S]*?flex: 1 1 0;[\s\S]*?min-height: var\(--target\)/.test(cssSaida)) falhas.push("saída: os dois botões precisam da mesma largura e 44 px");
if (!/@media \(max-width: 320px\) \{[\s\S]*?\.dialogo-sair \{[\s\S]*?padding-bottom: calc\(16px \+ var\(--safe-bottom\)\)[\s\S]*?\.dialogo-sair \.botoes \{[\s\S]*?flex-direction: column;[\s\S]*?gap: 12px/.test(cssSaida)) falhas.push("saída: a 200% os botões empilham com 12 px e a folha termina com 16 px");
if (/community_slug: "[^"]+", user_id:/.test(ler("dev/mock-api.js"))) falhas.push("mock: a lista do admin ainda mostra user_id");

/* As portas antigas saem: a comunidade é a 3.ª aba, sem linha nem atalho. */
if (/id="linha-comunidades"|linha-comunidades/.test(ler("missao.html") + ler("missao.css"))) falhas.push("Missão: a linha «Comunidades» precisa sair");
if (/link-comunidades|pintarAtalhoComunidades/.test(ler("hoje.html") + ler("hoje.js"))) falhas.push("Hoje: o atalho da comunidade precisa sair");
if (!/<a class="linha-seta" id="link-meu-merito" href="merito\.html">/.test(ler("comunidades.html"))) falhas.push("lista: falta a linha «Meu mérito» no fim");

/* CSS sóbrio. */
var css = ler("comunidade.css");
if (/border-left:\s*[2-9]/.test(css)) falhas.push("comunidade.css: sem barra colorida à esquerda (sinal de IA)");
if (/var\(--(grad|glow-[a-z0-9]+|neon-[a-z]+)\)|#2DF2D0|#3DD8FF/i.test(css)) falhas.push("comunidade.css: o símbolo do título e os apoios ficam planos");

/* Cache. */
var sw = ler("sw.js");
if (sw.indexOf('CACHE = "nexus-v2-v54"') === -1) falhas.push("o cache não está em nexus-v2-v54");
NOVAS_JS.concat(NOVAS_HTML).forEach(function (n) {
  if (sw.indexOf('"./' + n + '"') === -1) falhas.push("sw.js sem " + n);
});

/* ---------- Quem pode postar: pintarPostar de verdade, num DOM falso ---------- */
function trecho(fonte, nome) {
  var i = fonte.indexOf("function " + nome + "(");
  if (i === -1) return "";
  var fim = fonte.indexOf("\n}\n", i);
  return fonte.slice(i, fim + 2);
}
function rodarPostar(fonteJs, comunidade, acesso, missao) {
  var els = {};
  ["form-post", "caixa-motivo", "motivo-post", "caminho-post"].forEach(function (id) {
    els[id] = { hidden: true, textContent: "", href: "" };
  });
  var caixa = {
    document: { getElementById: function (id) { return els[id]; } },
    C: M, T: M.TEXTOS,
    B: { link: function (p, extras) { return p + (extras && extras.area ? "?area=" + extras.area : ""); } },
    comunidadeAtual: comunidade,
    soLeitura: acesso.post_code === "read_only"
  };
  vm.runInNewContext([trecho(fonteJs, "areaDaComunidade"), trecho(fonteJs, "mostrarMotivo"), trecho(fonteJs, "pintarPostar"),
    "pintarPostar(acesso, missao);"].join("\n"), Object.assign(caixa, { acesso: acesso, missao: missao }));
  return { podePostar: els["form-post"].hidden === false, motivo: els["motivo-post"].textContent, caminho: els["caminho-post"].hidden ? "" : els["caminho-post"].textContent, href: els["caminho-post"].href };
}
function casosDePostar(fonteJs) {
  var erros = [];
  var mente = { slug: "leitura", area: "mente" };
  var alimentacao = { slug: "alimentacao", area: "corpo" };
  var r;
  try {
    /* Negado: a Alimentação não oferece postar, nem se o acesso disser que pode. */
    r = rodarPostar(fonteJs, alimentacao, { post_code: "read_only", can_post_forum: true }, { area: "corpo" });
    if (r.podePostar) erros.push("a Alimentação ofereceu postar");
    if (r.motivo !== M.TEXTOS.soLeitura) erros.push("a Alimentação precisa de «Os posts aqui abrem em breve»");
    /* Negado: sem missão da área, não posta (e vê o caminho). */
    r = rodarPostar(fonteJs, mente, { post_code: "no_active_mission", can_post_forum: false }, null);
    if (r.podePostar) erros.push("sem missão, ofereceu postar");
    if (r.motivo !== "Para postar aqui você precisa de uma missão ativa em Mente." || r.caminho !== "Começar uma missão de Mente") erros.push("sem missão: motivo e caminho errados («" + r.motivo + "» / «" + r.caminho + "»)");
    r = rodarPostar(fonteJs, mente, { post_code: "other_area", can_post_forum: false }, { area: "corpo" });
    if (r.podePostar) erros.push("outra área ofereceu postar");
    if (r.motivo !== "Sua missão ativa é de Corpo. Esta comunidade é de Mente." || r.href !== "comunidades.html?area=corpo") erros.push("outra área: motivo ou caminho errado");
    r = rodarPostar(fonteJs, mente, { post_code: "not_member", can_post_forum: false }, { area: "mente" });
    if (r.podePostar || r.motivo !== M.TEXTOS.paraPostarEntre) erros.push("quem não é membro: entra primeiro");
    r = rodarPostar(fonteJs, mente, { post_code: "community_without_area", can_post_forum: false, post_requirement: "Esta comunidade ainda não está aberta para posts." }, { area: "mente" });
    if (r.podePostar || r.motivo !== "Esta comunidade ainda não está aberta para posts.") erros.push("motivo desconhecido: a frase do servidor");
    r = rodarPostar(fonteJs, mente, { post_code: "ok", can_post_forum: true }, { area: "mente" });
    if (!r.podePostar || r.motivo) erros.push("com missão de Mente e membro, posta");
  } catch (e) {
    erros.push("não deu para rodar pintarPostar: " + e.message);
  }
  return erros;
}
var fonteComunidade = ler("comunidade.js");
falhas = falhas.concat(casosDePostar(fonteComunidade));
var mutante = fonteComunidade.replace("if (soLeitura) return mostrarMotivo(T.soLeitura, \"\", \"\");", "");
if (mutante === fonteComunidade) falhas.push("caso negado não mudou nada (ajuste a checagem): sem a linha da Alimentação");
else if (!casosDePostar(mutante).length) falhas.push("caso negado não reprovou: sem a linha da Alimentação");

/* «dia N de 30» (o mesmo cálculo do Hoje). */
var janela = { NexusComunidade: M };
vm.runInNewContext(ler("comunidade-base.js"), { window: janela, location: { hostname: "x", search: "" }, navigator: {}, URLSearchParams: URLSearchParams, document: {} });
var BB = janela.NexusComBase;
var hoje = new Date("2026-11-27T12:00:00Z");
[
  [{ started_at: "2026-11-16T10:00:00Z" }, 12], [{ started_at: "2026-11-27T11:00:00Z" }, 1],
  [{ started_at: "2026-09-01T10:00:00Z" }, 30], [{ started_at: "lixo" }, 0], [null, 0]
].forEach(function (par) {
  var veio = BB.diaDaMissao(par[0], hoje);
  if (veio !== par[1]) falhas.push("dia da missão: veio " + veio + ", esperado " + par[1]);
});
if (BB.missaoAtiva([{ id: 1, status: "completed" }, { id: 2, status: "active" }]).id !== 2 || BB.missaoAtiva([]) !== null) falhas.push("missão ativa errada");

/* ---------- Mock: casos negados ---------- */
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
        resolve({ status: res.statusCode, json: json, bruto: bruto });
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
async function entrar(email) {
  return (await pedir("POST", "/api/users/login", { email: email, password: "123456" })).json.token;
}
function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + veio + ", esperado " + esperado);
}
/* A resposta da comunidade não traz id de pessoa: só o servidor marca is_mine. */
function semId(nome, json) {
  var ruim = [];
  (function andar(v) {
    if (Array.isArray(v)) return v.forEach(andar);
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
      if (/^(user_id|author_id|reporter_id)$/.test(k)) ruim.push(k);
      andar(v[k]);
    });
  })(json);
  if (ruim.length) falhas.push(nome + ": resposta com id de pessoa (" + ruim.join(", ") + ")");
}
/* Nenhuma chave de quem apoiou em lugar nenhum da resposta. */
function semQuemApoiou(nome, json) {
  var ruim = [];
  (function andar(v) {
    if (Array.isArray(v)) return v.forEach(andar);
    if (v && typeof v === "object") Object.keys(v).forEach(function (k) {
      if (/support/i.test(k) && ["supports", "supported_by_me", "supported", "week_supports"].indexOf(k) === -1) ruim.push(k);
      andar(v[k]);
    });
  })(json);
  if (ruim.length) falhas.push(nome + ": resposta com quem apoiou (" + ruim.join(", ") + ")");
}

async function casosDoMock() {
  for (var c of ["/api/communities", "/api/communities/leitura/posts", "/api/communities/leitura/highlights", "/api/communities/merit/me", "/api/communities/leitura/ranking"]) {
    igual("sem login " + c, (await pedir("GET", c)).status, 401);
  }
  igual("publicar sem login", (await pedir("POST", "/api/communities/leitura/posts", { content: "oi" })).status, 401);
  igual("apoiar sem login", (await pedir("POST", "/api/communities/leitura/posts/61/support")).status, 401);
  igual("criar sem login", (await pedir("POST", "/api/communities", { name: "X", area: "mente" })).status, 401);

  var pessoa = await entrar("com-missao@exemplo.com");
  var r = await pedir("GET", "/api/communities/alimentacao", null, pessoa);
  igual("Alimentação: não oferece postar", r.json.access && r.json.access.can_post_forum, false);
  igual("Alimentação: só leitura", r.json.access && r.json.access.post_code, "read_only");
  igual("entrar na Alimentação", (await pedir("POST", "/api/communities/alimentacao/join", null, pessoa)).json.success, true);
  igual("Alimentação: postar dá 403 mesmo com missão de Corpo", (await pedir("POST", "/api/communities/alimentacao/posts?cenario=outra-area", { content: "dica" }, pessoa)).json.code, "read_only");
  igual("Alimentação: apoiar dá 403", (await pedir("POST", "/api/communities/alimentacao/posts/50/support", null, pessoa)).status, 403);

  r = await pedir("POST", "/api/communities/leitura/posts?cenario=sem-missao", { content: "dica" }, pessoa);
  igual("sem missão: não posta", r.status, 403);
  igual("sem missão: o código", r.json.code, "no_active_mission");
  r = await pedir("POST", "/api/communities/leitura/posts?cenario=outra-area", { content: "dica" }, pessoa);
  igual("outra área: não posta", r.json.code, "other_area");
  igual("sem missão: a página diz o motivo", (await pedir("GET", "/api/communities/leitura?cenario=sem-missao", null, pessoa)).json.access.can_post_forum, false);

  r = await pedir("POST", "/api/communities/leitura/posts?cenario=post-crise", { content: "texto de teste" }, pessoa);
  igual("crise: abre a ajuda", r.json.crisis, true);
  var lista = await pedir("GET", "/api/communities/leitura/posts", null, pessoa);
  igual("crise: nada foi gravado", lista.bruto.indexOf("texto de teste") === -1, true);
  igual("lista: 10 por vez antes do dia cumprido", (lista.json.posts || []).length, 10);
  igual("lista: sem rolagem sozinha", lista.json.continuous_scroll, false);
  igual("lista: com o dia cumprido, 20", ((await pedir("GET", "/api/communities/leitura/posts?cenario=dia-cumprido", null, pessoa)).json.posts || []).length, 20);
  igual("lista: cursor inválido", (await pedir("GET", "/api/communities/leitura/posts?cursor=nada", null, pessoa)).status, 400);
  var segunda = await pedir("GET", "/api/communities/leitura/posts?cursor=" + encodeURIComponent(lista.json.next_cursor), null, pessoa);
  igual("lista: a 2.ª página não repete a 1.ª", (segunda.json.posts || []).some(function (p) { return (lista.json.posts || []).some(function (q) { return q.id === p.id; }); }), false);
  semQuemApoiou("lista", lista.json);
  semId("lista", lista.json);
  semId("destaques", (await pedir("GET", "/api/communities/leitura/highlights", null, pessoa)).json);

  igual("apoiar o próprio post", (await pedir("POST", "/api/communities/leitura/posts/50/support", null, pessoa)).json.code, "own_post");
  r = await pedir("POST", "/api/communities/leitura/posts/62/support", null, pessoa);
  igual("apoiar", r.status, 201);
  semQuemApoiou("apoiar", r.json);
  igual("apoiar de novo", (await pedir("POST", "/api/communities/leitura/posts/62/support", null, pessoa)).status, 409);
  igual("tirar o apoio", (await pedir("DELETE", "/api/communities/leitura/posts/62/support", null, pessoa)).json.supported, false);

  /* Saída da comunidade: só a própria pessoa, dona não sai, posts ficam. */
  igual("saída sem login", (await pedir("DELETE", "/api/communities/leitura/members/me")).status, 401);
  igual("saída da responsável: 409", (await pedir("DELETE", "/api/communities/leitura/members/me?cenario=sair-dono", null, pessoa)).json.code, "owner");
  igual("saída de quem não participa: 403", (await pedir("DELETE", "/api/communities/leitura/members/me?cenario=nao-membro", null, pessoa)).json.code, "not_member");
  igual("saída com erro: 503/500 calmo", (await pedir("DELETE", "/api/communities/leitura/members/me?cenario=sair-erro", null, pessoa)).status, 500);
  r = await pedir("DELETE", "/api/communities/leitura/members/me", null, pessoa);
  igual("saída", r.json.left, true);
  igual("saída de novo: 403", (await pedir("DELETE", "/api/communities/leitura/members/me", null, pessoa)).json.code, "not_member");
  igual("saída não apaga os posts", (await pedir("GET", "/api/communities/leitura/posts", null, pessoa)).json.posts.some(function (p) { return p.id === 50; }), true);

  r = await pedir("POST", "/api/communities", { name: "Filosofia", area: "mente" }, pessoa);
  igual("criar sem 30 dias", r.status, 403);
  igual("criar sem 30 dias: o código", r.json.code, "needs_completed_mission");
  igual("criar: ícone que não é emoji", (await pedir("POST", "/api/communities?cenario=com-merito", { name: "Filosofia", area: "mente", icon: "livro" }, pessoa)).json.code, "invalid_icon");
  igual("criar: nome repetido", (await pedir("POST", "/api/communities?cenario=com-merito", { name: "Leitura", area: "mente" }, pessoa)).status, 409);
  igual("criar: crise não cria", (await pedir("POST", "/api/communities?cenario=criar-crise", { name: "Teste crise", area: "mente" }, pessoa)).json.crisis, true);
  igual("criar: a da crise não existe", (await pedir("GET", "/api/communities/teste-crise", null, pessoa)).status, 404);
  igual("criar com 30 dias", (await pedir("POST", "/api/communities?cenario=com-merito", { name: "Filosofia", area: "mente", icon: "📚" }, pessoa)).status, 201);

  var ranking = await pedir("GET", "/api/communities/leitura/ranking?cenario=com-merito", null, pessoa);
  igual("ranking: 3 primeiros", (ranking.json.top || []).length, 3);
  igual("ranking: a minha posição", ranking.json.me && ranking.json.me.is_me, true);
  igual("ranking: sem missão concluída, fora", (await pedir("GET", "/api/communities/leitura/ranking", null, pessoa)).json.me, null);

  var semIdade = await entrar("sem-idade@exemplo.com");
  igual("sem 18+: lista", (await pedir("GET", "/api/communities", null, semIdade)).status, 403);
  igual("sem 18+: mérito", (await pedir("GET", "/api/communities/merit/me", null, semIdade)).status, 403);
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
  console.log("ok: lista por área, comunidade por dentro, criar, mérito e ranking, portas na Missão e no Hoje, e casos negados (Alimentação, sem missão da área, criar sem 30 dias, quem apoiou)");
});
