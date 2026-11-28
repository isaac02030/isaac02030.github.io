/* Compartilhar (fila do beta, item 5): botão do celular, link limpo para a
   comunidade com o post à vista e login para quem não tem conta. Nada no
   servidor, nada de token na URL, nenhuma luz nova. */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];
function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8").replace(/\r\n/g, "\n");
}
function igual(nome, vindo, esperado) {
  if (vindo !== esperado) falhas.push(nome + ": veio " + JSON.stringify(vindo) + ", esperado " + JSON.stringify(esperado));
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/.*$/gm, "$1");
}
function trecho(fonte, nome) {
  var i = fonte.indexOf("function " + nome + "(");
  if (i === -1) return "";
  var fim = fonte.indexOf("\n}\n", i);
  return fim === -1 ? "" : fonte.slice(i, fim + 2);
}

var textosFonte = ler("comunidade-textos.js");
var janela = {};
vm.runInNewContext(textosFonte, { window: janela });
var T = janela.NexusComunidade && janela.NexusComunidade.TEXTOS;
if (!T) falhas.push("comunidade-textos.js não carregou");
else {
  igual("texto do botão", T.compartilhar, "Compartilhar");
  igual("nome do botão", T.compartilharPost, "Compartilhar post");
  igual("título da folha do celular", T.compartilharTitulo, "Post da comunidade no Nexus");
  igual("cópia sem celular", T.linkCopiado, "Link copiado.");
  igual("erro calmo", T.compartilharErro, "Não foi possível compartilhar agora.");
  igual("nome do menu", T.maisOpcoes, "Mais opções");
}

var comJs = semComentarios(ler("comunidade.js"));
var comHtml = ler("comunidade.html");
var css = ler("comunidade.css");

/* O link é gerado de verdade, num contexto pequeno, para conferir o que sai. */
var idFn = trecho(comJs, "idDoPost");
var linkFn = trecho(comJs, "linkDoPost");
if (!idFn || !linkFn) falhas.push("comunidade.js: faltam idDoPost/linkDoPost");
else {
  var contexto = {
    location: { href: "https://isaac02030.github.io/nexus-v2/comunidade.html?cenario=uma-comunidade&tema=escuro" },
    slugAtual: "leitura",
    URL: URL,
    String: String
  };
  vm.runInNewContext(idFn + "\n" + linkFn, contexto);
  var link = contexto.linkDoPost({ id: 62 });
  igual("link limpo", link, "https://isaac02030.github.io/nexus-v2/comunidade.html?c=leitura&p=62");
  if (/token|cenario|tema|@|user_id/.test(link)) falhas.push("o link de compartilhar levou dado de teste, tema ou conta: " + link);
  igual("id estranho não entra", contexto.linkDoPost({ id: "62<script>" }), "https://isaac02030.github.io/nexus-v2/comunidade.html?c=leitura&p=62");
}

var fnCompartilhar = trecho(comJs, "compartilharPost");
if (!fnCompartilhar || !/navigator\.share && typeof navigator\.share === "function"/.test(fnCompartilhar)) falhas.push("compartilhar: falta o botão nativo do celular");
if (!fnCompartilhar || !/\{ title: T\.compartilharTitulo, url: url \}/.test(fnCompartilhar)) falhas.push("compartilhar: a folha do celular recebe o título e o link");
if (!fnCompartilhar || fnCompartilhar.indexOf('erro.name === "AbortError"') === -1) falhas.push("compartilhar: cancelar a folha não pode virar erro");
if (!fnCompartilhar || !/await navigator\.clipboard\.writeText\(url\)/.test(fnCompartilhar) || !/T\.linkCopiado/.test(fnCompartilhar)) falhas.push("compartilhar: sem celular, copia o link e diz que copiou");
if (!fnCompartilhar || !/document\.execCommand\("copy"\)/.test(fnCompartilhar)) falhas.push("compartilhar: falta a cópia de reserva");
if (!fnCompartilhar || !/T\.compartilharErro/.test(fnCompartilhar)) falhas.push("compartilhar: erro com frase calma");
if (!fnCompartilhar || !/aria-busy/.test(fnCompartilhar)) falhas.push("compartilhar: o botão precisa travar enquanto compartilha");

var fnBotao = trecho(comJs, "botaoDeCompartilhar");
if (!fnBotao || !/className = "btn btn-discreto btn-compartilhar"/.test(fnBotao)) falhas.push("compartilhar: botão discreto, cinza e sem luz própria");
if (!fnBotao || !/icone\(DESENHOS\.compartilhar\)/.test(fnBotao) || !/textContent = T\.compartilhar/.test(fnBotao)) falhas.push("compartilhar: falta o desenho e a palavra «Compartilhar»");
if (!fnBotao || !/setAttribute\("aria-label", T\.compartilharPost\)/.test(fnBotao)) falhas.push("compartilhar: o nome acessível é «Compartilhar post»");
if (!/btn-luz/.test(fnBotao) && !/btn-luz/.test(trecho(comJs, "compartilharPost"))) {
  /* Está certo: nenhuma luz nova. */
} else falhas.push("compartilhar: não pode acender uma segunda luz");
if (!/secundarias\.appendChild\(botaoDeCompartilhar\(post\)\);/.test(comJs)) falhas.push("compartilhar: falta um botão por post visível");
if (/innerHTML\s*=/.test(comJs)) falhas.push("compartilhar: texto de outra pessoa nunca entra por innerHTML");

/* Revisão da Clara (03:05): as duas ações discretas ficam à direita, juntas,
   em cinza e sem sublinhado; a 200% vão para o menu «Mais». */
