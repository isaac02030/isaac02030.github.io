/* V52: «Meu mérito» em Ajustes, nome da comunidade no atalho do Hoje e tela
   «Novo título» com urso contente e fita de 5 marcas. O servidor não manda
   flag de título novo; a comparação é local e a lista é fechada.
   Casos negados: título de outro nome, nível errado, marcas erradas,
   mais de uma comunidade no atalho, luz fora do botão e prints no repo.
   Rode na raiz do repositório: node nexus-v2/dev/checar-v52.js */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}
function quer(cond, msg) {
  if (!cond) falhas.push(msg);
}

var ajustesHtml = semComentarios(ler("ajustes.html"));
var ajustesJs = semComentarios(ler("ajustes.js"));
var hojeHtml = semComentarios(ler("hoje.html"));
var hojeJs = semComentarios(ler("hoje.js"));
var novaHtml = semComentarios(ler("novo-titulo.html"));
var novaCss = semComentarios(ler("novo-titulo.css"));
var novaJs = semComentarios(ler("novo-titulo.js"));
var helperJs = semComentarios(ler("titulo-novo.js"));
var textosJs = semComentarios(ler("comunidade-textos.js"));
var comunidadesJs = semComentarios(ler("comunidades.js"));
var comunidadeJs = semComentarios(ler("comunidade.js"));
var checkinJs = semComentarios(ler("checkin.js"));
var dificilJs = semComentarios(ler("dia-dificil.js"));
var trilhaCss = ler("trilha.css");
var ursoClaro = ler("icons/urso-contente-claro.svg");
var sw = ler("sw.js");

