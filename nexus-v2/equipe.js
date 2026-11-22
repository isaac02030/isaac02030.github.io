/* Área da equipe: posts escondidos por denúncia.
   Só admin: quem decide é o servidor (403 para os outros, com frase calma aqui).
   Nunca mostra quem denunciou, nem o nome ou o id do autor do post.
   Restaurar e Apagar pedem confirmação; o foco começa em «Cancelar».
   Textos: comunidade-textos.js. */

var T = window.NexusComunidade.TEXTOS;
var C = window.NexusComunidade;
var ciclo = 0;
var TRECHO = 240;
var acaoAberta = null;

function hostDeDesenvolvimento() {
  var host = location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function parametro(nome) {
  try {
    return new URLSearchParams(location.search).get(nome) || "";
  } catch (erro) {
    return "";
  }
}

/* ?rede=off é atalho de teste: só vale em localhost, 127.0.0.1 ou [::1]. */
function semRedeAgora() {
  var rede = hostDeDesenvolvimento() ? parametro("rede") : "";
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

var DESENHOS = {
  falha: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01",
  rede: "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18",
  ok: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9",
  /* Bandeira: prioridade. Ícone + texto, nunca só a cor. */
  prioridade: "M5 21V4M5 4h11l-2 4 2 4H5",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01"
};

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(icone(DESENHOS[tipo] || DESENHOS.falha), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  ["carregando", "aviso", "negado", "lista"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function focarTitulo() {
  NexusAbas.focar(document.getElementById("titulo"));
}

function irParaEntrada() {
  try {
    localStorage.removeItem("nexus_v2_token");
  } catch (erro) {}
  location.replace("./" + NexusAbas.busca(["tema"]));
}

function sessaoVencida(resultado) {
  if (resultado.status === 401) return true;
  return resultado.status === 403 && resultado.erro === C.DO_SERVIDOR.tokenInvalido;
}

function abrirAviso(tipo, texto) {
  mostrarAviso(document.getElementById("alerta"), tipo, texto);
  mostrarVista("aviso");
  focarTitulo();
}

function abrirNegado() {
  fecharConfirmacao();
  mostrarVista("negado");
  focarTitulo();
}

function trecho(texto) {
  var limpo = typeof texto === "string" ? texto.trim() : "";
  var letras = Array.from(limpo);
  if (letras.length <= TRECHO) return limpo;
  return letras.slice(0, TRECHO).join("").trim() + "…";
}

function rotuloDoMotivo(codigo) {
  var achado = C.motivo(codigo);
  return achado ? achado.rotulo : "";
}

function linhaComIcone(classe, desenho, texto) {
  var linha = document.createElement("p");
  linha.className = classe;
  linha.appendChild(icone(desenho));
  var span = document.createElement("span");
  span.textContent = texto;
  linha.appendChild(span);
  return linha;
}

/* Cada item: trecho do post, motivos e comentários. Sem nomes. */
function itemEscondido(post) {
  var item = document.createElement("li");
  item.className = "escondido";
  item.dataset.post = String(post.id);
  if (post.priority === "alta") {
    item.classList.add("prioridade-alta");
    item.appendChild(linhaComIcone("rotulo-prioridade", DESENHOS.prioridade, T.prioridadeAlta));
  }

  var texto = document.createElement("p");
  texto.className = "escondido-trecho";
  texto.textContent = trecho(post.content);
  item.appendChild(texto);

  if (post.repeat_reporter_alert === true) {
    item.appendChild(linhaComIcone("alerta-repetido", DESENHOS.info, T.alertaRepetido));
  }

  /* Uma linha por denúncia: o motivo em negrito e, logo abaixo, o comentário dela.
     Sem nomes e sem rótulo solto. */
  var denuncias = Array.isArray(post.reports) ? post.reports : [];
  if (denuncias.length) {
    var lista = document.createElement("ul");
    lista.className = "denuncias";
    denuncias.forEach(function (denuncia) {
      if (!denuncia) return;
      var linha = document.createElement("li");
      linha.className = "denuncia";
      var motivo = document.createElement("span");
      motivo.className = "denuncia-motivo";
      motivo.textContent = rotuloDoMotivo(denuncia.reason) || rotuloDoMotivo("outro");
      linha.appendChild(motivo);
      if (typeof denuncia.details === "string" && denuncia.details.trim()) {
        var comentario = document.createElement("q");
        comentario.className = "denuncia-comentario";
        comentario.textContent = denuncia.details.trim();
        linha.appendChild(comentario);
      }
      lista.appendChild(linha);
    });
    item.appendChild(lista);
  }

  var acoes = document.createElement("div");
  acoes.className = "escondido-acoes";
  var restaurar = document.createElement("button");
  restaurar.type = "button";
  restaurar.className = "btn btn-secundario";
  restaurar.textContent = T.restaurar;
  restaurar.setAttribute("aria-haspopup", "dialog");
  restaurar.addEventListener("click", function () {
    abrirConfirmacao("restaurar", post.id, restaurar);
  });
  var apagar = document.createElement("button");
  apagar.type = "button";
  apagar.className = "btn btn-perigo";
  apagar.textContent = T.apagar;
  apagar.setAttribute("aria-haspopup", "dialog");
  apagar.addEventListener("click", function () {
    abrirConfirmacao("apagar", post.id, apagar);
  });
  acoes.appendChild(restaurar);
  acoes.appendChild(apagar);
  item.appendChild(acoes);
  return item;
}

function conferirVazio() {
  var lista = document.getElementById("escondidos");
  document.getElementById("lista-vazia").hidden = lista.children.length > 0;
}

function pintarLista(dados) {
  var posts = dados && Array.isArray(dados.posts) ? dados.posts : [];
  /* priority "alta" primeiro (o servidor já ordena; aqui só garante). */
  var ordem = posts.filter(function (p) { return p && p.id != null; });
  ordem.sort(function (a, b) {
    return (b.priority === "alta" ? 1 : 0) - (a.priority === "alta" ? 1 : 0);
  });
  var lista = document.getElementById("escondidos");
  lista.replaceChildren();
  ordem.forEach(function (post) {
    lista.appendChild(itemEscondido(post));
  });
  esconderAviso(document.getElementById("status-acao"));
  conferirVazio();
  mostrarVista("lista");
  focarTitulo();
}

/* ---------- Confirmação ---------- */

function definirOcupado(ligado) {
  var confirmar = document.getElementById("btn-confirmar");
  confirmar.disabled = ligado;
  confirmar.setAttribute("aria-busy", ligado ? "true" : "false");
  document.getElementById("btn-cancelar").disabled = ligado;
  document.getElementById("confirmacao").dataset.ocupado = ligado ? "sim" : "";
}

function abrirConfirmacao(tipo, postId, origem) {
  var dialogo = document.getElementById("confirmacao");
  var confirmar = document.getElementById("btn-confirmar");
  acaoAberta = { tipo: tipo, postId: postId, origem: origem };
  document.getElementById("pergunta").textContent = tipo === "apagar" ? T.apagarTitulo : T.restaurarTitulo;
  document.getElementById("explica").textContent = tipo === "apagar" ? T.apagarCorpo : T.restaurarCorpo;
  confirmar.querySelector(".btn-rotulo").textContent = tipo === "apagar" ? T.apagar : T.restaurar;
  confirmar.className = "btn " + (tipo === "apagar" ? "btn-perigo" : "btn-primario");
  esconderAviso(document.getElementById("alerta-acao"));
  definirOcupado(false);
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");
  document.getElementById("btn-cancelar").focus();
}

function fecharConfirmacao() {
  var dialogo = document.getElementById("confirmacao");
  if (!dialogo.open) return;
  if (typeof dialogo.close === "function") dialogo.close();
  else dialogo.removeAttribute("open");
}

function tirarDaLista(postId, frase) {
  var item = document.querySelector('.escondido[data-post="' + String(postId).replace(/[^0-9]/g, "") + '"]');
  if (item) item.remove();
  conferirVazio();
  var status = document.getElementById("status-acao");
  mostrarAviso(status, "ok", frase);
  status.tabIndex = -1;
  NexusAbas.focar(status);
}

async function confirmar() {
  var dialogo = document.getElementById("confirmacao");
  if (!acaoAberta || dialogo.dataset.ocupado === "sim") return;
  var alerta = document.getElementById("alerta-acao");
  esconderAviso(alerta);
  if (semRedeAgora()) {
    mostrarAviso(alerta, "rede", T.acaoSemRede);
    return;
  }
  var acao = acaoAberta;
  definirOcupado(true);
  var resultado;
  try {
    resultado = acao.tipo === "apagar" ? await NexusApi.apagarPost(acao.postId) : await NexusApi.restaurarPost(acao.postId);
  } finally {
    definirOcupado(false);
  }
  var feito = resultado.ok && resultado.dados && (acao.tipo === "apagar" ? resultado.dados.deleted === true : resultado.dados.restored === true);
  if (feito) {
    acaoAberta = null;
    fecharConfirmacao();
    tirarDaLista(acao.postId, acao.tipo === "apagar" ? T.apagado : T.restaurado);
    return;
  }
  if (resultado.semRede) return mostrarAviso(alerta, "rede", T.acaoSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (resultado.status === 403) return abrirNegado();
  if (resultado.status === 404 || resultado.status === 409) {
    /* O post já saiu da lista (outra aba ou outra pessoa da equipe): abre a lista de novo. */
    acaoAberta = null;
    fecharConfirmacao();
    carregar();
    return;
  }
  if (resultado.status === 503) return mostrarAviso(alerta, "falha", T.indisponivel);
  mostrarAviso(alerta, "falha", T.acaoErro);
}

function ligarConfirmacao() {
  var dialogo = document.getElementById("confirmacao");
  document.getElementById("btn-confirmar").addEventListener("click", confirmar);
  document.getElementById("btn-cancelar").addEventListener("click", fecharConfirmacao);
  dialogo.addEventListener("cancel", function (evento) {
    if (dialogo.dataset.ocupado === "sim") evento.preventDefault();
  });
  dialogo.addEventListener("close", function () {
    if (acaoAberta && acaoAberta.origem && acaoAberta.origem.isConnected) NexusAbas.focar(acaoAberta.origem);
    acaoAberta = null;
  });
}

/* ---------- Carga ---------- */

async function carregar() {
  var meu = ++ciclo;
  mostrarVista("carregando");
  if (semRedeAgora()) {
    abrirAviso("rede", T.semRede);
    return;
  }
  var resultado = await NexusApi.postsEscondidos();
  if (meu !== ciclo) return;
  if (resultado.ok) return pintarLista(resultado.dados);
  if (resultado.semRede) return abrirAviso("rede", T.semRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (resultado.status === 403) return abrirNegado();
  if (resultado.status === 503) return abrirAviso("falha", T.indisponivel);
  abrirAviso("falha", T.adminErro);
}

function iniciar() {
  /* ?cenario= só vale com o mock local (localhost, 127.0.0.1, [::1]). Fora disso não vai à API. */
  window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  C.aplicar(document);
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  ligarConfirmacao();
  NexusAbas.iniciar(null);
  carregar();
}

iniciar();
