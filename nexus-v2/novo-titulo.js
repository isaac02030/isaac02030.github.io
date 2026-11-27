/* Tela «Novo título». O nome do título e a fita vêm do objeto guardado por
   titulo-novo.js; texto de servidor entra só por textContent. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;
  var B = window.NexusComBase;
  var N = window.NexusTituloNovo;

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
