/* Confere que o texto de exemplo da IA não entra nos arquivos da página.
   Rode na raiz do repositório: node nexus-v2/dev/checar-ia-exemplo.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
var frase = "EXEMPLO — texto de IA fictício";
var daPagina = [
  "grande-irmao.html",
  "grande-irmao.js",
  "grande-irmao.css",
  "abas.js",
  "api.js",
  "checkin.js",
  "dia-dificil.js",
  "hoje.js",
  "sw.js",
  "base.css",
  "tokens.css"
];
var falhas = [];

daPagina.forEach(function (nome) {
  var texto = fs.readFileSync(path.join(raiz, nome), "utf8");
  if (texto.indexOf(frase) !== -1) falhas.push(nome + " contém o exemplo de IA");
});

var dev = fs.readFileSync(path.join(__dirname, "ia-exemplo.js"), "utf8");
if (dev.indexOf(frase) === -1) falhas.push("dev/ia-exemplo.js não tem o exemplo");

var html = fs.readFileSync(path.join(raiz, "grande-irmao.html"), "utf8");
if (html.indexOf("dev/ia-exemplo.js") === -1) falhas.push("a página não aponta o arquivo de desenvolvimento");
if (html.indexOf('host === "localhost"') === -1 || html.indexOf('host === "127.0.0.1"') === -1) {
  falhas.push("o carregamento do exemplo não limita o host");
}

var abas = fs.readFileSync(path.join(raiz, "abas.js"), "utf8");
if (abas.indexOf('host === "localhost"') === -1 || abas.indexOf('host === "127.0.0.1"') === -1) {
  falhas.push("abas.js não limita ?ia=1 a localhost ou 127.0.0.1");
}
if (abas.indexOf("if (!emDesenvolvimento()) return false;") === -1) {
  falhas.push("?ia=1 não fica desligado fora do desenvolvimento");
}

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}

console.log("ok: o exemplo de IA só está em dev/ia-exemplo.js");
