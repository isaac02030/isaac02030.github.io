/* Tela Missão: Solo, Duo e Rival.
   A flag abaixo é o interruptor do convite por link.
   false: a rota ainda não existe. Os botões avisam, em voz alta para o leitor,
   e não inventam link. Não chamar a criação de missão com o modo de par ou de
   rival: isso entra na fila de pareamento automático.
   true: pedirConvite passa a falar com a rota nova. Enquanto o corpo dela
   estiver vazio, o aviso de indisponível continua. */

var NEXUS_CONVITE_POR_LINK = false;

var CHAVE_CACHE = "nexus_v2_missao";
var CHAVE_USUARIO = "nexus_v2_user";
var TEXTO_ERRO = "Não foi possível abrir a missão. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
var TEXTO_CONVITE_OFF = "Sem internet. O convite não pode ser criado agora.";
var TEXTO_CONVITE_FORA = "O convite por link ainda não está disponível.";
var TEXTO_PLACAR_OFF = "Sem internet. Este placar é o último que ficou neste aparelho.";
var TEXTO_PLACAR_SEM = "Sem internet. O placar aparece quando a conexão voltar.";
var TEXTO_PLACAR_ERRO = "Não foi possível abrir o placar agora.";
var TEXTO_COPIA_ERRO = "Não foi possível copiar. Selecione o link e copie à mão.";
var TEXTO_ABANDONO_OFF = "Sem internet. A missão continua. Tente de novo quando a conexão voltar.";
var TEXTO_ABANDONO_ERRO = "Não foi possível abandonar agora. A missão continua.";
var TEXTO_SOLO_FIM = "Esta missão termina. O registro do dia para.";
var TEXTO_SOLO_FEITO = "A missão foi encerrada. O registro do dia parou.";
var ciclo = 0;
var modeloAtual = null;
var abandonando = false;
var abandonoCancelado = false;

function cenarioDaPagina() {
  try {
    return new URLSearchParams(location.search).get("cenario") || "";
  } catch (erro) {
    return "";
  }
}

function semRedeAgora() {
  var rede = "";
  var cenario = "";
  try {
    var params = new URLSearchParams(location.search);
    rede = params.get("rede") || "";
    cenario = params.get("cenario") || "";
  } catch (erro) {
    rede = "";
  }
  return rede === "off" || cenario === "offline" || navigator.onLine === false;
}

function texto(valor) {
  return typeof valor === "string" ? valor.trim() : "";
}

function nomeLocal() {
  try {
    var bruto = localStorage.getItem(CHAVE_USUARIO);
    if (!bruto) return "";
    var usuario = JSON.parse(bruto);
    return usuario && typeof usuario.username === "string" ? usuario.username.trim() : "";
  } catch (erro) {
    return "";
  }
}

function meuNomeNaMissao(missao) {
  var local = nomeLocal();
  var dono = texto(missao.user_name);
  var par = texto(missao.partner_name);
  if (local && (local === dono || local === par)) return local;
  if (dono) return dono;
  return local;
}

function nomeDoPar(missao, meu) {
  var dono = texto(missao.user_name);
  var par = texto(missao.partner_name);
  if (!par) return "";
  if (meu && meu === par) return dono;
  return par;
}

function modoDePar(modo) {
  return modo === "parceiro" || modo === "duo" || modo === "rival";
}

function modeloBase(missao) {
  var modo = String(missao && missao.mode || "solo").toLowerCase();
  var meuNome = meuNomeNaMissao(missao || {});
  var nomePar = nomeDoPar(missao || {}, meuNome);
  var status = texto(missao && missao.status);
  var temPar = !!nomePar && modoDePar(modo);
  var aguardando = !temPar && (missao && missao.pending_invite === "duo" || modo === "parceiro" || modo === "duo");
  var tituloModo = "Solo";
  if (temPar && modo === "rival") tituloModo = "Rival com " + nomePar;
  else if (temPar) tituloModo = "Duo com " + nomePar;
  else if (aguardando) tituloModo = "Duo, esperando o par";
  var ativa = status === "active" || status === "";
  return {
    id: missao.id,
    titulo: texto(missao.title),
    modo: modo,
    status: status,
    meuNome: meuNome,
    nomePar: temPar ? nomePar : "",
    tituloModo: tituloModo,
    aguardando: aguardando,
    fraseSolo: aguardando && ativa,
    rival: temPar && modo === "rival" && ativa,
    temPar: temPar,
    linhas: null,
    avisoPlacar: "",
    mostrarConvite: !temPar,
    link: ""
  };
}

