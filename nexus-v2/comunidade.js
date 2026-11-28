/* Comunidade por dentro (?c=<slug>): postar, destaques da semana, lista por
   cursor, apoio, título do autor, denúncia de post e aviso ao autor do post
   escondido. Textos: comunidade-textos.js. API: api.js (PRs 18 e 40 a 44 do
   servidor). Sem ?c=, a página leva à lista de comunidades (comunidades.html).
   Texto de outra pessoa entra só por textContent.
   Nada aqui finge que enviou: só um 2xx do servidor conta como post publicado,
   apoio dado ou denúncia feita. */

var T = window.NexusComunidade.TEXTOS;
var C = window.NexusComunidade;
var B = window.NexusComBase;
var ciclo = 0;
var slugAtual = "";
var postDaFolha = null;
var botaoDaFolha = null;
var comunidadeAtual = null;
var soLeitura = false;
var proximoCursor = null;
var rolagemContinua = false;
var carregandoMais = false;
var observador = null;
var usandoListaAntiga = false;
var comentariosAbertos = {};
var comentarioDaFolha = null;
var avisoCompartilharTimer = null;
var acoesDaFolhaMais = null;

function hostDeDesenvolvimento() {
  return B.dev();
}

function parametro(nome) {
  return B.parametro(nome);
}

/* ?rede=off é atalho de teste: só vale em localhost, 127.0.0.1 ou [::1]. */
function semRedeAgora() {
  return B.semRedeAgora();
}

function busca() {
  return B.busca();
}

function icone(caminho) {
  return B.icone(caminho);
}

