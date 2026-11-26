/* Conversa do Duo/Rival (spec da Clara, visual/spec-chat-duo.md).
   - Só abre com Duo ou Rival ativo; sem par, diz isso e volta à Missão.
   - «Enviada» só depois do servidor confirmar. Sem «visto».
   - Crise (crisis: true): nada foi enviado. O campo volta vazio, nenhum balão
     fica e a tela de ajuda abre. O texto não é guardado no aparelho.
   - O rascunho não é guardado em lugar nenhum (só na memória da página).
   Textos: chat-textos.js (e os da denúncia, comunidade-textos.js). */

var X = window.NexusChat;
var TX = X.TEXTOS;
var TC = window.NexusComunidade.TEXTOS;
var C = window.NexusComunidade;

var missaoId = null;
var missaoAtual = null;
var ciclo = 0;
var enviando = false;
var abrindoConversa = false;
var falhasAoAbrir = 0;
var mensagemDaFolha = null;
var botaoDaFolha = null;
var vistas = {};
var chipsDispensados = false;

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

function busca(extra) {
  var base = NexusAbas.busca(["tema", "cenario", "rede"]);
  if (!extra) return base;
  return base ? base + "&" + extra : "?" + extra;
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
  ok: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"
};

/* «…» das opções: três pontos cheios de 4,5 px (revisão da Clara do PR 30).
   Cor --text-muted: 6,29:1 sobre o papel (claro) e 10,05:1 sobre o preto
   (escuro), acima de 3:1 para ícone. */