function linkFalso() {
  if (!NexusAbas.emDev()) return "";
  if (cenarioDaPagina() !== "link-fake") return "";
  if (!window.NexusDevConvite || typeof NexusDevConvite.link !== "function") return "";
  var url = "";
  try {
    url = NexusDevConvite.link();
  } catch (erro) {
    return "";
  }
  if (typeof url !== "string") return "";
  url = url.trim();
  if (!url || url.length > 200 || /\s/.test(url)) return "";
  return url;
}

function aplicarLink(base) {
  var url = linkFalso();
  if (!url || base.temPar) return;
  base.link = url;
  base.mostrarConvite = false;
  base.aguardando = true;
  base.fraseSolo = base.status !== "waiting";
  base.tituloModo = "Duo, esperando o par";
  base.rival = false;
  base.linhas = null;
  base.avisoPlacar = "";
}

/* A rota nova entra nesta função. Hoje ela não pede nada. */
function pedirConvite(tipo) {
  if (NEXUS_CONVITE_POR_LINK !== true) {
    return Promise.resolve({ indisponivel: true, tipo: tipo });
  }
  return Promise.resolve({ indisponivel: true, tipo: tipo });
}

function lerDias(scores, nome) {
  if (!nome || !scores || typeof scores !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(scores, nome)) return null;
  var n = Number(scores[nome]);
  if (!isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function linhasDoPlacar(dados, meuNome, nomePar) {
  if (!dados || typeof dados.scores !== "object" || !dados.scores) return null;
  if (!meuNome || !nomePar || meuNome === nomePar) return null;
  var meu = lerDias(dados.scores, meuNome);
  var par = lerDias(dados.scores, nomePar);
  if (meu == null || par == null) return null;
  return [
    { nome: meuNome, dias: meu },
    { nome: nomePar, dias: par }
  ];
}

function textoDias(n) {
  if (n === 1) return "1 dia";
  return String(n) + " dias";
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
  return null;
}

function sanitizarLinhas(lista) {
  if (!Array.isArray(lista) || lista.length !== 2) return null;
  var saida = [];
  for (var i = 0; i < lista.length; i++) {
    var item = lista[i];
    var nome = item && typeof item.nome === "string" ? item.nome.trim() : "";
    var dias = item ? Number(item.dias) : NaN;
    if (!nome || !isFinite(dias) || dias < 0) return null;
    saida.push({ nome: nome, dias: Math.floor(dias) });
  }
  if (saida[0].nome === saida[1].nome) return null;
  return saida;
}

function linkSeguro(valor) {
  if (typeof valor !== "string") return "";
  var url = valor.trim();
  if (!url || url.length > 200 || /\s/.test(url)) return "";
  return url;
}

function guardarCache(modelo) {
  if (!modelo || modelo.id == null) return;
  /* O link de exemplo não fica gravado. Um link de verdade, quando a rota existir, fica. */
  var link = cenarioDaPagina() === "link-fake" ? "" : linkSeguro(modelo.link);
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({
      versao: 1,
      id: modelo.id,
      titulo: modelo.titulo || "",
      modo: modelo.modo || "solo",
      status: modelo.status || "",
      meuNome: modelo.meuNome || "",
      nomePar: modelo.nomePar || "",
      tituloModo: modelo.tituloModo || "Solo",
      aguardando: modelo.aguardando === true,
      fraseSolo: modelo.fraseSolo === true,
      rival: modelo.rival === true,
      temPar: modelo.temPar === true,
      mostrarConvite: modelo.mostrarConvite === true,
      linhas: modelo.linhas || null,
      link: link
    }));
  } catch (erro) {}
}

