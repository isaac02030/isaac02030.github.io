/* Confere idade no cadastro, comunidade, denúncia, post escondido e área da equipe.
   1. Textos iguais aos aprovados, num lugar só (comunidade-textos.js), com os
      ajustes decididos: «Obrigado por avisar»; sem caixa de 18+ para conta
      antiga; o aviso ao autor nunca mostra quantas denúncias houve.
   2. Cadastro: três campos de texto (não type=date) e birth_date AAAA-MM-DD.
   3. Visual calmo: sem urso, sem sombra, sem gradiente, sem animação, sem
      vermelho em fundo cheio; --danger só em «Apagar».
   4. A área da equipe nunca mostra quem denunciou nem o autor.
   5. Sobe o mock local e prova os casos negados: sem login, menor de 18,
      data inválida, 503, denúncia repetida, próprio post, quem não é admin,
      sem 18+ confirmado.
   Rode na raiz do repositório: node nexus-v2/dev/checar-comunidade.js */

var fs = require("fs");
var http = require("http");
var path = require("path");
var vm = require("vm");
var spawn = require("child_process").spawn;

var PORTA = 3097;
var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}

function semComentarios(texto) {
  return texto
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'])\/\/.*$/gm, "$1");
}

/* ---------- 1. Textos aprovados ---------- */

var APROVADOS = {
  dataLegenda: "Data de nascimento",
  dataDia: "Dia",
  dataMes: "Mês",
  dataAno: "Ano",
  dataAjuda: "O Nexus é para maiores de 18 anos. A data serve só para conferir isso e não fica guardada.",
  dataErro: "Confira a data. Exemplo: 07 / 03 / 1995.",
  menorTitulo: "Ainda não dá para criar sua conta",
  menorTexto: "O Nexus é para maiores de 18 anos. Nada foi guardado. Você pode voltar quando fizer 18.",
  menorVoltar: "Voltar ao início",
  cadastroIndisponivel: "Não foi possível criar a conta agora. Tente mais tarde.",
  idadeTitulo: "Antes de entrar na comunidade",
  idadeAviso: "Sua conta ainda não tem a confirmação de idade. Crie a conta com a data de nascimento para usar a comunidade.",
  agoraNao: "Agora não",
  denunciar: "Denunciar",
  denunciaTitulo: "Por que você quer denunciar?",
  explicarRotulo: "Quer explicar?",
  explicarOpcional: "(opcional)",
  enviarDenuncia: "Enviar denúncia",
  cancelar: "Cancelar",
  denunciaOk: "Recebemos sua denúncia. Obrigado por avisar.",
  denunciaRepetida: "Você já denunciou este post.",
  denunciaErro: "Não foi possível enviar. Tente de novo.",
  denunciaSemRede: "Sem internet. A denúncia não foi enviada.",
  denunciaIndisponivel: "Não foi possível enviar agora. Tente mais tarde.",
  denunciaCrise: "Sua denúncia foi recebida. Se você está passando por um momento difícil, há quem possa ajudar agora.",
  escondidoTitulo: "Este post está escondido por enquanto.",
  escondidoMotivo: "Motivo mais citado: {motivo}",
  escondidoEquipe: "Uma pessoa da equipe vai conferir. Ninguém além de você vê este post.",
  soEquipe: "Esta área é só da equipe.",
  prioridadeAlta: "Perigoso, conferir primeiro",
  alertaRepetido: "Atenção: quem escondeu este post escondeu vários hoje. Confira se a denúncia é justa.",
  restaurar: "Restaurar",
  apagar: "Apagar",
  apagarTitulo: "Apagar este post para sempre?",
  apagarCorpo: "Isso não dá para desfazer.",
  /* Revisão da Clara (22/11): título curto + corpo, sem «feed». Novos, esperam o sim. */
  restaurarTitulo: "Restaurar este post?",
  restaurarCorpo: "Ele volta para a comunidade. Só denúncias novas poderão escondê-lo de novo.",
  feedFechado: "Você ainda não pode ver os posts desta comunidade.",
  voce: "Você",
  adminVazio: "Nenhum post escondido agora.",
  indisponivel: "Esta parte ainda não está disponível. Tente mais tarde.",
  tentarDeNovo: "Tentar de novo"
};

