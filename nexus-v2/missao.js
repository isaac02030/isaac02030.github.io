/* Tela Missão: Solo, Duo e Rival.
   A flag abaixo é o interruptor do convite por link.
   false: a rota ainda não existe. Os botões avisam, em voz alta para o leitor,
   e não inventam link. Não chamar a criação de missão com o modo de par ou de
   rival: isso entra na fila de pareamento automático.
   true: pedirConvite passa a falar com a rota nova. Enquanto o corpo dela
   estiver vazio, o aviso de indisponível continua. */

/* Ligado com o convite por link do servidor (PR 38). */
var NEXUS_CONVITE_POR_LINK = true;

var CHAVE_CACHE = "nexus_v2_missao";
var CHAVE_USUARIO = "nexus_v2_user";
var TEXTO_ERRO = "Não foi possível abrir a missão. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
var TEXTO_CONVITE_OFF = "Sem internet. O convite não pode ser criado agora.";
var TEXTO_CONVITE_FORA = "O convite por link ainda não está disponível.";
var TEXTO_PLACAR_OFF = "Sem internet. Este placar é o último que ficou neste aparelho.";
var TEXTO_PLACAR_SEM = "Sem internet. O placar aparece quando a conexão voltar.";
var TEXTO_PLACAR_ERRO = "Não foi possível abrir o placar agora.";
var TEXTO_RASTRO_ERRO = "Não foi possível abrir os dias da missão. Tente de novo.";
var TEXTO_RASTRO_OFF = "Sem internet. Estes são os dias que ficaram neste aparelho.";
var TEXTO_RASTRO_SEM = "Sem internet. Os dias aparecem quando a conexão voltar.";
var TEXTO_COPIA_ERRO = "Não foi possível copiar. Selecione o link e copie à mão.";
var TEXTO_ABANDONO_OFF = "Sem internet. A missão continua. Tente de novo quando a conexão voltar.";
var TEXTO_ABANDONO_ERRO = "Não foi possível abandonar agora. A missão continua.";
var TEXTO_SOLO_FIM = "Se abandonar, esta missão termina e você não registra mais os dias dela.";
var TEXTO_SOLO_FEITO = "A missão foi encerrada. O registro do dia parou.";
var MS_DIA = 24 * 60 * 60 * 1000;
var ciclo = 0;
var modeloAtual = null;
var missaoAtual = null;
var sequenciaAtual = null;
var diasAbrindo = false;
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
  var quando = diaDaMissao(missao);
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
    dia: quando ? quando.dia : null,
    duracao: quando ? quando.duracao : null,
    minimo: campoTexto(missao, "daily_minimum"),
    porque: campoTexto(missao, "why_it_matters"),
    diasSemana: NexusDias.daMissao(missao && missao.mission_weekdays),
    semanaDia1: missao && missao.started_at ? NexusDias.diaDaSemana(missao.started_at) : null,
    diaLivre: false,
    linhas: null,
    avisoPlacar: "",
    mostrarConvite: !temPar,
    link: ""
  };
}

/* Dia N de D só existe com started_at e duration_days de verdade.
   Sem um dos dois, a linha some. Não completamos com 1 nem com 30. */
function diaDaMissao(missao) {
  if (!missao || typeof missao.started_at !== "string" || !missao.started_at) return null;
  if (!Object.prototype.hasOwnProperty.call(missao, "duration_days")) return null;
  if (missao.duration_days == null || missao.duration_days === "") return null;
  var inicio = new Date(missao.started_at);
  if (isNaN(inicio.getTime())) return null;
  var duracao = Number(missao.duration_days);
  if (!isFinite(duracao) || duracao < 1) return null;
  var dia = Math.floor((Date.now() - inicio.getTime()) / MS_DIA) + 1;
  if (dia < 1) return null;
  return { dia: dia, duracao: Math.floor(duracao) };
}