function lerCache() {
  try {
    var bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || dados.versao !== 1 || dados.id == null) return null;
    dados.linhas = sanitizarLinhas(dados.linhas);
    dados.link = linkSeguro(dados.link);
    dados.avisoPlacar = "";
    if (dados.link) dados.mostrarConvite = false;
    return dados;
  } catch (erro) {
    return null;
  }
}

function limparCache() {
  try {
    localStorage.removeItem(CHAVE_CACHE);
  } catch (erro) {}
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

function mostrarAviso(el, tipo, textoAviso) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = textoAviso;
  var desenho = tipo === "rede"
    ? "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18"
    : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01";
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(icone(desenho), paragrafo);
  el.hidden = false;
}

function mostrarVista(qual) {
  document.getElementById("vista-carregando").hidden = qual !== "carregando";
  document.getElementById("vista-erro").hidden = qual !== "erro";
  document.getElementById("vista-vazia").hidden = qual !== "vazia";
  document.getElementById("vista-encerrada").hidden = qual !== "encerrada";
  document.getElementById("vista-missao").hidden = qual !== "missao";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function mostrarFalha(tipo, textoFalha) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, textoFalha);
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function mostrarVazia() {
  mostrarVista("vazia");
  document.getElementById("btn-comecar").href = "onboarding.html" + NexusAbas.busca(["tema"]);
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function pintarPlacar(linhas) {
  var lista = document.getElementById("placar-lista");
  lista.replaceChildren();
  linhas.forEach(function (linha) {
    var item = document.createElement("li");
    item.className = "placar-linha";
    var nome = document.createElement("span");
    nome.className = "placar-nome";
    nome.textContent = linha.nome;
    var dias = document.createElement("span");
    dias.className = "placar-dias";
    dias.textContent = textoDias(linha.dias);
    item.appendChild(nome);
    item.appendChild(dias);
    lista.appendChild(item);
  });
}

function pintar(modelo) {
  document.getElementById("modo").textContent = modelo.tituloModo || "Solo";
  var objetivo = document.getElementById("objetivo");
  if (modelo.titulo) {
    objetivo.hidden = false;
    objetivo.textContent = modelo.titulo;
  } else {
    objetivo.hidden = true;
    objetivo.textContent = "";
  }
  document.getElementById("frase-solo").hidden = modelo.fraseSolo !== true;

  var placar = document.getElementById("placar");
  var avisoPlacar = document.getElementById("aviso-placar");
  if (modelo.linhas) {
    pintarPlacar(modelo.linhas);
    placar.hidden = false;
  } else {
    placar.hidden = true;
    document.getElementById("placar-lista").replaceChildren();
  }
  if (modelo.avisoPlacar) mostrarAviso(avisoPlacar, "rede", modelo.avisoPlacar);
  else {
    avisoPlacar.hidden = true;
    avisoPlacar.replaceChildren();
  }

  var convites = document.getElementById("convites");
  convites.hidden = modelo.mostrarConvite !== true;
  var avisoConvite = document.getElementById("aviso-convite");
  if (modelo.mostrarConvite === true && cenarioDaPagina() === "convite-indisponivel" && !semRedeAgora()) {
    avisoConvite.textContent = TEXTO_CONVITE_FORA;
  } else {
    avisoConvite.textContent = "";
  }

  var bloco = document.getElementById("bloco-link");
  var campo = document.getElementById("campo-link");
  if (modelo.link) {
    bloco.hidden = false;
    campo.value = modelo.link;
  } else {
    bloco.hidden = true;
    campo.value = "";
  }
  document.getElementById("aviso-copia").textContent = "";
}

function abrirModelo(modelo) {
  modeloAtual = modelo;
  fecharConfirmacao();
  pintar(modelo);
  mostrarVista("missao");
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function abrirOffline() {
  var guardado = lerCache();
  if (!guardado) {
    mostrarFalha("rede", TEXTO_SEM_REDE);
    return;
  }
  if (guardado.rival && guardado.linhas) guardado.avisoPlacar = TEXTO_PLACAR_OFF;
  else if (guardado.rival) guardado.avisoPlacar = TEXTO_PLACAR_SEM;
  if (guardado.link) guardado.mostrarConvite = false;
  else guardado.mostrarConvite = guardado.temPar !== true;
  abrirModelo(guardado);
}

function textoAbandono(modelo) {
  if (modelo && modelo.temPar && modelo.nomePar) {
    return "Você sai desta missão. O seu registro do dia para. " + modelo.nomePar + " continua em Solo, na mesma missão.";
  }
  return TEXTO_SOLO_FIM;
}

function fecharConfirmacao() {
  document.getElementById("confirma").hidden = true;
  document.getElementById("btn-abandonar").hidden = false;
  document.getElementById("aviso-abandono").textContent = "";
  document.getElementById("btn-entendi").hidden = false;
  document.getElementById("btn-confirmar").hidden = true;
  definirConfirmando(false);
}

function abrirConfirmacao() {
  if (!modeloAtual || abandonando) return;
  abandonoCancelado = false;
  document.getElementById("texto-abandono").textContent = textoAbandono(modeloAtual);
  document.getElementById("aviso-abandono").textContent = "";
  document.getElementById("btn-entendi").hidden = false;
  document.getElementById("btn-confirmar").hidden = true;
  document.getElementById("btn-abandonar").hidden = true;
  document.getElementById("confirma").hidden = false;
  document.getElementById("texto-abandono").focus();
}

function avancarConfirmacao() {
  document.getElementById("btn-entendi").hidden = true;
  document.getElementById("btn-confirmar").hidden = false;
  document.getElementById("btn-confirmar").focus();
}

function definirConfirmando(ligado) {
  var botao = document.getElementById("btn-confirmar");
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  if (rotulo) rotulo.textContent = ligado ? "Abandonando…" : "Abandonar missão";
  if (spinner) spinner.hidden = !ligado;
}

function sucessoAbandono(resultado) {
  return !!(resultado && resultado.ok && resultado.dados && resultado.dados.success === true);
}

function mostrarEncerrada(temPar, nome) {
  var frase = TEXTO_SOLO_FEITO;
  if (temPar && nome) frase = "Você saiu desta missão. " + nome + " continua em Solo.";
  document.getElementById("texto-encerrada").textContent = frase;
  mostrarVista("encerrada");
  modeloAtual = null;
  NexusAbas.focar(document.getElementById("titulo"));
}

function confirmarAbandono() {
  if (!modeloAtual || abandonando) return;
  if (semRedeAgora()) {
    document.getElementById("aviso-abandono").textContent = TEXTO_ABANDONO_OFF;
    return;
  }
  var modelo = modeloAtual;
  abandonando = true;
  abandonoCancelado = false;
  definirConfirmando(true);
  NexusApi.abandonarMissao(modelo.id).then(function (resultado) {
    abandonando = false;
    definirConfirmando(false);
    if (sucessoAbandono(resultado)) {
      limparCache();
      mostrarEncerrada(modelo.temPar, modelo.nomePar);
      return;
    }
    if (abandonoCancelado || document.getElementById("confirma").hidden) return;
    var frase = resultado && resultado.semRede ? TEXTO_ABANDONO_OFF : TEXTO_ABANDONO_ERRO;
    document.getElementById("aviso-abandono").textContent = frase;
  }).catch(function () {
    abandonando = false;
    definirConfirmando(false);
    if (abandonoCancelado || document.getElementById("confirma").hidden) return;
    document.getElementById("aviso-abandono").textContent = TEXTO_ABANDONO_ERRO;
  });
}

function aoConvidar(tipo) {
  var aviso = document.getElementById("aviso-convite");
  if (semRedeAgora()) {
    aviso.textContent = TEXTO_CONVITE_OFF;
    return;
  }
  pedirConvite(tipo).then(function (resultado) {
    if (resultado && typeof resultado.link === "string" && resultado.link && modeloAtual) {
      modeloAtual.link = resultado.link;
      modeloAtual.mostrarConvite = false;
      pintar(modeloAtual);
      return;
    }
    aviso.textContent = TEXTO_CONVITE_FORA;
  });
}

function copiarPeloCampo() {
  var campo = document.getElementById("campo-link");
  try {
    campo.focus();
    campo.select();
    return document.execCommand("copy") === true;
  } catch (erro) {
    return false;
  }
}

function copiarTexto(valor) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(valor).then(function () {
      return true;
    }).catch(function () {
      return copiarPeloCampo();
    });
  }
  return Promise.resolve(copiarPeloCampo());
}

