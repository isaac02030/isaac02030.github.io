/* Página simples do Hoje. O conteúdo de verdade vem na próxima tarefa. */

function iniciar() {
  var titulo = document.getElementById("titulo-hoje");
  if (titulo) titulo.focus();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

iniciar();