var DESENHOS = {
  falha: B.DESENHOS.falha,
  rede: B.DESENHOS.rede,
  ok: B.DESENHOS.ok,
  mao: B.DESENHOS.mao,
  /* Três pontos ligados: o desenho do botão do celular, sem cor própria. */
  compartilhar: "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  /* Balão de fala: o «Comentários» do rodapé, com o mesmo traço do «Apoiar». */
  comentarios: "M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z",
  /* Três pontos em linha: o menu «Mais» no canto superior direito do post. */
  mais: "M5 12h.01M12 12h.01M19 12h.01",
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
  ["carregando", "aviso", "idade", "feed"].forEach(function (nome) {
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
  B.irParaEntrada();
}

/* 401, ou 403 do token: a sessão venceu. Os outros 403 são da própria tela. */
function sessaoVencida(resultado) {
  return B.sessaoVencida(resultado);
}

function semIdade(resultado) {
  return B.semIdade(resultado);
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

/* ---------- Posts ---------- */

/* Só pelo servidor: is_mine. Nunca pelo apelido nem por id, que a resposta
   da API não traz mais (dois apelidos iguais não podem virar «Você»). */
function ehMeu(post) {
  return !!(post && post.is_mine === true);
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

/* Linha do autor: apelido, símbolo e nome do título, tempo. Tocar no nome não
   abre perfil (não há perfil). A 200%, cada parte desce inteira. */
function cabecaDoPost(post, nome, idAutor) {
  var cabeca = document.createElement("p");
  cabeca.className = "post-cabeca";
  if (nome) {
    var autor = document.createElement("span");
    autor.className = "post-autor";
    autor.id = idAutor;
    autor.textContent = nome;
    cabeca.appendChild(autor);
  }
  var titulo = post.author_title;
  if (titulo && typeof titulo.name === "string" && titulo.name) {
    var parte = document.createElement("span");
    parte.className = "post-titulo";
    parte.appendChild(B.simboloDoTitulo(titulo, false));
    var nomeTitulo = document.createElement("span");
    nomeTitulo.textContent = titulo.name;
    parte.appendChild(nomeTitulo);
    cabeca.appendChild(parte);
  }
  var quando = C.tempoCurto(post.created_at, new Date());
  if (quando) {
    var data = document.createElement("time");
    data.className = "post-data";
    data.dateTime = String(post.created_at);
    data.textContent = quando;
    cabeca.appendChild(data);
  }
  return cabeca;
}

/* «Apoiar»: liga e desliga (aria-pressed), com o total em texto. O próprio
   post e a comunidade só leitura mostram só o total. Nunca quem apoiou. */
function apoioDoPost(post, meu) {
  if (typeof post.supports !== "number" && typeof post.supports !== "string") return null;
  var total = Number(post.supports) || 0;
  if (meu || soLeitura) {
    var so = document.createElement("p");
    so.className = "apoios-total";
    so.appendChild(icone(DESENHOS.mao));
    var texto = document.createElement("span");
    texto.textContent = C.contarApoios(total);
    so.appendChild(texto);
    return so;
  }
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-apoiar";
  botao.appendChild(icone(DESENHOS.mao));
  var rotulo = document.createElement("span");
  rotulo.textContent = T.apoiar;
  botao.appendChild(rotulo);
  var contagem = document.createElement("span");
  contagem.className = "apoios-numero";
  botao.appendChild(contagem);
  function pintar(ligado, n) {
    botao.setAttribute("aria-pressed", ligado ? "true" : "false");
    contagem.textContent = String(n);
    botao.setAttribute("aria-label", C.preencher(T.apoiarRotulo, { apoios: C.contarApoios(n) }));
    botao.dataset.total = String(n);
  }
  pintar(post.supported_by_me === true, total);
  botao.addEventListener("click", function () {
    apoiar(post, botao, pintar);
  });
  return botao;
}

async function apoiar(post, botao, pintar) {
  if (botao.getAttribute("aria-busy") === "true") return;
  var acoes = botao.parentNode;
  var antigo = acoes.querySelector(".post-erro");
  if (antigo) antigo.remove();
  function erro(tipo, texto) {
    var aviso = document.createElement("p");
    aviso.className = "post-erro";
    aviso.setAttribute("role", "alert");
    aviso.textContent = texto;
    acoes.appendChild(aviso);
  }
  if (semRedeAgora()) return erro("rede", T.apoioSemRede);
  var ligar = botao.getAttribute("aria-pressed") !== "true";
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  var resultado = await NexusApi.apoiarPost(slugAtual, post.id, ligar);
  botao.disabled = false;
  botao.setAttribute("aria-busy", "false");
  var dados = resultado.dados || {};
  if (resultado.ok && typeof dados.supported === "boolean") {
    pintar(dados.supported, Number(dados.supports) || 0);
    return;
  }
  /* 409: já tinha apoiado (outra aba). O servidor manda o total certo. */
  if (resultado.status === 409 && dados.supported === true) {
    pintar(true, Number(dados.supports) || 0);
    return;
  }
  if (resultado.semRede) return erro("rede", T.apoioSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 403 && dados.code === "own_post") return erro("falha", T.apoioProprio);
  if (resultado.status === 503) return erro("falha", T.indisponivel);
  erro("falha", T.apoioErro);
}

function idDoPost(post) {
  return String(post && post.id != null ? post.id : "").replace(/[^0-9]/g, "");
}

/* O link é limpo: só a comunidade e o post. Nunca token, cenário de teste
   nem e-mail. Quem não tem conta cai no login ao abrir a comunidade. */
function linkDoPost(post) {
  var url = new URL("comunidade.html", location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("c", slugAtual);
  var id = idDoPost(post);
  if (id) url.searchParams.set("p", id);
  return url.toString();
}

/* Aviso curto e fixo, no pé da tela acima da barra de abas. Enquanto aparece,
   a tela ganha espaço na base e sobe só o necessário para a ação tocada não
   ficar debaixo dele. role="status" + aria-live: some sozinho em 3,5 s. */
function avisoDeCompartilhamento(texto, botao) {
  var aviso = document.getElementById("aviso-compartilhar");
  if (!aviso) return;
  if (avisoCompartilharTimer) clearTimeout(avisoCompartilharTimer);
  aviso.textContent = texto;
  aviso.hidden = false;
  var tela = document.querySelector(".tela-comunidade");
  document.body.classList.add("com-aviso-compartilhar");
  if (tela) tela.classList.add("com-aviso-compartilhar");
  /* A faixa não pode ficar sobre ação nenhuma. Primeiro sobe só o necessário
     para a ação tocada continuar à vista; depois procura o primeiro espaço
     livre na vertical. O «⋯» do canto não conta: fica fora da faixa. */
  function descerAteLivre() {
    var faixa = aviso.getBoundingClientRect();
    var alvos = document.querySelectorAll("main button, main a");
    var intervalos = [];
    for (var i = 0; i < alvos.length; i++) {
      var alvo = alvos[i];
      if (!alvo.offsetHeight || alvo.hidden || alvo.closest("[hidden]")) continue;
      var r = alvo.getBoundingClientRect();
      if (r.right <= faixa.left - 8 || r.left >= faixa.right + 8) continue;
      /* O alvo entra na faixa quando descemos «entra» e sai em «sai». */
      var entra = r.top - faixa.bottom - 8;
      var sai = r.bottom - faixa.top + 8;
      if (sai > 0) intervalos.push({ entra: entra, sai: sai });
    }
    intervalos.sort(function (a, b) { return a.entra - b.entra; });
    var livre = Math.max(0, document.documentElement.scrollHeight - window.innerHeight - window.scrollY);
    var d = 0;
    for (var j = 0; j < intervalos.length; j++) {
      var iv = intervalos[j];
      if (iv.sai <= d) continue;
      if (iv.entra > d) break;
      d = iv.sai;
      if (d > livre) break;
    }
    var passo = Math.min(d, livre);
    if (passo > 0) window.scrollBy(0, passo);
  }
  if (botao && botao.offsetHeight > 0) {
    var acao = botao.getBoundingClientRect();
    var area = aviso.getBoundingClientRect();
    if (acao.bottom > area.top - 8) window.scrollBy(0, acao.bottom - area.top + 8);
  }
  descerAteLivre();
  avisoCompartilharTimer = setTimeout(function () {
    aviso.hidden = true;
    aviso.textContent = "";
    document.body.classList.remove("com-aviso-compartilhar");
    if (tela) tela.classList.remove("com-aviso-compartilhar");
    avisoCompartilharTimer = null;
  }, 3500);
}

async function compartilharPost(post, botao) {
  if (botao.getAttribute("aria-busy") === "true") return;
  var url = linkDoPost(post);
  botao.setAttribute("aria-busy", "true");
  try {
    if (navigator.share && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: T.compartilharTitulo, url: url });
      } catch (erro) {
        if (erro && erro.name === "AbortError") return;
        throw erro;
      }
      return;
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(url);
      avisoDeCompartilhamento(T.linkCopiado, botao);
      return;
    }
    var campo = document.createElement("textarea");
    campo.value = url;
    campo.setAttribute("readonly", "");
    campo.style.position = "fixed";
    campo.style.opacity = "0";
    document.body.appendChild(campo);
    campo.select();
    var copiado = false;
    try { copiado = document.execCommand("copy") === true; } catch (erro) { copiado = false; }
    campo.remove();
    if (!copiado) throw new Error("cópia falhou");
    avisoDeCompartilhamento(T.linkCopiado, botao);
  } catch (erro) {
    avisoDeCompartilhamento(T.compartilharErro, botao);
  } finally {
    botao.removeAttribute("aria-busy");
  }
}

/* Mesma caixa de «Comentários» e «Apoiar»: contorno, ícone e palavra curta,
   na cor neon que os Comentários já usavam. Sem luz própria. */
function botaoDeCompartilhar(post) {
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-acao-post btn-compartilhar";
  botao.appendChild(icone(DESENHOS.compartilhar));
  var rotulo = document.createElement("span");
  rotulo.textContent = T.compartilhar;
  botao.appendChild(rotulo);
  botao.setAttribute("aria-label", T.compartilharPost);
  botao.addEventListener("click", function () {
    compartilharPost(post, botao);
  });
  return botao;
}

/* Canto superior direito do post: três pontos, com nome acessível. A folha
   esconde «Denunciar» no post da própria pessoa. */
function botaoDeMais(post, acoes) {
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-mais";
  botao.appendChild(icone(DESENHOS.mais));
  botao.setAttribute("aria-label", T.maisOpcoes);
  botao.setAttribute("aria-haspopup", "dialog");
  botao.addEventListener("click", function () {
    abrirFolhaMais(post, acoes, botao);
  });
  return botao;
}

function abrirFolhaMais(post, acoes, botao) {
  var folha = document.getElementById("folha-mais");
  if (!folha) return;
  acoesDaFolhaMais = { post: post, acoes: acoes, botao: botao };
  var denunciar = folha.querySelector("#btn-mais-denunciar");
  if (denunciar) denunciar.hidden = ehMeu(post);
  folha.setAttribute("aria-label", T.maisOpcoes);
  if (typeof folha.showModal === "function") folha.showModal();
  else folha.setAttribute("open", "");
  var primeiro = folha.querySelector('button:not([hidden])');
  if (primeiro) primeiro.focus();
}

function fecharFolhaMais() {
  var folha = document.getElementById("folha-mais");
  if (!folha) return;
  if (typeof folha.close === "function") folha.close();
  else folha.removeAttribute("open");
  if (acoesDaFolhaMais && acoesDaFolhaMais.botao) NexusAbas.focar(acoesDaFolhaMais.botao);
  acoesDaFolhaMais = null;
}

function ligarFolhaMais() {
  var folha = document.getElementById("folha-mais");
  if (!folha) return;
  var compartilhar = folha.querySelector("#btn-mais-compartilhar");
  var denunciar = folha.querySelector("#btn-mais-denunciar");
  var fechar = folha.querySelector("#btn-mais-fechar");
  if (compartilhar) compartilhar.addEventListener("click", function () {
    var atual = acoesDaFolhaMais;
    fecharFolhaMais();
    if (atual && atual.post) {
      var botao = atual.acoes.querySelector(".btn-compartilhar");
      if (botao) compartilharPost(atual.post, botao);
    }
  });
  if (denunciar) denunciar.addEventListener("click", function () {
    var atual = acoesDaFolhaMais;
    fecharFolhaMais();
    if (atual && atual.post && atual.botao) abrirFolha(atual.post, atual.botao);
  });
  if (fechar) fechar.addEventListener("click", fecharFolhaMais);
  folha.addEventListener("cancel", function () {
    acoesDaFolhaMais = null;
  });
}

/* O link de um post abre a comunidade com o post à vista, sem apelido nem
   ranking: só a posição na página. */
function irParaPostCompartilhado() {
  var id = String(parametro("p") || "").replace(/[^0-9]/g, "");
  if (!id) return false;
  var item = document.querySelector('.post[data-post="' + id + '"]');
  if (!item) return false;
  item.scrollIntoView({ block: "center" });
  NexusAbas.focar(item);
  return true;
}

function itemDoPost(post, destaque) {
  var item = document.createElement("li");
  item.className = "post";
  item.tabIndex = -1;
  item.dataset.post = idDoPost(post);
  /* O próprio post aparece como «Você». Sem apelido do servidor, a linha some:
     nunca uma palavra genérica no lugar do nome. */
  var meu = ehMeu(post) || post.hidden === true;
  var nome = meu ? T.voce : (typeof post.username === "string" ? post.username.trim() : "");
  var idAutor = (destaque ? "autor-d-" : "autor-") + post.id;
  var cabeca = nome ? cabecaDoPost(post, nome, idAutor) : cabecaDoPost(post, "", "");
  if (!nome) idAutor = "";
  item.appendChild(cabeca);

  if (post.hidden === true) {
    item.classList.add("post-escondido");
    item.appendChild(cartaoEscondido(post));
    return item;
  }

  var texto = document.createElement("p");
  texto.className = "post-texto";
  texto.textContent = typeof post.content === "string" ? post.content : "";
  item.appendChild(texto);
  if (destaque) {
    texto.classList.add("recolhido");
    texto.id = "texto-d-" + post.id;
  }

  var rodape = document.createElement("div");
  rodape.className = "post-rodape";

  var principais = document.createElement("div");
  principais.className = "acoes-principais";
  criarComentariosDoPost(post, item, principais);
  var apoio = apoioDoPost(post, meu);
  if (apoio) principais.appendChild(apoio);
  principais.appendChild(botaoDeCompartilhar(post));
  rodape.appendChild(principais);
  item.appendChild(rodape);

  /* «Denunciar» saiu do rodapé: fica só na folha do ⋯ do canto superior. */
  cabeca.appendChild(botaoDeMais(post, rodape));
  return item;
}

/* Destaques: no máximo 2 linhas; «Ver mais» só se o texto passa disso. */
function ligarVerMais(item) {
  var texto = item.querySelector(".post-texto.recolhido");
  if (!texto || texto.scrollHeight <= texto.clientHeight + 1) {
    if (texto) texto.classList.remove("recolhido");
    return;
  }
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-texto btn-ver-mais";
  botao.textContent = T.verMais;
  botao.setAttribute("aria-expanded", "false");
  botao.setAttribute("aria-controls", texto.id);
  botao.addEventListener("click", function () {
    var aberto = botao.getAttribute("aria-expanded") === "true";
    texto.classList.toggle("recolhido", aberto);
    botao.setAttribute("aria-expanded", aberto ? "false" : "true");
    botao.textContent = aberto ? T.verMais : T.verMenos;
  });
  texto.insertAdjacentElement("afterend", botao);
}

/* Destaque só com 3 apoios ou mais (revisão da Clara). O post em destaque
   não se repete em Recentes. */
var MINIMO_DESTAQUE = 3;
var emDestaque = {};

function pintarDestaques(lista) {
  var ol = document.getElementById("destaques");
  ol.replaceChildren();
  emDestaque = {};
  (Array.isArray(lista) ? lista : []).slice(0, 3).forEach(function (post) {
    if (!post || post.id == null || post.hidden === true) return;
    if ((Number(post.supports) || 0) < MINIMO_DESTAQUE) return;
    emDestaque[String(post.id)] = true;
    ol.appendChild(itemDoPost(post, true));
  });
  document.getElementById("bloco-destaques").hidden = ol.children.length === 0;
}

/* Só depois de a vista aparecer: escondida, a altura do texto é zero. */
function ligarVerMaisDosDestaques() {
  Array.prototype.forEach.call(document.getElementById("destaques").children, ligarVerMais);
}

function acrescentarPosts(posts) {
  var ol = document.getElementById("posts");
  var primeiro = null;
  (Array.isArray(posts) ? posts : []).forEach(function (post) {
    if (!post || post.id == null) return;
    if (emDestaque[String(post.id)]) return;
    if (ol.querySelector('[data-post="' + String(post.id).replace(/[^0-9]/g, "") + '"]')) return;
    var item = itemDoPost(post, false);
    item.dataset.post = String(post.id).replace(/[^0-9]/g, "");
    ol.appendChild(item);
    if (!primeiro) primeiro = item;
  });
  atualizarVazio();
  return primeiro;
}

function atualizarVazio() {
  var vazio = document.getElementById("feed-vazio");
  var ol = document.getElementById("posts");
  vazio.hidden = ol.children.length > 0;
  vazio.textContent = podePostar() ? T.postsVaziosEscreva : T.postsVazios;
}

function podePostar() {
  return !document.getElementById("form-post").hidden;
}

/* Depois de cada página: «Ver anteriores» (10 de cada vez, antes do dia
   cumprido) ou a rolagem sozinha (com o dia cumprido, o servidor decide). */
function ajustarMais() {
  var botao = document.getElementById("btn-anteriores");
  var dica = document.getElementById("dica-rolar");
  var temMais = !!proximoCursor && !usandoListaAntiga;
  var sozinha = rolagemContinua && typeof IntersectionObserver === "function";
  botao.hidden = !temMais || sozinha;
  dica.hidden = rolagemContinua || usandoListaAntiga || document.getElementById("posts").children.length === 0;
  if (observador) observador.disconnect();
  if (temMais && sozinha) {
    observador = new IntersectionObserver(function (entradas) {
      if (entradas.some(function (e) { return e.isIntersecting; })) carregarMais(false);
    }, { rootMargin: "200px 0px" });
    observador.observe(document.getElementById("sentinela"));
  }
}

function definirCarregandoMais(ligado) {
  carregandoMais = ligado;
  var botao = document.getElementById("btn-anteriores");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? T.carregandoMais : T.verAnteriores;
}

async function carregarMais(peloBotao) {
  if (carregandoMais || !proximoCursor) return;
  var alerta = document.getElementById("alerta-mais");
  esconderAviso(alerta);
  if (semRedeAgora()) {
    mostrarAviso(alerta, "rede", T.maisSemRede);
    if (observador) observador.disconnect();
    document.getElementById("btn-anteriores").hidden = false;
    return;
  }
  var meu = ciclo;
  definirCarregandoMais(true);
  var resultado = await NexusApi.postsDaComunidade(slugAtual, proximoCursor);
  definirCarregandoMais(false);
  if (meu !== ciclo) return;
  if (!resultado.ok) {
    if (sessaoVencida(resultado)) return irParaEntrada();
    if (semIdade(resultado)) return abrirIdade();
    if (observador) observador.disconnect();
    if (resultado.status === 400) {
      proximoCursor = null;
      ajustarMais();
      return mostrarAviso(alerta, "falha", T.maisCursor);
    }
    document.getElementById("btn-anteriores").hidden = false;
    return mostrarAviso(alerta, resultado.semRede ? "rede" : "falha", resultado.semRede ? T.maisSemRede : (resultado.status === 503 ? T.indisponivel : T.maisErro));
  }
  var dados = resultado.dados || {};
  proximoCursor = typeof dados.next_cursor === "string" && dados.next_cursor ? dados.next_cursor : null;
  rolagemContinua = dados.continuous_scroll === true;
  var primeiro = acrescentarPosts(dados.posts);
  var n = Array.isArray(dados.posts) ? dados.posts.length : 0;
  document.getElementById("aviso-mais").textContent = n ? C.preencher(T.maisCarregados, { n: n }) : "";
  ajustarMais();
  /* Pelo botão, o foco vai ao primeiro post novo (o botão pode ter sumido). */
  if (peloBotao && primeiro) NexusAbas.focar(primeiro);
}

/* ---------- Quem pode postar ---------- */

function areaDaComunidade() {
  return comunidadeAtual && C.areaValida(comunidadeAtual.area) ? comunidadeAtual.area : "";
}

function mostrarMotivo(texto, caminho, href) {
  var caixa = document.getElementById("caixa-motivo");
  /* Só leitura: texto com divisória, sem caixa (revisão da Clara). */
  if (caixa.classList) caixa.classList.toggle("motivo-texto", soLeitura);
  document.getElementById("motivo-post").textContent = texto;
  var link = document.getElementById("caminho-post");
  link.hidden = !caminho;
  if (caminho) {
    link.textContent = caminho;
    link.href = href;
  }
  caixa.hidden = !texto;
}

/* access.post_code do servidor (lib/community-access.js e routes/communities.js). */
function pintarPostar(acesso, missao) {
  var form = document.getElementById("form-post");
  form.hidden = true;
  mostrarMotivo("", "", "");
  var codigo = acesso && typeof acesso.post_code === "string" ? acesso.post_code : "";
  var area = areaDaComunidade();
  var nomeArea = C.nomeDaArea(area);
  var outra = missao && C.areaValida(missao.area) && missao.area !== area ? missao.area : "";
  if (soLeitura) return mostrarMotivo(T.soLeitura, "", "");
  if (acesso && acesso.can_post_forum === true) {
    form.hidden = false;
    return;
  }
  if (codigo === "not_member") return mostrarMotivo(T.paraPostarEntre, "", "");
  if (codigo === "no_active_mission" && nomeArea) {
    return mostrarMotivo(C.preencher(T.precisaMissao, { area: nomeArea }), C.preencher(T.comecarMissaoDe, { area: nomeArea }), B.link("onboarding.html"));
  }
  if (codigo === "other_area" && nomeArea && outra) {
    return mostrarMotivo(C.preencher(T.outraArea, { outra: C.nomeDaArea(outra), area: nomeArea }), C.preencher(T.verComunidadesDe, { area: C.nomeDaArea(outra) }), B.link("comunidades.html", { area: outra }));
  }
  /* Os outros motivos: a frase calma do servidor (sem culpa), por textContent. */
  var texto = acesso && typeof acesso.post_requirement === "string" && acesso.post_requirement ? acesso.post_requirement : T.indisponivel;
  if (codigo === "mission_without_area") return mostrarMotivo(texto, T.irParaMissao, B.link("missao.html"));
  mostrarMotivo(texto, "", "");
}

/* Entrar (um toque) direto daqui, para quem ainda não é membro. */
function pintarMembro(ehMembro) {
  var lugar = document.getElementById("meta-membro");
  lugar.replaceChildren();
  if (soLeitura && !ehMembro) return;
  if (ehMembro) {
    var participa = document.createElement("span");
    participa.className = "participa";
    participa.textContent = T.participa;
    lugar.appendChild(participa);
    return;
  }
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-secundario btn-entrar";
  botao.textContent = T.entrar;
  botao.addEventListener("click", function () {
    entrarAqui(botao);
  });
  lugar.appendChild(botao);
}

async function entrarAqui(botao) {
  if (botao.getAttribute("aria-busy") === "true") return;
  var alerta = document.getElementById("alerta-entrar");
  esconderAviso(alerta);
  if (semRedeAgora()) return mostrarAviso(alerta, "rede", T.entrarSemRede);
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  botao.textContent = T.entrando;
  var resultado = await NexusApi.entrarNaComunidade(slugAtual);
  botao.disabled = false;
  botao.setAttribute("aria-busy", "false");
  botao.textContent = T.entrar;
  if (resultado.ok && resultado.dados && resultado.dados.success === true) {
    /* O acesso a postar muda com a entrada: abre de novo, do servidor. */
    if (window.NexusTituloNovo) {
      NexusTituloNovo.verificar(resultado.dados.title).then(function (abriu) {
        if (!abriu) carregar();
      });
      return;
    }
    carregar();
    return;
  }
  if (resultado.semRede) return mostrarAviso(alerta, "rede", T.entrarSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  mostrarAviso(alerta, "falha", resultado.status === 503 ? T.indisponivel : T.entrarErro);
}

/* ---------- Sair da comunidade ---------- */

var gatilhoDaSaida = null;

function pintarSaida(ehMembro) {
  document.getElementById("link-sair").hidden = !ehMembro;
}

function abrirDialogoSaida(gatilho) {
  gatilhoDaSaida = gatilho || null;
  esconderAviso(document.getElementById("alerta-sair"));
  var confirmar = document.getElementById("btn-sair-confirmar");
  confirmar.disabled = false;
  confirmar.setAttribute("aria-busy", "false");
  var dialogo = document.getElementById("dialogo-sair");
  if (dialogo.showModal) dialogo.showModal();
  else dialogo.setAttribute("open", "");
  /* A ação segura vem primeiro no foco. */
  document.getElementById("btn-sair-agora-nao").focus();
}

function fecharDialogoSaida() {
  var dialogo = document.getElementById("dialogo-sair");
  if (dialogo.close) dialogo.close();
  else dialogo.removeAttribute("open");
}

async function sairDaqui() {
  var confirmar = document.getElementById("btn-sair-confirmar");
  if (confirmar.getAttribute("aria-busy") === "true") return;
  var alerta = document.getElementById("alerta-sair");
  esconderAviso(alerta);
  if (semRedeAgora()) return mostrarAviso(alerta, "rede", T.sairSemRede);
  confirmar.disabled = true;
  confirmar.setAttribute("aria-busy", "true");
  var resultado;
  try {
    resultado = await NexusApi.sairDaComunidade(slugAtual);
  } finally {
    confirmar.disabled = false;
    confirmar.setAttribute("aria-busy", "false");
  }
  var dados = resultado.dados || {};
  if (resultado.ok && dados.left === true) {
    fecharDialogoSaida();
    location.assign("comunidades.html" + busca());
    return;
  }
  if (resultado.semRede) return mostrarAviso(alerta, "rede", T.sairSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 403) {
    /* Já não participa: a lista é o destino certo. */
    fecharDialogoSaida();
    location.assign("comunidades.html" + busca());
    return;
  }
  /* 409 (quem cuida da comunidade) e 503/500: frase do servidor, sem culpa. */
  mostrarAviso(alerta, "falha", resultado.status === 409 && resultado.erro ? resultado.erro : T.sairErro);
}

function ligarSaida() {
  document.getElementById("link-sair").addEventListener("click", function (evento) {
    abrirDialogoSaida(evento.currentTarget);
  });
  document.getElementById("btn-sair-agora-nao").addEventListener("click", fecharDialogoSaida);
  document.getElementById("btn-sair-confirmar").addEventListener("click", sairDaqui);
  var dialogo = document.getElementById("dialogo-sair");
  dialogo.addEventListener("cancel", function (evento) {
    if (document.getElementById("btn-sair-confirmar").getAttribute("aria-busy") === "true") evento.preventDefault();
  });
  dialogo.addEventListener("close", function () {
    if (gatilhoDaSaida && gatilhoDaSaida.isConnected) NexusAbas.focar(gatilhoDaSaida);
  });
}

/* ---------- Comentários (fila do beta, item 4; PR 50 do servidor) ----------
   Uma lista chata por post, aberta só quando a pessoa pede. Nada de resposta
   aninhada, nada de apelido nosso no lugar do nome, nada de innerHTML. O
   formulário segue a mesma porta de publicar (access.can_post_forum), então
   Alimentação, não membro e sem missão da área leem, mas não escrevem. */

function idComentario(postId) {
  return String(postId == null ? "" : postId).replace(/[^0-9]/g, "");
}

function criarComentariosDoPost(post, item, rodape) {
  var id = idComentario(post.id);
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-acao-post btn-comentarios";
  botao.id = "btn-comentarios-" + id;
  botao.appendChild(icone(DESENHOS.comentarios));
  var rotulo = document.createElement("span");
  rotulo.className = "btn-rotulo";
  rotulo.textContent = T.comentarios;
  botao.appendChild(rotulo);
  botao.setAttribute("aria-expanded", "false");
  botao.setAttribute("aria-controls", "comentarios-" + id);
  rodape.insertBefore(botao, rodape.firstChild);

  var secao = document.createElement("section");
  secao.className = "comentarios";
  secao.id = "comentarios-" + id;
  secao.setAttribute("aria-label", T.comentarios);
  secao.hidden = true;

  var alerta = document.createElement("div");
  alerta.className = "alerta";
  alerta.id = "alerta-comentarios-" + id;
  alerta.setAttribute("role", "alert");
  alerta.hidden = true;

  var contagem = document.createElement("p");
  contagem.className = "aviso-texto";
  contagem.id = "contagem-comentarios-" + id;
  contagem.setAttribute("role", "status");

  var vazio = document.createElement("p");
  vazio.className = "vazio-texto";
  vazio.id = "vazio-comentarios-" + id;
  vazio.textContent = T.comentariosVazios;
  vazio.hidden = true;

  var lista = document.createElement("ol");
  lista.className = "comentarios-lista";
  lista.id = "lista-comentarios-" + id;

  var motivo = document.createElement("p");
  motivo.className = "aviso-texto";
  motivo.id = "motivo-comentarios-" + id;
  motivo.hidden = true;

  var form = document.createElement("form");
  form.className = "formulario formulario-comentario";
  form.id = "form-comentario-" + id;
  form.method = "post";
  form.action = "#comentar";
  form.noValidate = true;
  form.hidden = true;

  var rotulo = document.createElement("label");
  rotulo.htmlFor = "texto-comentario-" + id;
  rotulo.textContent = T.escrevaComentario;

  var campo = document.createElement("textarea");
  campo.id = "texto-comentario-" + id;
  campo.name = "content";
  campo.rows = 2;
  campo.maxLength = 280;
  campo.setAttribute("aria-describedby", "contador-comentario-" + id + " aviso-comentario-" + id);

  var acoes = document.createElement("div");
  acoes.className = "comentarios-acoes";
  var contador = document.createElement("p");
  contador.className = "contador";
  contador.id = "contador-comentario-" + id;
  contador.textContent = "0 de 280";
  var enviar = document.createElement("button");
  enviar.type = "submit";
  enviar.className = "btn btn-secundario";
  enviar.id = "btn-comentario-" + id;
  enviar.setAttribute("aria-busy", "false");
  var textoEnviar = document.createElement("span");
  textoEnviar.className = "btn-rotulo";
  textoEnviar.textContent = T.enviarComentario;
  enviar.appendChild(textoEnviar);
  acoes.appendChild(contador);
  acoes.appendChild(enviar);

  var avisoContador = document.createElement("p");
  avisoContador.className = "so-leitor";
  avisoContador.id = "aviso-comentario-" + id;
  avisoContador.setAttribute("aria-live", "polite");

  var enviado = document.createElement("p");
  enviado.className = "aviso-publicado";
  enviado.id = "comentario-enviado-" + id;
  enviado.setAttribute("role", "status");
  enviado.tabIndex = -1;
  enviado.hidden = true;

  form.appendChild(rotulo);
  form.appendChild(campo);
  form.appendChild(acoes);
  form.appendChild(avisoContador);
  form.appendChild(alerta);

  secao.appendChild(contagem);
  secao.appendChild(vazio);
  secao.appendChild(lista);
  secao.appendChild(motivo);
  secao.appendChild(form);
  secao.appendChild(enviado);
  item.appendChild(secao);

  var estado = {
    id: id,
    post: post,
    botao: botao,
    secao: secao,
    lista: lista,
    vazio: vazio,
    contagem: contagem,
    motivo: motivo,
    form: form,
    campo: campo,
    enviar: enviar,
    alerta: alerta,
    enviado: enviado,
    atualizar: window.NexusNota.ligar(campo.id, contador.id, avisoContador.id),
    carregado: false,
    total: 0,
    ocupado: false
  };
  comentariosAbertos[id] = estado;
  botao.addEventListener("click", function () {
    alternarComentarios(estado);
  });
  form.addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviarComentario(estado);
  });
  return estado;
}

function alternarComentarios(estado) {
  var aberto = estado.botao.getAttribute("aria-expanded") === "true";
  estado.botao.setAttribute("aria-expanded", aberto ? "false" : "true");
  estado.botao.querySelector(".btn-rotulo").textContent = aberto ? T.comentarios : T.fecharComentarios;
  estado.secao.hidden = aberto;
  if (aberto) {
    NexusAbas.focar(estado.botao);
    return;
  }
  if (estado.carregado) {
    NexusAbas.focar(estado.form.hidden ? estado.botao : estado.campo);
    return;
  }
  carregarComentarios(estado);
}

async function carregarComentarios(estado) {
  if (estado.carregado || estado.botao.getAttribute("aria-busy") === "true") return;
  var meu = ciclo;
  esconderAviso(estado.alerta);
  estado.botao.disabled = true;
  estado.botao.setAttribute("aria-busy", "true");
  estado.botao.querySelector(".btn-rotulo").textContent = T.comentariosAbrindo;
  var resultado;
  try {
    resultado = await NexusApi.comentariosDoPost(slugAtual, estado.post.id);
  } finally {
    estado.botao.disabled = false;
    estado.botao.setAttribute("aria-busy", "false");
    estado.botao.querySelector(".btn-rotulo").textContent = T.fecharComentarios;
  }
  if (meu !== ciclo) return;
  if (!resultado.ok) {
    if (sessaoVencida(resultado)) return irParaEntrada();
    if (semIdade(resultado)) return abrirIdade();
    var texto = resultado.status === 503 ? T.comentarioIndisponivel :
      (resultado.semRede ? T.comentariosSemRede : T.comentariosErro);
    return mostrarAviso(estado.alerta, resultado.semRede ? "rede" : "falha", texto);
  }
  estado.carregado = true;
  pintarComentarios(estado, resultado.dados && resultado.dados.comments);
  if (podePostar()) {
    estado.form.hidden = false;
    estado.motivo.hidden = true;
    NexusAbas.focar(estado.campo);
    return;
  }
  estado.form.hidden = true;
  estado.motivo.textContent = soLeitura ? T.comentariosSoLeitura :
    (document.getElementById("motivo-post").textContent || T.comentariosSoLeitura);
  estado.motivo.hidden = false;
  NexusAbas.focar(estado.botao);
}

function pintarComentarios(estado, comentarios) {
  estado.lista.replaceChildren();
  estado.total = 0;
  (Array.isArray(comentarios) ? comentarios : []).forEach(function (comentario) {
    if (!comentario || comentario.id == null) return;
    estado.lista.appendChild(itemDoComentario(estado, comentario));
    estado.total += 1;
  });
  estado.vazio.hidden = estado.total > 0;
  estado.contagem.textContent = C.contarComentarios(estado.total);
}

function cartaoEscondidoComentario(comentario) {
  var cartao = document.createElement("div");
  cartao.className = "cartao-comentario-escondido";
  var texto = document.createElement("p");
  texto.textContent = C.textoDoComentarioEscondido(comentario);
  cartao.appendChild(texto);
  return cartao;
}

function itemDoComentario(estado, comentario) {
  var item = document.createElement("li");
  item.className = "comentario";
  item.tabIndex = -1;
  item.dataset.comment = idComentario(comentario.id);

  if (comentario.hidden === true) {
    item.appendChild(cartaoEscondidoComentario(comentario));
    return item;
  }

  var meu = ehMeu(comentario);
  var cabeca = document.createElement("p");
  cabeca.className = "comentario-cabeca";
  var nome = meu ? T.voce : (typeof comentario.username === "string" ? comentario.username.trim() : "");
  var idAutor = "";
  if (nome) {
    var autor = document.createElement("span");
    autor.className = "comentario-autor";
    idAutor = "autor-c-" + item.dataset.comment;
    autor.id = idAutor;
    autor.textContent = nome;
    cabeca.appendChild(autor);
  }
  var quando = C.tempoCurto(comentario.created_at, new Date());
  if (quando) {
    var data = document.createElement("time");
    data.className = "post-data";
    data.dateTime = String(comentario.created_at);
    data.textContent = quando;
    cabeca.appendChild(data);
  }
  var texto = document.createElement("p");
  texto.className = "comentario-texto";
  texto.textContent = typeof comentario.content === "string" ? comentario.content : "";
  var rodape = document.createElement("div");
  rodape.className = "comentario-rodape";
  var apoio = apoioDoComentario(estado, comentario);
  if (apoio) rodape.appendChild(apoio);
  if (!meu) {
    var denunciar = document.createElement("button");
    denunciar.type = "button";
    denunciar.className = "btn btn-texto btn-denunciar btn-denunciar-comentario";
    denunciar.textContent = T.denunciar;
    if (idAutor) denunciar.setAttribute("aria-describedby", idAutor);
    denunciar.setAttribute("aria-haspopup", "dialog");
    denunciar.addEventListener("click", function () {
      abrirFolha(estado.post, denunciar, comentario);
    });
    /* O rodapé do comentário mostra só «Apoiar», como pediu o Isaac. A
       denúncia continua acessível por teclado/leitor de tela e, no toque,
       por pressão longa ou menu de contexto — mesma folha, sem desenho novo. */
    rodape.appendChild(denunciar);
    ligarDenunciaPorToque(item, denunciar);
  }
  item.appendChild(cabeca);
  item.appendChild(texto);
  item.appendChild(rodape);
  return item;
}

/* Denúncia de comentário sem botão visível: pressão longa no celular ou menu
   de contexto no mouse/teclado. Um toque comum, rolagem e os botões de apoio
   não abrem nada; a folha única de denúncia continua a mesma. */
function ligarDenunciaPorToque(item, botao) {
  var inicio = null;
  var timer = null;
  function cancelar() {
    if (timer) clearTimeout(timer);
    timer = null;
    inicio = null;
  }
  function abrir() {
    cancelar();
    var folha = document.getElementById("folha-denuncia");
    if (folha && folha.open) return;
    botao.click();
  }
  function eAcao(alvo) {
    return !!(alvo && alvo.closest && alvo.closest("a, button, input, textarea, select"));
  }
  item.addEventListener("touchstart", function (event) {
    if (eAcao(event.target) || event.touches.length !== 1) return;
    var toque = event.touches[0];
    inicio = { x: toque.clientX, y: toque.clientY };
    timer = setTimeout(abrir, 500);
  }, { passive: true });
  item.addEventListener("touchmove", function (event) {
    if (!timer || !inicio || !event.touches.length) return;
    var toque = event.touches[0];
    if (Math.abs(toque.clientX - inicio.x) > 10 || Math.abs(toque.clientY - inicio.y) > 10) cancelar();
  }, { passive: true });
  item.addEventListener("touchend", cancelar, { passive: true });
  item.addEventListener("touchcancel", cancelar, { passive: true });
  item.addEventListener("contextmenu", function (event) {
    if (eAcao(event.target)) return;
    event.preventDefault();
    abrir();
  });
}

function apoioDoComentario(estado, comentario) {
  if (typeof comentario.supports !== "number" && typeof comentario.supports !== "string") return null;
  var total = Number(comentario.supports) || 0;
  if (ehMeu(comentario)) {
    var so = document.createElement("p");
    so.className = "apoios-total";
    so.appendChild(icone(DESENHOS.mao));
    var texto = document.createElement("span");
    texto.textContent = C.contarApoios(total);
    so.appendChild(texto);
    return so;
  }
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-apoiar btn-apoiar-comentario";
  botao.appendChild(icone(DESENHOS.mao));
  var rotulo = document.createElement("span");
  rotulo.textContent = T.apoioComentario;
  botao.appendChild(rotulo);
  var contagem = document.createElement("span");
  contagem.className = "apoios-numero";
  botao.appendChild(contagem);
  function pintar(ligado, n) {
    botao.setAttribute("aria-pressed", ligado ? "true" : "false");
    contagem.textContent = String(n);
    botao.setAttribute("aria-label", C.preencher(T.apoioComentarioRotulo, { apoios: C.contarApoios(n) }));
    botao.dataset.total = String(n);
  }
  pintar(comentario.supported_by_me === true, total);
  botao.addEventListener("click", function () {
    apoiarComentario(estado, comentario, botao, pintar);
  });
  return botao;
}

async function apoiarComentario(estado, comentario, botao, pintar) {
  if (botao.getAttribute("aria-busy") === "true") return;
  var acoes = botao.parentNode;
  var antigo = acoes.querySelector(".post-erro");
  if (antigo) antigo.remove();
  function erro(texto) {
    var aviso = document.createElement("p");
    aviso.className = "post-erro";
    aviso.setAttribute("role", "alert");
    aviso.textContent = texto;
    acoes.appendChild(aviso);
  }
  if (semRedeAgora()) return erro(T.apoioComentarioSemRede);
  var ligar = botao.getAttribute("aria-pressed") !== "true";
  botao.disabled = true;
  botao.setAttribute("aria-busy", "true");
  var resultado;
  try {
    resultado = await NexusApi.apoiarComentario(slugAtual, estado.post.id, comentario.id, ligar);
  } finally {
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");
  }
  var dados = resultado.dados || {};
  if (resultado.ok && typeof dados.supported === "boolean") {
    return pintar(dados.supported, Number(dados.supports) || 0);
  }
  if (resultado.status === 409 && dados.supported === true) {
    return pintar(true, Number(dados.supports) || 0);
  }
  if (resultado.semRede) return erro(T.apoioComentarioSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 403 && dados.code === "own_comment") return erro(T.apoioComentarioProprio);
  erro(T.apoioComentarioErro);
}

async function enviarComentario(estado) {
  if (estado.ocupado) return;
  var texto = estado.campo.value.trim();
  esconderAviso(estado.alerta);
  estado.enviado.hidden = true;
  if (!texto) {
    mostrarAviso(estado.alerta, "falha", T.comentarioVazio);
    estado.campo.focus();
    return;
  }
  if (window.NexusNota.passou(texto)) {
    mostrarAviso(estado.alerta, "falha", window.NexusNota.MSG_SERVIDOR);
    estado.campo.focus();
    return;
  }
  if (semRedeAgora()) return mostrarAviso(estado.alerta, "rede", T.comentarioSemRede);
  var meu = ciclo;
  estado.ocupado = true;
  estado.enviar.disabled = true;
  estado.enviar.setAttribute("aria-busy", "true");
  estado.enviar.querySelector(".btn-rotulo").textContent = T.enviandoComentario;
  var resultado;
  try {
    resultado = await NexusApi.escreverComentario(slugAtual, estado.post.id, texto);
  } finally {
    estado.ocupado = false;
    estado.enviar.disabled = false;
    estado.enviar.setAttribute("aria-busy", "false");
    estado.enviar.querySelector(".btn-rotulo").textContent = T.enviarComentario;
  }
  if (meu !== ciclo) return;
  var dados = resultado.dados || {};
  if (resultado.ok && dados.crisis === true) {
    estado.campo.value = "";
    estado.atualizar();
    B.abrirAjuda();
    return;
  }
  if (resultado.ok && dados.comment && dados.comment.id != null) {
    estado.campo.value = "";
    estado.atualizar();
    estado.lista.appendChild(itemDoComentario(estado, dados.comment));
    estado.total += 1;
    estado.vazio.hidden = true;
    estado.contagem.textContent = C.contarComentarios(estado.total);
    estado.enviado.textContent = T.comentarioEnviado;
    estado.enviado.hidden = false;
    NexusAbas.focar(estado.enviado);
    return;
  }
  if (resultado.ok) return mostrarAviso(estado.alerta, "falha", T.comentarioErro);
  if (resultado.semRede) return mostrarAviso(estado.alerta, "rede", T.comentarioSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 503) return mostrarAviso(estado.alerta, "falha", T.comentarioIndisponivel);
  /* 400, 403 e 429: a frase do servidor já diz o que fazer. */
  var frase = (resultado.status === 400 || resultado.status === 403 || resultado.status === 429) && resultado.erro ? resultado.erro :
    (resultado.status === 429 ? T.comentarioLimite : T.comentarioErro);
  mostrarAviso(estado.alerta, "falha", frase);
}

/* ---------- Publicar ---------- */

var atualizarContadorPost = function () {};

function definirPublicando(ligado) {
  var form = document.getElementById("form-post");
  var botao = document.getElementById("btn-publicar");
  form.dataset.ocupado = ligado ? "sim" : "";
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? T.publicando : T.publicar;
}

async function publicar() {
  var form = document.getElementById("form-post");
  if (form.dataset.ocupado === "sim") return;
  var campo = document.getElementById("texto-post");
  var alerta = document.getElementById("alerta-post");
  var publicado = document.getElementById("aviso-publicado");
  esconderAviso(alerta);
  publicado.hidden = true;
  var texto = campo.value.trim();
  if (!texto) {
    mostrarAviso(alerta, "falha", T.postVazio);
    campo.focus();
    return;
  }
  if (window.NexusNota.passou(texto)) {
    mostrarAviso(alerta, "falha", window.NexusNota.MSG_SERVIDOR);
    campo.focus();
    return;
  }
  if (semRedeAgora()) return mostrarAviso(alerta, "rede", T.postSemRede);
  definirPublicando(true);
  var resultado;
  try {
    resultado = await NexusApi.publicarPost(slugAtual, texto);
  } finally {
    definirPublicando(false);
  }
  var dados = resultado.dados || {};
  /* Crise: nada foi publicado. O campo fica vazio e a ajuda abre na hora. */
  if (resultado.ok && dados.crisis === true) {
    campo.value = "";
    atualizarContadorPost();
    B.abrirAjuda();
    return;
  }
  if (resultado.ok && dados.post && dados.post.id != null) {
    campo.value = "";
    atualizarContadorPost();
    var novo = Object.assign({}, dados.post, { is_mine: true, supports: 0, supported_by_me: false });
    var ol = document.getElementById("posts");
    var item = itemDoPost(novo, false);
    item.dataset.post = String(novo.id).replace(/[^0-9]/g, "");
    ol.insertBefore(item, ol.firstChild);
    atualizarVazio();
    publicado.textContent = T.publicado;
    publicado.hidden = false;
    NexusAbas.focar(publicado);
    return;
  }
  if (resultado.ok) return mostrarAviso(alerta, "falha", T.postErro);
  if (resultado.semRede) return mostrarAviso(alerta, "rede", T.postSemRede);
  if (sessaoVencida(resultado)) return irParaEntrada();
  if (semIdade(resultado)) return abrirIdade();
  if (resultado.status === 429) return mostrarAviso(alerta, "falha", T.postLimite);
  if (resultado.status === 403) {
    /* O acesso mudou (missão encerrada, comunidade só leitura): mostra o motivo. */
    if (dados.code === "read_only") soLeitura = true;
    pintarPostar({ can_post_forum: false, post_code: dados.code, post_requirement: resultado.erro }, null);
    return;
  }
  if (resultado.status === 503) return mostrarAviso(alerta, "falha", T.indisponivel);
  /* 400: a frase do servidor já diz o que fazer (vazio, longo demais). */
  mostrarAviso(alerta, "falha", resultado.status === 400 && resultado.erro ? resultado.erro : T.postErro);
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

function abrirFolha(post, botao, comentario) {
  var folha = document.getElementById("folha-denuncia");
  var form = document.getElementById("form-denuncia");
  postDaFolha = post;
  botaoDaFolha = botao;
  comentarioDaFolha = comentario || null;
  form.reset();
  definirEnviando(false);
  atualizarContador();
  esconderAviso(document.getElementById("alerta-denuncia"));
  document.getElementById("titulo-denuncia").textContent = comentarioDaFolha ? T.denunciaComentarioTitulo : T.denunciaTitulo;
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
  /* O ⋯ continua no canto: o aviso entra ao lado, sem tirar o menu do post. */
  if (botao.classList && botao.classList.contains("btn-mais")) {
    botao.parentNode.insertBefore(aviso, botao.nextSibling);
  } else {
    botao.parentNode.replaceChild(aviso, botao);
  }
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
    resultado = comentarioDaFolha ?
      await NexusApi.denunciarComentario(slugAtual, postDaFolha.id, comentarioDaFolha.id, motivo, detalhes) :
      await NexusApi.denunciarPost(slugAtual, postDaFolha.id, motivo, detalhes);
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
    comentarioDaFolha = null;
  });
}

