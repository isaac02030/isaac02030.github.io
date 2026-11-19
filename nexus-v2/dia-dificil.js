/* Dia difícil. Tela empilhada em cima do check-in: Voltar, sem barra de abas.
   POST /api/checkins manda { mission_id, note, difficult: true }.
   O sucesso só aparece num 2xx com checkin.difficult === true.
   A nota é o rascunho da aba, o mesmo do check-in. Some só depois do registro.
   Tela 4 fica desligada. A flag é NEXUS_ABRIR_TELA_IA_APOS_CHECKIN, em abas.js.
   O padrão é false. ?ia=1 liga nesta URL só em localhost ou 127.0.0.1.
   Com a flag ligada, o registro feito abre grande-irmao.html e a tela não fecha sozinha.
   Sem isso, a volta continua sendo o Hoje.
   Se o registro veio da volta ao ciclo, o aviso é
   «Você voltou. O ciclo continua.» */

var CHAVE_CACHE = "nexus_v2_hoje";
var CHAVE_RASCUNHO = "nexus_v2_rascunho_checkin";
var TEXTO_APOIO = "Você tem 4 destes dias na missão, e não pode usar mais de 2 seguidos.";
var TEXTO_SEGUIDOS = "Você já usou 2 dias difíceis seguidos. Hoje o dia conta no ritmo normal. Se não der, a recuperação está te esperando.";
var TEXTO_QUATRO = "Os 4 dias difíceis desta missão já foram usados. Hoje é um dia normal.";
var MSG_QUATRO = "Você já usou os 4 dias difíceis desta missão.";
var MSG_SEGUIDOS = "Não dá para ter mais de 2 dias difíceis seguidos.";
var TEXTO_VAZIO = "Antes de registrar, escreva uma nota curta do que fez.";
var TEXTO_ESTUDO = "Uma frase chega. Diga o que praticou (pelo menos 12 caracteres).";
var TEXTO_ACADEMIA = "Uma frase chega (pelo menos 8 caracteres).";
var TEXTO_INATIVA = "Esta missão não está ativa.";
var TEXTO_TERMINOU = "A missão já terminou.";
var TEXTO_FALHA = "Não foi possível registrar agora. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Sua nota continua aqui. Tente de novo quando a conexão voltar.";
var TEXTO_SEM_REDE_SEM_NOTA = "Sem internet. Tente de novo quando a conexão voltar.";
var TEXTO_JA = "ja-registrado";
var TEXTO_SUCESSO = "Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.";
var TEXTO_VOLTOU = "Você voltou. O ciclo continua.";
var CHAVE_ORIGEM = "nexus_v2_origem_recuperacao";
var CHAVE_PASSO = "nexus_v2_passo_grande_irmao";
var ESPERA_SUCESSO_MS = 300;
var voltaPelaSequencia = false;
var MS_DIA = 24 * 60 * 60 * 1000;

var ERROS_NOTA_CURTA = {
  "Esta missao exige uma prova curta antes do check-in.": "academia",
  "Esta missao de estudo exige uma nota curta com o que estudaste hoje.": "estudo",
  "Esta missao exige um registo curto do que produziste hoje.": "estudo",
  "Esta missao exige uma nota curta antes do check-in.": "academia"
};

var CAMPOS_DE_CRISE_NA_RESPOSTA = [];

var ciclo = 0;
var missaoAtual = null;
var saindo = false;
var rascunhoFechado = false;

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
  document.getElementById("vista-limite").hidden = qual !== "limite";
  document.getElementById("vista-form").hidden = qual !== "form";
  document.getElementById("vista-sucesso").hidden = qual !== "sucesso";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function descreverNota(campo, comErro) {
  var ajuda = document.getElementById("nota-ajuda");
  var ids = [];
  if (ajuda && !ajuda.hidden && ajuda.textContent) ids.push("nota-ajuda");
  if (comErro) ids.push("nota-erro");
  if (ids.length) campo.setAttribute("aria-describedby", ids.join(" "));
  else campo.removeAttribute("aria-describedby");
}

function definirErro(texto) {
  var campo = document.getElementById("nota");
  var aviso = document.getElementById("nota-erro");
  var ajuda = document.getElementById("nota-ajuda");
  if (texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
    if (ajuda) ajuda.hidden = !ajuda.textContent || ajuda.textContent === texto;
    descreverNota(campo, true);
  } else {
    aviso.hidden = true;
    aviso.textContent = "";
    campo.removeAttribute("aria-invalid");
    if (ajuda) ajuda.hidden = !ajuda.textContent;
    descreverNota(campo, false);
  }
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

function lerRascunho() {
  try {
    var bruto = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || typeof dados.note !== "string") return null;
    return dados;
  } catch (erro) {
    return null;
  }
}

function guardarRascunho(id, dia, nota) {
  try {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
      mission_id: id,
      day: dia,
      note: typeof nota === "string" ? nota : ""
    }));
  } catch (erro) {
    /* Sem sessionStorage, a nota continua no campo desta página. */
  }
}

function limparRascunho() {
  rascunhoFechado = true;
  try {
    sessionStorage.removeItem(CHAVE_RASCUNHO);
  } catch (erro) {}
}