var MOTIVOS_APROVADOS = [
  ["perigoso", "Conselho perigoso para a saúde", "conselho perigoso para a saúde"],
  ["ofensa", "Ofensa ou desrespeito", "ofensa"],
  ["improprio", "Conteúdo impróprio (sexual ou violento)", "conteúdo impróprio"],
  ["spam", "Spam", "spam"],
  ["outro", "Outro motivo", "outro motivo"]
];

function carregarTextos(fonte) {
  var janela = {};
  vm.runInNewContext(fonte, { window: janela });
  return janela.NexusComunidade;
}

function conferirTextos(fonte) {
  var erros = [];
  var M;
  try {
    M = carregarTextos(fonte);
  } catch (erro) {
    return ["comunidade-textos.js não carrega"];
  }
  if (!M || !M.TEXTOS) return ["comunidade-textos.js não expõe NexusComunidade.TEXTOS"];
  Object.keys(APROVADOS).forEach(function (chave) {
    if (M.TEXTOS[chave] !== APROVADOS[chave]) erros.push("texto «" + chave + "» diferente do aprovado: «" + M.TEXTOS[chave] + "»");
  });
  var motivos = (M.MOTIVOS || []).map(function (m) { return [m.codigo, m.rotulo, m.autor]; });
  if (JSON.stringify(motivos) !== JSON.stringify(MOTIVOS_APROVADOS)) erros.push("os 5 motivos (código, rótulo, frase ao autor) mudaram");
  if (/Obrigada/.test(fonte)) erros.push("«Obrigada» voltou (o decidido é «Obrigado por avisar»)");
  /* Sem caixa de 18+ para conta antiga. */
  if (/Tenho 18 anos ou mais|Confirmar e entrar/.test(fonte)) erros.push("voltou a caixa de 18+ (decidido: só o aviso)");
  /* O aviso ao autor nunca diz quantas denúncias houve. */
  if (/\{(n|total|quantas|contagem)\}/.test(fonte)) erros.push("um texto da comunidade tem lugar para número de denúncias");
  if (/\bfeed\b|adminDenuncias/.test(fonte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/feed(Vazio|Fechado)/g, ""))) erros.push("«feed» ou o rótulo solto «Denúncias» voltou");
  return erros;
}

var textosFonte = ler("comunidade-textos.js");
falhas = falhas.concat(conferirTextos(textosFonte));

/* Casos negados da conferência de textos. */
[
  ["Obrigada", textosFonte.replace("Obrigado por avisar", "Obrigada por avisar")],
  ["motivo trocado", textosFonte.replace('rotulo: "Spam"', 'rotulo: "Propaganda"')],
  ["caixa de 18+", textosFonte.replace('agoraNao: "Agora não",', 'agoraNao: "Agora não",\n    caixa: "Tenho 18 anos ou mais",')],
  ["contagem no aviso", textosFonte.replace("Motivo mais citado: {motivo}", "Motivo mais citado: {motivo} ({n} denúncias)")]
].forEach(function (caso) {
  if (caso[1] === textosFonte) falhas.push("caso negado não mudou nada (ajuste a checagem): " + caso[0]);
  else if (!conferirTextos(caso[1]).length) falhas.push("caso negado não reprovou: " + caso[0]);
});

/* Num lugar só: nenhuma outra tela repete as frases aprovadas. */
var outros = fs.readdirSync(raiz).filter(function (nome) {
  return /\.(js|html)$/.test(nome) && nome !== "comunidade-textos.js";
});
Object.keys(APROVADOS).forEach(function (chave) {
  var frase = APROVADOS[chave];
  if (frase.length < 18) return;
  outros.forEach(function (nome) {
    /* Exceção única (revisão do Argos no PR 24): «Isso não dá para desfazer.»
       fecha também o texto da exclusão de conta, em dados-textos.js. */
    if (nome === "dados-textos.js" && frase === "Isso não dá para desfazer.") return;
    if (semComentarios(ler(nome)).indexOf(frase) !== -1) falhas.push("«" + frase + "» repetida em " + nome + " (o texto fica só em comunidade-textos.js)");
  });
});

