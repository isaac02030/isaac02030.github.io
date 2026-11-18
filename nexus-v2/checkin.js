/* Registro de hoje. Tela empilhada em cima do Hoje: o voltar do navegador desfaz o passo.
   A nota só existe no campo. Depois do envio, o campo é limpo. Não gravamos a nota aqui.
   POST /api/checkins manda { mission_id, note }. Não manda difficult (isso é a tela 5).

   Tela 4, a resposta da IA depois do registro, fica desligada.
   O gancho é NEXUS_ABRIR_TELA_IA_APOS_CHECKIN. O padrão é false.
   Não há página da IA neste passo. */

var NEXUS_ABRIR_TELA_IA_APOS_CHECKIN = false;

/* Na branch codex/nexus-council-and-matching-switch (commit ae348817),
   POST /api/checkins responde { checkin, day, already_done, message }.
   checkin traz id, mission_id, user_id, day_number, completed, note, created_at.
   Nenhum desses campos é sinal de crise. A lista fica vazia de propósito:
   não lemos a nota para adivinhar crise. */
var CAMPOS_DE_CRISE_NA_RESPOSTA = [];

var CHAVE_CACHE = "nexus_v2_hoje";
var TEXTO_VAZIO = "Antes de registrar, escreva uma nota curta do que fez.";
var TEXTO_ESTUDO = "Uma frase chega. Diga o que praticou (pelo menos 12 caracteres).";
var TEXTO_ACADEMIA = "Uma frase chega (pelo menos 8 caracteres).";
var TEXTO_INATIVA = "Esta missão não está ativa.";
var TEXTO_TERMINOU = "A missão já terminou.";
var TEXTO_FALHA = "Não foi possível registrar agora. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. O registro fica para quando a conexão voltar.";
var TEXTO_JA = "ja-registrado";
var ESPERA_SUCESSO_MS = 250;
var MS_DIA = 24 * 60 * 60 * 1000;

var ERROS_NOTA_CURTA = {
  "Esta missao exige uma prova curta antes do check-in.": "academia",
  "Esta missao de estudo exige uma nota curta com o que estudaste hoje.": "estudo",
  "Esta missao exige um registo curto do que produziste hoje.": "estudo",
  "Esta missao exige uma nota curta antes do check-in.": "academia"
};

var ciclo = 0;
var missaoAtual = null;
var saindo = false;

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

function icone(caminho) {
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
  traco.setAttribute("d", caminho);
  svg.appendChild(traco);
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  var desenho = tipo === "rede"
    ? "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18"
    : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01";
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(icone(desenho), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  document.getElementById("vista-carregando").hidden = qual !== "carregando";
  document.getElementById("vista-erro").hidden = qual !== "erro";
  document.getElementById("vista-bloqueio").hidden = qual !== "bloqueio";
  document.getElementById("vista-form").hidden = qual !== "form";
  document.getElementById("vista-sucesso").hidden = qual !== "sucesso";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function definirErro(texto) {
  var campo = document.getElementById("nota");
  var aviso = document.getElementById("nota-erro");
  var ajuda = document.getElementById("nota-ajuda");
  if (texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
  } else {
    aviso.hidden = true;
    aviso.textContent = "";
    campo.removeAttribute("aria-invalid");
  }
  if (ajuda) ajuda.hidden = !ajuda.textContent || ajuda.textContent === texto;
}

function definirCarregando(ligado) {
  var botao = document.getElementById("btn-registrar");
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  if (rotulo) rotulo.textContent = ligado ? botao.getAttribute("data-carregando") : botao.getAttribute("data-texto");
  if (spinner) spinner.hidden = !ligado;
}

function limparNota() {
  var campo = document.getElementById("nota");
  if (campo) campo.value = "";
}

function numeroDoDia(startedAt) {
  var inicio = new Date(startedAt);
  if (!startedAt || isNaN(inicio.getTime())) return 1;
  var dia = Math.floor((Date.now() - inicio.getTime()) / MS_DIA) + 1;
  if (dia < 1) return 1;
  return dia;
}

function duracaoDe(missao) {
  var n = Number(missao && missao.duration_days);
  if (!isFinite(n) || n < 1) return 30;
  return Math.min(Math.floor(n), 60);
}

function escolherMissao(lista) {
  if (!Array.isArray(lista)) return null;
  var i;
  for (i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].status === "active") return lista[i];
  }
  for (i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].status === "waiting") return lista[i];
  }
  for (i = 0; i < lista.length; i++) {
    if (lista[i]) return lista[i];
  }
  return null;
}

function lerCache() {
  try {
    var bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || dados.versao !== 1) return null;
    return dados;
  } catch (erro) {
    return null;
  }
}

