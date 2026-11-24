/* Confere as trocas de texto contra os sinais de texto de IA (revisões do Zé
   e da Clara, 23/11/2026): frases robóticas e de chatbot, o mínimo da nota sem
   número na tela, negrito contido nos Termos e na Privacidade, títulos sem
   fórmula repetida, aspas de um tipo só e a instrução do iPhone numa chave só.
   Casos negados: o texto antigo não volta; a nota curta ainda é barrada; nada
   de «Parabéns» no fim. A tela de crise e os números de ajuda não entram aqui.
   Rode na raiz do repositório: node nexus-v2/dev/checar-textos.js */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var raiz = path.join(__dirname, "..");
var falhas = [];

function ler(nome) {
  return fs.readFileSync(path.join(raiz, nome), "utf8");
}
function semComentarios(t) {
  return t.replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"])\/\/.*$/gm, "$1");
}

var paginas = fs.readdirSync(raiz).filter(function (n) { return /\.(html|js)$/.test(n) && n !== "sw.js"; });
var tudo = {};
paginas.forEach(function (n) { tudo[n] = semComentarios(ler(n)); });

/* 1. Trocas do Zé: o novo está lá, o antigo não volta. */
var TROCAS = [
  ["checkin.js", "Uma frase chega. Diga o que praticou (pelo menos 12 caracteres).", "Essa nota ficou curta demais. Conte um pouco mais do que você praticou."],
  ["checkin.js", "Uma frase chega (pelo menos 8 caracteres).", "Essa nota ficou curta demais. Conte um pouco mais do que você treinou."],
  ["hoje.js", "Dias difíceis: restam ", "Ainda dá para usar "],
  ["hoje.html", "Que tal começar a primeira?", "Você ainda não tem missão. Comece a primeira."],
  ["missao.html", "Que tal começar a primeira?", "Você ainda não tem missão. Comece a primeira."],
  ["index.html", "Leva menos de um minuto. Depois você escreve seu compromisso.", "Leva um minuto. Depois, escreva o seu combinado."],
  ["dia-dificil.js", "a recuperação está te esperando.", "Se não der, a recuperação fica disponível."],
  ["dia-dificil.js", "era pequeno, e valeu.", "Dia difícil registrado. O mínimo de hoje era pequeno, e você o cumpriu."],
  ["grande-irmao.js", "era pequeno, e valeu.", "Dia difícil registrado. O mínimo de hoje era pequeno, e você o cumpriu."],
  ["hoje.js", "era pequeno, e valeu.", "Dia difícil registrado. O mínimo de hoje era pequeno, e você o cumpriu."],
  ["onboarding.html", "O treino que você combinou com você mesmo.", "Seu treino, do jeito que você combinou."],
  ["comunidade-textos.js", "quem ajudou a esconder este post escondeu vários posts hoje", "Atenção: quem escondeu este post escondeu vários hoje. Confira se a denúncia é justa."]
];
TROCAS.forEach(function (t) {
  if (tudo[t[0]].indexOf(t[2]) === -1) falhas.push(t[0] + ": falta o texto novo «" + t[2] + "»");
});
/* Negado em todas as páginas, não só onde estava. */
["Que tal", "te esperando", "e valeu.", "Uma frase chega", "ajudou a esconder", "Leva menos de um minuto", "combinou com você mesmo", "Dias difíceis: restam"].forEach(function (velho) {
  paginas.forEach(function (n) {
    if (tudo[n].indexOf(velho) !== -1) falhas.push("negado: «" + velho + "» voltou em " + n);
  });
});

/* 2. O mínimo de 8 e 12: a tela não mostra o número; o erro só vem com frase curta. */
var checkin = ler("checkin.js");
var trechos = ["TEXTO_VAZIO", "TEXTO_CURTA_ESTUDO", "TEXTO_CURTA_ACADEMIA"].map(function (nome) {
  var m = checkin.match(new RegExp("var " + nome + " = [^\\n]+"));
  return m ? m[0] : "";
}).join("\n");
var fn = function (nome) {
  var i = checkin.indexOf("function " + nome + "(");
  var fim = checkin.indexOf("\n}\n", i);
  return i === -1 ? "" : checkin.slice(i, fim + 2);
};
var caixa = { NexusNota: null };
vm.runInNewContext(trechos + "\n" + fn("regraDaNota") + "\nvar missaoAtual = null;\nfunction notaEscrita() { return nota; }\nvar nota = '';\n" +
  fn("validarNota").replace("window.NexusNota && ", "false && ") + "\nthis.teste = function (cat, texto) { missaoAtual = { category: cat }; nota = texto; return validarNota(); }; this.regra = regraDaNota;", caixa);
