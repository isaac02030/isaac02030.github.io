/* Pedido do Isaac (28/11, 12:30): dentro do comentário aparece só «Apoiar».
   «Denunciar» sai da linha, continua no teclado/leitor de tela e abre por
   pressão longa ou menu de contexto, sem desenho novo e sem rota nova. */
var fs = require("fs");
var path = require("path");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(__dirname, "..", nome), "utf8").replace(/\r\n/g, "\n");
}

var js = ler("comunidade.js");
var css = ler("comunidade.css");
var sw = ler("sw.js");

var bloco = (css.match(/\.btn-denunciar-comentario \{[\s\S]*?\n\}/) || [""])[0];
if (!/position:\s*absolute/.test(bloco)) falhas.push("o «Denunciar» do comentário saiu do fluxo");
if (!/width:\s*1px/.test(bloco) || !/height:\s*1px/.test(bloco)) falhas.push("o «Denunciar» do comentário ainda ocupa a linha");
if (!/min-width:\s*0/.test(bloco) || !/min-height:\s*0/.test(bloco)) falhas.push("o alvo mínimo da base ainda abre o botão oculto");
if (!/clip-path:\s*inset\(50%\)/.test(bloco)) falhas.push("o «Denunciar» do comentário não está recortado da vista");
if (!/\.btn-denunciar-comentario:focus-visible \{[\s\S]*?position:\s*static/.test(css)) falhas.push("quem navega por teclado não vê o «Denunciar» ao focar");

if (!/ligarDenunciaPorToque\(item, denunciar\)/.test(js)) falhas.push("a denúncia do comentário não está ligada ao item");
if (!/abrirFolha\(estado\.post, denunciar, comentario\)/.test(js)) falhas.push("a folha não recebe o comentário certo");
var gesto = (js.match(/function ligarDenunciaPorToque\([\s\S]*?\n\}/) || [""])[0];
if (!/"touchstart"/.test(gesto) || !/"touchmove"/.test(gesto)) falhas.push("falta pressão longa com cancelamento por movimento");
if (!/"contextmenu"/.test(gesto)) falhas.push("falta o menu de contexto");
if (!/event\.preventDefault\(\)/.test(gesto)) falhas.push("o menu de contexto do sistema não foi segurado");
if (!/folha && folha\.open/.test(gesto)) falhas.push("a folha pode abrir duas vezes");
if (!/apoioDoComentario\(estado, comentario\)/.test(js)) falhas.push("«Apoiar» saiu do comentário");

if (sw.indexOf('CACHE = "nexus-v2-v57"') === -1) falhas.push("o cache não está em nexus-v2-v57");

if (falhas.length) {
  console.error("FALHOU (" + falhas.length + "):\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: comentário só com «Apoiar», denúncia por pressão longa/contexto e cache v57");