function regraDaNota(missao) {
  var categoria = missao && missao.category;
  if (categoria === "fitness") return { minimo: 8, ajuda: TEXTO_ACADEMIA };
  if (categoria === "aprendizagem") return { minimo: 12, ajuda: TEXTO_ESTUDO };
  return { minimo: 1, ajuda: "" };
}

function ajudaDoErroDeProva(erro, missao) {
  var tipo = ERROS_NOTA_CURTA[erro];
  if (!tipo) return "";
  var categoria = missao && missao.category;
  if (categoria === "fitness") return TEXTO_ACADEMIA;
  if (categoria === "aprendizagem") return TEXTO_ESTUDO;
  return tipo === "academia" ? TEXTO_ACADEMIA : TEXTO_ESTUDO;
}

function respostaIndicaCrise(dados) {
  if (!dados || typeof dados !== "object") return false;
  var i;
  for (i = 0; i < CAMPOS_DE_CRISE_NA_RESPOSTA.length; i++) {
    if (dados[CAMPOS_DE_CRISE_NA_RESPOSTA[i]] === true) return true;
  }
  return false;
}

function busca() {
  return NexusAbas.busca(["tema", "cenario", "rede"]);
}

function irParaHoje(aviso) {
  if (saindo) return;
  saindo = true;
  if (aviso) {
    try {
      sessionStorage.setItem("nexus_v2_aviso_hoje", aviso);
    } catch (erro) {
      /* Sem sessionStorage, o Hoje abre mesmo assim. */
    }
  }
  location.replace("hoje.html" + busca());
}

function irParaCrise() {
  if (saindo) return;
  saindo = true;
  location.replace("crise.html" + busca());
}

function destinoDepoisDoRegistro() {
  if (NEXUS_ABRIR_TELA_IA_APOS_CHECKIN) return "ia.html" + busca();
  return "hoje.html" + busca();
}

