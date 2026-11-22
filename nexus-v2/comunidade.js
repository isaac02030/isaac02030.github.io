/* Comunidade (leitura), denúncia de post e aviso ao autor do post escondido.
   Textos: comunidade-textos.js. API: api.js (PR 18 do servidor).
   Sem ?c= mostra a lista de comunidades; com ?c=<slug> mostra os posts.
   Nada aqui finge que enviou: só um 2xx do servidor conta como denúncia feita. */

var T = window.NexusComunidade.TEXTOS;
var C = window.NexusComunidade;
var ciclo = 0;
var meuId = null;
var meuNome = "";
var slugAtual = "";
var postDaFolha = null;
var botaoDaFolha = null;

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

function busca() {
  return NexusAbas.busca(["tema", "cenario", "rede"]);
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
  /* Olho fechado: o post está escondido. Nada de cor de alarme. */
  escondido: "M3 3l18 18M10.6 5.1A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7a12.6 12.6 0 0 1-2.9 3.9M6.6 6.6C4.4 8 2.8 10.2 2 12c1 2.5 5 7 10 7a9.6 9.6 0 0 0 4.4-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2"
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
  ["carregando", "aviso", "idade", "lista", "feed"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function definirTitulo(texto) {
  var titulo = document.getElementById("titulo");
  titulo.textContent = texto;
  document.title = texto + " — Nexus";
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

/* 401, ou 403 do token: a sessão venceu. Os outros 403 são da própria tela. */
function sessaoVencida(resultado) {
  if (resultado.status === 401) return true;
  return resultado.status === 403 && resultado.erro === C.DO_SERVIDOR.tokenInvalido;
}

function semIdade(resultado) {
  var dados = resultado && resultado.dados;
  return resultado.status === 403 && !!dados && (dados.code === C.DO_SERVIDOR.codigoIdade || dados.adult_confirmation_required === true);
}

function abrirAviso(tipo, texto) {
  mostrarAviso(document.getElementById("alerta"), tipo, texto);
  mostrarVista("aviso");
  focarTitulo();
}

/* Erro ao abrir: o que aconteceu e o que fazer. Nunca detalhe técnico. */
function falhouAoAbrir(resultado) {
  if (resultado.semRede) return abrirAviso("rede", T.semRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 503) return abrirAviso("falha", T.indisponivel);
  abrirAviso("falha", T.comunidadeErro);
}

function abrirIdade() {
  definirTitulo(T.idadeTitulo);
  fecharFolha();
  mostrarVista("idade");
  focarTitulo();
}

/* ---------- Lista de comunidades ---------- */

function pintarLista(dados) {
  var lista = document.getElementById("lista-comunidades");
  var itens = Array.isArray(dados) ? dados : (dados && Array.isArray(dados.communities) ? dados.communities : []);
  lista.replaceChildren();
  itens.forEach(function (comunidade) {
    if (!comunidade || typeof comunidade.slug !== "string" || !comunidade.slug) return;
    var item = document.createElement("li");
    var link = document.createElement("a");
    link.className = "link-comunidade";
    var params = new URLSearchParams(busca().slice(1));
    params.set("c", comunidade.slug);
    link.href = "comunidade.html?" + params.toString();
    link.textContent = typeof comunidade.name === "string" && comunidade.name ? comunidade.name : comunidade.slug;
    item.appendChild(link);
    lista.appendChild(item);
  });
  document.getElementById("lista-vazia").hidden = lista.children.length > 0;
  definirTitulo(T.comunidadesTitulo);
  mostrarVista("lista");
  focarTitulo();
}

/* ---------- Posts ---------- */

function dataCurta(valor) {
  var data = new Date(valor);
  if (!valor || isNaN(data.getTime())) return "";
  try {
    return data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
  } catch (erro) {
    return "";
  }
}

function ehMeu(post) {
  if (meuId != null && post.user_id != null) return String(post.user_id) === String(meuId);
  return !!meuNome && post.username === meuNome;
}

/* Só para o autor: cartão neutro com borda, no lugar do corpo do post.
   Motivo mais citado, se vier. Nunca quantas denúncias nem quem. */
function cartaoEscondido(post) {
  var cartao = document.createElement("div");
  cartao.className = "cartao-escondido";
  cartao.appendChild(icone(DESENHOS.escondido));
  var textos = document.createElement("div");
  textos.className = "escondido-textos";
  var titulo = document.createElement("p");
  titulo.className = "escondido-titulo";
  titulo.textContent = T.escondidoTitulo;
  textos.appendChild(titulo);
  var motivo = C.linhaDoMotivo(post.hidden_reason);
  if (motivo) {
    var linha = document.createElement("p");
    linha.textContent = motivo;
    textos.appendChild(linha);
  }
  var equipe = document.createElement("p");
  equipe.textContent = T.escondidoEquipe;
  textos.appendChild(equipe);
  cartao.appendChild(textos);
  return cartao;
}

function itemDoPost(post) {
  var item = document.createElement("li");
  item.className = "post";
  /* O próprio post aparece como «Você». Sem apelido do servidor, a linha some:
     nunca uma palavra genérica no lugar do nome. */
  var meu = ehMeu(post) || post.hidden === true;
  var nome = meu ? T.voce : (typeof post.username === "string" ? post.username.trim() : "");
  var idAutor = nome ? "autor-" + post.id : "";
  if (nome) {
    var autor = document.createElement("p");
    autor.className = "post-autor";
    autor.id = idAutor;
    autor.textContent = nome;
    item.appendChild(autor);
  }

  if (post.hidden === true) {
    item.classList.add("post-escondido");
    item.appendChild(cartaoEscondido(post));
    return item;
  }

  var texto = document.createElement("p");
  texto.className = "post-texto";
  texto.textContent = typeof post.content === "string" ? post.content : "";
  item.appendChild(texto);

  var rodape = document.createElement("div");
  rodape.className = "post-rodape";
  var quando = dataCurta(post.created_at);
  if (quando) {
    var data = document.createElement("time");
    data.className = "post-data";
    data.dateTime = String(post.created_at);
    data.textContent = quando;
    rodape.appendChild(data);
  }
  /* «Denunciar» não aparece no próprio post. */
  if (!meu) {
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-texto btn-denunciar";
    botao.textContent = T.denunciar;
    if (idAutor) botao.setAttribute("aria-describedby", idAutor);
    botao.setAttribute("aria-haspopup", "dialog");
    botao.addEventListener("click", function () {
      abrirFolha(post, botao);
    });
    rodape.appendChild(botao);
  }
  item.appendChild(rodape);
  return item;
}

function pintarFeed(dados) {
  var comunidade = dados && dados.community ? dados.community : {};
  var acesso = dados && dados.access ? dados.access : {};
  var posts = dados && Array.isArray(dados.posts) ? dados.posts : [];
  var lista = document.getElementById("posts");
  lista.replaceChildren();
  posts.forEach(function (post) {
    if (post && post.id != null) lista.appendChild(itemDoPost(post));
  });
  var vazio = document.getElementById("feed-vazio");
  vazio.hidden = lista.children.length > 0;
  vazio.textContent = acesso.can_read_forum === false ? T.feedFechado : T.feedVazio;
  definirTitulo(typeof comunidade.name === "string" && comunidade.name ? comunidade.name : T.comunidadesTitulo);
  mostrarVista("feed");
  focarTitulo();
}

/* ---------- Folha de denúncia ---------- */

var atualizarContador = function () {};

function montarMotivos() {
  var grupo = document.getElementById("motivos");
  C.MOTIVOS.forEach(function (motivo) {
    var rotulo = document.createElement("label");
    rotulo.className = "motivo";
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "motivo";
    radio.value = motivo.codigo;
    radio.addEventListener("change", atualizarEnviar);
    var texto = document.createElement("span");
    texto.textContent = motivo.rotulo;
    rotulo.appendChild(radio);
    rotulo.appendChild(texto);
    grupo.appendChild(rotulo);
  });
}

function motivoEscolhido() {
  var marcado = document.querySelector('input[name="motivo"]:checked');
  return marcado ? marcado.value : "";
}

function atualizarEnviar() {
  var form = document.getElementById("form-denuncia");
  if (form.dataset.ocupado === "sim") return;
  document.getElementById("btn-enviar-denuncia").disabled = !motivoEscolhido();
}

function definirEnviando(ligado) {
  var form = document.getElementById("form-denuncia");
  var botao = document.getElementById("btn-enviar-denuncia");
  form.dataset.ocupado = ligado ? "sim" : "";
  botao.disabled = ligado || !motivoEscolhido();
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? T.enviandoDenuncia : T.enviarDenuncia;
  document.getElementById("btn-cancelar-denuncia").disabled = ligado;
}

function abrirFolha(post, botao) {
  var folha = document.getElementById("folha-denuncia");
  var form = document.getElementById("form-denuncia");
  postDaFolha = post;
  botaoDaFolha = botao;
  form.reset();
  definirEnviando(false);
  atualizarContador();
  esconderAviso(document.getElementById("alerta-denuncia"));
  if (typeof folha.showModal === "function") folha.showModal();
  else folha.setAttribute("open", "");
  var primeiro = folha.querySelector('input[name="motivo"]');
  if (primeiro) primeiro.focus();
}

function fecharFolha() {
  var folha = document.getElementById("folha-denuncia");
  if (!folha.open) return;
  if (typeof folha.close === "function") folha.close();
  else folha.removeAttribute("open");
}

/* Sucesso: a frase fica no lugar do botão «Denunciar» daquele post.
   Não diz se o post saiu do ar. */
function marcarDenunciado(botao) {
  if (!botao || !botao.parentNode) return;
  var aviso = document.createElement("p");
  aviso.className = "post-denunciado";
  aviso.setAttribute("role", "status");
  aviso.tabIndex = -1;
  aviso.appendChild(icone(DESENHOS.ok));
  var texto = document.createElement("span");
  texto.textContent = T.denunciaOk;
  aviso.appendChild(texto);
  botao.parentNode.replaceChild(aviso, botao);
  NexusAbas.focar(aviso);
}

/* Crise no comentário: a ajuda abre na hora, sem animação.
   Se a denúncia valeu (reported: true), a tela de ajuda diz isso numa linha. */
function abrirAjuda(denunciaRecebida) {
  var params = new URLSearchParams(busca().slice(1));
  if (denunciaRecebida) params.set("de", "denuncia");
  var texto = params.toString();
  location.assign("crise.html" + (texto ? "?" + texto : ""));
}

async function enviarDenuncia() {
  var form = document.getElementById("form-denuncia");
  if (form.dataset.ocupado === "sim" || !postDaFolha) return;
  var alerta = document.getElementById("alerta-denuncia");
  var motivo = motivoEscolhido();
  if (!motivo) return;
  esconderAviso(alerta);
  if (semRedeAgora()) {
    mostrarAviso(alerta, "rede", T.denunciaSemRede);
    return;
  }
  var detalhes = document.getElementById("detalhes").value;
  definirEnviando(true);
  var resultado;
  try {
    resultado = await NexusApi.denunciarPost(slugAtual, postDaFolha.id, motivo, detalhes);
  } finally {
    definirEnviando(false);
  }

  if (resultado.ok && resultado.dados && resultado.dados.crisis === true) {
    fecharFolha();
    abrirAjuda(resultado.dados.reported === true);
    return;
  }
  if (resultado.ok && resultado.dados && resultado.dados.reported === true) {
    var botao = botaoDaFolha;
    fecharFolha();
    marcarDenunciado(botao);
    return;
  }
  if (resultado.ok) {
    /* 2xx sem reported: true não conta como enviada. */
    mostrarAviso(alerta, "falha", T.denunciaErro);
    return;
  }
  if (resultado.semRede) return mostrarAviso(alerta, "rede", T.denunciaSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 409) return mostrarAviso(alerta, "falha", T.denunciaRepetida);
  if (resultado.status === 503) return mostrarAviso(alerta, "falha", T.denunciaIndisponivel);
  mostrarAviso(alerta, "falha", T.denunciaErro);
}

function ligarFolha() {
  var folha = document.getElementById("folha-denuncia");
  var form = document.getElementById("form-denuncia");
  montarMotivos();
  atualizarContador = window.NexusNota.ligar("detalhes", "detalhes-contador", "detalhes-aviso");
  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviarDenuncia();
  });
  document.getElementById("btn-cancelar-denuncia").addEventListener("click", fecharFolha);
  /* Esc fecha (o diálogo já faz isso), mas não no meio do envio. */
  folha.addEventListener("cancel", function (evento) {
    if (form.dataset.ocupado === "sim") evento.preventDefault();
  });
  folha.addEventListener("close", function () {
    if (botaoDaFolha && botaoDaFolha.isConnected) NexusAbas.focar(botaoDaFolha);
    postDaFolha = null;
  });
}

/* ---------- Carga ---------- */

async function carregar() {
  var meu = ++ciclo;
  slugAtual = parametro("c");
  mostrarVista("carregando");
  if (semRedeAgora()) {
    abrirAviso("rede", T.semRede);
    return;
  }
  if (!slugAtual) {
    var lista = await NexusApi.listarComunidades();
    if (meu !== ciclo) return;
    if (!lista.ok) return falhouAoAbrir(lista);
    pintarLista(lista.dados);
    return;
  }
  var pedidos = await Promise.all([NexusApi.abrirComunidade(slugAtual), NexusApi.eu()]);
  if (meu !== ciclo) return;
  var comunidade = pedidos[0];
  var eu = pedidos[1];
  if (eu.ok && eu.dados && eu.dados.user && eu.dados.user.id != null) meuId = eu.dados.user.id;
  if (!comunidade.ok) return falhouAoAbrir(comunidade);
  pintarFeed(comunidade.dados);
}

function lerMeuNome() {
  try {
    var usuario = JSON.parse(localStorage.getItem("nexus_v2_user") || "{}");
    return usuario && typeof usuario.username === "string" ? usuario.username : "";
  } catch (erro) {
    return "";
  }
}

function iniciar() {
  /* ?cenario= só vale com o mock local (localhost, 127.0.0.1, [::1]). Fora disso não vai à API. */
  window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  C.aplicar(document);
  meuNome = lerMeuNome();
  document.getElementById("btn-agora-nao").href = "hoje.html" + busca();
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  ligarFolha();
  NexusAbas.iniciar(null);
  carregar();
}

iniciar();