function campoTexto(missao, chave) {
  if (!missao || !Object.prototype.hasOwnProperty.call(missao, chave)) return "";
  if (typeof missao[chave] !== "string") return "";
  return missao[chave].trim();
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

/* Convite por link (PR 38 do servidor). Devolve { link, convite } ou { erro }. */
function pedirConvite(tipo) {
  if (NEXUS_CONVITE_POR_LINK !== true || !modeloAtual || modeloAtual.id == null) {
    return Promise.resolve({ indisponivel: true, tipo: tipo });
  }
  return NexusApi.criarConvite(modeloAtual.id, tipo).then(function (resultado) {
    var C = window.NexusConvite;
    var dados = resultado && resultado.dados;
    if (resultado && resultado.ok && dados && C.tokenValido(dados.token) && dados.invite) {
      return {
        link: C.linkDoConvite(dados.token),
        convite: { id: dados.invite.id, tipo: dados.invite.kind === "rival" ? "rival" : "duo", vence: dados.invite.expires_at }
      };
    }
    if (resultado && resultado.sessaoEncerrada) return { erro: "" };
    if (resultado && resultado.semRede) return { erro: TEXTO_CONVITE_OFF };
    return { erro: C.textoDoErro(resultado) };
  });
}

function lerPontos(pontos, nome) {
  if (!nome || !pontos || typeof pontos !== "object") return null;
  if (!Object.prototype.hasOwnProperty.call(pontos, nome)) return null;
  var n = Number(pontos[nome]);
  if (!isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

/* Placar do Rival em pontos (points do /score, PR 37). Sem points: sem placar. */
function linhasDoPlacar(dados, meuNome, nomePar) {
  if (!dados || typeof dados.points !== "object" || !dados.points) return null;
  if (!meuNome || !nomePar || meuNome === nomePar) return null;
  var meu = lerPontos(dados.points, meuNome);
  var par = lerPontos(dados.points, nomePar);
  if (meu == null || par == null) return null;
  return [
    { eu: true, pontos: meu },
    { eu: false, nome: nomePar, pontos: par }
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

function pontosDaLinha(item) {
  var pontos = item ? Number(item.pontos) : NaN;
  if (!isFinite(pontos) || pontos < 0) return null;
  return Math.floor(pontos);
}

/* Cópia guardada do placar: só em pontos (uma cópia antiga, em dias, é descartada). */
function sanitizarLinhas(lista) {
  if (!Array.isArray(lista) || lista.length !== 2) return null;
  var da = pontosDaLinha(lista[0]);
  var db = pontosDaLinha(lista[1]);
  if (da == null || db == null) return null;
  var nomePar = lista[1] && typeof lista[1].nome === "string" ? lista[1].nome.trim() : "";
  if (!nomePar) return null;
  return [
    { eu: true, pontos: da },
    { eu: false, nome: nomePar, pontos: db }
  ];
}

function linkSeguro(valor) {
  if (typeof valor !== "string") return "";
  var url = valor.trim();
  if (!url || url.length > 200 || /\s/.test(url)) return "";
  return url;
}

function numerosGuardados(lista) {
  if (!Array.isArray(lista)) return null;
  var saida = [];
  lista.forEach(function (item) {
    var n = Number(item);
    if (!isFinite(n) || n < 1 || n > 96) return;
    n = Math.floor(n);
    if (saida.indexOf(n) === -1) saida.push(n);
  });
  return saida;
}

function guardarCache(modelo) {
  if (!modelo || modelo.id == null) return;
  /* Se os dias falharam agora, não apaga os números que já estavam neste aparelho. */
  var feitos = Array.isArray(modelo.feitos) ? modelo.feitos : null;
  var dificeis = Array.isArray(modelo.dificeis) ? modelo.dificeis : null;
  var hojeFeito = modelo.hojeFeito === true;
  if (feitos == null) {
    var anterior = lerCache();
    if (anterior && String(anterior.id) === String(modelo.id) && Array.isArray(anterior.feitos)) {
      feitos = anterior.feitos;
      dificeis = Array.isArray(anterior.dificeis) ? anterior.dificeis : [];
      hojeFeito = anterior.hojeFeito === true;
    }
  }
  /* O link do convite não fica gravado no aparelho: o token aparece uma vez. */
  var link = "";
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({
      versao: 2,
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
      dia: typeof modelo.dia === "number" ? modelo.dia : null,
      duracao: typeof modelo.duracao === "number" ? modelo.duracao : null,
      minimo: modelo.minimo || "",
      porque: modelo.porque || "",
      diasSemana: Array.isArray(modelo.diasSemana) ? modelo.diasSemana : null,
      semanaDia1: typeof modelo.semanaDia1 === "number" ? modelo.semanaDia1 : null,
      diaLivre: modelo.diaLivre === true,
      feitos: feitos,
      dificeis: dificeis,
      hojeFeito: hojeFeito,
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
    if (!dados || (dados.versao !== 1 && dados.versao !== 2) || dados.id == null) return null;
    dados.linhas = sanitizarLinhas(dados.linhas);
    dados.link = linkSeguro(dados.link);
    dados.feitos = numerosGuardados(dados.feitos);
    dados.dificeis = numerosGuardados(dados.dificeis);
    dados.hojeFeito = dados.hojeFeito === true;
    dados.avisoPlacar = "";
    dados.avisoRastro = "";
    dados.rastroErro = false;
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
    : (tipo === "ok"
      ? "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"
      : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
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
  NexusAbas.focar(document.getElementById("sobretitulo"));
  NexusAbas.concluirRolagem();
}

function mostrarVazia() {
  mostrarVista("vazia");
  document.getElementById("btn-comecar").href = "onboarding.html" + NexusAbas.busca(["tema"]);
  NexusAbas.focar(document.getElementById("sobretitulo"));
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
    nome.textContent = linha.eu ? "Você" : linha.nome;
    var dias = document.createElement("span");
    dias.className = "placar-dias";
    dias.textContent = window.NexusConvite.textoPontos(linha.pontos);
    item.appendChild(nome);
    item.appendChild(dias);
    lista.appendChild(item);
  });
}

function mostrarLinha(id, valor) {
  var el = document.getElementById(id);
  if (valor) {
    el.hidden = false;
    el.textContent = valor;
    return;
  }
  el.hidden = true;
  el.textContent = "";
}

/* A linha dos dias da semana fica. A régua saiu: o rastro já mostra o dia livre. */
function pintarDiasDaSemana(modelo) {
  var linha = document.getElementById("dias-linha");
  var dias = NexusDias.daMissao(modelo.diasSemana);
  if (!dias || typeof modelo.semanaDia1 !== "number") {
    linha.hidden = true;
    linha.textContent = "";
    return;
  }
  linha.hidden = false;
  linha.textContent = NexusDias.TEXTOS.rotuloPrevia + ": " + NexusDias.resumo(dias);
}

function rastroCabe(modelo) {
  if (!modelo || modelo.status === "completed") return false;
  if (typeof modelo.dia !== "number" || typeof modelo.duracao !== "number") return false;
  if (modelo.dia < 1 || modelo.duracao < 1 || modelo.dia > modelo.duracao) return false;
  return true;
}

function dadosDoRastro(modelo) {
  if (!rastroCabe(modelo) || !Array.isArray(modelo.feitos)) return null;
  return {
    duracao: modelo.duracao,
    hoje: modelo.dia,
    feitos: modelo.feitos,
    dificeis: Array.isArray(modelo.dificeis) ? modelo.dificeis : [],
    ehLivre: NexusRegistro.livreDe(modelo),
    hojeFeito: modelo.hojeFeito === true
  };
}

function textoContagem(n) {
  var partes = [n.feitos + " " + (n.feitos === 1 ? "feito" : "feitos")];
  if (n.dificeis) partes.push(n.dificeis + " " + (n.dificeis === 1 ? "difícil" : "difíceis"));
  if (n.livres) partes.push(n.livres + " " + (n.livres === 1 ? "livre" : "livres"));
  if (n.faltas) partes.push(n.faltas + " sem registro");
  return partes.join(" · ");
}

function rotuloDoDia(item) {
  if (item.hoje && (item.estado === "f" || item.estado === "d")) return "hoje, registrado";
  if (item.estado === "h") return "hoje, ainda sem registro";
  if (item.estado === "d") return "dia difícil";
  if (item.estado === "l") return "dia livre";
  if (item.estado === "x") return "sem registro";
  if (item.estado === "f") return "feito";
  return "";
}

function linhasDoDiaADia(dados) {
  var linhas = [];
  var futuroA = null;
  var futuroB = null;
  NexusTrilha.estados(dados).forEach(function (item) {
    if (item.dia > dados.hoje) {
      if (futuroA == null) futuroA = item.dia;
      futuroB = item.dia;
      return;
    }
    var rotulo = rotuloDoDia(item);
    if (rotulo) linhas.push("Dia " + item.dia + ": " + rotulo);
  });
  if (futuroA != null) {
    if (futuroA === futuroB) linhas.push("Dia " + futuroA + ": ainda por vir");
    else linhas.push("Dias " + futuroA + " a " + futuroB + ": ainda por vir");
  }
  return linhas;
}

function definirDiasAbrindo(ligado) {
  var botao = document.getElementById("btn-dias");
  diasAbrindo = ligado === true;
  botao.textContent = diasAbrindo ? "Abrindo…" : "Tentar de novo";
  botao.setAttribute("aria-disabled", diasAbrindo ? "true" : "false");
  botao.setAttribute("aria-busy", diasAbrindo ? "true" : "false");
}

function mostrarAvisoRastro(textoAviso, alerta) {
  var aviso = document.getElementById("aviso-rastro");
  aviso.className = "alerta alerta-neutro";
  aviso.setAttribute("role", alerta ? "alert" : "status");
  aviso.textContent = textoAviso;
  aviso.hidden = !textoAviso;
}

function pintarRastro(modelo) {
  var bloco = document.getElementById("bloco-rastro");
  var caixa = document.getElementById("trilha-missao");
  var contagem = document.getElementById("contagem-rastro");
  var legenda = document.getElementById("legenda-rastro");
  var detalhes = document.getElementById("dia-a-dia");
  var lista = document.getElementById("lista-dias");
  var botao = document.getElementById("btn-dias");
  if (!rastroCabe(modelo)) {
    bloco.hidden = true;
    return;
  }
  bloco.hidden = false;
  var dados = dadosDoRastro(modelo);
  if (!dados) {
    caixa.hidden = true;
    caixa.replaceChildren();
    contagem.hidden = true;
    contagem.textContent = "";
    legenda.hidden = true;
    legenda.replaceChildren();
    detalhes.hidden = true;
    detalhes.open = false;
    lista.replaceChildren();
    mostrarAvisoRastro(modelo.avisoRastro || "", modelo.rastroErro === true);
    botao.hidden = modelo.rastroErro !== true;
    if (!botao.hidden) definirDiasAbrindo(false);
    return;
  }
  botao.hidden = true;
  definirDiasAbrindo(false);
  mostrarAvisoRastro(modelo.avisoRastro || "", false);
  caixa.hidden = false;
  NexusTrilha.pintar(caixa, dados);
  var n = NexusTrilha.contagem(dados);
  contagem.hidden = false;
  contagem.textContent = textoContagem(n);
  var temHoje = NexusTrilha.estados(dados).some(function (item) { return item.hoje; });
  var itens = [
    ["lf", "Feito", n.feitos],
    ["ld", "Dia difícil", n.dificeis],
    ["ll", "Dia livre", n.livres],
    ["lx", "Sem registro", n.faltas],
    ["lh", "Hoje", temHoje ? 1 : 0]
  ];
  var pecas = itens.filter(function (item) { return item[2] > 0; }).map(function (item) {
    var li = document.createElement("li");
    var marca = document.createElement("i");
    marca.className = item[0];
    li.appendChild(marca);
    li.appendChild(document.createTextNode(item[1]));
    return li;
  });
  legenda.replaceChildren.apply(legenda, pecas);
  legenda.hidden = pecas.length === 0;
  var linhas = linhasDoDiaADia(dados).map(function (frase) {
    var li = document.createElement("li");
    li.textContent = frase;
    return li;
  });
  lista.replaceChildren.apply(lista, linhas);
  detalhes.open = false;
  detalhes.hidden = linhas.length === 0;
}

function aplicarDias(modelo, missao, progresso, sequencia) {
  var meus = NexusRegistro.checkinsMeus(missao, progresso);
  var hojeFeito = !!(sequencia && sequencia.today_done);
  modelo.hojeFeito = hojeFeito;
  modelo.feitos = NexusRegistro.diasFeitos(meus, modelo.dia, hojeFeito);
  var dificeis = NexusRegistro.lerDiasDificeis(sequencia, missao, meus);
  modelo.dificeis = Array.isArray(dificeis) ? dificeis : [];
  modelo.rastroErro = false;
  modelo.avisoRastro = "";
}

function aplicarRastroGuardado(modelo) {
  var guardado = lerCache();
  modelo.rastroErro = false;
  if (guardado && String(guardado.id) === String(modelo.id) && Array.isArray(guardado.feitos)) {
    modelo.feitos = guardado.feitos;
    modelo.dificeis = Array.isArray(guardado.dificeis) ? guardado.dificeis : [];
    modelo.hojeFeito = guardado.hojeFeito === true;
    modelo.avisoRastro = TEXTO_RASTRO_OFF;
    return;
  }
  modelo.feitos = null;
  modelo.dificeis = null;
  modelo.hojeFeito = false;
  modelo.avisoRastro = TEXTO_RASTRO_SEM;
}

async function tentarDias() {
  if (!modeloAtual || !missaoAtual || diasAbrindo) return;
  if (semRedeAgora()) {
    aplicarRastroGuardado(modeloAtual);
    pintarRastro(modeloAtual);
    return;
  }
  definirDiasAbrindo(true);
  var progresso = await NexusApi.progressoDaMissao(modeloAtual.id);
  if (!modeloAtual) return;
  definirDiasAbrindo(false);
  if (progresso.ok) {
    aplicarDias(modeloAtual, missaoAtual, progresso.dados, sequenciaAtual);
    guardarCache(modeloAtual);
    pintarRastro(modeloAtual);
    return;
  }
  if (progresso.semRede) {
    aplicarRastroGuardado(modeloAtual);
    pintarRastro(modeloAtual);
    return;
  }
  modeloAtual.feitos = null;
  modeloAtual.dificeis = null;
  modeloAtual.hojeFeito = false;
  modeloAtual.rastroErro = true;
  modeloAtual.avisoRastro = TEXTO_RASTRO_ERRO;
  pintarRastro(modeloAtual);
}

function pintar(modelo) {
  var titulo = document.getElementById("titulo");
  if (modelo.titulo) {
    titulo.hidden = false;
    titulo.textContent = modelo.titulo;
    document.title = modelo.titulo + " — Nexus";
  } else {
    titulo.hidden = true;
    titulo.textContent = "";
    document.title = "Sua missão — Nexus";
  }
  document.getElementById("modo").textContent = modelo.tituloModo || "Solo";
  mostrarLinha("dia-numero", modelo.dia && modelo.duracao ? "Dia " + modelo.dia + " de " + modelo.duracao : "");
  /* Num dia livre (today_is_mission_day false) não há mínimo de hoje: vale a frase aprovada. */
  if (modelo.diaLivre === true) mostrarLinha("minimo", NexusDias.TEXTOS.hojeLivre);
  else mostrarLinha("minimo", modelo.minimo ? "O mínimo de hoje: " + modelo.minimo : "");
  mostrarLinha("porque", modelo.porque ? "Porque: " + modelo.porque : "");
  document.getElementById("frase-solo").hidden = modelo.fraseSolo !== true;
  pintarDiasDaSemana(modelo);
  pintarRastro(modelo);

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

  pintarConvite(modelo);
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

/* Chat do Duo/Rival: «Abrir a conversa» só com par ativo. «2 novas» conta,
   neste aparelho, as mensagens da outra pessoa depois da última vez que a
   conversa foi aberta (não é «visto»: nada disso vai ao servidor). */
var cicloConversa = 0;
async function pintarConversa(modelo, missao) {
  var meu = ++cicloConversa;
  var bloco = document.getElementById("bloco-conversa");
  var novas = document.getElementById("novas-conversa");
  var X = window.NexusChat;
  novas.hidden = true;
  novas.textContent = "";
  var ativa = modelo.status === "active" || modelo.status === "";
  if (!X || !missao || !X.temPar(missao) || !ativa) {
    bloco.hidden = true;
    return;
  }
  bloco.hidden = false;
  var extra = NexusAbas.busca(["tema", "cenario", "rede"]);
  document.getElementById("btn-conversa").href = "conversa.html" + (extra ? extra + "&" : "?") + "missao=" + encodeURIComponent(modelo.id);
  if (semRedeAgora()) return;
  var lista = await NexusApi.listarMensagens(modelo.id);
  if (meu !== cicloConversa || !lista.ok || !lista.dados || !Array.isArray(lista.dados.messages)) return;
  var n = X.contarNovas(modelo.id, lista.dados.messages);
  if (n > 0) {
    novas.textContent = n === 1 ? X.TEXTOS.nova : X.preencher(X.TEXTOS.novas, { n: n });
    novas.hidden = false;
  }
}

/* «Pessoa bloqueada.»: a conversa já confirmou com o servidor antes de vir para cá. */
function avisoDeBloqueio() {
  var marca = "";
  try {
    marca = sessionStorage.getItem("nexus_v2_aviso_missao") || "";
    sessionStorage.removeItem("nexus_v2_aviso_missao");
  } catch (erro) {
    marca = "";
  }
  if (marca === "bloqueio" && window.NexusChat) {
    mostrarAviso(document.getElementById("aviso-missao"), "ok", window.NexusChat.TEXTOS.bloqueada);
  }
}

function abrirModelo(modelo) {
  modeloAtual = modelo;
  fecharConfirmacao();
  pintar(modelo);
  mostrarVista("missao");
  var titulo = document.getElementById("titulo");
  NexusAbas.focar(titulo && !titulo.hidden ? titulo : document.getElementById("sobretitulo"));
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
  if (Array.isArray(guardado.feitos)) guardado.avisoRastro = TEXTO_RASTRO_OFF;
  else guardado.avisoRastro = TEXTO_RASTRO_SEM;
  if (guardado.link) guardado.mostrarConvite = false;
  else guardado.mostrarConvite = guardado.temPar !== true;
  abrirModelo(guardado);
}

function textoAbandono(modelo) {
  if (modelo && modelo.temPar && modelo.nomePar) {
    return "Se você sair, é removido da missão e " + modelo.nomePar + " continua em Solo.";
  }
  return TEXTO_SOLO_FIM;
}

function fecharConfirmacao() {
  var confirma = document.getElementById("confirma");
  confirma.hidden = true;
  confirma.setAttribute("aria-labelledby", "texto-abandono");
  document.getElementById("btn-abandonar").hidden = false;
  document.getElementById("aviso-abandono").textContent = "";
  document.getElementById("pergunta-abandono").hidden = true;
  document.getElementById("btn-continuar").hidden = false;
  document.getElementById("btn-confirmar").hidden = true;
  definirConfirmando(false);
}

function abrirConfirmacao() {
  if (!modeloAtual || abandonando) return;
  abandonoCancelado = false;
  document.getElementById("texto-abandono").textContent = textoAbandono(modeloAtual);
  document.getElementById("aviso-abandono").textContent = "";
  document.getElementById("pergunta-abandono").hidden = true;
  document.getElementById("btn-continuar").hidden = false;
  document.getElementById("btn-confirmar").hidden = true;
  document.getElementById("btn-abandonar").hidden = true;
  var confirma = document.getElementById("confirma");
  confirma.setAttribute("aria-labelledby", "texto-abandono");
  confirma.hidden = false;
  document.getElementById("texto-abandono").focus();
}

function avancarConfirmacao() {
  var pergunta = document.getElementById("pergunta-abandono");
  document.getElementById("btn-continuar").hidden = true;
  document.getElementById("btn-confirmar").hidden = false;
  pergunta.hidden = false;
  document.getElementById("confirma").setAttribute("aria-labelledby", "pergunta-abandono");
  pergunta.focus();
}

function definirConfirmando(ligado) {
  var botao = document.getElementById("btn-confirmar");
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  if (rotulo) rotulo.textContent = ligado ? "Abandonando…" : "Sim, abandonar";
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
  document.title = "Sua missão — Nexus";
  NexusAbas.focar(document.getElementById("sobretitulo"));
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

/* Apoio, validade, compartilhar e cancelar do convite real (o de exemplo não tem). */
function pintarConvite(modelo) {
  var C = window.NexusConvite;
  var convite = modelo && modelo.convite;
  var apoio = document.getElementById("apoio-link");
  var validade = document.getElementById("validade-link");
  var cancelar = document.getElementById("btn-cancelar-convite");
  var compartilhar = document.getElementById("btn-compartilhar");
  if (!convite || !C) {
    validade.hidden = true;
    cancelar.hidden = true;
    compartilhar.hidden = true;
    return;
  }
  apoio.textContent = convite.tipo === "rival" ? C.TEXTOS.apoioRival : C.TEXTOS.apoioDuo;
  validade.textContent = C.validade(convite.vence);
  validade.hidden = !validade.textContent;
  cancelar.hidden = false;
  compartilhar.hidden = !(navigator.share && typeof navigator.share === "function");
}

var criandoConvite = false;
function aoConvidar(tipo) {
  var aviso = document.getElementById("aviso-convite");
  if (criandoConvite) return;
  if (semRedeAgora()) {
    aviso.textContent = TEXTO_CONVITE_OFF;
    return;
  }
  criandoConvite = true;
  ["btn-duo", "btn-rival"].forEach(function (id) { document.getElementById(id).setAttribute("aria-busy", "true"); });
  aviso.textContent = window.NexusConvite ? window.NexusConvite.TEXTOS.criando : "";
  pedirConvite(tipo).then(function (resultado) {
    criandoConvite = false;
    ["btn-duo", "btn-rival"].forEach(function (id) { document.getElementById(id).setAttribute("aria-busy", "false"); });
    if (resultado && typeof resultado.link === "string" && resultado.link && modeloAtual) {
      aviso.textContent = "";
      modeloAtual.link = resultado.link;
      modeloAtual.convite = resultado.convite || null;
      modeloAtual.mostrarConvite = false;
      pintar(modeloAtual);
      NexusAbas.focar(document.getElementById("campo-link"));
      return;
    }
    aviso.textContent = resultado && typeof resultado.erro === "string" ? resultado.erro : TEXTO_CONVITE_FORA;
  });
}

var cancelandoConvite = false;
function aoCancelarConvite() {
  var C = window.NexusConvite;
  var aviso = document.getElementById("aviso-copia");
  var botao = document.getElementById("btn-cancelar-convite");
  if (cancelandoConvite || !modeloAtual || !modeloAtual.convite) return;
  if (semRedeAgora()) {
    aviso.textContent = C.TEXTOS.semRedeCancelar;
    return;
  }
  cancelandoConvite = true;
  botao.textContent = C.TEXTOS.cancelando;
  botao.setAttribute("aria-busy", "true");
  NexusApi.cancelarConvite(modeloAtual.convite.id).then(function (resultado) {
    cancelandoConvite = false;
    botao.textContent = C.TEXTOS.cancelar;
    botao.setAttribute("aria-busy", "false");
    if (resultado.sessaoEncerrada) return;
    if (resultado.ok && resultado.dados && resultado.dados.canceled === true) {
      modeloAtual.link = "";
      modeloAtual.convite = null;
      modeloAtual.mostrarConvite = true;
      pintar(modeloAtual);
      var avisoConvite = document.getElementById("aviso-convite");
      avisoConvite.textContent = typeof resultado.dados.message === "string" && C.DO_SERVIDOR.indexOf(resultado.dados.message) !== -1
        ? resultado.dados.message
        : "";
      NexusAbas.focar(document.getElementById("btn-duo"));
      return;
    }
    aviso.textContent = resultado.semRede ? C.TEXTOS.semRedeCancelar : C.textoDoErro(resultado);
  });
}

function aoCompartilhar() {
  var url = document.getElementById("campo-link").value;
  if (!url || !navigator.share) return;
  navigator.share({ title: window.NexusConvite.TEXTOS.textoCompartilhar, url: url }).catch(function () {});
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
  missaoAtual = null;
  sequenciaAtual = null;
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

  /* A sequência só diz se hoje é dia livre. Se ela falhar, a tela abre como antes. */
  var pedidos = await Promise.all([
    NexusApi.obterMissao(resumo.id),
    NexusApi.sequenciaDaMissao(resumo.id),
    NexusApi.progressoDaMissao(resumo.id)
  ]);
  var missaoRes = pedidos[0];
  var sequenciaRes = pedidos[1];
  var progressoRes = pedidos[2];
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
  missaoAtual = missao;
  sequenciaAtual = sequenciaRes && sequenciaRes.ok ? sequenciaRes.dados : null;
  base.diaLivre = !!(sequenciaAtual && sequenciaAtual.today_is_mission_day === false);
  if (progressoRes.ok) aplicarDias(base, missao, progressoRes.dados, sequenciaAtual);
  else if (progressoRes.semRede) aplicarRastroGuardado(base);
  else {
    base.feitos = null;
    base.dificeis = null;
    base.hojeFeito = false;
    base.rastroErro = true;
    base.avisoRastro = TEXTO_RASTRO_ERRO;
  }
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
  pintarConversa(base, missao);
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#000000" : "#0B5F52");
}

function aplicarTextosDosDias() {
  document.querySelectorAll("[data-texto-dias]").forEach(function (el) {
    var chave = el.getAttribute("data-texto-dias");
    if (Object.prototype.hasOwnProperty.call(NexusDias.TEXTOS, chave)) el.textContent = NexusDias.TEXTOS[chave];
  });
}

function iniciar() {
  aplicarTextosDosDias();
  if (window.NexusChat) window.NexusChat.aplicar(document);
  avisoDeBloqueio();
  window.NEXUS_CENARIO = cenarioDaPagina();
  NexusAbas.montar("missao");
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("btn-dias").addEventListener("click", function () {
    if (diasAbrindo) return;
    tentarDias();
  });
  document.getElementById("btn-duo").addEventListener("click", function () { aoConvidar("duo"); });
  document.getElementById("btn-rival").addEventListener("click", function () { aoConvidar("rival"); });
  document.getElementById("btn-copiar").addEventListener("click", aoCopiar);
  document.getElementById("btn-cancelar-convite").addEventListener("click", aoCancelarConvite);
  document.getElementById("btn-compartilhar").addEventListener("click", aoCompartilhar);
  document.querySelectorAll("[data-texto-convite]").forEach(function (el) {
    var chave = el.getAttribute("data-texto-convite");
    if (window.NexusConvite && Object.prototype.hasOwnProperty.call(window.NexusConvite.TEXTOS, chave)) el.textContent = window.NexusConvite.TEXTOS[chave];
  });
  document.getElementById("btn-abandonar").addEventListener("click", abrirConfirmacao);
  document.getElementById("btn-continuar").addEventListener("click", avancarConfirmacao);
  document.getElementById("btn-confirmar").addEventListener("click", confirmarAbandono);
  document.getElementById("btn-cancelar").addEventListener("click", function () {
    abandonoCancelado = true;
    fecharConfirmacao();
    var botao = document.getElementById("btn-abandonar");
    if (!botao.hidden) botao.focus();
  });
  NexusAbas.focar(document.getElementById("sobretitulo"));
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  carregar();
}

iniciar();