function iconeTresPontos() {
  var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", "icone");
  [5, 12, 19].forEach(function (x) {
    var ponto = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ponto.setAttribute("cx", String(x));
    ponto.setAttribute("cy", "12");
    ponto.setAttribute("r", "2.25");
    ponto.setAttribute("fill", "currentColor");
    svg.appendChild(ponto);
  });
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(icone(tipo === "ok" ? DESENHOS.ok : (tipo === "rede" ? DESENHOS.rede : DESENHOS.falha)), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  ["carregando", "erro", "sem-par", "conversa"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function focarTitulo() {
  NexusAbas.focar(document.getElementById("titulo"));
}

/* ---------- Datas ---------- */
function dataDe(valor) {
  var d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
}

function dois(n) {
  return (n < 10 ? "0" : "") + n;
}

function horaDe(valor) {
  var d = dataDe(valor);
  return d ? dois(d.getHours()) + ":" + dois(d.getMinutes()) : "";
}

function chaveDoDia(d) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
}

function rotuloDoDia(d) {
  var hoje = new Date();
  var ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (chaveDoDia(d) === chaveDoDia(hoje)) return TX.hoje;
  if (chaveDoDia(d) === chaveDoDia(ontem)) return TX.ontem;
  return dois(d.getDate()) + "/" + dois(d.getMonth() + 1);
}

/* ---------- O fio ---------- */
function minha(mensagem) {
  var eu = X.meuApelido();
  return !!eu && mensagem && mensagem.sender_name === eu;
}

var ultimoDia = "";

function separadorSePreciso(lista, valor) {
  var d = dataDe(valor) || new Date();
  var chave = chaveDoDia(d);
  if (chave === ultimoDia) return;
  ultimoDia = chave;
  var sep = document.createElement("li");
  sep.className = "separador-dia";
  sep.textContent = rotuloDoDia(d);
  lista.appendChild(sep);
}

function pe(mensagem, textoEstado) {
  var linha = document.createElement("p");
  linha.className = "mensagem-pe";
  var hora = document.createElement("span");
  hora.className = "hora";
  hora.textContent = horaDe(mensagem.created_at);
  linha.appendChild(hora);
  if (textoEstado) {
    var estado = document.createElement("span");
    estado.className = "estado-envio";
    estado.textContent = textoEstado;
    linha.appendChild(estado);
  }
  return linha;
}

function botaoOpcoes(mensagem) {
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn-opcoes";
  botao.setAttribute("aria-haspopup", "dialog");
  botao.setAttribute("aria-label", X.preencher(TX.opcoes, { hora: horaDe(mensagem.created_at) }));
  botao.appendChild(iconeTresPontos());
  botao.addEventListener("click", function () {
    abrirOpcoes(mensagem, botao);
  });
  return botao;
}

function itemDaMensagem(mensagem, estado) {
  var item = document.createElement("li");
  var eu = minha(mensagem) || estado === "enviando";
  item.className = "mensagem " + (eu ? "minha" : "dela");
  if (mensagem.id != null) item.dataset.id = String(mensagem.id);
  var balao = document.createElement("p");
  balao.className = "balao";
  balao.textContent = typeof mensagem.content === "string" ? mensagem.content : "";
  item.appendChild(balao);
  var linha = pe(mensagem, eu ? (estado === "enviando" ? TX.enviando : TX.enviada) : "");
  if (!eu) linha.appendChild(botaoOpcoes(mensagem));
  item.appendChild(linha);
  return item;
}

function pintarFio(mensagens) {
  var lista = document.getElementById("fio");
  lista.replaceChildren();
  ultimoDia = "";
  vistas = {};
  mensagens.forEach(function (m) {
    if (!m || m.id == null) return;
    vistas[String(m.id)] = true;
    separadorSePreciso(lista, m.created_at);
    lista.appendChild(itemDaMensagem(m, "enviada"));
  });
  document.getElementById("fio-vazio").hidden = mensagens.length > 0;
}

function pertoDoFim() {
  var resto = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
  return resto < 160;
}

function irParaOFim() {
  window.scrollTo(0, document.documentElement.scrollHeight);
  document.getElementById("ir-novas").hidden = true;
}

/* ---------- Abrir ---------- */
function ocuparBotaoTentar() {
  var botao = document.getElementById("btn-tentar");
  botao.setAttribute("aria-disabled", "true");
  botao.textContent = TX.abrindo;
}

function soltarBotaoTentar() {
  var botao = document.getElementById("btn-tentar");
  botao.setAttribute("aria-disabled", "false");
  botao.textContent = TX.tentarDeNovo;
}

function abrirErro(tipo, texto, segunda) {
  var link = document.getElementById("link-voltar-erro");
  link.hidden = !segunda;
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-abrir"), tipo, texto);
  soltarBotaoTentar();
  if (segunda) NexusAbas.focar(document.getElementById("btn-tentar"));
  else focarTitulo();
}

function falhaAoAbrir() {
  falhasAoAbrir += 1;
  var segunda = falhasAoAbrir >= 2;
  abrirErro("neutro", segunda ? TX.erroAbrirDeNovo : TX.erroAbrir, segunda);
}

async function carregar() {
  if (abrindoConversa) return;
  var meu = ++ciclo;
  abrindoConversa = true;
  ocuparBotaoTentar();
  mostrarVista("carregando");
  function parar() {
    if (meu === ciclo) abrindoConversa = false;
  }
  if (!missaoId) {
    parar();
    mostrarVista("sem-par");
    focarTitulo();
    return;
  }
  /* Sem internet: não chama o servidor. Não abre de novo sozinho quando a rede volta. */
  if (semRedeAgora()) {
    parar();
    return abrirErro("rede", TX.semRedeAbrir);
  }

  var missaoRes = await NexusApi.obterMissao(missaoId);
  if (meu !== ciclo) return;
  if (missaoRes.sessaoEncerrada) {
    parar();
    return;
  }
  if (!missaoRes.ok) {
    parar();
    if (missaoRes.semRede) return abrirErro("rede", TX.semRedeAbrir);
    if (missaoRes.status === 403 || missaoRes.status === 404) {
      mostrarVista("sem-par");
      focarTitulo();
      return;
    }
    return falhaAoAbrir();
  }
  missaoAtual = missaoRes.dados || {};
  var nome = X.nomeDoOutro(missaoAtual);
  pintarTopo(nome, missaoAtual.title);

  /* Sem Duo/Rival ativo, a conversa não abre (nem pede as mensagens). */
  if (!X.temPar(missaoAtual)) {
    parar();
    mostrarVista("sem-par");
    focarTitulo();
    return;
  }

  var lista = await NexusApi.listarMensagens(missaoId);
  if (meu !== ciclo) return;
  if (lista.sessaoEncerrada) {
    parar();
    return;
  }
  if (!lista.ok) {
    parar();
    if (lista.semRede) return abrirErro("rede", TX.semRedeAbrir);
    if (lista.status === 503) return abrirErro("neutro", TC.indisponivel);
    if (lista.status === 403) {
      mostrarVista("sem-par");
      focarTitulo();
      return;
    }
    return falhaAoAbrir();
  }
  var mensagens = lista.dados && Array.isArray(lista.dados.messages) ? lista.dados.messages : [];
  pintarFio(mensagens);
  X.marcarVista(missaoId, mensagens);
  falhasAoAbrir = 0;
  parar();
  mostrarVista("conversa");
  atualizarCampo();
  mostrarChipsSeCouber();
  focarTitulo();
  irParaOFim();
}

function pintarTopo(nome, titulo) {
  var h1 = document.getElementById("titulo");
  h1.textContent = nome ? X.preencher(TX.titulo, { nome: nome }) : TX.tituloSemNome;
  document.title = h1.textContent + " — Nexus";
  var linha = document.getElementById("missao-linha");
  var t = typeof titulo === "string" ? titulo.trim() : "";
  linha.hidden = !t;
  linha.textContent = t ? X.preencher(TX.missao, { titulo: t }) : "";
}

/* Ao voltar para a aba do navegador, pega as novas sem puxar a tela. */
async function atualizarEmSilencio() {
  if (!missaoAtual || document.getElementById("vista-conversa").hidden || semRedeAgora()) return;
  var lista = await NexusApi.listarMensagens(missaoId);
  if (!lista.ok || !lista.dados || !Array.isArray(lista.dados.messages)) return;
  var perto = pertoDoFim();
  var fio = document.getElementById("fio");
  var novas = 0;
  lista.dados.messages.forEach(function (m) {
    if (!m || m.id == null || vistas[String(m.id)]) return;
    vistas[String(m.id)] = true;
    separadorSePreciso(fio, m.created_at);
    fio.appendChild(itemDaMensagem(m, "enviada"));
    novas += 1;
  });
  if (!novas) return;
  document.getElementById("fio-vazio").hidden = true;
  X.marcarVista(missaoId, lista.dados.messages);
  if (perto) irParaOFim();
  else document.getElementById("ir-novas").hidden = false;
}

/* Frases prontas: só com ?apoio=1. O toque preenche o campo e não envia.
   Somem ao digitar, ao preencher ou ao enviar, e não voltam nesta abertura. */
function esconderChips() {
  chipsDispensados = true;
  var grupo = document.getElementById("frases-prontas");
  if (grupo) grupo.hidden = true;
}

function mostrarChipsSeCouber() {
  var grupo = document.getElementById("frases-prontas");
  var campo = document.getElementById("campo-mensagem");
  if (!grupo) return;
  if (parametro("apoio") !== "1" || chipsDispensados || (campo && campo.value.length > 0)) {
    grupo.hidden = true;
    return;
  }
  grupo.hidden = false;
  grupo.setAttribute("aria-label", TX.frasesProntas);
}

function usarFrase(botao) {
  if (chipsDispensados || !botao) return;
  var campo = document.getElementById("campo-mensagem");
  campo.value = botao.textContent;
  esconderChips();
  atualizarCampo();
  campo.focus();
  var fim = campo.value.length;
  try { campo.setSelectionRange(fim, fim); } catch (erro) {}
}

/* ---------- Campo e envio ---------- */
function atualizarCampo() {
  var campo = document.getElementById("campo-mensagem");
  var contador = document.getElementById("contador-mensagem");
  var n = X.tamanho(campo.value);
  contador.textContent = n + " de " + X.LIMITE;
  contador.classList.toggle("passou", n > X.LIMITE);
  var vazio = !campo.value.trim();
  document.getElementById("btn-enviar").setAttribute("aria-disabled", vazio || enviando ? "true" : "false");
  /* Cresce até 4 linhas. */
  campo.style.height = "auto";
  campo.style.height = Math.min(campo.scrollHeight + 2, 52 * 2.4) + "px";
}

function mostrarAvisoDoEnvio(texto) {
  var aviso = document.getElementById("aviso-envio");
  if (texto) mostrarAviso(aviso, "neutro", texto);
  else esconderAviso(aviso);
}

function mostrarErroDoCampo(texto) {
  var erro = document.getElementById("erro-mensagem");
  var campo = document.getElementById("campo-mensagem");
  erro.textContent = texto;
  erro.hidden = !texto;
  if (texto) campo.setAttribute("aria-invalid", "true");
  else campo.removeAttribute("aria-invalid");
}

function balaoEnviando(texto) {
  var fio = document.getElementById("fio");
  var agora = new Date().toISOString();
  separadorSePreciso(fio, agora);
  var item = itemDaMensagem({ content: texto, created_at: agora, sender_name: X.meuApelido() }, "enviando");
  fio.appendChild(item);
  document.getElementById("fio-vazio").hidden = true;
  irParaOFim();
  return item;
}

function marcarEnviada(item, mensagem) {
  item.classList.remove("falhou");
  if (mensagem && mensagem.id != null) {
    item.dataset.id = String(mensagem.id);
    vistas[String(mensagem.id)] = true;
  }
  var novo = pe(mensagem || { created_at: new Date().toISOString() }, TX.enviada);
  item.replaceChild(novo, item.querySelector(".mensagem-pe"));
}

/* Sem internet: o balão vira contorno, com «Tentar de novo» (o texto fica só na página). */
function marcarFalha(item, texto) {
  item.classList.add("falhou");
  var linha = document.createElement("p");
  linha.className = "mensagem-pe";
  linha.setAttribute("role", "alert");
  var frase = document.createElement("span");
  frase.textContent = TX.falhaSemRede;
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "tentar-de-novo";
  botao.textContent = TX.tentarDeNovo;
  botao.addEventListener("click", function () {
    item.remove();
    enviar(texto);
  });
  linha.appendChild(frase);
  linha.appendChild(botao);
  item.replaceChild(linha, item.querySelector(".mensagem-pe"));
}

/* Crise: nada foi enviado. Sem balão, campo vazio, a ajuda abre. */
function abrirAjudaDoEnvio(item) {
  if (item && item.parentNode) item.remove();
  var campo = document.getElementById("campo-mensagem");
  campo.value = "";
  atualizarCampo();
  location.assign("crise.html" + busca("de=chat&missao=" + encodeURIComponent(missaoId)));
}

function textoDoErro(resultado) {
  var doServidor = X.erroDoServidor(resultado.erro);
  if (doServidor) return doServidor;
  if (resultado.status === 403) return TX.falhaSemAcesso;
  return TC.denunciaErro;
}

async function enviar(textoRepetido) {
  if (enviando) return;
  var campo = document.getElementById("campo-mensagem");
  var texto = typeof textoRepetido === "string" ? textoRepetido : campo.value;
  if (!texto.trim()) return;
  if (X.tamanho(texto.trim()) > X.LIMITE) {
    mostrarErroDoCampo(TX.passou);
    return;
  }
  mostrarErroDoCampo("");
  mostrarAvisoDoEnvio("");
  esconderChips();
  enviando = true;
  if (typeof textoRepetido !== "string") campo.value = "";
  atualizarCampo();
  var item = balaoEnviando(texto.trim());

  if (semRedeAgora()) {
    enviando = false;
    marcarFalha(item, texto.trim());
    atualizarCampo();
    return;
  }

  var resultado = await NexusApi.enviarMensagem(missaoId, texto.trim());
  enviando = false;
  if (resultado.sessaoEncerrada) return;

  if (resultado.ok && resultado.dados && resultado.dados.crisis === true) {
    abrirAjudaDoEnvio(item);
    return;
  }
  if (resultado.ok && resultado.dados && resultado.dados.message && resultado.dados.message.id != null) {
    marcarEnviada(item, resultado.dados.message);
    X.marcarVista(missaoId, [resultado.dados.message]);
    atualizarCampo();
    return;
  }
  if (resultado.semRede) {
    marcarFalha(item, texto.trim());
    atualizarCampo();
    return;
  }
  /* Outra falha (400, 403, 429, 500 ou 2xx sem mensagem): nada foi enviado.
     O balão sai e o texto volta ao campo, com o motivo. */
  item.remove();
  if (!document.querySelector("#fio .mensagem")) document.getElementById("fio-vazio").hidden = false;
  campo.value = texto;
  atualizarCampo();
  /* 400 é do que foi escrito (erro do campo); o resto é aviso neutro do servidor. */
  if (resultado.status === 400) mostrarErroDoCampo(textoDoErro(resultado));
  else mostrarAvisoDoEnvio(textoDoErro(resultado));
  campo.focus();
}

/* ---------- Opções, denúncia e bloqueio ---------- */
function abrirDialogo(dialogo) {
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");
}

function fecharDialogo(dialogo) {
  if (!dialogo.open) return;
  if (typeof dialogo.close === "function") dialogo.close();
  else dialogo.removeAttribute("open");
}

function abrirOpcoes(mensagem, botao) {
  mensagemDaFolha = mensagem;
  botaoDaFolha = botao;
  abrirDialogo(document.getElementById("folha-opcoes"));
  document.getElementById("opcao-denunciar").focus();
}

function montarMotivos() {
  var grupo = document.getElementById("motivos");
  C.MOTIVOS.forEach(function (motivo) {
    var rotulo = document.createElement("label");
    rotulo.className = "motivo";
    var radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "motivo";
    radio.value = motivo.codigo;
    radio.addEventListener("change", atualizarEnviarDenuncia);
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

function atualizarEnviarDenuncia() {
  var form = document.getElementById("form-denuncia");
  if (form.dataset.ocupado === "sim") return;
  document.getElementById("btn-enviar-denuncia").disabled = !motivoEscolhido();
}

function definirDenunciando(ligado) {
  var form = document.getElementById("form-denuncia");
  var botao = document.getElementById("btn-enviar-denuncia");
  form.dataset.ocupado = ligado ? "sim" : "";
  botao.disabled = ligado || !motivoEscolhido();
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? TC.enviandoDenuncia : TC.enviarDenuncia;
  document.getElementById("btn-cancelar-denuncia").disabled = ligado;
}

var atualizarContadorDenuncia = function () {};

function abrirDenuncia() {
  fecharDialogo(document.getElementById("folha-opcoes"));
  var form = document.getElementById("form-denuncia");
  form.reset();
  definirDenunciando(false);
  atualizarContadorDenuncia();
  esconderAviso(document.getElementById("alerta-denuncia"));
  abrirDialogo(document.getElementById("folha-denuncia"));
  var primeiro = document.querySelector('#folha-denuncia input[name="motivo"]');
  if (primeiro) primeiro.focus();
}

function ajudaDaDenuncia(recebida) {
  var extra = "volta=conversa&missao=" + encodeURIComponent(missaoId);
  if (recebida) extra = "de=denuncia&" + extra;
  location.assign("crise.html" + busca(extra));
}

async function enviarDenuncia() {
  var form = document.getElementById("form-denuncia");
  if (form.dataset.ocupado === "sim" || !mensagemDaFolha) return;
  var alerta = document.getElementById("alerta-denuncia");
  var motivo = motivoEscolhido();
  if (!motivo) return;
  esconderAviso(alerta);
  if (semRedeAgora()) return mostrarAviso(alerta, "rede", TC.denunciaSemRede);
  var detalhes = document.getElementById("detalhes").value;
  definirDenunciando(true);
  var resultado;
  try {
    resultado = await NexusApi.denunciarMensagem(mensagemDaFolha.id, motivo, detalhes);
  } finally {
    definirDenunciando(false);
  }
  if (resultado.sessaoEncerrada) return;
  if (resultado.ok && resultado.dados && resultado.dados.crisis === true) {
    fecharDialogo(document.getElementById("folha-denuncia"));
    ajudaDaDenuncia(resultado.dados.reported === true);
    return;
  }
  if (resultado.ok && resultado.dados && resultado.dados.reported === true) {
    fecharDialogo(document.getElementById("folha-denuncia"));
    var aviso = document.getElementById("aviso-conversa");
    mostrarAviso(aviso, "ok", TC.denunciaOk);
    return;
  }
  if (resultado.ok) return mostrarAviso(alerta, "falha", TC.denunciaErro);
  if (resultado.semRede) return mostrarAviso(alerta, "rede", TC.denunciaSemRede);
  if (resultado.status === 409) return mostrarAviso(alerta, "falha", TX.denunciaRepetida);
  if (resultado.status === 429 && X.erroDoServidor(resultado.erro)) return mostrarAviso(alerta, "falha", resultado.erro);
  if (resultado.status === 503) return mostrarAviso(alerta, "falha", TC.denunciaIndisponivel);
  mostrarAviso(alerta, "falha", TC.denunciaErro);
}

function abrirBloquear() {
  fecharDialogo(document.getElementById("folha-opcoes"));
  document.getElementById("texto-bloquear").textContent = X.souParceiroNaMissaoDoOutro(missaoAtual)
    ? TX.bloquearTextoSaida
    : TX.bloquearTexto;
  esconderAviso(document.getElementById("alerta-bloquear"));
  definirBloqueando(false);
  abrirDialogo(document.getElementById("dialogo-bloquear"));
  /* Foco inicial em «Cancelar». */
  document.getElementById("btn-cancelar-bloquear").focus();
}

function definirBloqueando(ligado) {
  var dialogo = document.getElementById("dialogo-bloquear");
  var botao = document.getElementById("btn-confirmar-bloquear");
  dialogo.dataset.ocupado = ligado ? "sim" : "";
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  botao.querySelector(".btn-rotulo").textContent = ligado ? TX.bloqueando : TX.bloquearConfirmar;
  document.getElementById("btn-cancelar-bloquear").disabled = ligado;
}

async function confirmarBloqueio() {
  var dialogo = document.getElementById("dialogo-bloquear");
  if (dialogo.dataset.ocupado === "sim") return;
  var alerta = document.getElementById("alerta-bloquear");
  esconderAviso(alerta);
  if (semRedeAgora()) return mostrarAviso(alerta, "rede", TX.bloquearSemRede);
  definirBloqueando(true);
  var resultado = await NexusApi.bloquearPar(missaoId);
  definirBloqueando(false);
  if (resultado.sessaoEncerrada) return;
  /* Só depois do servidor: a pessoa vê «Pessoa bloqueada.» na Missão. */
  if (resultado.ok && resultado.dados && resultado.dados.blocked === true) {
    try {
      sessionStorage.setItem("nexus_v2_aviso_missao", "bloqueio");
    } catch (erro) {}
    location.replace("missao.html" + busca());
    return;
  }
  if (resultado.semRede) return mostrarAviso(alerta, "rede", TX.bloquearSemRede);
  if (resultado.status === 503) return mostrarAviso(alerta, "falha", TX.bloquearIndisponivel);
  mostrarAviso(alerta, "falha", TX.bloquearErro);
}

/* ---------- Início ---------- */
function ligar() {
  document.getElementById("btn-tentar").addEventListener("click", function () {
    var botao = document.getElementById("btn-tentar");
    if (abrindoConversa || botao.getAttribute("aria-disabled") === "true") return;
    carregar();
  });
  var campo = document.getElementById("campo-mensagem");
  campo.addEventListener("input", function () {
    if (!chipsDispensados) esconderChips();
    if (X.tamanho(campo.value.trim()) <= X.LIMITE) mostrarErroDoCampo("");
    atualizarCampo();
  });
  var chips = document.querySelectorAll(".chip-frase");
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function (evento) {
      usarFrase(evento.currentTarget);
    });
  }
  document.getElementById("form-mensagem").addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviar();
  });
  document.getElementById("ir-novas").addEventListener("click", irParaOFim);

  var opcoes = document.getElementById("folha-opcoes");
  document.getElementById("opcao-denunciar").addEventListener("click", abrirDenuncia);
  document.getElementById("opcao-bloquear").addEventListener("click", abrirBloquear);
  document.getElementById("btn-fechar-opcoes").addEventListener("click", function () { fecharDialogo(opcoes); });

  montarMotivos();
  atualizarContadorDenuncia = window.NexusNota.ligar("detalhes", "detalhes-contador", "detalhes-aviso");
  var folha = document.getElementById("folha-denuncia");
  document.getElementById("form-denuncia").addEventListener("submit", function (evento) {
    evento.preventDefault();
    enviarDenuncia();
  });
  document.getElementById("btn-cancelar-denuncia").addEventListener("click", function () { fecharDialogo(folha); });
  folha.addEventListener("cancel", function (evento) {
    if (document.getElementById("form-denuncia").dataset.ocupado === "sim") evento.preventDefault();
  });

  var dialogo = document.getElementById("dialogo-bloquear");
  document.getElementById("btn-cancelar-bloquear").addEventListener("click", function () { fecharDialogo(dialogo); });
  document.getElementById("btn-confirmar-bloquear").addEventListener("click", confirmarBloqueio);
  dialogo.addEventListener("cancel", function (evento) {
    if (dialogo.dataset.ocupado === "sim") evento.preventDefault();
  });

  /* Ao fechar qualquer folha, o foco volta ao «…» da mensagem. */
  [opcoes, folha, dialogo].forEach(function (d) {
    d.addEventListener("close", function () {
      var aberto = document.querySelector("dialog[open]");
      if (!aberto && botaoDaFolha && botaoDaFolha.isConnected) NexusAbas.focar(botaoDaFolha);
    });
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") atualizarEmSilencio();
  });
}

/* Texto grande (200%): o cabeçalho encolhe para caber mais mensagens. */
function ajustarTextoGrande() {
  var tamanho = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  document.body.classList.toggle("texto-grande", tamanho >= 24);
}

function iniciar() {
  ajustarTextoGrande();
  window.addEventListener("resize", ajustarTextoGrande);
  if (typeof ResizeObserver === "function") new ResizeObserver(ajustarTextoGrande).observe(document.documentElement);
  /* ?cenario= só vale com o mock local (localhost, 127.0.0.1, [::1]). */
  window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  var id = parametro("missao");
  missaoId = /^[1-9]\d{0,9}$/.test(id) ? id : null;
  X.aplicar(document);
  C.aplicar(document);
  document.getElementById("fio").setAttribute("aria-label", TX.mensagens);
  document.getElementById("voltar").href = "missao.html" + busca();
  document.getElementById("link-missao").href = "missao.html" + busca();
  document.getElementById("link-voltar-erro").href = "missao.html" + busca();
  NexusAbas.montar("missao");
  ligar();
  carregar();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

iniciar();