function guardarNotaDoCampo() {
  if (rascunhoFechado || saindo) return;
  if (!missaoAtual || missaoAtual.id == null) return;
  var form = document.getElementById("vista-form");
  if (!form || form.hidden) return;
  var campo = document.getElementById("nota");
  if (!campo) return;
  guardarRascunho(missaoAtual.id, numeroDoDia(missaoAtual.started_at), campo.value);
}

function aplicarRascunho() {
  if (!missaoAtual || missaoAtual.id == null) return;
  var dados = lerRascunho();
  if (!dados) return;
  if (String(dados.mission_id) !== String(missaoAtual.id)) return;
  if (Number(dados.day) !== numeroDoDia(missaoAtual.started_at)) return;
  var campo = document.getElementById("nota");
  if (campo) campo.value = dados.note;
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

function diaNaLista(lista, dia) {
  if (!Array.isArray(lista)) return false;
  var i;
  for (i = 0; i < lista.length; i++) {
    if (Number(lista[i]) === dia) return true;
  }
  return false;
}

/* O servidor manda a verdade. Sem o campo, não inventamos o bloqueio.
   remaining 0 vem antes dos 2 seguidos, como na validação da rota. */
function limiteDaSequencia(sequencia, dia) {
  if (!sequencia || typeof sequencia !== "object") return "";
  if (sequencia.difficult_days_remaining === 0) return "quatro";
  if (dia < 3) return "";
  if (diaNaLista(sequencia.difficult_days, dia - 1) && diaNaLista(sequencia.difficult_days, dia - 2)) {
    return "seguidos";
  }
  return "";
}

/* O Hoje guarda restantes só quando é maior que zero. Quatro dias na lista
   é o restante 0 que o cache não consegue escrever. */
function sequenciaDoCache(cache) {
  var seq = { today_done: !!(cache && cache.hojeFeito) };
  if (!cache || !Array.isArray(cache.dificeis)) return seq;
  seq.difficult_days = cache.dificeis;
  if (typeof cache.restantes === "number" && cache.restantes > 0) {
    seq.difficult_days_remaining = cache.restantes;
  } else if (cache.dificeis.length >= 4) {
    seq.difficult_days_remaining = 0;
  }
  return seq;
}

function busca() {
  return NexusAbas.busca(["tema", "cenario", "rede", "ia"]);
}

function buscaHoje() {
  return NexusAbas.busca(["tema", "cenario", "rede"]);
}

function sequenciaIndicaVolta(sequencia) {
  if (!sequencia || typeof sequencia !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(sequencia, "missed_days_before_today")) return false;
  var n = sequencia.missed_days_before_today;
  return typeof n === "number" && isFinite(n) && n > 0;
}

function guardarPassoGrandeIrmao(tipo, recuperacao) {
  try {
    sessionStorage.setItem(CHAVE_PASSO, JSON.stringify({
      tipo: tipo === "dificil" ? "dificil" : "checkin",
      recuperacao: recuperacao === true
    }));
  } catch (erro) {}
}

function destinoDepoisDoRegistro() {
  if (NexusAbas.abrirTelaIa()) return "grande-irmao.html" + busca();
  return "hoje.html" + buscaHoje();
}

function veioDaRecuperacao() {
  try {
    return sessionStorage.getItem(CHAVE_ORIGEM) === "1";
  } catch (erro) {
    return false;
  }
}

function limparOrigemRecuperacao() {
  try {
    sessionStorage.removeItem(CHAVE_ORIGEM);
  } catch (erro) {}
}

function guardarAvisoDeVolta(codigo) {
  try {
    sessionStorage.setItem("nexus_v2_aviso_hoje", codigo);
  } catch (erro) {}
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
  location.replace("hoje.html" + buscaHoje());
}

function irParaCrise() {
  if (saindo) return;
  saindo = true;
  location.replace("crise.html" + busca());
}

function mostrarBloqueio(texto) {
  document.getElementById("texto-bloqueio").textContent = texto;
  mostrarVista("bloqueio");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function mostrarLimite(tipo) {
  guardarNotaDoCampo();
  document.getElementById("texto-limite").textContent = tipo === "quatro" ? TEXTO_QUATRO : TEXTO_SEGUIDOS;
  mostrarVista("limite");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function mostrarFalha(tipo, texto) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, texto);
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function textoApoio(sequencia) {
  var frase = TEXTO_APOIO;
  if (sequencia && typeof sequencia.difficult_days_remaining === "number" && isFinite(sequencia.difficult_days_remaining)) {
    frase += " Ainda restam " + sequencia.difficult_days_remaining + ".";
  }
  return frase;
}

function preencherForma(missao, sequencia, semRede) {
  document.getElementById("apoio").textContent = textoApoio(sequencia);
  var minimo = typeof missao.daily_minimum === "string" ? missao.daily_minimum : "";
  var bloco = document.getElementById("bloco-minimo");
  var valor = document.getElementById("minimo-valor");
  if (minimo.trim()) {
    valor.textContent = minimo;
    bloco.hidden = false;
  } else {
    valor.textContent = "";
    bloco.hidden = true;
  }
  var regra = regraDaNota(missao);
  var ajuda = document.getElementById("nota-ajuda");
  ajuda.textContent = regra.ajuda;
  ajuda.hidden = !regra.ajuda;
  definirErro("");
  esconderAviso(document.getElementById("alerta"));
  aplicarRascunho();
  if (semRede) mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
  mostrarVista("form");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function missaoTerminou(missao) {
  return numeroDoDia(missao.started_at) > duracaoDe(missao);
}

function decidirMissao(missao, sequencia, semRede) {
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
  if (sequencia && sequencia.today_done === true) {
    irParaHoje(TEXTO_JA);
    return;
  }
  var limite = limiteDaSequencia(sequencia, numeroDoDia(missao.started_at));
  if (limite) {
    mostrarLimite(limite);
    return;
  }
  preencherForma(missao, sequencia, semRede);
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
    mostrarFalha("rede", TEXTO_SEM_REDE_SEM_NOTA);
    return;
  }
  decidirMissao(missao, sequenciaDoCache(cache), true);
}

async function carregar() {
  var meu = ++ciclo;
  voltaPelaSequencia = false;
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
  voltaPelaSequencia = sequenciaIndicaVolta(sequencia);
  decidirMissao(missao, sequencia, false);
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
  limparRascunho();
  limparNota();
  var caixa = document.getElementById("sucesso");
  caixa.classList.remove("visivel");
  caixa.replaceChildren();
  mostrarVista("sucesso");
  NexusAbas.focar(document.getElementById("titulo"));
  var reduzido = false;
  try {
    reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (erro) {
    reduzido = false;
  }
  var daVolta = veioDaRecuperacao();
  var fraseVolta = daVolta || voltaPelaSequencia;
  var anunciarVolta = NexusAbas.abrirTelaIa() ? fraseVolta : daVolta;
  function anunciar() {
    var texto = document.createElement("span");
    texto.textContent = anunciarVolta ? TEXTO_VOLTOU : TEXTO_SUCESSO;
    caixa.replaceChildren(
      icone("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"),
      texto
    );
  }
  function seguir() {
    if (saindo) return;
    saindo = true;
    if (daVolta) {
      limparOrigemRecuperacao();
      guardarAvisoDeVolta("voltou");
    }
    if (NexusAbas.abrirTelaIa()) guardarPassoGrandeIrmao("dificil", fraseVolta);
    location.replace(destinoDepoisDoRegistro());
  }
  function sairDepois() {
    window.setTimeout(seguir, ESPERA_SUCESSO_MS);
  }
  if (reduzido) {
    anunciar();
    caixa.classList.add("visivel");
    sairDepois();
    return;
  }
  window.requestAnimationFrame(function () {
    anunciar();
    window.requestAnimationFrame(function () {
      caixa.classList.add("visivel");
      sairDepois();
    });
  });
}

function tratarResposta(resultado) {
  if (!resultado || resultado.semRede) {
    mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
    return;
  }
  var dados = resultado.dados || {};
  if (resultado.ok) {
    if (respostaIndicaCrise(dados)) {
      irParaCrise();
      return;
    }
    if (dados.already_done === true) {
      limparOrigemRecuperacao();
      irParaHoje(TEXTO_JA);
      return;
    }
    if (!dados.checkin || dados.checkin.difficult !== true) {
      mostrarAviso(document.getElementById("alerta"), "falha", TEXTO_FALHA);
      return;
    }
    mostrarSucesso();
    return;
  }
  var erro = typeof resultado.erro === "string" ? resultado.erro : "";
  if (resultado.status === 400 && erro === MSG_QUATRO) {
    mostrarLimite("quatro");
    return;
  }
  if (resultado.status === 400 && erro === MSG_SEGUIDOS) {
    mostrarLimite("seguidos");
    return;
  }
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
    guardarNotaDoCampo();
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
  guardarNotaDoCampo();
  definirCarregando(true);
  var resultado = await NexusApi.registrarDiaDificil(missaoAtual.id, notaEscrita());
  if (saindo) return;
  definirCarregando(false);
  tratarResposta(resultado);
}

function ligarLinks() {
  var extra = busca();
  document.getElementById("voltar").href = "checkin.html" + extra;
  document.getElementById("btn-dia-normal").href = "checkin.html" + extra;
  document.getElementById("btn-voltar-hoje").href = "hoje.html" + buscaHoje();
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
    var campo = document.getElementById("nota");
    if (campo.getAttribute("aria-invalid") === "true") {
      var problema = validarNota();
      if (!problema) definirErro("");
      else if (document.getElementById("nota-erro").textContent !== problema) definirErro(problema);
    }
    guardarNotaDoCampo();
  });
  document.getElementById("voltar").addEventListener("click", guardarNotaDoCampo);
  document.getElementById("btn-dia-normal").addEventListener("click", guardarNotaDoCampo);
  window.addEventListener("pagehide", guardarNotaDoCampo);
  window.addEventListener("pageshow", function (evento) {
    if (!evento.persisted) return;
    if (document.getElementById("vista-form").hidden) return;
    aplicarRascunho();
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
