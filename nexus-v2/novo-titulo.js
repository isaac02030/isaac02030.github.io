/* Tela «Novo título». O nome do título e a fita vêm do objeto guardado por
   titulo-novo.js; texto de servidor entra só por textContent. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;
  var B = window.NexusComBase;
  var N = window.NexusTituloNovo;

  /* O urso de luz é só do escuro. No claro, o mesmo traço em pinho, chapado,
     sem preenchimento preto e sem brilho — a regra da trilha no caderno. */
  function temaEscolhido() {
    var pedido = "";
    try {
      pedido = new URLSearchParams(location.search).get("tema") || "";
    } catch (erro) {}
    if (pedido === "escuro" || pedido === "claro") return pedido;
    var guardado = "";
    try {
      guardado = localStorage.getItem("nexus_v2_tema") || "";
    } catch (erroGuardado) {}
    if (guardado === "escuro" || guardado === "claro") return guardado;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
  }

  function pintarUrso() {
    var urso = document.getElementById("urso");
    if (urso) urso.setAttribute("src", temaEscolhido() === "escuro" ? "icons/urso-contente.svg" : "icons/urso-contente-claro.svg");
  }

  function pintar(titulo) {
    var fita = document.getElementById("fita-titulo");
    fita.replaceChildren();
    fita.appendChild(B.simboloDoTitulo(titulo, true));
    var nome = document.getElementById("nome-titulo");
    nome.replaceChildren();
    var texto = document.createElement("span");
    texto.className = "titulo-novo-texto";
    texto.textContent = titulo.name;
    nome.appendChild(texto);
    document.getElementById("vista-titulo").hidden = false;
    NexusAbas.focar(document.getElementById("titulo"));
    NexusAbas.concluirRolagem();
  }

  function iniciar() {
    B.iniciarCenario();
    C.aplicar(document);
    pintarUrso();
    document.title = T.novoTitulo + " — Nexus";
    NexusAbas.montar("missao");
    document.getElementById("btn-continuar").addEventListener("click", function () {
      N.limparPendente();
      location.replace("hoje.html" + B.busca());
    });
    var pendente = N.lerPendente();
    if (!N.valido(pendente)) {
      location.replace(B.link("merito.html"));
      return;
    }
    pintar(pendente);
  }

  iniciar();
})();
