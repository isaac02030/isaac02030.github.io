/* Tela Ajustes. Horário, aviso no iPhone e saída da conta.
   O interruptor do Grande Irmão fica para outra etapa. */

var CHAVE_TOKEN = "nexus_v2_token";
var CHAVE_USUARIO = "nexus_v2_user";
var CHAVE_LEMBRETE = "nexus_v2_lembrete";
var HORA_PADRAO = "20:00";
var TEXTO_HORA = "Escolha o horário do lembrete.";
var TEXTO_OK = "Horário salvo.";
var TEXTO_OFF = "Não foi possível salvar agora. Tente de novo quando houver rede.";
var TEXTO_FALHA = "Não foi possível salvar agora. Tente de novo.";

function cenarioDaPagina() {
  try {
    return new URLSearchParams(location.search).get("cenario") || "";
  } catch (erro) {
    return "";
  }
}

function semRedeAgora() {
  var rede = "";
  try {
    rede = new URLSearchParams(location.search).get("rede") || "";
  } catch (erro) {
    rede = "";
  }
  return rede === "off" || navigator.onLine === false;
}

function buscaTema() {
  var tema = "";
  try {
    tema = new URLSearchParams(location.search).get("tema") || "";
  } catch (erro) {
    tema = "";
  }
  if (tema === "claro" || tema === "escuro" || tema === "sistema") return "?tema=" + tema;
  return "";
}

function normalizarHora(valor) {
  if (typeof valor !== "string") return "";
  var achado = valor.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!achado) return "";
  return achado[1] + ":" + achado[2];
}

function fusoHorario() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (erro) {
    return "UTC";
  }
}

function icone(tipo) {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icone");
  var traco = document.createElementNS("http://www.w3.org/2000/svg", "path");
  traco.setAttribute("fill", "none");
  traco.setAttribute("stroke", "currentColor");
  traco.setAttribute("stroke-width", "2");
  traco.setAttribute("stroke-linecap", "round");
  traco.setAttribute("stroke-linejoin", "round");
  if (tipo === "ok") {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9");
  } else if (tipo === "rede") {
    traco.setAttribute("d", "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18");
  } else {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
  }
  svg.appendChild(traco);
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  var erro = tipo !== "ok";
  el.className = "alerta" + (tipo === "ok" ? " alerta-ok" : " alerta-rede");
  el.setAttribute("role", erro ? "alert" : "status");
  el.setAttribute("aria-live", erro ? "assertive" : "polite");
  el.replaceChildren(icone(tipo), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function definirErro(texto) {
  var campo = document.getElementById("horario");
  var aviso = document.getElementById("erro-horario");
  if (texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
    return;
  }
  aviso.hidden = true;
  aviso.textContent = "";
  campo.removeAttribute("aria-invalid");
}

function definirCarregando(botao, ligado) {
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  if (rotulo) {
    rotulo.textContent = ligado ? botao.getAttribute("data-carregando") : botao.getAttribute("data-texto");
  }
  if (spinner) spinner.hidden = !ligado;
}

function aplicarHorarioGuardado() {
  var campo = document.getElementById("horario");
  var hora = "";
  try {
    var bruto = localStorage.getItem(CHAVE_LEMBRETE);
    if (bruto) {
      var dados = JSON.parse(bruto);
      hora = normalizarHora(dados && dados.reminder_time);
    }
  } catch (erro) {
    hora = "";
  }
  campo.value = hora || HORA_PADRAO;
}

function guardarLembreteLocal(hora) {
  try {
    localStorage.setItem(CHAVE_LEMBRETE, JSON.stringify({
      reminder_time: hora,
      timezone: fusoHorario()
    }));
  } catch (erro) {
    /* O horário continua no campo. A confirmação só aparece se o servidor aceitar. */
  }
}

function instaladoNaTelaInicial() {
  var modoSolto = false;
  try {
    modoSolto = window.matchMedia("(display-mode: standalone)").matches;
  } catch (erro) {
    modoSolto = false;
  }
  return navigator.standalone === true || modoSolto;
}

/* iPhone, iPad e iPadOS (que se apresenta como Mac com toque). */
function ehIOS() {
  var agente = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(agente)) return true;
  var plataforma = navigator.platform || "";
  return plataforma === "MacIntel" && navigator.maxTouchPoints > 1;
}

/* O texto é o mesmo do passo 3 do começo.
   Só aparece no iPhone ou iPad, e some se o app já está na Tela de Início. */
function atualizarNotaIphone() {
  var bloco = document.getElementById("bloco-iphone");
  if (!bloco) return;
  bloco.hidden = !(ehIOS() && !instaladoNaTelaInicial());
}

async function salvarHorario(evento) {
  evento.preventDefault();
  var form = evento.currentTarget;
  if (form.dataset.ocupado === "sim") return;
  var campo = document.getElementById("horario");
  var aviso = document.getElementById("aviso-lembrete");
  var botao = document.getElementById("btn-salvar");
  var hora = normalizarHora(campo.value);
  esconderAviso(aviso);
  definirErro("");
  if (!hora) {
    definirErro(TEXTO_HORA);
    campo.focus();
    return;
  }
  if (semRedeAgora()) {
    mostrarAviso(aviso, "rede", TEXTO_OFF);
    evitarCorte();
    return;
  }
  /* A rota ainda não existe no servidor de verdade.
     Fora de localhost, 127.0.0.1 e [::1], não chamamos o mock
     e não dizemos que o horário foi salvo. O valor guardado fica como está.
     O número digitado continua no campo. */
  if (!NexusAbas.emDev()) {
    mostrarAviso(aviso, "falha", TEXTO_FALHA);
    evitarCorte();
    return;
  }
  form.dataset.ocupado = "sim";
  definirCarregando(botao, true);
  try {
    var resultado = await NexusApi.saveReminderTime({
      reminder_time: hora,
      timezone: fusoHorario()
    });
    if (!resultado || resultado.semRede) {
      mostrarAviso(aviso, "rede", TEXTO_OFF);
      return;
    }
    if (!resultado.ok) {
      mostrarAviso(aviso, "falha", TEXTO_FALHA);
      return;
    }
    guardarLembreteLocal(hora);
    mostrarAviso(aviso, "ok", TEXTO_OK);
  } catch (erro) {
    mostrarAviso(aviso, "falha", TEXTO_FALHA);
  } finally {
    form.dataset.ocupado = "";
    definirCarregando(botao, false);
    evitarCorte();
  }
}

/* Se um bloco fica cortado pela barra, sobe só o bastante para ele aparecer inteiro. */
function evitarCorte() {
  var barra = document.getElementById("abas");
  if (!barra) return;
  var limite = barra.getBoundingClientRect().top - 8;
  var corte = 0;
  ["titulo-sair", "btn-pedir-saida", "btn-sair", "btn-cancelar", "aviso-lembrete"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el || !el.offsetParent) return;
    var caixa = el.getBoundingClientRect();
    if (caixa.top < limite && caixa.bottom > limite) {
      corte = Math.max(corte, caixa.bottom - limite);
    }
  });
  if (corte > 0) window.scrollBy(0, Math.ceil(corte + 4));
}