function mostrarBloqueio(texto) {
  document.getElementById("texto-bloqueio").textContent = texto;
  mostrarVista("bloqueio");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function mostrarFalha(tipo, texto) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, texto);
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function preencherForma(missao, semRede) {
  var minimo = typeof missao.daily_minimum === "string" ? missao.daily_minimum.trim() : "";
  var porque = typeof missao.why_it_matters === "string" ? missao.why_it_matters.trim() : "";
  var pergunta = document.getElementById("pergunta");
  pergunta.textContent = minimo
    ? "Você cumpriu o mínimo de hoje: " + minimo + "?"
    : "Você cumpriu o mínimo de hoje?";
  var escreveu = document.getElementById("escreveu");
  if (porque) {
    escreveu.hidden = false;
    escreveu.textContent = "Você escreveu: " + porque;
  } else {
    escreveu.hidden = true;
    escreveu.textContent = "";
  }
  var regra = regraDaNota(missao);
  var ajuda = document.getElementById("nota-ajuda");
  ajuda.textContent = regra.ajuda;
  ajuda.hidden = !regra.ajuda;
  definirErro("");
  esconderAviso(document.getElementById("alerta"));
  if (semRede) mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
  mostrarVista("form");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function missaoTerminou(missao) {
  return numeroDoDia(missao.started_at) > duracaoDe(missao);
}

function decidirMissao(missao, todayDone, semRede) {
  missaoAtual = missao;
  if (!missao || missao.id == null) {
    mostrarBloqueio(TEXTO_INATIVA);
    return;
  }
  if (missaoTerminou(missao)) {
    mostrarBloqueio(TEXTO_TERMINOU);
    return;
  }
  if (missao.status !== "active") {
    mostrarBloqueio(TEXTO_INATIVA);
    return;
  }
  if (todayDone) {
    irParaHoje(TEXTO_JA);
    return;
  }
  preencherForma(missao, semRede);
}

function cacheViraMissao(cache) {
  if (!cache || cache.id == null) return null;
  return {
    id: cache.id,
    status: "active",
    category: cache.category || "",
    proof_mode: cache.proof_mode || "",
    daily_minimum: cache.minimo || "",
    why_it_matters: cache.porque || "",
    started_at: new Date(Date.now() - ((Number(cache.dia) || 1) - 1) * MS_DIA).toISOString(),
    duration_days: cache.duracao || 30
  };
}

function abrirOffline() {
  var cache = lerCache();
  if (cache && cache.hojeFeito) {
    irParaHoje(TEXTO_JA);
    return;
  }
  var missao = cacheViraMissao(cache);
  if (!missao) {
    mostrarFalha("rede", TEXTO_SEM_REDE);
    return;
  }
  if (cache.recuperacao) {
    location.replace("recuperacao.html" + busca());
    return;
  }
  decidirMissao(missao, false, true);
}

async function carregar() {
  var meu = ++ciclo;
  mostrarVista("carregando");
  if (semRedeAgora()) {
    abrirOffline();
    return;
  }

  var lista = await NexusApi.listarMissoes();
  if (meu !== ciclo) return;
  if (!lista.ok) {
    if (lista.semRede) abrirOffline();
    else mostrarFalha("falha", TEXTO_FALHA);
    return;
  }

  var resumo = escolherMissao(lista.dados);
  if (!resumo || resumo.id == null) {
    mostrarBloqueio(TEXTO_INATIVA);
    return;
  }

  var respostas = await Promise.all([
    NexusApi.obterMissao(resumo.id),
    NexusApi.sequenciaDaMissao(resumo.id)
  ]);
  if (meu !== ciclo) return;
  if (!respostas[0].ok || !respostas[1].ok) {
    var falha = respostas[0].semRede ? respostas[0] : respostas[1];
    if (falha.semRede) abrirOffline();
    else mostrarFalha("falha", TEXTO_FALHA);
    return;
  }

  var missao = respostas[0].dados;
  if (!missao || typeof missao !== "object") {
    mostrarFalha("falha", TEXTO_FALHA);
    return;
  }
  var sequencia = respostas[1].dados || {};
  decidirMissao(missao, sequencia.today_done === true, false);
}

function notaEscrita() {
  var campo = document.getElementById("nota");
  return campo ? campo.value.trim() : "";
}

function validarNota() {
  var texto = notaEscrita();
  if (!texto) return TEXTO_VAZIO;
  var regra = regraDaNota(missaoAtual);
  if (texto.length < regra.minimo) return regra.ajuda || TEXTO_VAZIO;
  return "";
}

function mostrarSucesso() {
  mostrarVista("sucesso");
  var caixa = document.getElementById("sucesso");
  caixa.classList.remove("visivel");
  var texto = document.createElement("span");
  texto.textContent = "Registro feito. Palavra cumprida hoje.";
  caixa.replaceChildren(
    icone("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"),
    texto
  );
  NexusAbas.focar(document.getElementById("titulo"));
  var reduzido = false;
  try {
    reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (erro) {
    reduzido = false;
  }
  function seguir() {
    if (saindo) return;
    saindo = true;
    location.replace(destinoDepoisDoRegistro());
  }
  if (reduzido) {
    caixa.classList.add("visivel");
    window.setTimeout(seguir, 0);
    return;
  }
  window.requestAnimationFrame(function () {
    caixa.classList.add("visivel");
  });
  window.setTimeout(seguir, ESPERA_SUCESSO_MS);
}

function tratarResposta(resultado) {
  if (!resultado || resultado.semRede) {
    mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
    return;
  }
  var dados = resultado.dados || {};
  if (resultado.ok) {
    limparNota();
    if (respostaIndicaCrise(dados)) {
      irParaCrise();
      return;
    }
    if (dados.already_done === true) {
      irParaHoje(TEXTO_JA);
      return;
    }
    mostrarSucesso();
    return;
  }
  var erro = typeof resultado.erro === "string" ? resultado.erro : "";
  if (resultado.status === 400 && erro === "Missão não está ativa.") {
    mostrarBloqueio(TEXTO_INATIVA);
    return;
  }
  if (resultado.status === 400 && erro === "A missão já terminou.") {
    mostrarBloqueio(TEXTO_TERMINOU);
    return;
  }
  var ajuda = ajudaDoErroDeProva(erro, missaoAtual);
  if (resultado.status === 400 && ajuda) {
    definirErro(ajuda);
    document.getElementById("nota").focus();
    return;
  }
  mostrarAviso(document.getElementById("alerta"), "falha", TEXTO_FALHA);
}

async function enviar(evento) {
  evento.preventDefault();
  if (saindo) return;
  esconderAviso(document.getElementById("alerta"));
  if (semRedeAgora()) {
    definirErro("");
    mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
    return;
  }
  var problema = validarNota();
  if (problema) {
    definirErro(problema);
    document.getElementById("nota").focus();
    return;
  }
  definirErro("");
  if (!missaoAtual || missaoAtual.id == null) {
    mostrarBloqueio(TEXTO_INATIVA);
    return;
  }
  definirCarregando(true);
  var resultado = await NexusApi.registrarDia(missaoAtual.id, notaEscrita());
  if (saindo) return;
  definirCarregando(false);
  tratarResposta(resultado);
}

function ligarLinks() {
  var extra = busca();
  document.getElementById("voltar").href = "hoje.html" + extra;
  document.getElementById("link-dificil").href = "dia-dificil.html" + extra;
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  ligarLinks();
  document.getElementById("form-nota").addEventListener("submit", enviar);
  document.getElementById("btn-tentar").addEventListener("click", function () {
    carregar();
  });
  document.getElementById("nota").addEventListener("input", function () {
    if (document.getElementById("nota").getAttribute("aria-invalid") === "true") definirErro("");
  });
  NexusAbas.focar(document.getElementById("titulo"));
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  carregar();
}

iniciar();
