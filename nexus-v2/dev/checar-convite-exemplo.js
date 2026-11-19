/* Confere que o link fictício não entra nos arquivos da página.
   Rode na raiz do repositório: node nexus-v2/dev/checar-convite-exemplo.js */

var fs = require("fs");
var path = require("path");

var raiz = path.join(__dirname, "..");
var frase = "exemplo.invalid/nexus/convite-ficticio";
var daPagina = [
  "missao.html",
  "missao.js",
  "missao.css",
  "api.js",
  "abas.js",
  "sw.js",
  "base.css",
  "tokens.css"
];
var falhas = [];

daPagina.forEach(function (nome) {
  var texto = fs.readFileSync(path.join(raiz, nome), "utf8");
  if (texto.indexOf(frase) !== -1) falhas.push(nome + " contém o link fictício");
  if (texto.indexOf("convite-ficticio") !== -1) falhas.push(nome + " contém o caminho fictício");
});

var dev = fs.readFileSync(path.join(__dirname, "convite-exemplo.js"), "utf8");
if (dev.indexOf(frase) === -1) falhas.push("dev/convite-exemplo.js não tem o link fictício");

var html = fs.readFileSync(path.join(raiz, "missao.html"), "utf8");
if (html.indexOf("dev/convite-exemplo.js") === -1) falhas.push("a página não aponta o arquivo de desenvolvimento");
if (html.indexOf('host === "localhost"') === -1 || html.indexOf('host === "127.0.0.1"') === -1) {
  falhas.push("o carregamento do link fictício não limita o host");
}

var js = fs.readFileSync(path.join(raiz, "missao.js"), "utf8");
if (js.indexOf("NEXUS_CONVITE_POR_LINK = false") === -1) {
  falhas.push("a flag do convite não está desligada");
}
if (js.indexOf('cenarioDaPagina() !== "link-fake"') === -1 && js.indexOf("link-fake") === -1) {
  falhas.push("o cenário link-fake não está na página");
}
if (js.indexOf("NexusAbas.emDev()") === -1) {
  falhas.push("o link fictício não passa pelo host de desenvolvimento");
}
if (js.indexOf('mode: "parceiro"') !== -1 || js.indexOf('mode: "rival"') !== -1 || js.indexOf("mode: \"parceiro\"") !== -1) {
  falhas.push("a página não pode criar missão com mode parceiro ou rival");
}

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}

console.log("ok: o link fictício só está em dev/convite-exemplo.js");