function focar(el) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch (erro) {
    el.focus();
  }
}

function pedirSaida() {
  var botao = document.getElementById("btn-pedir-saida");
  var box = document.getElementById("confirma-sair");
  botao.hidden = true;
  botao.setAttribute("aria-expanded", "true");
  box.hidden = false;
  evitarCorte();
  focar(document.getElementById("btn-cancelar"));
}

function cancelarSaida() {
  var botao = document.getElementById("btn-pedir-saida");
  document.getElementById("confirma-sair").hidden = true;
  botao.hidden = false;
  botao.setAttribute("aria-expanded", "false");
  focar(botao);
}

/* O token e o usuário saem, como na saída antiga.
   Os rascunhos desta aba também saem: nota, missão pela metade e o dia guardado.
   O tema do aparelho fica. */
function limparSessao() {
  try {
    localStorage.removeItem(CHAVE_TOKEN);
    localStorage.removeItem(CHAVE_USUARIO);
  } catch (erro) {}
  try {
    var i = sessionStorage.length;
    while (i > 0) {
      i -= 1;
      var chave = sessionStorage.key(i);
      if (chave && chave.indexOf("nexus_v2_") === 0) sessionStorage.removeItem(chave);
    }
  } catch (erroSessao) {}
}

function sairDaConta() {
  var sair = document.getElementById("btn-sair");
  var cancelar = document.getElementById("btn-cancelar");
  if (sair) sair.disabled = true;
  if (cancelar) cancelar.disabled = true;
  limparSessao();
  location.replace("./" + buscaTema());
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function irParaEntrarSeSemSessao() {
  var token = "";
  try {
    token = localStorage.getItem(CHAVE_TOKEN) || "";
  } catch (erro) {
    token = "";
  }
  if (token) return;
  location.replace("./" + buscaTema());
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  var link = document.getElementById("link-ajuda");
  if (link) link.href = "crise.html" + NexusAbas.busca(["tema", "cenario", "rede"]);
  aplicarHorarioGuardado();
  atualizarNotaIphone();

  document.getElementById("form-lembrete").addEventListener("submit", salvarHorario);
  document.getElementById("horario").addEventListener("input", function () {
    if (document.getElementById("horario").getAttribute("aria-invalid") === "true") definirErro("");
  });
  document.getElementById("btn-pedir-saida").addEventListener("click", pedirSaida);
  document.getElementById("btn-cancelar").addEventListener("click", cancelarSaida);
  document.getElementById("btn-sair").addEventListener("click", sairDaConta);

  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  window.addEventListener("pageshow", irParaEntrarSeSemSessao);

  if (window.NexusDados) NexusDados.aplicar(document);
  document.getElementById("link-meus-dados").href = "meus-dados.html" + buscaTema();
  NexusAbas.iniciar("ajustes");
}

iniciar();
