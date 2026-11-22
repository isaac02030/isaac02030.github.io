/* Registro de hoje. Tela empilhada em cima do Hoje: o voltar do navegador desfaz o passo.
   POST /api/checkins manda { mission_id, note }. Não manda difficult (isso é a tela 5).
   A nota fica no rascunho desta aba, o mesmo da tela de dia difícil.
   O rascunho some só depois de um registro feito. Não é fila de envio.

   Tela 4, a resposta do Grande Irmão, fica desligada.
   A flag é NEXUS_ABRIR_TELA_IA_APOS_CHECKIN, em abas.js. O padrão é false.
   ?ia=1 liga nesta URL só em localhost ou 127.0.0.1. Em outro host, não faz nada.
   Com a flag ligada, o registro feito abre grande-irmao.html e a tela não fecha sozinha.
   Sem isso, a ida continua sendo o Hoje.
   Se o registro veio da volta ao ciclo, o aviso é
   «Você voltou. O ciclo continua.» */

/* Na branch codex/nexus-council-and-matching-switch (commit ae348817),
   POST /api/checkins responde { checkin, day, already_done, message }.
   checkin traz id, mission_id, user_id, day_number, completed, note, created_at.
   Nenhum desses campos é sinal de crise. A lista fica vazia de propósito:
   não lemos a nota para adivinhar crise. */
/* O servidor manda crisis: true (e crisis_level) em qualquer resposta do
   check-in quando o filtro de crise dispara, inclusive em 201 e em erro.
   A tela abre a ajuda e apaga o rascunho: a frase de crise não fica guardada. */
var CAMPOS_DE_CRISE_NA_RESPOSTA = ["crisis"];

var CHAVE_CACHE = "nexus_v2_hoje";
var CHAVE_RASCUNHO = "nexus_v2_rascunho_checkin";
var TEXTO_VAZIO = "Antes de registrar, escreva uma nota curta do que fez.";
var TEXTO_ESTUDO = "Uma frase chega. Diga o que praticou (pelo menos 12 caracteres).";
var TEXTO_ACADEMIA = "Uma frase chega (pelo menos 8 caracteres).";
var TEXTO_INATIVA = "Esta missão não está ativa.";
var TEXTO_TERMINOU = "A missão já terminou.";
var TEXTO_FALHA = "Não foi possível registrar agora. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Sua nota continua aqui. Tente de novo quando a conexão voltar.";
/* Limite de 280 caracteres (nota-limite.js). O servidor confere de novo. */
var TEXTO_LONGA = "A nota passou de 280 caracteres. Encurte um pouco e envie de novo.";
var atualizarContador = function () {};
var TEXTO_SEM_REDE_SEM_NOTA = "Sem internet. Tente de novo quando a conexão voltar.";
var TEXTO_JA = "ja-registrado";
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

/* Escolha da nota (PR 27): "yes", "no", null (nunca respondeu) ou
   "desconhecida" (não deu para ler; a pergunta não aparece e a linha de
   apoio também não, para nunca dizer algo falso). */
