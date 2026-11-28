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
if (!fnBotao || !/className = "btn btn-acao-post btn-compartilhar"/.test(fnBotao)) falhas.push("compartilhar: precisa da mesma caixa dos outros dois botões do post");
if (!fnBotao || !/icone\(DESENHOS\.compartilhar\)/.test(fnBotao) || !/textContent = T\.compartilhar/.test(fnBotao)) falhas.push("compartilhar: falta o desenho e a palavra «Compartilhar»");
if (!fnBotao || !/setAttribute\("aria-label", T\.compartilharPost\)/.test(fnBotao)) falhas.push("compartilhar: o nome acessível é «Compartilhar post»");
if (!/btn-luz/.test(fnBotao) && !/btn-luz/.test(trecho(comJs, "compartilharPost"))) {
  /* Está certo: nenhuma luz nova. */
} else falhas.push("compartilhar: não pode acender uma segunda luz");
if (!/principais\.appendChild\(botaoDeCompartilhar\(post\)\);/.test(comJs)) falhas.push("compartilhar: falta um botão por post visível");
if (/innerHTML\s*=/.test(comJs)) falhas.push("compartilhar: texto de outra pessoa nunca entra por innerHTML");

/* Decisão das 11:24/11:25: um estilo só no rodapé, ⋯ no canto e Denunciar
   apenas na folha, escondido no próprio post. */
if (!/\.btn-acao-post,\s*\.btn-apoiar,\s*\.apoios-total \{[\s\S]*?min-height: var\(--target\);[\s\S]*?padding: 0 2px;[\s\S]*?border-radius: var\(--radius-pill\);[\s\S]*?color: var\(--accent-standout\);[\s\S]*?font-size: 14px;[\s\S]*?text-decoration: none;/.test(css)) falhas.push("rodapé: os três botões precisam do mesmo estilo, 14 px e cor neon");
if (!/\.btn-acao-post \.icone,[\s\S]*?width: 15px;/.test(css)) falhas.push("rodapé: os ícones precisam do mesmo tamanho");
if (/btn-discreto/.test(css) || /btn-discreto/.test(comJs) || /acoes-secundarias/.test(css) || /acoes-secundarias/.test(comJs)) falhas.push("rodapé: o estilo antigo de texto solto voltou");
if (/btn-denunciar/.test(trecho(comJs, "itemDoPost")) || /secundarias/.test(trecho(comJs, "itemDoPost"))) falhas.push("rodapé: «Denunciar» não pode voltar para a linha do post");
if (!/cabeca\.appendChild\(botaoDeMais\(post, rodape\)\);/.test(comJs)) falhas.push("rodapé: o «⋯» precisa ficar no canto superior do post");
if (!/mais: "M5 12h\.01M12 12h\.01M19 12h\.01"/.test(comJs)) falhas.push("rodapé: falta o desenho de três pontos do «Mais»");
var fnMais = trecho(comJs, "botaoDeMais");
if (!fnMais || !/icone\(DESENHOS\.mais\)/.test(fnMais) || !/setAttribute\("aria-label", T\.maisOpcoes\)/.test(fnMais)) falhas.push("rodapé: o «Mais» precisa dos três pontos e do nome «Mais opções»");
var fnAbrirMais = trecho(comJs, "abrirFolhaMais");
if (!fnAbrirMais || !/denunciar\.hidden = ehMeu\(post\)/.test(fnAbrirMais)) falhas.push("próprio post: «Denunciar» precisa ficar escondido na folha");
if (!fnAbrirMais || !/folha\.querySelector\('button:not\(\[hidden\]\)'\)/.test(fnAbrirMais)) falhas.push("folha «Mais»: o foco precisa ir para o primeiro item visível");
if (!/function ligarFolhaMais\(/.test(comJs) || !/ligarFolhaMais\(\);/.test(comJs)) falhas.push("rodapé: a folha pequena do «Mais» não está ligada");
if (!/id="folha-mais"/.test(comHtml) || !/id="btn-mais-compartilhar"/.test(comHtml) || !/id="btn-mais-denunciar"/.test(comHtml)) falhas.push("rodapé: a folha do «Mais» precisa dos dois botões");
if (!/btn-mais-fechar"[^>]*data-texto-comunidade="agoraNao"/.test(comHtml)) falhas.push("folha «Mais»: precisa de «Agora não» para fechar");
if (!/\.btn-mais \{[\s\S]*?position: absolute;[\s\S]*?top: 0;[\s\S]*?right: 0;[\s\S]*?color: var\(--accent-standout\);/.test(css)) falhas.push("canto: o «⋯» precisa ficar no canto com cor contrastante");
if (!/\.btn-mais \.icone path \{[\s\S]*?stroke-width: 2\.6;/.test(css)) falhas.push("canto: os três pontos precisam de traço mais visível sem ampliar o alvo");
if (!/\.folha-mais \.btn-mais-denunciar \{[\s\S]*?color: var\(--danger\);/.test(css)) falhas.push("folha «Mais»: «Denunciar» precisa ser vermelho");
if (!/\.folha-mais \.btn-mais-fechar \{[\s\S]*?color: var\(--text\);/.test(css)) falhas.push("folha «Mais»: «Agora não» precisa da cor normal do texto");
if (!/\.folha-mais-acoes \{[\s\S]*?width: calc\(100% \+ var\(--space-4\) \* 2\);[\s\S]*?margin: 0 calc\(var\(--space-4\) \* -1\);/.test(css)) falhas.push("folha «Mais»: as divisórias precisam ir de ponta a ponta");

/* O aviso de cópia é fixo no pé, reserva espaço, não tapa ações e some em 3,5 s. */
var fnAviso = trecho(comJs, "avisoDeCompartilhamento");
if (!fnAviso || !/getElementById\("aviso-compartilhar"\)/.test(fnAviso) || !/textContent = texto/.test(fnAviso)) falhas.push("aviso: precisa usar textContent no aviso fixo");
if (!fnAviso || !/setTimeout\(function \(\) \{[\s\S]*?hidden = true;[\s\S]*?\}, 3500\)/.test(fnAviso)) falhas.push("aviso: precisa sumir depois de 3,5 s");
if (!fnAviso || !/window\.scrollBy\(0, acao\.bottom - area\.top \+ 8\)/.test(fnAviso)) falhas.push("aviso: precisa rolar o mínimo para não cobrir a ação tocada");
if (!/class="aviso-compartilhar" id="aviso-compartilhar" role="status" aria-live="polite" hidden/.test(comHtml)) falhas.push("aviso: falta o parágrafo role=status aria-live escondido no HTML");
if (!/\.aviso-compartilhar \{[\s\S]*?position: fixed;[\s\S]*?bottom: calc\(var\(--altura-abas\)/.test(css)) falhas.push("aviso: precisa ficar fixo acima da barra de abas");
if (!/\.tela-comunidade\.com-aviso-compartilhar \{[\s\S]*?padding-bottom: calc\(var\(--altura-abas\)/.test(css)) falhas.push("aviso: a tela precisa reservar espaço enquanto ele aparece");

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
console.log("ok: Compartilhar com botão do celular, link limpo, rodapé uniforme, ⋯ no canto, folha do próprio post e aviso sem cobrir ações");
