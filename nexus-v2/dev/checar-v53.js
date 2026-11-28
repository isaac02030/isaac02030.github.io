/* V53: a 4.ª aba «Comunidade» (Hoje, Missão, Comunidade, Ajustes).
   Saem o atalho do Hoje, a linha da Missão e «Meu mérito» de Ajustes;
   a linha vira o fim da lista em comunidades.html. A tela «Novo título»,
   o urso e a fita da v52 continuam. Casos negados: 3 abas, aba ativa errada,
   duas abas ativas, rótulo escondido, porta antiga de volta, innerHTML,
   prints no repositório, luz dupla e título fora da lista fechada.
   Rode na raiz do repositório: node nexus-v2/dev/checar-v53.js */

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

var abasJs = semComentarios(ler("abas.js"));
var abasCss = semComentarios(ler("abas.css"));
var ajustesHtml = semComentarios(ler("ajustes.html"));
var ajustesJs = semComentarios(ler("ajustes.js"));
var hojeHtml = semComentarios(ler("hoje.html"));
var hojeJs = semComentarios(ler("hoje.js"));
var missaoHtml = semComentarios(ler("missao.html"));
var missaoCss = semComentarios(ler("missao.css"));
var comunidadesHtml = semComentarios(ler("comunidades.html"));
var comunidadesJs = semComentarios(ler("comunidades.js"));
var novaHtml = semComentarios(ler("novo-titulo.html"));
var novaCss = semComentarios(ler("novo-titulo.css"));
var novaJs = semComentarios(ler("novo-titulo.js"));
var helperJs = semComentarios(ler("titulo-novo.js"));
var textosJs = semComentarios(ler("comunidade-textos.js"));
var comunidadeJs = semComentarios(ler("comunidade.js"));
var checkinJs = semComentarios(ler("checkin.js"));
var dificilJs = semComentarios(ler("dia-dificil.js"));
var trilhaCss = ler("trilha.css");
var ursoClaro = ler("icons/urso-contente-claro.svg");
var sw = ler("sw.js");

/* ---------- 1. Quatro abas, nesta ordem ---------- */
quer((abasJs.match(/href: "[a-z-]+\.html"/g) || []).length === 4, "a barra precisa ter 4 abas, não 3");
var ordem = ["hoje.html", "missao.html", "comunidades.html", "ajustes.html"];
var posicoes = ordem.map(function (href) { return abasJs.indexOf('href: "' + href + '"'); });
quer(posicoes.every(function (p, i) { return p !== -1 && (i === 0 || p > posicoes[i - 1]); }), "a ordem tem de ser Hoje, Missão, Comunidade, Ajustes");
["Hoje", "Missão", "Comunidade", "Ajustes"].forEach(function (rotulo) {
  quer(abasJs.indexOf('texto: "' + rotulo + '"') !== -1, "falta o rótulo da aba «" + rotulo + "»");
});
quer(abasJs.indexOf('id: "comunidade"') !== -1, "falta o id da aba Comunidade");
quer(/icone: "M10 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM2 19a5 5 0 0 1 10 0M20 8a3\.5 3\.5 0 1 0-7 0 3\.5 3\.5 0 0 0 7 0zM7\.5 21a6\.5 6\.5 0 0 1 13 0"/.test(abasJs), "o ícone precisa ser dois bustos de traço, um atrás e um na frente");
quer(/setAttribute\("aria-hidden", "true"\)/.test(abasJs) && /setAttribute\("fill", "none"\)/.test(abasJs) && /setAttribute\("stroke-width", "2"\)/.test(abasJs), "ícone de aba: traço de 2 px, sem preenchimento e aria-hidden");
quer(abasJs.indexOf('quebra: "Comun"') !== -1 && abasJs.indexOf('createElement("wbr")') !== -1, "a 200% o rótulo precisa quebrar sem hífen, com wbr");
quer(abasJs.indexOf("texto.textContent = aba.texto") !== -1, "as abas usam textContent, nunca innerHTML");
quer(!/innerHTML|outerHTML|document\.write/.test(abasJs), "abas.js: texto só por textContent");
quer(/aria-current", "page"/.test(abasJs) && /if \(aba\.id === ativa\)/.test(abasJs), "a aba ativa precisa de aria-current=page");
quer(/href = aba\.href \+ busca/.test(abasJs), "as 4 abas são links reais para páginas separadas");

/* ---------- 2. Largura e luz da barra ---------- */
quer(/\.aba\s*\{[^}]*min-width:\s*0/.test(abasCss), "as 4 colunas precisam ser iguais (min-width: 0)");
quer(/\.aba\s*\{[^}]*min-height:\s*56px/.test(abasCss) && !/\.aba\s*\{[^}]*[^-]height:\s*56px/.test(abasCss), "a aba mantém 56 px mínimos e cresce com o texto");
quer(/\.aba\s*\{[^}]*font-size:\s*0\.75rem/.test(abasCss), "o rótulo da aba é 12 px");
quer(/\.aba span\s*\{[^}]*hyphens:\s*none/.test(abasCss), "sem hífen automático no rótulo");
quer(/@media \(max-width: 360px\)[\s\S]*\.aba\s*\{[^}]*padding-left:\s*0/.test(abasCss), "a 200% o rótulo precisa do espaço lateral todo");
quer(/flex:\s*1 1 0/.test(abasCss), "as 4 abas precisam repartir a largura por igual");
quer(/'\.aba\[aria-current="page"\]::before'/.test(ler("dev/checar-neon.js")) || ler("dev/checar-neon.js").indexOf('.aba[aria-current="page"]::before') !== -1, "a barrinha de luz da aba ativa não pode mudar de seletor");
quer(/\.icone-aba\s*\{[^}]*width:\s*24px[^}]*height:\s*24px/.test(abasCss), "o ícone da aba continua com 24 px");