var escolhaNota = "desconhecida";
var TITULO_REGISTRO = "Registro de hoje";

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
  document.getElementById("vista-form").hidden = qual !== "form";
  document.getElementById("vista-pergunta").hidden = qual !== "pergunta";
  document.getElementById("titulo").textContent = qual === "pergunta" ? NexusDados.texto("perguntaTitulo") : TITULO_REGISTRO;
  document.getElementById("vista-sucesso").hidden = qual !== "sucesso";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function descreverNota(campo, comErro) {
  var ajuda = document.getElementById("nota-ajuda");
  var ids = [];
  if (ajuda && !ajuda.hidden && ajuda.textContent) ids.push("nota-ajuda");
  if (document.getElementById("nota-contador")) ids.push("nota-contador");
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

function limparNota() {
  var campo = document.getElementById("nota");
  if (campo) campo.value = "";
  atualizarContador();
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
  atualizarContador();
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
  return Math.min(Math.floor(n), 96);
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
  limparRascunho();
  limparNota();
  saindo = true;
  location.replace("crise.html" + busca());
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

/* Dia livre: as frases do Hoje, com o próximo dia da missão.
   Fica só o «Voltar a Hoje» de baixo; o «Voltar» do topo some para não repetir. */
var diasDaSequencia = null;
function mostrarDiaLivre(missao) {
  mostrarBloqueio(NexusDias.fraseDiaLivre(missao, diasDaSequencia));
  document.getElementById("voltar").hidden = true;
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
  var minimo = typeof missao.daily_minimum === "string" ? missao.daily_minimum : "";
  var porque = typeof missao.why_it_matters === "string" ? missao.why_it_matters.trim() : "";
  var linha = document.getElementById("minimo-hoje");
  var valor = document.getElementById("minimo-valor");
  if (minimo.trim()) {
    valor.textContent = minimo;
    linha.hidden = false;
  } else {
    valor.textContent = "";
    linha.hidden = true;
  }
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
  aplicarRascunho();
  if (semRede) mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
  /* Primeiro check-in: a pergunta antes do campo da nota. */
  if (!semRede && escolhaNota === null) {
    mostrarPergunta();
    return;
  }
  mostrarFormulario();
}

function pintarApoioDaNota() {
  var linha = document.getElementById("nota-guarda");
  if (escolhaNota === "yes" || escolhaNota === "no") {
    linha.textContent = NexusDados.texto(escolhaNota === "yes" ? "apoioSim" : "apoioNao");
    linha.hidden = false;
  } else {
    linha.textContent = "";
    linha.hidden = true;
  }
  var campo = document.getElementById("nota");
  var ids = (campo.getAttribute("aria-describedby") || "").split(/\s+/).filter(function (id) { return id && id !== "nota-guarda"; });
  if (!linha.hidden) ids.push("nota-guarda");
  campo.setAttribute("aria-describedby", ids.join(" "));
}

function mostrarFormulario() {
  pintarApoioDaNota();
  mostrarVista("form");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function mostrarPergunta() {
  esconderAviso(document.getElementById("alerta-pergunta"));
  mostrarVista("pergunta");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

/* «Sim» só vale depois que o servidor confirma. */
async function responderSim() {
  var botao = document.getElementById("btn-guardar-notas");
  if (botao.disabled) return;
  var alerta = document.getElementById("alerta-pergunta");
  esconderAviso(alerta);
  if (semRedeAgora()) {
    mostrarAviso(alerta, "rede", NexusDados.texto("escolhaSemRede"));
    return;
  }
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  var resultado = await NexusApi.guardarNotas();
  botao.disabled = false;
  botao.setAttribute("aria-busy", "false");
  if (resultado.sessaoEncerrada) return;
  if (resultado.ok && resultado.dados && resultado.dados.note_consent === "yes") {
    escolhaNota = "yes";
    mostrarFormulario();
    return;
  }
  /* Neutro: é falha do servidor ou da rede, não de quem respondeu. */
  mostrarAviso(alerta, "rede", resultado.semRede ? NexusDados.texto("escolhaSemRede") : NexusDados.texto("guardarEscolhaErro"));
}

/* «Não guardar» nunca falha nem espera: o padrão seguro já é não guardar.
   O pedido grava o «não» para a pergunta não voltar; se falhar, ela volta
   no próximo check-in e nada é guardado. */
function responderNao() {
  escolhaNota = "no";
  if (!semRedeAgora()) {
    NexusApi.naoGuardarNotas().catch(function () {});
  }
  mostrarFormulario();
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
    mostrarFalha("rede", TEXTO_SEM_REDE_SEM_NOTA);
    return;
  }
  decidirMissao(missao, false, true);
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
    NexusApi.sequenciaDaMissao(resumo.id),
    NexusApi.escolhaDaNota()
  ]);
  /* A escolha da nota não impede o registro: sem ela, a tela segue sem a
     pergunta e sem a linha de apoio (o servidor decide o que guarda). */
  var escolha = respostas[2];
  if (escolha && escolha.ok && escolha.dados) {
    var valor = escolha.dados.note_consent;
    escolhaNota = valor === "yes" || valor === "no" ? valor : null;
  } else {
    escolhaNota = "desconhecida";
  }
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
  /* Dia livre (dias-da-missao.js): a mesma frase do servidor, sem erro e sem formulário. */
  diasDaSequencia = Array.isArray(sequencia.mission_weekdays) ? sequencia.mission_weekdays : null;
  if (sequencia.today_is_mission_day === false && sequencia.today_done !== true && missao.status === "active") {
    mostrarDiaLivre(missao);
    return;
  }
  decidirMissao(missao, sequencia.today_done === true, false);
}

function notaEscrita() {
  var campo = document.getElementById("nota");
  return campo ? campo.value.trim() : "";
}

function validarNota() {
  var texto = notaEscrita();
  if (!texto) return TEXTO_VAZIO;
  /* Rascunho antigo posto por código pode passar do maxlength. */
  if (window.NexusNota && NexusNota.passou(texto)) return TEXTO_LONGA;
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
    texto.textContent = anunciarVolta ? TEXTO_VOLTOU : "Registro feito. Palavra cumprida hoje.";
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
    if (NexusAbas.abrirTelaIa()) guardarPassoGrandeIrmao("checkin", fraseVolta);
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

/* Sem note_saved, a cópia do dia neste aparelho não guarda a nota: o Hoje
   não mostra «Ver a nota de hoje». */
function esquecerNotaDoAparelho() {
  try {
    var bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return;
    var cache = JSON.parse(bruto);
    if (cache && typeof cache === "object" && cache.nota) {
      cache.nota = "";
      localStorage.setItem(CHAVE_CACHE, JSON.stringify(cache));
    }
  } catch (erro) {}
}

function tratarResposta(resultado) {
  if (!resultado || resultado.semRede) {
    mostrarAviso(document.getElementById("alerta"), "rede", TEXTO_SEM_REDE);
    return;
  }
  var dados = resultado.dados || {};
  if (respostaIndicaCrise(dados)) {
    irParaCrise();
    return;
  }
  if (resultado.ok) {
    /* A nota só existe para rever se o servidor a guardou (note_saved). */
    if (dados.note_saved !== true) esquecerNotaDoAparelho();
    if (dados.already_done === true) {
      limparOrigemRecuperacao();
      irParaHoje(TEXTO_JA);
      return;
    }
    mostrarSucesso();
    return;
  }
  var erro = typeof resultado.erro === "string" ? resultado.erro : "";
  /* Dia livre (PR 16 do servidor): 400 com free_day: true. Nada foi gravado.
     Não é erro: a tela mostra a frase do servidor, como no bloqueio. */
  if (resultado.status === 400 && dados.free_day === true) {
    mostrarDiaLivre(missaoAtual);
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
  if (resultado.status === 400 && window.NexusNota && erro === NexusNota.MSG_SERVIDOR) {
    definirErro(TEXTO_LONGA);
    document.getElementById("nota").focus();
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
  document.getElementById("voltar").href = "hoje.html" + buscaHoje();
  document.getElementById("link-dificil").href = "dia-dificil.html" + extra;
  document.getElementById("link-como-tratamos").href = "privacidade.html" + NexusAbas.busca(["tema"]) + "#secao-5";
  /* Quando a tela 10 existir, este botão passa a dizer «Ver o resultado». */
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
  NexusDados.aplicar(document);
  ligarLinks();
  document.getElementById("btn-guardar-notas").addEventListener("click", responderSim);
  document.getElementById("btn-nao-guardar").addEventListener("click", responderNao);
  document.getElementById("form-nota").addEventListener("submit", enviar);
  document.getElementById("btn-tentar").addEventListener("click", function () {
    carregar();
  });
  if (window.NexusNota) atualizarContador = NexusNota.ligar("nota", "nota-contador", "nota-limite-aviso");
  document.getElementById("nota").addEventListener("input", function () {
    var campo = document.getElementById("nota");
    if (campo.getAttribute("aria-invalid") === "true") {
      var problema = validarNota();
      if (!problema) definirErro("");
      else if (document.getElementById("nota-erro").textContent !== problema) definirErro(problema);
    }
    guardarNotaDoCampo();
  });
  document.getElementById("link-dificil").addEventListener("click", guardarNotaDoCampo);
  document.getElementById("voltar").addEventListener("click", guardarNotaDoCampo);
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
