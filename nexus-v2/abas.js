/* Barra Hoje, Missão e Ajustes. As telas seguintes chamam NexusAbas.montar. */

var ABAS = [
  {
    id: "hoje",
    href: "hoje.html",
    texto: "Hoje",
    icone: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2"
  },
  {
    id: "missao",
    href: "missao.html",
    texto: "Missão",
    icone: "M5 21V4h9l-1.5 3L14 10H5"
  },
  {
    id: "ajustes",
    href: "ajustes.html",
    texto: "Ajustes",
    icone: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM12 3v2.2M12 18.8V21M4.9 6.2l1.6 1.6M17.5 16.2l1.6 1.6M3 12h2.2M18.8 12H21M4.9 17.8l1.6-1.6M17.5 7.8l1.6-1.6"
  }
];

function buscaDasAbas(chaves) {
  var params;
  try {
    params = new URLSearchParams(location.search);
  } catch (erro) {
    return "";
  }
  var manter = new URLSearchParams();
  var lista = chaves || ["tema", "cenario", "rede"];
  lista.forEach(function (chave) {
    var valor = params.get(chave);
    if (valor) manter.set(chave, valor);
  });
  var texto = manter.toString();
  return texto ? "?" + texto : "";
}

function iconeDaAba(caminho) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icone-aba");
  var traco = document.createElementNS("http://www.w3.org/2000/svg", "path");
  traco.setAttribute("fill", "none");
  traco.setAttribute("stroke", "currentColor");
  traco.setAttribute("stroke-width", "2");
  traco.setAttribute("stroke-linecap", "round");
  traco.setAttribute("stroke-linejoin", "round");
  traco.setAttribute("d", caminho);
  svg.appendChild(traco);
  return svg;
}

function montarAbas(ativa) {
  var nav = document.getElementById("abas");
  if (!nav) return;
  if (!nav.getAttribute("aria-label")) nav.setAttribute("aria-label", "Seções");
  var busca = buscaDasAbas();
  nav.replaceChildren();
  ABAS.forEach(function (aba) {
    var link = document.createElement("a");
    link.className = "aba";
    link.href = aba.href + busca;
    link.appendChild(iconeDaAba(aba.icone));
    var texto = document.createElement("span");
    texto.textContent = aba.texto;
    link.appendChild(texto);
    if (aba.id === ativa) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
}

function iniciarAba(ativa) {
  montarAbas(ativa);
  var titulo = document.querySelector("main h1");
  if (titulo) titulo.focus();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

var NexusAbas = {
  montar: montarAbas,
  iniciar: iniciarAba,
  busca: buscaDasAbas
};