if (!/btn-discreto \{[\s\S]*?color: var\(--text-muted\);[\s\S]*?text-decoration: none;/.test(css)) falhas.push("rodapé: as ações discretas precisam ser cinza e sem sublinhado");
if (!/\.acoes-principais,\s*\.acoes-secundarias \{/.test(css) || !/\.acoes-secundarias \{\s*margin-left: auto;/.test(css)) falhas.push("rodapé: «Comentários»/«Apoiar» à esquerda e as discretas à direita");
if (!/mais: "M5 12h\.01M12 12h\.01M19 12h\.01"/.test(comJs)) falhas.push("rodapé: falta o desenho de três pontos do «Mais»");
var fnMais = trecho(comJs, "botaoDeMais");
if (!fnMais || !/icone\(DESENHOS\.mais\)/.test(fnMais) || !/setAttribute\("aria-label", T\.maisOpcoes\)/.test(fnMais)) falhas.push("rodapé: o «Mais» precisa dos três pontos e do nome «Mais opções»");
if (!/secundarias\.appendChild\(botaoDeMais\(post, secundarias\)\);/.test(comJs)) falhas.push("rodapé: falta o botão «Mais» por post");
if (!/function abrirFolhaMais\(/.test(comJs) || !/function ligarFolhaMais\(/.test(comJs) || !/ligarFolhaMais\(\);/.test(comJs)) falhas.push("rodapé: a folha pequena do «Mais» não está ligada");
if (!/id="folha-mais"/.test(comHtml) || !/id="btn-mais-compartilhar"/.test(comHtml) || !/id="btn-mais-denunciar"/.test(comHtml)) falhas.push("rodapé: a folha do «Mais» precisa dos dois botões");
if (!/data-texto-comunidade="agoraNao"/.test(comHtml)) falhas.push("rodapé: a folha do «Mais» precisa de «Agora não» para fechar");
if (!/@media \(min-width: 321px\) \{[\s\S]*?\.post-rodape \.btn \{\s*font-size: 12px;/.test(css)) falhas.push("rodapé: a 390 px os quatro botões precisam caber numa linha só");
if (!/@media \(max-width: 320px\) \{[\s\S]*?\.post-rodape \.btn-compartilhar,\s*\.post-rodape \.btn-denunciar \{\s*display: none;[\s\S]*?\.post-rodape \.btn-mais \{\s*display: inline-flex;/.test(css)) falhas.push("rodapé: a 200% as discretas precisam ir para o «Mais»");

/* O aviso de cópia é fixo no pé, acima da barra de abas, e some em 3 s. */
var fnAviso = trecho(comJs, "avisoDeCompartilhamento");
if (!fnAviso || !/getElementById\("aviso-compartilhar"\)/.test(fnAviso) || !/textContent = texto/.test(fnAviso)) falhas.push("aviso: precisa usar textContent no aviso fixo");
if (!fnAviso || !/setTimeout\(function \(\) \{[\s\S]*?hidden = true;[\s\S]*?\}, 3000\)/.test(fnAviso)) falhas.push("aviso: precisa sumir depois de 3 s");
if (!/class="aviso-compartilhar" id="aviso-compartilhar" role="status" hidden/.test(comHtml)) falhas.push("aviso: falta o parágrafo role=status escondido no HTML");
if (!/\.aviso-compartilhar \{[\s\S]*?position: fixed;[\s\S]*?bottom: calc\(var\(--altura-abas\)/.test(css)) falhas.push("aviso: precisa ficar fixo acima da barra de abas");
if (!/\.aviso-compartilhar \{[\s\S]*?color: var\(--text-muted\)/.test(css)) falhas.push("aviso: o aviso de cópia precisa ser neutro");

/* O link abre a comunidade e encontra o post, sem apelido nem ranking. */
var fnIr = trecho(comJs, "irParaPostCompartilhado");
if (!fnIr || fnIr.indexOf('parametro("p")') === -1) falhas.push("compartilhar: o link precisa ler ?p=");
if (!fnIr || fnIr.indexOf('replace(/[^0-9]/g, "")') === -1) falhas.push("compartilhar: o id do link precisa ser filtrado");
if (!fnIr || !/scrollIntoView\(\{ block: "center" \}\)/.test(fnIr) || !/NexusAbas\.focar\(item\)/.test(fnIr)) falhas.push("compartilhar: o post precisa ficar à vista e receber o foco");
if (!/if \(!irParaPostCompartilhado\(\)\) focarTitulo\(\);/.test(comJs)) falhas.push("compartilhar: o foco do título não pode roubar o post do link");
if (!/item\.dataset\.post = idDoPost\(post\);/.test(trecho(comJs, "itemDoPost"))) falhas.push("compartilhar: os posts precisam do alvo data-post");
if (!/querySelector\('\[data-post="'/ .test(comJs)) falhas.push("compartilhar: falta a procura do post pelo alvo");

/* Sem conta, o link cai no login; com conta, nada de token na URL. */
if (!/if \(!localStorage\.getItem\("nexus_v2_token"\)\) \{\s*location\.replace\("\.\/" \+ location\.search\);/.test(comHtml)) falhas.push("compartilhar: quem não tem conta precisa ver o login");
if (ler("sw.js").indexOf('CACHE = "nexus-v2-v56"') === -1) falhas.push("o cache não está em nexus-v2-v56");

if (falhas.length) {
  console.error("FALHOU (" + falhas.length + "):\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: Compartilhar com botão do celular, link limpo, rodapé discreto, menu «Mais», aviso fixo e login para quem não tem conta");