if (typeof caixa.teste !== "function") {
  falhas.push("não deu para rodar a validação da nota de checkin.js");
} else {
  ["fitness", "aprendizagem"].forEach(function (cat) {
    var r = caixa.regra({ category: cat });
    if (r.ajuda !== "") falhas.push(cat + ": negado: sem dica no check-in (o rótulo orienta; o erro só vem se faltar)");
    if (/\d/.test(r.curta) || /caracteres/.test(r.curta)) falhas.push(cat + ": o erro mostra número ou «caracteres»");
  });
  if (caixa.regra({ category: "fitness" }).minimo !== 8 || caixa.regra({ category: "aprendizagem" }).minimo !== 12) falhas.push("o mínimo de 8 e 12 caracteres mudou (a regra fica)");
  if (caixa.teste("fitness", "fui sim") !== "Essa nota ficou curta demais. Conte um pouco mais do que você treinou.") falhas.push("negado: 7 caracteres na academia têm de dar o erro de frase curta");
  if (caixa.teste("fitness", "treinei!") !== "") falhas.push("8 caracteres na academia passam sem erro");
  if (caixa.teste("aprendizagem", "li um texto") !== "Essa nota ficou curta demais. Conte um pouco mais do que você praticou.") falhas.push("negado: 11 caracteres no estudo têm de dar o erro de frase curta");
  if (caixa.teste("aprendizagem", "li um texto.") !== "") falhas.push("12 caracteres no estudo passam sem erro");
  if (caixa.teste("outra", "x") !== "") falhas.push("sem categoria, qualquer frase passa");
}
if (!/if \(categoria === "fitness"\) return TEXTO_CURTA_ACADEMIA;/.test(checkin)) falhas.push("o erro de prova curta do servidor usa o texto de frase curta, sem número");
if (/Escreva uma frase curta sobre/.test(tudo["checkin.js"])) falhas.push("negado: a dica repetida do check-in voltou");
var checkinHtml = ler("checkin.html");
if (!/<textarea id="nota"[^>]*><\/textarea>\s*(<!--[^>]*-->\s*)?<p id="nota-erro" class="erro-campo" role="alert" hidden><\/p>/.test(checkinHtml)) falhas.push("check-in: o erro fica colado ao campo, logo abaixo dele, com role=alert");

/* 3. Termos e Privacidade: um negrito por parágrafo, curto. Exceções: o aviso
   de que não é serviço de saúde e a linha dos números de ajuda (não mexemos). */
function blocos(html) {
  var corpo = html.slice(html.indexOf('<main'), html.indexOf("</main>"));
  return corpo.match(/<(p|li|dd)\b[^>]*>[\s\S]*?<\/\1>/g) || [];
}
["termos.html", "privacidade.html"].forEach(function (nome) {
  var html = ler(nome);
  blocos(html).forEach(function (b) {
    if (/<strong>188<\/strong> \(CVV\)/.test(b) && /^<li/.test(b)) return;
    var fortes = b.match(/<strong>[^<]*<\/strong>/g) || [];
    if (/^<(ul|ol)/.test(b)) return;
    if (fortes.length > 1 && !/<li>/.test(b.slice(4))) falhas.push(nome + ": mais de um negrito no mesmo parágrafo: " + b.replace(/<[^>]+>/g, "").slice(0, 70));
    fortes.forEach(function (f) {
      var t = f.replace(/<[^>]+>/g, "");
      var rotulo = /[:?]$/.test(t);
      if (!rotulo && t.split(/\s+/).length > 6 && !/^Não é tratamento/.test(t)) falhas.push(nome + ": negrito longo demais: «" + t + "»");
    });
  });
  if (/: o que ele faz|: o que isso significa|Consentimento separado|sem promessa de resultado/.test(html)) falhas.push(nome + ": título com a fórmula repetida «Assunto: o que…»");
});
var termos = ler("termos.html");
["<strong>188</strong> (CVV)", "<strong>192</strong> (SAMU)", "<strong>112</strong> (risco de vida)", "Suicídio (<strong>1411</strong>)", "SNS 24, <strong>808 24 24 24, opção 4</strong>"].forEach(function (n) {
  if (termos.indexOf(n) === -1) falhas.push("termos: número de ajuda sem mudança e com negrito só no número: falta «" + n + "»");
});
if (/<strong>[^<]*(CVV|SAMU|Linha Nacional)[^<]*<\/strong>/.test(termos)) falhas.push("negado: o negrito dos números de ajuda não pega o nome inteiro");
if (!/<h2 id="secao-8">8\. Sem garantia de resultado<\/h2>/.test(termos)) falhas.push("termos: título da seção 8 é «Sem garantia de resultado»");

/* 4. Aspas de um tipo só no que a pessoa vê: “ ”, nunca « ». */
paginas.forEach(function (n) {
  var t = tudo[n];
  if (/\.js$/.test(n)) t = (t.match(/"(?:[^"\\\n]|\\.)*"/g) || []).join("\n");
  if (/[«»]/.test(t)) falhas.push(n + ": aspas « » no texto que a pessoa vê (use “ ”)");
});

/* 5. Peso: «Você cumpriu?» acima do rótulo do campo; no Hoje, título em 600. */
if (!/\.pergunta \{\s*font: var\(--text-label\);\s*font-size: 1\.1875rem;/.test(ler("checkin.css"))) falhas.push("check-in: «Você cumpriu?» pesa mais que o rótulo do campo");
if (!/\.titulo-missao \{[^}]*font-weight: 600;/.test(ler("hoje.css"))) falhas.push("Hoje: o título da missão fica em 600 (o mínimo é o mais pesado)");

/* 5b. Avisos de crise (decisão de 24/11): fim condicional, sem «Parece que». */
var FIM_CRISE = "Se você está passando por um momento difícil, veja os contatos de ajuda abaixo.";
if (ler("chat-textos.js").indexOf("Sua mensagem não foi enviada. " + FIM_CRISE) === -1) falhas.push("a linha de crise do chat tem o texto novo exato");
paginas.concat(["dev/mock-api.js"]).forEach(function (n) {
  if (ler(n).indexOf("Parece que você está passando") !== -1) falhas.push("negado: «Parece que você está passando…» voltou em " + n);
});

/* 6. Fecho seco: nada de «Parabéns» nem «jornada» no fim. */
["dia-30.html", "dia-30.js", "conta-excluida.html"].forEach(function (n) {
  if (/Parabéns|jornada/i.test(tudo[n] || "")) falhas.push("negado: " + n + " com fecho de efeito");
});

if (falhas.length) {
  console.log("FALHOU:\n- " + falhas.join("\n- "));
  process.exit(1);
}
console.log("ok: textos sem sinais de IA (Zé 9, Clara 13), mínimo sem número, negrito contido e casos negados");