/* ---------- Carga ---------- */

function pintarComunidade(dados, destaques, pagina, missao, maratona) {
  var comunidade = dados && dados.community ? dados.community : {};
  var acesso = dados && dados.access ? dados.access : {};
  comunidadeAtual = comunidade;
  soLeitura = acesso.post_code === "read_only";
  definirTitulo(typeof comunidade.name === "string" && comunidade.name ? comunidade.name : T.comunidadesTitulo);

  var chip = document.getElementById("chip-area");
  chip.textContent = C.nomeDaArea(areaDaComunidade());
  chip.hidden = !chip.textContent;
  document.getElementById("meta-pessoas").textContent = C.contarPessoas(comunidade.member_count);
  var souMembro = acesso.is_member === true || comunidade.is_member === true;
  pintarMembro(souMembro);
  pintarSaida(souMembro);
  document.getElementById("faixa-alimentacao").hidden = comunidade.slug !== "alimentacao";
  pintarPostar(acesso, missao);

  /* Cada carga é uma tela nova: nenhum comentário aberto fica preso ao post
     antigo, e a folha de denúncia não guarda o alvo da carga anterior. */
  comentariosAbertos = {};
  comentarioDaFolha = null;

  /* Destaques (até 3 da semana). Sem a rota (503 ou erro): a seção some. */
  pintarDestaques(destaques && destaques.ok && destaques.dados ? destaques.dados.highlights : []);

  /* Recentes pela lista por cursor. Sem ela (migração 015 ainda não aplicada):
     os 20 posts que já vêm com a comunidade, sem apoio e sem «Ver anteriores». */
  document.getElementById("posts").replaceChildren();
  var posts;
  if (pagina && pagina.ok && pagina.dados && Array.isArray(pagina.dados.posts)) {
    usandoListaAntiga = false;
    posts = pagina.dados.posts;
    proximoCursor = typeof pagina.dados.next_cursor === "string" && pagina.dados.next_cursor ? pagina.dados.next_cursor : null;
    rolagemContinua = pagina.dados.continuous_scroll === true;
  } else {
    usandoListaAntiga = true;
    posts = dados && Array.isArray(dados.posts) ? dados.posts : [];
    proximoCursor = null;
    rolagemContinua = false;
  }
  acrescentarPosts(posts);
  ajustarMais();
  document.getElementById("link-merito").href = B.link("merito.html", { c: slugAtual });
  /* A Maratona é uma linha da comunidade. Sem a rota (503 da migração 017),
     ela não aparece; o resto da tela continua igual. */
  NexusMaratonaLinha.pintar(maratona, acesso, slugAtual);
  mostrarVista("feed");
  ligarVerMaisDosDestaques();
  if (!irParaPostCompartilhado()) focarTitulo();
}