/* ---------- 1. Ajustes ---------- */
quer(/id="link-meu-merito"[^>]*href="merito\.html"/.test(ajustesHtml), "Ajustes: falta a linha «Meu mérito» para merito.html");
quer(ajustesHtml.indexOf(">Meu mérito<") !== -1, "Ajustes: o rótulo da linha mudou");
quer(/function atualizarLinkMerito\(/.test(ajustesJs), "Ajustes: falta a escolha da comunidade principal");
quer(ajustesJs.indexOf("listarComunidades()") !== -1, "Ajustes: não consulta as comunidades");
quer(ajustesJs.indexOf("is_member === true") !== -1, "Ajustes: não filtra só as comunidades da pessoa");
quer(ajustesJs.indexOf("minhas.length !== 1") !== -1, "Ajustes: com várias comunidades, não abre a lista");
quer(ajustesJs.indexOf("encodeURIComponent(minhas[0].slug)") !== -1, "Ajustes: o slug da comunidade única não vai no link");
quer(/atualizarLinkMerito\(\);/.test(ajustesJs), "Ajustes: a linha não é atualizada ao abrir");
quer(!/innerHTML|document\.write/.test(ajustesJs), "Ajustes: texto só por textContent");

/* Sair da conta não pode deixar o título da conta anterior no aparelho. */
function extrairFuncao(fonte, nome) {
  var inicio = fonte.indexOf("function " + nome + "()");
  if (inicio < 0) return "";
  var abre = fonte.indexOf("{", inicio);
  var nivel = 0;
  for (var i = abre; i < fonte.length; i++) {
    if (fonte[i] === "{") nivel++;
    else if (fonte[i] === "}") {
      nivel--;
      if (nivel === 0) return fonte.slice(inicio, i + 1);
    }
  }
  return "";
}
function areaFake(inicial) {
  var dados = Object.assign({}, inicial);
  return {
    get length() { return Object.keys(dados).length; },
    key: function (i) { return Object.keys(dados)[i] || null; },
    getItem: function (c) { return Object.prototype.hasOwnProperty.call(dados, c) ? dados[c] : null; },
    setItem: function (c, v) { dados[c] = String(v); },
    removeItem: function (c) { delete dados[c]; },
    dados: dados
  };
}
var fonteApi = ler("api.js");
var funcaoApi = extrairFuncao(fonteApi, "nexusLimparSessao");
var funcaoSaida = extrairFuncao(ajustesJs, "limparSessao");
quer(funcaoApi !== "" && funcaoSaida !== "", "Sair: falta a função de limpar a sessão");
quer(/nexusLimparSessao\(\);/.test(funcaoSaida), "Sair: não usa a limpeza completa de api.js");
if (funcaoApi && funcaoSaida) {
  var ctxSaida = {
    localStorage: areaFake({
      "nexus_v2_token": "x",
      "nexus_v2_user": "y",
      "nexus_v2_tema": "claro",
      "nexus_v2_titulo_visto": '{"name":"Constante","level":3,"marks":5}',
      "nexus_v2_titulo_pendente": '{"name":"Veterano","level":4,"marks":5}'
    }),
    sessionStorage: areaFake({ "nexus_v2_rascunho": "rascunho" }),
    console: console
  };
  vm.createContext(ctxSaida);
  vm.runInContext(funcaoApi, ctxSaida);
  vm.runInContext(funcaoSaida, ctxSaida);
  vm.runInContext("limparSessao();", ctxSaida);
  var restantes = Object.keys(ctxSaida.localStorage.dados);
  quer(restantes.every(function (c) { return c.indexOf("nexus_v2_titulo_") !== 0; }), "Sair: sobrou chave nexus_v2_titulo_*");
  quer(restantes.join(",") === "nexus_v2_tema", "Sair: devia ficar só o tema, ficou " + restantes.join(","));
  quer(Object.keys(ctxSaida.sessionStorage.dados).length === 0, "Sair: sobrou chave na sessão");
}

/* ---------- 2. Hoje ---------- */
quer(/<a class="linha-mensagem link-comunidades" id="link-comunidades" href="comunidades\.html">Comunidades<\/a>/.test(hojeHtml), "Hoje: falta o atalho de texto com o padrão «Comunidades»");
quer(/link-comunidades[^>]*btn-luz|btn-luz[^>]*link-comunidades/.test(hojeHtml) === false, "Hoje: o atalho ganhou luz");
quer(hojeHtml.indexOf('<script src="comunidade-textos.js"></script>') !== -1, "Hoje: faltam os textos da comunidade");
quer(hojeHtml.indexOf('<script src="titulo-novo.js"></script>') !== -1, "Hoje: falta o ajudante do título novo");
quer(/function pintarAtalhoComunidades\(/.test(hojeJs), "Hoje: falta a pintura do nome da comunidade");
quer(hojeJs.indexOf("comunidadeLinhaHoje") !== -1, "Hoje: a frase «Comunidade: {nome}» não vem de comunidade-textos.js");
quer(hojeJs.indexOf("link.textContent = texto") !== -1, "Hoje: o nome entra por textContent");
quer(hojeJs.indexOf("minhas.length !== 1") !== -1, "Hoje: só mostra o nome com uma comunidade");
quer(/pintarAtalhoComunidades\(\);/.test(hojeJs), "Hoje: o atalho não é pintado ao abrir");
quer(/@media \(max-width: 360px\)[\s\S]*\.trilha30[\s\S]*grid-template-columns:\s*repeat\(5,\s*22px\)/.test(trilhaCss), "Hoje a 200%: a trilha precisa caber em 5 quadrados por linha");
quer(textosJs.indexOf('comunidadeLinhaHoje: "Comunidade: {nome}"') !== -1, "A frase do atalho mudou");

/* ---------- 3. Título novo: lista fechada, casos negados ---------- */
quer(textosJs.indexOf('novoTitulo: "Novo título"') !== -1, "Falta o texto «Novo título»");
quer(textosJs.indexOf('continuar: "Continuar"') !== -1, "Falta o texto «Continuar»");
quer(!/innerHTML|outerHTML|document\.write/.test(helperJs + novaJs), "Novo título: texto só por textContent");
quer(helperJs.indexOf("CHAVE_VISTO") !== -1 && helperJs.indexOf("CHAVE_PENDENTE") !== -1, "Novo título: falta a memória local do título");
quer(/NexusTituloNovo\.verificar\(resultado\.dados\.title\)/.test(comunidadesJs + comunidadeJs), "Entrar na comunidade não confere o título");
quer(/await NexusTituloNovo\.verificar\(\)/.test(checkinJs + dificilJs), "Concluir a missão não confere o título");
["checkin.html", "dia-dificil.html"].forEach(function (nome) {
  quer(ler(nome).indexOf('<script src="titulo-novo.js"></script>') !== -1, nome + ": sem o ajudante do título");
});

/* ---------- 4. Tela ---------- */
quer(/<img class="urso-novo-titulo" id="urso" src="icons\/urso-contente\.svg" alt="" width="140" height="140"/.test(novaHtml), "Novo título: o urso precisa ser o desenho grande de 140 px");
quer(ursoClaro.indexOf('stroke="#0B5F52"') !== -1, "Urso no claro: o traço precisa ser pinho #0B5F52");
quer(!/fill="#[0-9A-Fa-f]{6}"|drop-shadow|linearGradient|mask/.test(ursoClaro), "Urso no claro: sem preenchimento, halo, degradê ou máscara");
quer(novaJs.indexOf("icons/urso-contente-claro.svg") !== -1 && /temaEscolhido\(\) === "escuro"/.test(novaJs), "Urso: no claro vai o traço de pinho; no escuro, o de luz");
quer(/pintarUrso\(\);/.test(novaJs), "Urso: a escolha do desenho não é aplicada ao abrir");
quer(novaHtml.indexOf('id="fita-titulo"') !== -1 && novaHtml.indexOf('id="fita-titulo"') < novaHtml.indexOf('id="nome-titulo"'), "Novo título: a fita precisa ficar acima do nome");
quer(/id="btn-continuar"[^>]*data-texto-comunidade="continuar"/.test(novaHtml), "Novo título: falta o botão «Continuar»");
quer((novaHtml.match(/btn-luz/g) || []).length === 1, "Novo título: tem de haver uma luz só");
quer(/localStorage\.getItem\("nexus_v2_token"\)[\s\S]*location\.replace\("\.\/"/.test(novaHtml), "Novo título: sem login, vai para a entrada");
quer(/<nav class="abas" id="abas"/.test(novaHtml), "Novo título: falta a barra de abas");
quer(/NexusAbas\.montar\("missao"\)/.test(novaJs), "Novo título: a barra de abas não é montada");
quer(!/[«»·→]/.test(novaHtml + novaJs + novaCss), "Novo título: aspas ou marca de IA no texto");
quer(!/box-shadow|gradient|border-left|drop-shadow/.test(novaCss), "Novo título: a fita e o urso ficam planos");
quer(/width:\s*140px/.test(novaCss) && /height:\s*140px/.test(novaCss), "Novo título: o urso precisa medir 140 px");
quer(!/fita-grande[\s\S]{0,80}gap:\s*0\.375rem/.test(novaCss) && !/marca-titulo[\s\S]{0,80}width:\s*0\.875rem/.test(novaCss), "Novo título: a fita não pode ser menor que a do «Meu mérito»");
quer(novaJs.indexOf('getElementById("fita-titulo")') !== -1 && novaJs.indexOf("fita.appendChild(B.simboloDoTitulo(titulo, true))") !== -1, "Novo título: a fita de marcas não aparece acima do nome");
quer(novaJs.indexOf("texto.textContent = titulo.name") !== -1, "Novo título: o nome entra por textContent");
quer(novaJs.indexOf('location.replace("hoje.html"') !== -1, "Novo título: «Continuar» não volta ao Hoje");

/* ---------- 5. Cache e provas ---------- */
quer(sw.indexOf('CACHE = "nexus-v2-v52"') !== -1, "o cache não está em nexus-v2-v52");
["ajustes.html", "ajustes.js", "hoje.html", "hoje.js", "checkin.html", "checkin.js", "dia-dificil.html", "dia-dificil.js", "comunidade.html", "comunidade.js", "comunidades.html", "comunidades.js", "novo-titulo.html", "novo-titulo.css", "novo-titulo.js", "titulo-novo.js", "comunidade-textos.js", "icons/urso-contente-claro.svg"].forEach(function (nome) {
  quer(sw.indexOf('"./' + nome + '"') !== -1, "sw.js sem " + nome);
});
quer(!fs.existsSync(path.join(raiz, "visual")), "os prints não podem ficar no repositório público");

/* ---------- 6. Rodada de verdade no ajudante ---------- */
var armazenado = {};
var janela = {};
var destino = "";
var contexto = {
  window: janela,
  localStorage: {
    getItem: function (chave) { return Object.prototype.hasOwnProperty.call(armazenado, chave) ? armazenado[chave] : null; },
    setItem: function (chave, valor) { armazenado[chave] = valor; },
    removeItem: function (chave) { delete armazenado[chave]; }
  },
  location: { assign: function (url) { destino = url; } },
  Promise: Promise,
  Number: Number,
  JSON: JSON,
  console: console
};
vm.runInNewContext(textosJs, contexto);
vm.runInNewContext(helperJs, contexto);
janela.NexusAbas = { busca: function () { return "?tema=escuro"; } };
var N = janela.NexusTituloNovo;
quer(!!N && typeof N.verificar === "function", "o ajudante do título não carregou");

if (N) {
  quer(N.valido({ name: "Constante", level: 3, marks: 5 }) !== null, "Constante, nível 3, 5 marcas devia ser aceito");
  quer(N.valido({ name: "Mestre", level: 3, marks: 5 }) === null, "negado: título fora da lista abriu a tela");
  quer(N.valido({ name: "Constante", level: 9, marks: 5 }) === null, "negado: nível fora de 1 a 5 abriu a tela");
  quer(N.valido({ name: "Constante", level: 3, marks: 4 }) === null, "negado: fita com 4 marcas abriu a tela");
  quer(N.valido(null) === null, "negado: título vazio abriu a tela");
  /* Primeira vez no aparelho: guarda o título, mas não mostra «novo». */
  N.verificar({ name: "Constante", level: 3, marks: 5 }).then(function (primeira) {
    quer(primeira === false, "primeira abertura não devia abrir «Novo título»");
    quer(destino === "", "primeira abertura não devia navegar");
    quer(N.lerPendente() === null, "primeira abertura não devia deixar título pendente");
    N.registrar({ name: "Praticante", level: 2, marks: 5 });
    return N.verificar({ name: "Praticante", level: 2, marks: 5 });
  }).then(function (igual) {
    quer(igual === false, "título igual não devia abrir tela");
    quer(destino === "", "título igual não devia navegar");
    return N.verificar({ name: "Constante", level: 3, marks: 5 });
  }).then(function (novo) {
    quer(novo === true, "título novo devia abrir tela");
    quer(destino.indexOf("novo-titulo.html?tema=escuro") !== -1, "a tela nova não recebeu o tema");
    quer(N.lerPendente() && N.lerPendente().name === "Constante", "o título novo não ficou pendente");
    N.limparPendente();
    quer(N.lerPendente() === null, "«Continuar» não apagou o título pendente");
    finalizar();
  }).catch(function (erro) {
    falhas.push("o ajudante falhou: " + erro.message);
    finalizar();
  });
} else {
  finalizar();
}

function finalizar() {
  if (falhas.length) {
    console.log("FALHOU:\n- " + falhas.join("\n- "));
    process.exit(1);
  }
  console.log("v52: linha em Ajustes, nome no Hoje, tela «Novo título» com urso e fita; casos negados passaram");
}
