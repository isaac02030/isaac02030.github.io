/* Ajustes da revisão das 02:40: a 200% (≤ 320 px) o aviso do comentário
   escondido não pode ficar numa coluna estreita com palavra sozinha. */
var fs = require("fs");
var path = require("path");
var css = fs.readFileSync(path.join(__dirname, "..", "comunidade.css"), "utf8").replace(/\r\n/g, "\n");
var falhas = [];

var inicio = css.indexOf("@media (max-width: 320px)");
if (inicio === -1) falhas.push("falta o bloco @media (max-width: 320px)");
else {
  /* O bloco é o último do arquivo; pegar daqui evita confundir o fecho de
     uma regra interna com o fecho do @media. */
  var bloco = css.slice(inicio);
  if (!/\.posts\.destaques\s*\{[^}]*padding-right:\s*0[^}]*padding-left:\s*0/.test(bloco)) falhas.push("o destaque ainda recua os comentários a 320 px");
  if (!/\.cartao-comentario-escondido\s*\{[^}]*border:\s*0[^}]*border-top:\s*1px solid var\(--borda-cartao\)/.test(bloco)) falhas.push("o aviso ainda tem caixa: tire a borda e deixe só a divisória");
  if (!/padding:\s*var\(--space-1\)\s+0\s+0/.test(bloco)) falhas.push("o aviso ainda tem recuo lateral próprio");
}

if (falhas.length) {
  console.error("FALHOU (" + falhas.length + "):\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: aviso do escondido sem caixa e sem recuo estreito a 320 px");