async function carregar() {
  var meu = ++ciclo;
  slugAtual = parametro("c");
  if (!slugAtual) {
    /* Sem comunidade escolhida: a lista mora em comunidades.html. */
    location.replace("comunidades.html" + busca());
    return;
  }
  mostrarVista("carregando");
  if (observador) observador.disconnect();
  esconderAviso(document.getElementById("alerta-mais"));
  esconderAviso(document.getElementById("alerta-entrar"));
  if (semRedeAgora()) {
    abrirAviso("rede", T.semRede);
    return;
  }
  var pedidos = await Promise.all([
    NexusApi.abrirComunidade(slugAtual),
    NexusApi.eu(),
    NexusApi.destaquesDaComunidade(slugAtual),
    NexusApi.postsDaComunidade(slugAtual, ""),
    NexusApi.listarMissoes(),
    NexusApi.listarMaratonas(slugAtual)
  ]);
  if (meu !== ciclo) return;
  var comunidade = pedidos[0];
  if (!comunidade.ok) return falhouAoAbrir(comunidade);
  var missao = pedidos[4].ok ? B.missaoAtiva(pedidos[4].dados) : null;
  pintarComunidade(comunidade.dados, pedidos[2], pedidos[3], missao, pedidos[5]);
  NexusAbas.concluirRolagem();
}

function iniciar() {
  /* ?cenario= só vale com o mock local (localhost, 127.0.0.1, [::1]). Fora disso não vai à API. */
  window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  C.aplicar(document);
  if (window.NexusMaratonaTextos) window.NexusMaratonaTextos.aplicar(document);
  document.getElementById("btn-agora-nao").href = "hoje.html" + busca();
  document.getElementById("link-voltar").href = B.link("comunidades.html");
  document.getElementById("link-hoje").href = B.link("hoje.html");
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("btn-anteriores").addEventListener("click", function () {
    carregarMais(true);
  });
  atualizarContadorPost = window.NexusNota.ligar("texto-post", "post-contador", "post-aviso");
  document.getElementById("form-post").addEventListener("submit", function (evento) {
    evento.preventDefault();
    publicar();
  });
  document.getElementById("texto-post").setAttribute("placeholder", T.escrevaDica);
  ligarFolha();
  ligarFolhaMais();
  ligarSaida();
  NexusMaratonaLinha.iniciar();
  NexusAbas.montar("comunidade");
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
  carregar();
}

iniciar();