function aoCopiar() {
  var campo = document.getElementById("campo-link");
  var aviso = document.getElementById("aviso-copia");
  var url = campo.value;
  if (!url) return;
  copiarTexto(url).then(function (ok) {
    if (ok) {
      aviso.textContent = "Link copiado.";
      return;
    }
    try {
      campo.focus();
      campo.select();
    } catch (erro) {}
    aviso.textContent = TEXTO_COPIA_ERRO;
  });
}

async function carregar() {
  var meu = ++ciclo;
  modeloAtual = null;
  fecharConfirmacao();
  mostrarVista("carregando");
  if (semRedeAgora()) {
    abrirOffline();
    return;
  }

  var lista = await NexusApi.listarMissoes();
  if (meu !== ciclo) return;
  if (!lista.ok) {
    if (lista.semRede) abrirOffline();
    else mostrarFalha("falha", TEXTO_ERRO);
    return;
  }

  var resumo = escolherMissao(lista.dados);
  if (!resumo || resumo.id == null) {
    mostrarVazia();
    return;
  }

  var missaoRes = await NexusApi.obterMissao(resumo.id);
  if (meu !== ciclo) return;
  if (!missaoRes.ok) {
    if (missaoRes.semRede) abrirOffline();
    else mostrarFalha("falha", TEXTO_ERRO);
    return;
  }
  var missao = missaoRes.dados;
  if (!missao || typeof missao !== "object" || missao.id == null) {
    mostrarFalha("falha", TEXTO_ERRO);
    return;
  }

  var base = modeloBase(missao);
  if (base.rival) {
    var placar = await NexusApi.placarDaMissao(missao.id);
    if (meu !== ciclo) return;
    if (placar.ok) {
      base.linhas = linhasDoPlacar(placar.dados, base.meuNome, base.nomePar);
      if (!base.linhas) base.avisoPlacar = TEXTO_PLACAR_ERRO;
    } else if (placar.semRede) {
      var guardado = lerCache();
      if (guardado && String(guardado.id) === String(base.id) && guardado.linhas) {
        base.linhas = guardado.linhas;
        base.avisoPlacar = TEXTO_PLACAR_OFF;
      } else {
        base.avisoPlacar = TEXTO_PLACAR_SEM;
      }
    } else {
      base.avisoPlacar = TEXTO_PLACAR_ERRO;
    }
  }
  aplicarLink(base);
  guardarCache(base);
  abrirModelo(base);
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  NexusAbas.montar("missao");
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("btn-duo").addEventListener("click", function () { aoConvidar("duo"); });
  document.getElementById("btn-rival").addEventListener("click", function () { aoConvidar("rival"); });
  document.getElementById("btn-copiar").addEventListener("click", aoCopiar);
  document.getElementById("btn-abandonar").addEventListener("click", abrirConfirmacao);
  document.getElementById("btn-entendi").addEventListener("click", avancarConfirmacao);
  document.getElementById("btn-confirmar").addEventListener("click", confirmarAbandono);
  document.getElementById("btn-cancelar").addEventListener("click", function () {
    abandonoCancelado = true;
    fecharConfirmacao();
    var botao = document.getElementById("btn-abandonar");
    if (!botao.hidden) botao.focus();
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
