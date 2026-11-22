/* Termos de uso e Política de privacidade. Abrem sem login e sem internet.
   «Voltar» volta ao ponto de origem quando veio de outra tela do app (o que
   já foi digitado no cadastro continua lá); aberta direto, vai ao início.
   Sem JavaScript, o link leva ao início. */
(function () {
  var voltar = document.getElementById("voltar");
  var veioDoApp = false;
  try {
    veioDoApp = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1;
  } catch (erro) {
    veioDoApp = false;
  }
  if (voltar) {
    var busca = "";
    try {
      var tema = new URLSearchParams(location.search).get("tema");
      if (tema === "claro" || tema === "escuro" || tema === "sistema") busca = "?tema=" + tema;
    } catch (erroBusca) {}
    voltar.setAttribute("href", "index.html" + busca);
    voltar.addEventListener("click", function (evento) {
      if (!veioDoApp) return;
      evento.preventDefault();
      history.back();
    });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
})();