/* ---------- 3. Aba ativa certa em cada tela ---------- */
var comAtiva = {
  "comunidades.js": 'NexusAbas.montar("comunidade")',
  "comunidade.js": 'NexusAbas.montar("comunidade")',
  "criar-comunidade.js": 'NexusAbas.montar("comunidade")',
  "merito.js": 'NexusAbas.montar("comunidade")',
  "maratona.js": 'NexusAbas.montar("comunidade")',
  "novo-titulo.js": 'NexusAbas.montar("comunidade")',
  "hoje.js": 'NexusAbas.montar("hoje")',
  "missao.js": 'NexusAbas.montar("missao")',
  "conversa.js": 'NexusAbas.montar("missao")',
  "aceitar-convite.js": 'NexusAbas.montar("missao")',
  "ajustes.js": 'NexusAbas.iniciar("ajustes")',
  "meus-dados.js": 'NexusAbas.iniciar("ajustes")',
  "pessoas-bloqueadas.js": 'NexusAbas.iniciar("ajustes")',
  "equipe.js": 'NexusAbas.iniciar(null)'
};
Object.keys(comAtiva).forEach(function (nome) {
  var fonte = semComentarios(ler(nome));
  quer(fonte.indexOf(comAtiva[nome]) !== -1, nome + ": aba ativa errada, esperava " + comAtiva[nome]);
  var ativas = fonte.match(/NexusAbas\.(?:montar|iniciar)\("(?:hoje|missao|comunidade|ajustes)"\)/g) || [];
  quer(ativas.length <= 1, nome + ": mais de uma aba ativa na mesma tela");
});
quer(ler("recuperacao.html").indexOf('NexusAbas.iniciar("hoje")') !== -1, "recuperação: aba ativa errada");

/* ---------- 4. Portas antigas fora; mérito dentro da Comunidade ---------- */
quer(hojeHtml.indexOf("link-comunidades") === -1 && hojeJs.indexOf("link-comunidades") === -1, "o atalho do Hoje precisa sair");
quer(hojeJs.indexOf("pintarAtalhoComunidades") === -1, "a pintura do atalho do Hoje precisa sair");
quer(textosJs.indexOf("comunidadeLinhaHoje") === -1 && hojeJs.indexOf("comunidadeLinhaHoje") === -1, "a frase «Comunidade: {nome}» saiu junto com o atalho");
quer(missaoHtml.indexOf("linha-comunidades") === -1 && missaoCss.indexOf("linha-comunidades") === -1, "a linha «Comunidades» da Missão precisa sair");
quer(ajustesHtml.indexOf("link-meu-merito") === -1 && ajustesJs.indexOf("atualizarLinkMerito") === -1, "«Meu mérito» precisa sair de Ajustes");
quer(ajustesJs.indexOf("encodeURIComponent") === -1, "Ajustes não escolhe mais a comunidade principal");
quer(/<a class="linha-seta" id="link-meu-merito" href="merito\.html"><span data-texto-comunidade="meritoTitulo">/.test(comunidadesHtml), "falta a linha «Meu mérito» na lista de comunidades");
quer(comunidadesHtml.indexOf('id="link-meu-merito"') < comunidadesHtml.indexOf('id="link-criar"'), "«Meu mérito» precisa ficar antes de «Criar uma comunidade»");
quer(comunidadesJs.indexOf('getElementById("link-meu-merito").href = B.link("merito.html")') !== -1, "o link de mérito da lista não usa o ajudante de busca");
quer(textosJs.indexOf('meritoTitulo: "Meu mérito"') !== -1, "o texto da linha «Meu mérito» mudou");
quer(!/innerHTML|outerHTML/.test(comunidadesJs + ajustesJs + hojeJs + missaoHtml), "as telas mudadas usam textContent, nunca innerHTML");

