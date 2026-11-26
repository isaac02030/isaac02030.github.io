/* Ajustes › Pessoas bloqueadas (spec da Clara, parte 2).
   A lista só traz quem eu bloqueei. O desbloqueio usa o blockId da linha,
   nunca o id da pessoa. Nada sai da lista antes de o servidor responder
   200 { unblocked: true }. Sem internet, a tela não chama o servidor. */

var T = window.NexusBloqueados;
var abrindo = false;
var pendente = null;
var focoDepois = null;

var DESENHO_FALHA = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01";
var DESENHO_REDE = "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18";

function cenarioDaPagina() {
  try {
    return new URLSearchParams(location.search).get("cenario") || "";
  } catch (erro) {
    return "";
  }
}

/* ?rede=off só vale em localhost, 127.0.0.1 e [::1]. */
function semRedeAgora() {
  var rede = "";
  if (NexusAbas.emDev()) {
    try {
      rede = new URLSearchParams(location.search).get("rede") || "";
    } catch (erro) {
      rede = "";
    }
  }
  return rede === "off" || navigator.onLine === false;
}

function focar(el) {
  NexusAbas.focar(el);
}

function focarTitulo() {
  focar(document.getElementById("titulo"));
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

/* Falha do servidor: caixa neutra, com o ícone, nunca em vermelho. */
function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-neutro";
  el.setAttribute("role", "alert");
  el.replaceChildren(icone(tipo === "rede" ? DESENHO_REDE : DESENHO_FALHA), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  ["carregando", "erro", "vazia", "lista"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function ocuparTentativa(ligado) {
  var botao = document.getElementById("btn-tentar");
  botao.setAttribute("aria-disabled", ligado ? "true" : "false");
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
}

function abrirDialogo(dialogo) {
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");
}

function fecharDialogo(dialogo) {
  if (!dialogo.open && !dialogo.hasAttribute("open")) return;
  if (typeof dialogo.close === "function") dialogo.close();
  else dialogo.removeAttribute("open");
}

function idValido(valor) {
  return /^[1-9]\d{0,17}$/.test(String(valor == null ? "" : valor));
}

/* Só block_id, username e created_at. O resto que o servidor mande é ignorado. */
function lerPessoas(dados) {
  var bruto = dados && Array.isArray(dados.blocks) ? dados.blocks : null;
  if (!bruto) return null;
  var saida = [];
  bruto.forEach(function (item) {
    if (!item || typeof item !== "object") return;
    var nome = typeof item.username === "string" ? item.username.trim() : "";
    if (!idValido(item.block_id) || !nome) return;
    saida.push({
      blockId: String(item.block_id),
      username: nome,
      createdAt: typeof item.created_at === "string" ? item.created_at : ""
    });
  });
  if (bruto.length > 0 && saida.length === 0) return null;
  saida.sort(function (a, b) {
    var da = Date.parse(a.createdAt);
    var db = Date.parse(b.createdAt);
    if (isNaN(da)) da = 0;
    if (isNaN(db)) db = 0;
    return db - da;
  });
  return saida;
}

function formatarData(iso) {
  var data = new Date(iso);
  if (!iso || isNaN(data.getTime())) return "";
  var partes = {};
  try {
    new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).formatToParts(data).forEach(function (p) { partes[p.type] = p.value; });
  } catch (erro) {
    return "";
  }
  if (!partes.day || !partes.month || !partes.year) return "";
  return partes.day + "/" + partes.month + "/" + partes.year;
}

function linhaDaPessoa(pessoa) {
  var item = document.createElement("li");
  item.className = "pessoa";
  var textos = document.createElement("div");
  textos.className = "pessoa-textos";
  var nome = document.createElement("p");
  nome.className = "pessoa-nome";
  nome.textContent = pessoa.username;
  textos.appendChild(nome);
  var data = formatarData(pessoa.createdAt);
  if (data) {
    var quando = document.createElement("p");
    quando.className = "pessoa-data";
    quando.textContent = T.texto("bloqueioEm", { data: data });
    textos.appendChild(quando);
  }
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-secundario btn-desbloquear";
  botao.textContent = T.texto("desbloquear");
  botao.setAttribute("aria-label", T.texto("desbloquearQuem", { apelido: pessoa.username }));
  botao.addEventListener("click", function () { abrirConfirmacao(pessoa, botao); });
  item.appendChild(textos);
  item.appendChild(botao);
  return item;
}

function pintar(pessoas) {
  var lista = document.getElementById("lista");
  lista.replaceChildren();
  pessoas.forEach(function (pessoa) {
    lista.appendChild(linhaDaPessoa(pessoa));
  });
  mostrarVista(pessoas.length ? "lista" : "vazia");
}

function abrirErro(tipo, texto, repetiu) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-lista"), tipo, texto);
  if (repetiu) focar(document.getElementById("btn-tentar"));
  else focarTitulo();
}

/* A frase do 503 já existe na comunidade. Não repetimos o texto aqui. */
function textoIndisponivel() {
  var comunidade = window.NexusComunidade;
  if (comunidade && comunidade.TEXTOS && comunidade.TEXTOS.indisponivel) return comunidade.TEXTOS.indisponivel;
  return T.texto("erro");
}

function textoDaLista(resultado) {
  if (resultado.semRede) return { tipo: "rede", texto: T.texto("semRede") };
  if (resultado.status === 429) return { tipo: "falha", texto: T.texto("muitasLista") };
  if (resultado.status === 503 && !resultado.sessaoIndisponivel) return { tipo: "falha", texto: textoIndisponivel() };
  return { tipo: "falha", texto: T.texto("erro") };
}

async function carregar(repetiu) {
  if (abrindo) return;
  abrindo = true;
  ocuparTentativa(true);
  document.getElementById("aviso-lista").hidden = true;
  mostrarVista("carregando");
  try {
    /* Sem internet: não chama o servidor e não abre sozinho quando a rede volta. */
    if (semRedeAgora()) {
      abrirErro("rede", T.texto("semRede"), repetiu);
      return;
    }
    var resultado = await NexusApi.listarBloqueios();
    if (resultado.sessaoEncerrada) return;
    if (!resultado.ok) {
      var falha = textoDaLista(resultado);
      abrirErro(falha.tipo, falha.texto, repetiu);
      return;
    }
    var pessoas = lerPessoas(resultado.dados);
    if (!pessoas) {
      abrirErro("falha", T.texto("erro"), repetiu);
      return;
    }
    pintar(pessoas);
    focarTitulo();
  } catch (erro) {
    abrirErro("falha", T.texto("erro"), repetiu);
  } finally {
    abrindo = false;
    ocuparTentativa(false);
  }
}

function abrirConfirmacao(pessoa, botao) {
  var dialogo = document.getElementById("dialogo-desbloquear");
  if (dialogo.dataset.ocupado === "sim") return;
  pendente = { blockId: pessoa.blockId, botao: botao };
  focoDepois = botao;
  document.getElementById("desbloquear-titulo").textContent = T.texto("confirmarTitulo", { apelido: pessoa.username });
  document.getElementById("desbloquear-texto").textContent = T.texto("confirmarTexto");
  esconderAviso(document.getElementById("alerta-desbloquear"));
  definirDesbloqueando(false);
  abrirDialogo(dialogo);
  focar(document.getElementById("btn-cancelar-desbloquear"));
}

function definirDesbloqueando(ligado) {
  var dialogo = document.getElementById("dialogo-desbloquear");
  var confirmar = document.getElementById("btn-confirmar-desbloquear");
  var cancelar = document.getElementById("btn-cancelar-desbloquear");
  dialogo.dataset.ocupado = ligado ? "sim" : "";
  confirmar.disabled = ligado;
  cancelar.disabled = ligado;
  confirmar.setAttribute("aria-busy", ligado ? "true" : "false");
  confirmar.querySelector(".btn-rotulo").textContent = T.texto(ligado ? "desbloqueando" : "desbloquear");
  if (ligado) focar(dialogo);
}

/* O próximo Desbloquear continua na lista. No fim da lista, o anterior.
   Se não sobrou ninguém, o foco vai ao título. */
function destinoDepois(botao) {
  var lista = document.getElementById("lista");
  var botoes = Array.prototype.slice.call(lista.querySelectorAll(".btn-desbloquear"));
  var indice = botoes.indexOf(botao);
  if (botoes[indice + 1]) return botoes[indice + 1];
  if (botoes[indice - 1]) return botoes[indice - 1];
  return document.getElementById("titulo");
}

function anunciarDesbloqueio() {
  var aviso = document.getElementById("aviso-lista");
  aviso.textContent = T.texto("desbloqueada");
  aviso.hidden = false;
}

function concluirDesbloqueio(botao) {
  var destino = destinoDepois(botao);
  var item = botao && botao.closest ? botao.closest(".pessoa") : null;
  var lista = document.getElementById("lista");
  if (item) item.remove();
  if (!lista.querySelector(".pessoa")) {
    mostrarVista("vazia");
    destino = document.getElementById("titulo");
  }
  focoDepois = destino;
  fecharDialogo(document.getElementById("dialogo-desbloquear"));
  anunciarDesbloqueio();
}

function textoDoDesbloqueio(resultado) {
  if (resultado.semRede) return { tipo: "rede", texto: T.texto("semRedeDesbloquear") };
  if (resultado.status === 429) return { tipo: "falha", texto: T.texto("muitasDesbloquear") };
  if (resultado.status === 503 && !resultado.sessaoIndisponivel) return { tipo: "falha", texto: T.texto("indisponivelDesbloquear") };
  return { tipo: "falha", texto: T.texto("erroDesbloquear") };
}

async function confirmarDesbloqueio() {
  var dialogo = document.getElementById("dialogo-desbloquear");
  if (dialogo.dataset.ocupado === "sim" || !pendente) return;
  var alerta = document.getElementById("alerta-desbloquear");
  esconderAviso(alerta);
  if (semRedeAgora()) {
    mostrarAviso(alerta, "rede", T.texto("semRedeDesbloquear"));
    return;
  }
  if (!idValido(pendente.blockId)) {
    mostrarAviso(alerta, "falha", T.texto("erroDesbloquear"));
    return;
  }
  var blockId = pendente.blockId;
  var botao = pendente.botao;
  definirDesbloqueando(true);
  var resultado;
  try {
    resultado = await NexusApi.desbloquear(blockId);
  } catch (erro) {
    resultado = { ok: false, status: 0 };
  }
  if (resultado.sessaoEncerrada) return;
  if (resultado.ok && resultado.dados && resultado.dados.unblocked === true) {
    definirDesbloqueando(false);
    concluirDesbloqueio(botao);
    return;
  }
  definirDesbloqueando(false);
  var falha = textoDoDesbloqueio(resultado);
  mostrarAviso(alerta, falha.tipo, falha.texto);
  focar(document.getElementById("btn-cancelar-desbloquear"));
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  if (T) T.aplicar(document);
  document.getElementById("voltar").href = "ajustes.html" + NexusAbas.busca(["tema", "cenario", "rede"]);
  document.getElementById("btn-tentar").addEventListener("click", function () {
    var botao = document.getElementById("btn-tentar");
    if (abrindo || botao.getAttribute("aria-disabled") === "true") return;
    carregar(true);
  });
  var dialogo = document.getElementById("dialogo-desbloquear");
  document.getElementById("btn-cancelar-desbloquear").addEventListener("click", function () {
    if (dialogo.dataset.ocupado === "sim") return;
    focoDepois = pendente && pendente.botao;
    fecharDialogo(dialogo);
  });
  document.getElementById("btn-confirmar-desbloquear").addEventListener("click", confirmarDesbloqueio);
  dialogo.addEventListener("cancel", function (evento) {
    if (dialogo.dataset.ocupado === "sim") evento.preventDefault();
  });
  dialogo.addEventListener("close", function () {
    var alvo = focoDepois;
    focoDepois = null;
    if (alvo && alvo.isConnected) focar(alvo);
  });
  NexusAbas.iniciar("ajustes");
  carregar(false);
}

iniciar();
