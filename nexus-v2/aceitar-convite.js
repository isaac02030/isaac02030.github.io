/* Aceitar convite do Duo ou do Rival (PR 38 do servidor).
   - O token vem no fragmento (#t=…). Ele sai da barra de endereço na hora
     (fica só na memória da página) e vai ao servidor só no CORPO dos pedidos.
   - Sem login: a página pede para entrar e não chama o servidor.
   - 18+ e as outras regras são do servidor; a tela mostra a frase aprovada. */

var V = window.NexusConvite;
var TV = V.TEXTOS;
var tokenAtual = "";
var conviteAtual = null;
var minhaMissao = null;
var aceitando = false;

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

function semRedeAgora() {
  var rede = hostDeDesenvolvimento() ? parametro("rede") : "";
  return rede === "off" || navigator.onLine === false;
}

function logado() {
  try {
    return !!localStorage.getItem("nexus_v2_token");
  } catch (erro) {
    return false;
  }
}

function busca() {
  return NexusAbas.busca(["tema", "cenario", "rede"]);
}

function mostrarVista(qual) {
  ["carregando", "entrar", "erro", "convite", "feito"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function aviso(el, texto) {
  var p = document.createElement("p");
  p.textContent = texto;
  el.replaceChildren(p);
  el.hidden = !texto;
}

function focarTitulo() {
  NexusAbas.focar(document.getElementById("titulo"));
}

function erro(texto) {
  aviso(document.getElementById("alerta-erro"), texto);
  mostrarVista("erro");
  focarTitulo();
}

function aplicarTextos() {
  document.querySelectorAll("[data-texto-convite]").forEach(function (el) {
    var chave = el.getAttribute("data-texto-convite");
    if (Object.prototype.hasOwnProperty.call(TV, chave)) el.textContent = TV[chave];
  });
}

/* O token sai da barra de endereço (não fica no histórico nem em favorito). */
function lerTokenEApagar() {
  var token = V.tokenDoFragmento(location.hash);
  if (location.hash) {
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch (erroHistorico) {}
  }
  return token;
}

/* No Rival, a missão Solo ativa da pessoa (se houver) é a que entra no par. */
async function acharMinhaMissao() {
  var lista = await NexusApi.listarMissoes();
  if (!lista.ok || !Array.isArray(lista.dados)) return null;
  return lista.dados.find(function (m) {
    return m && m.status === "active" && String(m.mode || "solo") === "solo" && m.partner_id == null;
  }) || null;
}

async function carregar() {
  mostrarVista("carregando");
  if (!tokenAtual) return erro(V.textoDoErro({ status: 404 }));
  if (!logado()) {
    mostrarVista("entrar");
    focarTitulo();
    return;
  }
  if (semRedeAgora()) return erro(TV.semRede);
  var res = await NexusApi.verConvite(tokenAtual);
  if (res.sessaoEncerrada) return;
  if (!res.ok || !res.dados || !res.dados.invite) {
    return erro(res.semRede ? TV.semRede : V.textoDoErro(res));
  }
  conviteAtual = res.dados.invite;
  var rival = conviteAtual.kind === "rival";
  document.getElementById("titulo").textContent = rival ? TV.tituloRival : TV.tituloDuo;
  document.title = document.getElementById("titulo").textContent + " — Nexus";
  var nome = typeof conviteAtual.owner_name === "string" ? conviteAtual.owner_name : "";
  document.getElementById("de-quem").textContent = V.preencher(rival ? TV.deQuemRival : TV.deQuemDuo, { nome: nome });
  var desafio = document.getElementById("desafio");
  var titulo = typeof conviteAtual.title === "string" ? conviteAtual.title.trim() : "";
  desafio.textContent = titulo ? V.preencher(TV.desafio, { titulo: titulo }) : "";
  desafio.hidden = !titulo;
  document.getElementById("pontos").hidden = !rival;
  var explica = document.getElementById("explica");
  if (rival) {
    minhaMissao = await acharMinhaMissao();
    explica.textContent = minhaMissao && minhaMissao.title
      ? V.preencher(TV.explicaRivalMinha, { titulo: minhaMissao.title })
      : TV.explicaRivalNova;
  } else {
    explica.textContent = TV.explicaDuo;
  }
  aviso(document.getElementById("alerta-aceitar"), "");
  mostrarVista("convite");
  focarTitulo();
}

function definirAceitando(ligado) {
  var botao = document.getElementById("btn-aceitar");
  aceitando = ligado;
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? TV.aceitando : TV.aceitar;
}

async function aceitar() {
  if (aceitando || !conviteAtual) return;
  var alerta = document.getElementById("alerta-aceitar");
  aviso(alerta, "");
  if (semRedeAgora()) return aviso(alerta, TV.semRedeAceitar);
  definirAceitando(true);
  var missao = conviteAtual.kind === "rival" && minhaMissao ? minhaMissao.id : null;
  var res = await NexusApi.aceitarConvite(tokenAtual, missao);
  definirAceitando(false);
  if (res.sessaoEncerrada) return;
  if (res.ok && res.dados && res.dados.accepted === true) {
    tokenAtual = "";
    var texto = V.DO_SERVIDOR.indexOf(res.dados.message) !== -1 ? res.dados.message : "";
    aviso(document.getElementById("aviso-feito"), texto);
    mostrarVista("feito");
    focarTitulo();
    return;
  }
  aviso(alerta, res.semRede ? TV.semRedeAceitar : V.textoDoErro(res));
}

function iniciar() {
  window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  tokenAtual = lerTokenEApagar();
  aplicarTextos();
  document.getElementById("link-entrar").href = "./" + busca();
  document.getElementById("link-missao").href = "missao.html" + busca();
  document.getElementById("link-missao-erro").href = "missao.html" + busca();
  document.getElementById("btn-aceitar").addEventListener("click", aceitar);
  if (logado()) {
    document.getElementById("abas").hidden = false;
    NexusAbas.montar("missao");
  }
  carregar();
}

iniciar();