/* ---------- 2. Cadastro ---------- */

var index = ler("index.html");
var login = ler("login.js");
var api = ler("api.js");
if (/type="date"/.test(index)) falhas.push("o cadastro não pode usar type=date");
["bday-day", "bday-month", "bday-year"].forEach(function (auto) {
  var re = new RegExp('<input[^>]*type="text"[^>]*inputmode="numeric"[^>]*autocomplete="' + auto + '"[^>]*aria-describedby="cadastro-data-ajuda cadastro-data-erro"');
  if (!re.test(index)) falhas.push("falta o campo " + auto + " (texto, numérico, ligado à ajuda)");
});
if (!/<fieldset class="campo-data"[^>]*>\s*<legend data-texto-comunidade="dataLegenda">/.test(index)) falhas.push("a data não está num fieldset com legend");
if (index.indexOf('id="cadastro-data-erro" class="erro-campo" role="alert"') === -1) falhas.push("o erro da data precisa de role=alert");
if (index.indexOf('<script src="comunidade-textos.js"></script>') === -1) falhas.push("o cadastro não carrega comunidade-textos.js");
if (index.indexOf("btn-criar") < index.indexOf("cadastro-data-ajuda")) falhas.push("a data precisa vir antes do botão de criar conta");
var pedidoCadastro = api.slice(api.indexOf("cadastrar:"), api.indexOf("listarMissoes"));
if (!/birth_date:\s*dados\.birth_date/.test(pedidoCadastro)) falhas.push("o cadastro não manda birth_date");
if (!/if \(resultado\.status === 403\) \{\s*limparCadastro\(form\);\s*mostrarVista\("menor", true\)/.test(login)) falhas.push("todo 403 do cadastro precisa trocar pela tela do menor (com ou sem under_age)");
if (!/limparCadastro\(form\);\s*mostrarVista\("menor", true\)/.test(login)) falhas.push("no 403 do menor, os campos precisam ser apagados");
if (/outra data/i.test(semComentarios(login + index))) falhas.push("a tela do menor não oferece «tentar outra data»");
if (!/resultado\.status === 503\)\s*\{\s*return \{ onde: "topo", tipo: "neutro", texto: TEXTOS_IDADE\(\)\.TEXTOS\.cadastroIndisponivel/.test(login)) falhas.push("o 503 do cadastro precisa da frase aprovada, em aviso neutro");
var loginCss = ler("login.css");
if (!/\.alerta-neutro \{\s*color: var\(--text\);\s*border-color: var\(--border\);/.test(loginCss)) falhas.push("falta o aviso neutro (sem vermelho) no cadastro");
if (!/\.campo-senha \{\s*display: flex;\s*flex-direction: row;\s*flex-wrap: wrap;/.test(loginCss) || !/\.campo-senha label \{[^}]*flex: 1 0 auto;/.test(loginCss)) falhas.push("a 200%, «Mostrar senha» precisa descer em vez de espremer o rótulo");

/* Contrato com o servidor (PR 18): o 403 do menor traz under_age: true.
   Lê o repositório do servidor ao lado, se existir; senão, avisa que pulou. */
var servidor = path.join(raiz, "..", "..", "nexus-backend");
if (fs.existsSync(path.join(servidor, "lib", "adult-age.js"))) {
  var idadeSrv = fs.readFileSync(path.join(servidor, "lib", "adult-age.js"), "utf8");
  var usersSrv = fs.readFileSync(path.join(servidor, "routes", "users.js"), "utf8");
  if (!/status: 403, error: UNDER_AGE_MESSAGE, under_age: true/.test(idadeSrv)) falhas.push("contrato: o servidor deixou de mandar 403 com under_age: true");
  if (!/adult\.under_age \? \{ under_age: true \} : \{\}/.test(usersSrv)) falhas.push("contrato: a rota de cadastro deixou de repassar under_age");
  if ((usersSrv.match(/status\(403\)/g) || []).length > 0) falhas.push("contrato: o cadastro do servidor ganhou outro 403 (a tela trata todo 403 como menor)");
} else {
  console.log("aviso: repositório do servidor não encontrado ao lado; contrato do 403 não conferido");
}

/* Data: só a forma. */
var M = carregarTextos(textosFonte);
[
  [["07", "03", "1995"], "1995-03-07"],
  [["7", "3", "1995"], "1995-03-07"],
  [["29", "02", "2000"], "2000-02-29"],
  [["29", "02", "2001"], ""],
  [["31", "04", "1990"], ""],
  [["00", "01", "1990"], ""],
  [["10", "13", "1990"], ""],
  [["1a", "01", "1990"], ""],
  [["10", "01", "90"], ""],
  [["", "", ""], ""]
].forEach(function (caso) {
  var veio = M.dataDeNascimento(caso[0][0], caso[0][1], caso[0][2]);
  if (veio !== caso[1]) falhas.push("data " + caso[0].join("/") + " deu «" + veio + "», esperado «" + caso[1] + "»");
});
if (M.linhaDoMotivo("perigoso") !== "Motivo mais citado: conselho perigoso para a saúde") falhas.push("linha do motivo ao autor errada");
if (M.linhaDoMotivo("qualquer") !== "" || M.linhaDoMotivo(null) !== "") falhas.push("motivo desconhecido não pode virar texto");

/* ---------- 3. Telas: comunidade e equipe ---------- */

var comHtml = ler("comunidade.html");
var comJs = semComentarios(ler("comunidade.js"));
var eqHtml = ler("equipe.html");
var eqJs = semComentarios(ler("equipe.js"));
var css = ler("comunidade.css");
var crise = ler("crise.html");
var sw = ler("sw.js");
var todas = comHtml + comJs + eqHtml + eqJs + css;

if (/\burso\b|grande-irmao\.(css|js|png|svg)|mascote/i.test(semComentarios(todas))) falhas.push("o urso não entra em comunidade, denúncia, aviso, equipe nem 503");
if (/type="checkbox"/.test(comHtml)) falhas.push("a comunidade não pode ter caixa de 18+");
if (!/<dialog class="folha" id="folha-denuncia" aria-labelledby="titulo-denuncia">/.test(comHtml)) falhas.push("a folha de denúncia precisa ser um dialog");
if (comJs.indexOf("folha.showModal()") === -1) falhas.push("a folha precisa abrir com showModal (foco preso e Esc)");
if (!/<textarea id="detalhes"[^>]*maxlength="280"/.test(comHtml)) falhas.push("o comentário precisa do limite de 280");
if (comHtml.indexOf('<p class="contador" id="detalhes-contador">0 de 280</p>') === -1) falhas.push("falta o contador «0 de 280»");
if (!/id="btn-enviar-denuncia" aria-busy="false" disabled/.test(comHtml)) falhas.push("«Enviar denúncia» começa desligado (sem motivo)");
if (!/var meu = ehMeu\(post\) \|\| post\.hidden === true;/.test(comJs) || !/if \(!meu\) \{/.test(comJs)) falhas.push("«Denunciar» não pode aparecer no próprio post");
if (!/var nome = meu \? T\.voce :/.test(comJs) || !/if \(nome\) \{/.test(comJs)) falhas.push("o próprio post aparece como «Você» e, sem apelido, a linha some");
[["comunidade.js", comJs], ["equipe.js", semComentarios(ler("equipe.js"))]].forEach(function (par) {
  if (!/window\.NEXUS_CENARIO = hostDeDesenvolvimento\(\) \? parametro\("cenario"\) : "";/.test(par[1])) falhas.push(par[0] + ": ?cenario= só pode valer em localhost");
});
if (!/resultado\.dados\.crisis === true\)\s*\{\s*fecharFolha\(\);\s*abrirAjuda\(resultado\.dados\.reported === true\)/.test(comJs)) falhas.push("crise na denúncia precisa abrir a ajuda");
if (!/resultado\.status === 409\) return mostrarAviso\(alerta, "falha", T\.denunciaRepetida\)/.test(comJs)) falhas.push("o 409 precisa da frase aprovada");
if (!/resultado\.status === 503\) return mostrarAviso\(alerta, "falha", T\.denunciaIndisponivel\)/.test(comJs)) falhas.push("o 503 da denúncia precisa da frase aprovada");
if (!/resultado\.ok && resultado\.dados && resultado\.dados\.reported === true/.test(comJs)) falhas.push("só reported: true conta como denúncia feita");
if (/hidden_message|report_count|reports_count|\.reports\b/.test(comJs)) falhas.push("o aviso ao autor não pode usar contagem nem frase do servidor");
if (!/semIdade\(resultado\)\) return abrirIdade\(\)/.test(comJs)) falhas.push("o 403 de idade precisa mostrar o aviso");
if (/\.username|user_id|reporter_id|\.reporter\b/.test(eqJs)) falhas.push("a área da equipe não pode mostrar autor nem quem denunciou");
if (/denuncias-rotulo|adminDenuncias/.test(eqJs + css)) falhas.push("o rótulo solto «Denúncias» voltou");
if (!/T\.apagarTitulo[\s\S]*T\.apagarCorpo/.test(eqJs) || !/aria-describedby="explica"/.test(eqHtml)) falhas.push("a confirmação precisa de título curto + corpo");
if (!/\.motivo input \{[^}]*appearance: none;[^}]*border: 2px solid var\(--border\);/.test(css)) falhas.push("o radio precisa do contorno em --border (contraste medido)");
if (!/document\.getElementById\("btn-cancelar"\)\.focus\(\)/.test(eqJs)) falhas.push("a confirmação começa com o foco em «Cancelar»");
if (!/resultado\.status === 403\) return abrirNegado\(\)/.test(eqJs)) falhas.push("quem não é admin precisa da frase calma");
if (!/post\.priority === "alta"[\s\S]*T\.prioridadeAlta/.test(eqJs)) falhas.push("prioridade alta precisa do rótulo em texto");
if (!/repeat_reporter_alert === true[\s\S]*T\.alertaRepetido/.test(eqJs)) falhas.push("falta o alerta do denunciante repetido");
[comHtml, eqHtml].forEach(function (html, i) {
  var nome = i ? "equipe.html" : "comunidade.html";
  if (!/<html lang="pt-BR">/.test(html)) falhas.push(nome + " sem lang=pt-BR");
  if (/fonts\.googleapis|gstatic/.test(html)) falhas.push(nome + " pede fonte de fora");
  if (!/localStorage\.getItem\("nexus_v2_token"\)[\s\S]*location\.replace\("\.\/"/.test(html)) falhas.push(nome + " precisa mandar quem não está logado para a entrada");
});

/* CSS calmo. */
if (/box-shadow:(?!\s*(inset|none))|--shadow/.test(css)) falhas.push("comunidade.css não pode ter sombra");
if (/gradient/i.test(css)) falhas.push("comunidade.css não pode ter gradiente");
if (/@keyframes|animation:(?!\s*none)|transition:(?!\s*none)/.test(css)) falhas.push("comunidade.css não pode ter animação nem transição");
if (/text-transform:\s*uppercase|letter-spacing:\s*0\.[1-9]/i.test(css)) falhas.push("comunidade.css não pode ter caixa alta espaçada");
if (/border-left:\s*[2-9]/.test(css)) falhas.push("comunidade.css não pode ter barra colorida à esquerda");
if (/\bred\b|crimson|#9B1C1C|#FF8A80/i.test(css)) falhas.push("comunidade.css não pode ter vermelho direto");
var usosDanger = css.split("var(--danger)").length - 1;
var blocoPerigo = (css.match(/\.btn-perigo \{[^}]*\}/) || [""])[0];
if (usosDanger !== 2 || (blocoPerigo.split("var(--danger)").length - 1) !== 2) falhas.push("--danger só no texto e no contorno de «Apagar»");
if (/background[^;]*var\(--danger\)/.test(css)) falhas.push("nada de --danger em fundo");
if (!/\.tela-comunidade \.alerta-falha,\s*\.folha \.alerta-falha,\s*\.confirmacao \.alerta-falha \{\s*color: var\(--text\);\s*border-color: var\(--border\);/.test(css)) falhas.push("os avisos de erro da comunidade e da equipe ficam sem vermelho");
if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(todas)) falhas.push("emoji como ícone");
if (/«[^»]*·|→/.test(semComentarios(comHtml + eqHtml))) falhas.push("marca de página de IA («·» ou «→») no texto");

/* Ajuda depois da denúncia: linha vazia no HTML, frase só com ?de=denuncia. */
if (crise.indexOf('<p class="linha-missao" id="linha-denuncia" hidden></p>') === -1) falhas.push("a tela de ajuda precisa da linha vazia da denúncia");
if (!/de === "denuncia" && window\.NexusComunidade[\s\S]*TEXTOS\.denunciaCrise/.test(crise)) falhas.push("a linha da denúncia só aparece com ?de=denuncia");

/* Cache. */
["comunidade-textos.js", "comunidade.html", "comunidade.css", "comunidade.js", "equipe.html", "equipe.js"].forEach(function (nome) {
  if (sw.indexOf('"./' + nome + '"') === -1) falhas.push("sw.js sem " + nome);
});
if (sw.indexOf('CACHE = "nexus-v2-v42"') === -1) falhas.push("o cache não está em nexus-v2-v42");

/* A pasta antiga não muda neste trabalho. */
if (!fs.existsSync(path.join(raiz, "..", "nexus"))) falhas.push("a pasta nexus/ sumiu");

/* ---------- 5. Mock: casos negados ---------- */

function pedir(metodo, caminho, corpo, token) {
  return new Promise(function (resolve, reject) {
    var dados = corpo ? JSON.stringify(corpo) : "";
    var headers = { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(dados) };
    if (token) headers.Authorization = "Bearer " + token;
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

function esperarMock(tentativas) {
  return pedir("GET", "/api/notifications/vapid-key").catch(function () {
    if (tentativas <= 0) throw new Error("mock não subiu");
    return new Promise(function (r) { setTimeout(r, 100); }).then(function () { return esperarMock(tentativas - 1); });
  });
}

async function entrar(email) {
  var r = await pedir("POST", "/api/users/login", { email: email, password: "123456" });
  return r.json.token;
}

function igual(nome, veio, esperado) {
  if (veio !== esperado) falhas.push(nome + ": veio " + veio + ", esperado " + esperado);
}

async function casosDoMock() {
  /* Com o aceite dos termos (PR 28): sem ele o cadastro é 400 (checar-aceite-legal.js). */
  var cad = { username: "nova", email: "nova@exemplo.com", password: "123456", terms_version: "beta-1", privacy_version: "beta-1" };
  igual("cadastro sem data", (await pedir("POST", "/api/users/register", cad)).status, 400);
  igual("cadastro com 31/02", (await pedir("POST", "/api/users/register", Object.assign({}, cad, { birth_date: "1995-02-31" }))).status, 400);
  var menor = await pedir("POST", "/api/users/register", Object.assign({}, cad, { birth_date: "2015-06-01" }));
  igual("cadastro de menor", menor.status, 403);
  igual("menor traz under_age", menor.json.under_age, true);
  var semCampo = await pedir("POST", "/api/users/register", Object.assign({}, cad, { email: "menor-sem-campo@exemplo.com", username: "msc", birth_date: "1995-03-07" }));
  igual("403 sem under_age (caso negado do site)", semCampo.status === 403 && semCampo.json.under_age === undefined, true);
  igual("sem migração 006", (await pedir("POST", "/api/users/register", Object.assign({}, cad, { email: "sem-migracao@exemplo.com", username: "sm", birth_date: "1995-03-07" }))).status, 503);
  /* O menor não deixou nada guardado: o mesmo e-mail cria a conta com uma data de adulto. */
  igual("cadastro de adulto depois do menor", (await pedir("POST", "/api/users/register", Object.assign({}, cad, { birth_date: "1995-03-07" }))).status, 201);

  igual("comunidade sem login", (await pedir("GET", "/api/communities/ingles-diario")).status, 401);
  igual("denúncia sem login", (await pedir("POST", "/api/communities/ingles-diario/posts/11/report", { reason: "spam" })).status, 401);
  igual("equipe sem login", (await pedir("GET", "/api/communities/admin/hidden-posts")).status, 401);

  var semIdade = await entrar("sem-idade@exemplo.com");
  var r = await pedir("GET", "/api/communities/ingles-diario", null, semIdade);
  igual("sem 18+ abre a comunidade", r.status, 403);
  igual("sem 18+ traz o código", r.json.code, "adult_confirmation_required");
  igual("sem 18+ denuncia", (await pedir("POST", "/api/communities/ingles-diario/posts/11/report", { reason: "spam" }, semIdade)).status, 403);

  var pessoa = await entrar("leitora@exemplo.com");
  r = await pedir("GET", "/api/communities/ingles-diario", null, pessoa);
  igual("comunidade abre", r.status, 200);
  var meu = (r.json.posts || []).filter(function (p) { return p.id === 50; })[0];
  igual("o próprio post vem visível", meu && meu.hidden, false);
  igual("motivo inválido", (await pedir("POST", "/api/communities/ingles-diario/posts/11/report", { reason: "chato" }, pessoa)).status, 400);
  igual("denunciar o próprio post", (await pedir("POST", "/api/communities/ingles-diario/posts/50/report", { reason: "spam" }, pessoa)).status, 400);
  igual("1.ª denúncia", (await pedir("POST", "/api/communities/ingles-diario/posts/11/report", { reason: "spam" }, pessoa)).status, 201);
  igual("2.ª denúncia do mesmo post", (await pedir("POST", "/api/communities/ingles-diario/posts/11/report", { reason: "spam" }, pessoa)).status, 409);
  igual("denúncia 503", (await pedir("POST", "/api/communities/ingles-diario/posts/12/report?cenario=denuncia-indisponivel", { reason: "spam" }, pessoa)).status, 503);
  r = await pedir("POST", "/api/communities/ingles-diario/posts/12/report?cenario=denuncia-crise", { reason: "perigoso", details: "texto de teste" }, pessoa);
  igual("denúncia com crise vale", r.json.reported, true);
  igual("denúncia com crise abre a ajuda", r.json.crisis, true);
  igual("outra pessoa não vê post escondido de ninguém", (r = await pedir("GET", "/api/communities/ingles-diario", null, pessoa)) && (r.json.posts || []).some(function (p) { return p.hidden === true; }), false);
  igual("quem não é admin abre a equipe", (await pedir("GET", "/api/communities/admin/hidden-posts", null, pessoa)).status, 403);
  igual("quem não é admin apaga", (await pedir("DELETE", "/api/communities/admin/posts/21", null, pessoa)).status, 403);
  igual("quem não é admin restaura", (await pedir("POST", "/api/communities/admin/posts/21/restore", null, pessoa)).status, 403);

  var autor = await entrar("autor@exemplo.com");
  r = await pedir("GET", "/api/communities/ingles-diario", null, autor);
  var escondido = (r.json.posts || []).filter(function (p) { return p.id === 50; })[0];
  igual("o autor vê o próprio post escondido", escondido && escondido.hidden, true);
  igual("o autor recebe o motivo", escondido && escondido.hidden_reason, "perigoso");

  var admin = await entrar("admin@exemplo.com");
  r = await pedir("GET", "/api/communities/admin/hidden-posts", null, admin);
  igual("admin abre a lista", r.status, 200);
  igual("prioridade alta primeiro", r.json.posts && r.json.posts[0] && r.json.posts[0].priority, "alta");
  igual("admin restaura", (await pedir("POST", "/api/communities/admin/posts/21/restore", null, admin)).status, 200);
  igual("restaurar de novo", (await pedir("POST", "/api/communities/admin/posts/21/restore", null, admin)).status, 404);
  igual("admin apaga", (await pedir("DELETE", "/api/communities/admin/posts/22", null, admin)).status, 200);
  igual("lista vazia depois", ((await pedir("GET", "/api/communities/admin/hidden-posts", null, admin)).json.posts || []).length, 0);
  igual("equipe 503", (await pedir("GET", "/api/communities/admin/hidden-posts?cenario=equipe-indisponivel", null, admin)).status, 503);
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
  console.log("ok: idade no cadastro, comunidade, denúncia, post escondido, equipe e casos negados");
});
