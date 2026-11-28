/* Barra Hoje, Missão, Comunidade e Ajustes. As telas seguintes chamam NexusAbas.montar. */

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
    /* Dois bustos de traço, um atrás e um na frente. Sem emoji e sem balão. */
    id: "comunidade",
    href: "comunidades.html",
    texto: "Comunidade",
    icone: "M10 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0zM2 19a5 5 0 0 1 10 0M20 8a3.5 3.5 0 1 0-7 0 3.5 3.5 0 0 0 7 0zM7.5 21a6.5 6.5 0 0 1 13 0"
  },
  {
    id: "ajustes",
    href: "ajustes.html",
    texto: "Ajustes",
    /* Três controles deslizantes. O desenho antigo parecia um sol (tema ou brilho). */
    icone: "M4 6h9M17 6h3M15 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 12h3M11 12h9M9 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 18h11M19 18h1M17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
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
  /* ia só existe no teste da tela 4. Sem o parâmetro, a busca fica igual. */
  var lista = chaves || ["tema", "cenario", "rede", "ia"];
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

/* Cada aba é um link para a página dela. O clique empilha no histórico.
   Não usamos location.replace para trocar de aba. */
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
    /* O rótulo é uma palavra só em todas as larguras: sem wbr, sem hífen. */
    texto.textContent = aba.texto;
    link.appendChild(texto);
    if (aba.id === ativa) link.setAttribute("aria-current", "page");
    nav.appendChild(link);
  });
  ligarRolagem();
}

var CHAVE_ROLAGEM = "nexus_v2_rolagem_";
var rolagemPronta = false;
var rolagemTimer = 0;
var rolagemTravada = false;

function nomeDaPagina() {
  var nome = "pagina";
  try {
    nome = (location.pathname.split("/").pop() || "hoje.html").toLowerCase();
  } catch (erro) {
    nome = "pagina";
  }
  if (!/^[a-z0-9.-]+$/.test(nome)) nome = "pagina";
  return nome;
}

function lerRolagem() {
  try {
    var bruto = sessionStorage.getItem(CHAVE_ROLAGEM + nomeDaPagina());
    if (bruto == null || bruto === "") return null;
    var y = Number(bruto);
    if (!isFinite(y) || y < 0) return null;
    return y;
  } catch (erro) {
    return null;
  }
}

function guardarRolagem() {
  if (!rolagemPronta || rolagemTravada) return;
  var y = window.scrollY || window.pageYOffset || 0;
  var guardado = lerRolagem();
  var maximo = 0;
  try {
    maximo = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  } catch (erro) {
    maximo = 0;
  }
  if (guardado != null && y + 1 < guardado && maximo + 1 < guardado) return;
  try {
    sessionStorage.setItem(CHAVE_ROLAGEM + nomeDaPagina(), String(y));
  } catch (erro) {}
}

function restaurarRolagem() {
  var y = lerRolagem();
  if (y == null) return;
  rolagemTravada = true;
  window.scrollTo(0, y);
  window.requestAnimationFrame(function () {
    rolagemTravada = false;
  });
}

function ligarRolagem() {
  if (window.__nexusRolagem) return;
  window.__nexusRolagem = true;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("scroll", function () {
    if (rolagemTimer) return;
    rolagemTimer = window.setTimeout(function () {
      rolagemTimer = 0;
      guardarRolagem();
    }, 80);
  }, { passive: true });
  window.addEventListener("pagehide", guardarRolagem);
  window.addEventListener("pageshow", function (evento) {
    if (!evento.persisted) return;
    restaurarRolagem();
  });
  window.addEventListener("DOMContentLoaded", restaurarRolagem);
}

/* Primeira visita desta página na sessão: não há valor, fica no topo.
   Ao voltar pela barra, o valor desta página é restaurado. */
function concluirRolagem() {
  ligarRolagem();
  rolagemPronta = true;
  restaurarRolagem();
  window.requestAnimationFrame(function () {
    restaurarRolagem();
  });
}

function focarSemRolar(el) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch (erro) {
    el.focus();
  }
}

function iniciarAba(ativa) {
  montarAbas(ativa);
  concluirRolagem();
  focarSemRolar(document.querySelector("main h1"));
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

/* Tela 4, a resposta do Grande Irmão, fica desligada.
   false: o check-in e o dia difícil voltam para o Hoje.
   true: os dois abrem grande-irmao.html.
   Desenvolvimento é só localhost ou 127.0.0.1.
   ?ia=1 liga a tela só nesse host. Em qualquer outro, o parâmetro não faz nada. */
var NEXUS_ABRIR_TELA_IA_APOS_CHECKIN = false;

function emDesenvolvimento() {
  var host = "";
  try {
    host = String(location.hostname || "");
  } catch (erro) {
    host = "";
  }
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function abrirTelaIaDepoisDoCheckin() {
  if (NEXUS_ABRIR_TELA_IA_APOS_CHECKIN === true) return true;
  if (!emDesenvolvimento()) return false;
  try {
    return new URLSearchParams(location.search).get("ia") === "1";
  } catch (erro) {
    return false;
  }
}

var NexusAbas = {
  montar: montarAbas,
  iniciar: iniciarAba,
  busca: buscaDasAbas,
  concluirRolagem: concluirRolagem,
  focar: focarSemRolar,
  emDev: emDesenvolvimento,
  abrirTelaIa: abrirTelaIaDepoisDoCheckin
};