/* ---------- 5. Título novo, urso e fita (v52 continua) ---------- */
quer(textosJs.indexOf('novoTitulo: "Novo título"') !== -1, "Falta o texto «Novo título»");
quer(textosJs.indexOf('continuar: "Continuar"') !== -1, "Falta o texto «Continuar»");
quer(!/innerHTML|outerHTML|document\.write/.test(helperJs + novaJs), "Novo título: texto só por textContent");
quer(helperJs.indexOf("CHAVE_VISTO") !== -1 && helperJs.indexOf("CHAVE_PENDENTE") !== -1, "Novo título: falta a memória local do título");
quer(/NexusTituloNovo\.verificar\(resultado\.dados\.title\)/.test(comunidadesJs + comunidadeJs), "Entrar na comunidade não confere o título");
quer(/await NexusTituloNovo\.verificar\(\)/.test(checkinJs + dificilJs), "Concluir a missão não confere o título");
["checkin.html", "dia-dificil.html"].forEach(function (nome) {
  quer(ler(nome).indexOf('<script src="titulo-novo.js"></script>') !== -1, nome + ": sem o ajudante do título");
});
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
quer(!/[«»·→]/.test(novaHtml + novaJs + novaCss), "Novo título: aspas ou marca de IA no texto");
quer(!/box-shadow|gradient|border-left|drop-shadow/.test(novaCss), "Novo título: a fita e o urso ficam planos");
quer(/width:\s*140px/.test(novaCss) && /height:\s*140px/.test(novaCss), "Novo título: o urso precisa medir 140 px");
quer(novaJs.indexOf('getElementById("fita-titulo")') !== -1 && novaJs.indexOf("fita.appendChild(B.simboloDoTitulo(titulo, true))") !== -1, "Novo título: a fita de marcas não aparece acima do nome");
quer(novaJs.indexOf("texto.textContent = titulo.name") !== -1, "Novo título: o nome entra por textContent");
quer(novaJs.indexOf('location.replace("hoje.html"') !== -1, "Novo título: «Continuar» não volta ao Hoje");
quer(/@media \(max-width: 360px\)[\s\S]*\.trilha30[\s\S]*grid-template-columns:\s*repeat\(5,\s*22px\)/.test(trilhaCss), "Hoje a 200%: a trilha precisa caber em 5 quadrados por linha");

/* ---------- 6. Saída da conta e cache ---------- */
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
var funcaoApi = extrairFuncao(ler("api.js"), "nexusLimparSessao");
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
quer(sw.indexOf('CACHE = "nexus-v2-v53"') !== -1, "o cache não está em nexus-v2-v53");
["ajustes.html", "ajustes.js", "hoje.html", "hoje.js", "missao.html", "missao.css", "checkin.html", "checkin.js", "dia-dificil.html", "dia-dificil.js", "comunidade.html", "comunidade.js", "comunidades.html", "comunidades.js", "novo-titulo.html", "novo-titulo.css", "novo-titulo.js", "titulo-novo.js", "comunidade-textos.js", "icons/urso-contente-claro.svg"].forEach(function (nome) {
  quer(sw.indexOf('"./' + nome + '"') !== -1, "sw.js sem " + nome);
});
quer(!fs.existsSync(path.join(raiz, "visual")), "os prints não podem ficar no repositório público");

/* ---------- 7. Rodada de verdade no ajudante ---------- */
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
  console.log("v53: 4 abas, ativa certa, portas antigas fora, mérito na lista, urso e fita; casos negados passaram");
}
