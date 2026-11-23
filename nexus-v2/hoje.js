/* Tela Hoje. O que fazer neste dia, sem placar.
   O dia X sai de started_at e duration_days, do mesmo jeito que o servidor:
   floor((agora - started_at) / 1 dia) + 1.
   Não chama GET /api/checkins/:id/score.
   Dia difícil, quando a sequência mandar:
   difficult_days (números do dia), difficult_days_remaining, difficult_days_used,
   e difficult (sim ou não) em cada check-in.
   Sem esses campos, a linha some e a régua não marca dia difícil. Não mostramos 0 nem um valor vazio.

   Com recovery_needed true, o miolo do Hoje vira a volta ao ciclo.
   A barra de abas continua. Não é página separada nem modal.
   A frase usa missed_days_before_today quando o servidor manda.
   Sem esse campo, cai em missed_days - 1. Zero e negativo não aparecem.

   Dias da missão (dias-da-missao.js): a sequência manda today_is_mission_day e
   mission_weekdays. Com today_is_mission_day false, hoje é dia livre: sem botão
   de registrar, sem pendência, sem cor de aviso. Na régua, o dia livre tem
   contorno pontilhado, sem preenchimento e sem o traço da falta. O dia da semana
   de cada Dia N sai do started_at neste aparelho; para hoje, vale o servidor. */

var CHAVE_CACHE = "nexus_v2_hoje";
var CHAVE_USUARIO = "nexus_v2_user";
var CHAVE_ORIGEM = "nexus_v2_origem_recuperacao";
var TEXTO_ONTEM = "Ontem não houve registro.";
var TEXTO_VOLTOU = "Você voltou. O ciclo continua.";
var MS_DIA = 24 * 60 * 60 * 1000;
var TEXTO_ERRO = "Não foi possível abrir o dia. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
/* Guia v2.1: a faixa diz o que a tela mostra; o toque em Registrar diz que nada foi enviado.
   Não há fila: o registro não fica guardado para depois. */
var TEXTO_FAIXA_REDE = "Sem internet. Mostrando o que o aparelho guardou.";
/* A faixa já diz «Sem internet»; o alerta não repete. */
var TEXTO_REGISTRO_OFF = "O registro não foi enviado. Tente de novo quando a conexão voltar.";
var TEXTO_PENDENTE = "Ainda não registrou o dia.";
var TEXTO_FEITO = "Registro feito. Palavra cumprida hoje.";
var TEXTO_DIFICIL = "Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.";
var DESENHO_REDE = "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18";
var ciclo = 0;

function cenarioDaPagina() {
  try {
    return new URLSearchParams(location.search).get("cenario") || "";
  } catch (erro) {
    return "";
  }
}

/* ?rede=off é atalho de teste: só vale em localhost, 127.0.0.1 ou [::1], como os mocks.
   No site publicado, só a falta de rede de verdade mostra o dia guardado. */
function hostDeDesenvolvimento() {
  var host = location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

function semRedeAgora() {
  var rede = "";
  if (hostDeDesenvolvimento()) {
    try {
      rede = new URLSearchParams(location.search).get("rede") || "";
    } catch (erro) {
      rede = "";
    }
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
    ? DESENHO_REDE
    : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01";
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(icone(desenho), paragrafo);
  el.hidden = false;
}

/* Faixa no topo quando a tela mostra o dia guardado neste aparelho. */
function mostrarFaixaRede(ligar) {
  var faixa = document.getElementById("faixa-rede");
  var tela = document.getElementById("conteudo");
  if (!faixa) return;
  if (!ligar) {
    faixa.hidden = true;
    faixa.replaceChildren();
    tela.classList.remove("com-faixa");
    return;
  }
  var texto = document.createElement("p");
  texto.textContent = TEXTO_FAIXA_REDE;
  faixa.replaceChildren(icone(DESENHO_REDE), texto);
  faixa.hidden = false;
  tela.classList.add("com-faixa");
}

function esconderAlertaRegistro() {
  ["alerta-registro", "alerta-registro-recuperacao"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.hidden = true;
    el.replaceChildren();
  });
}

/* Sem internet, Registrar não abre o check-in: diz que nada foi enviado. */
function botaoRegistrarSemRede(idAlerta) {
  var botao = document.createElement("button");
  botao.type = "button";
  botao.className = "btn btn-primario";
  botao.id = "btn-registrar";
  botao.textContent = "Registrar o dia";
  botao.addEventListener("click", function () {
    var alerta = document.getElementById(idAlerta);
    alerta.hidden = true;
    alerta.replaceChildren();
    /* Recriar o conteúdo faz o leitor de tela ler de novo a cada toque. */
    window.setTimeout(function () {
      mostrarAviso(alerta, "rede", TEXTO_REGISTRO_OFF);
    }, 50);
  });
  return botao;
}

function mostrarVista(qual) {
  document.getElementById("vista-carregando").hidden = qual !== "carregando";
  document.getElementById("vista-erro").hidden = qual !== "erro";
  document.getElementById("vista-vazia").hidden = qual !== "vazia";
  document.getElementById("vista-dia").hidden = qual !== "dia";
  document.getElementById("vista-recuperacao").hidden = qual !== "recuperacao";
  document.getElementById("titulo-hoje").hidden = qual === "recuperacao";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
  if (qual !== "dia" && qual !== "recuperacao") mostrarFaixaRede(false);
}

function marcarOrigemRecuperacao() {
  try {
    sessionStorage.setItem(CHAVE_ORIGEM, "1");
  } catch (erro) {}
}

function limparOrigemRecuperacao() {
  try {
    sessionStorage.removeItem(CHAVE_ORIGEM);
  } catch (erro) {}
}

function mostrarFalha(tipo, texto) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, texto);
  NexusAbas.focar(document.getElementById("titulo-hoje"));
  NexusAbas.concluirRolagem();
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
  /* 96 cabe o ciclo de 30 e mais 36, sem cortar o número que o servidor gravou. */
  return Math.min(Math.floor(n), 96);
}

/* O mesmo critério da tela do fim: dia depois da duração, ou status completed. */
function fimDoCiclo(status, dia, duracao) {
  if (status === "completed") return true;
  var d = Number(dia);
  var n = Number(duracao);
  if (!isFinite(d) || !isFinite(n)) return false;
  return d > n;
}

var CHAVE_ADIAR_FIM = "nexus_v2_adiar_fim";

function consumirAdiamentoDoFim() {
  try {
    if (sessionStorage.getItem(CHAVE_ADIAR_FIM) === "1") {
      sessionStorage.removeItem(CHAVE_ADIAR_FIM);
      return true;
    }
  } catch (erro) {}
  return false;
}

function irParaOFim() {
  location.replace("dia-30.html" + NexusAbas.busca(["tema", "cenario", "rede", "ia"]));
}

function primeiraConcluida(lista) {
  if (!Array.isArray(lista)) return null;
  var i;
  for (i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].status === "completed") return lista[i];
  }
  return null;
}

function nomeLocal() {
  try {
    var bruto = localStorage.getItem(CHAVE_USUARIO);
    if (!bruto) return "";
    var usuario = JSON.parse(bruto);
    return usuario && typeof usuario.username === "string" ? usuario.username : "";
  } catch (erro) {
    return "";
  }
}

function grupos(progresso) {
  if (!progresso || typeof progresso.progress !== "object" || !progresso.progress) return [];
  return Object.keys(progresso.progress).map(function (chave) {
    var grupo = progresso.progress[chave];
    return {
      username: grupo && typeof grupo.username === "string" ? grupo.username : "",
      checkins: grupo && Array.isArray(grupo.checkins) ? grupo.checkins : []
    };
  });
}

function normalizar(checkins) {
  var saida = [];
  checkins.forEach(function (item) {
    if (!item) return;
    var dia = Number(item.day);
    if (!isFinite(dia)) return;
    saida.push({
      day: dia,
      completed: item.completed === true,
      note: typeof item.note === "string" ? item.note : "",
      difficult: item.difficult === true || item.is_difficult === true
    });
  });
  return saida;
}

function checkinsMeus(missao, progresso) {
  var lista = grupos(progresso);
  var meuNome = nomeLocal();
  var i;
  if (meuNome) {
    for (i = 0; i < lista.length; i++) {
      if (lista[i].username === meuNome) return normalizar(lista[i].checkins);
    }
  }
  var dono = missao && typeof missao.user_name === "string" ? missao.user_name : "";
  if (dono && (!meuNome || meuNome === dono)) {
    for (i = 0; i < lista.length; i++) {
      if (lista[i].username === dono) return normalizar(lista[i].checkins);
    }
  }
  var par = missao && typeof missao.partner_name === "string" ? missao.partner_name : "";
  var outros = lista.filter(function (grupo) {
    return !par || grupo.username !== par;
  });
  if (outros.length === 1) return normalizar(outros[0].checkins);
  return [];
}

function modoDuo(missao) {
  var modo = String(missao && missao.mode || "").toLowerCase();
  return modo === "parceiro" || modo === "duo";
}

function esperandoPar(missao) {
  if (!missao) return false;
  var semPar = missao.partner_id == null || missao.partner_id === "";
  if (!semPar) return false;
  if (missao.status === "waiting") return true;
  var pref = String(missao.match_preference || "");
  var querPar = pref === "parceiro" || pref === "rival" || pref === "duo";
  return querPar && String(missao.mode || "solo") === "solo";
}

function parFezHoje(progresso, nome, dia) {
  var lista = grupos(progresso);
  for (var i = 0; i < lista.length; i++) {
    if (lista[i].username !== nome) continue;
    var checks = lista[i].checkins;
    for (var j = 0; j < checks.length; j++) {
      if (Number(checks[j].day) === dia && checks[j].completed === true) return true;
    }
  }
  return false;
}

function numerosDe(lista) {
  var dias = [];
  if (!Array.isArray(lista)) return dias;
  lista.forEach(function (item) {
    var n = typeof item === "number" ? item : Number(item && item.day);
    if (isFinite(n) && n > 0) dias.push(n);
  });
  return dias;
}

/* Sem o campo, devolve null. Não completa com 0. */
function lerDiasDificeis(sequencia, missao, meus) {
  var veio = false;
  var dias = [];
  if (sequencia && Array.isArray(sequencia.difficult_days)) {
    veio = true;
    dias = numerosDe(sequencia.difficult_days);
  } else if (missao && Array.isArray(missao.difficult_days)) {
    veio = true;
    dias = numerosDe(missao.difficult_days);
  }
  meus.forEach(function (item) {
    if (item.difficult === true) {
      veio = true;
      if (dias.indexOf(item.day) === -1) dias.push(item.day);
    }
  });
  return veio ? dias : null;
}

function numeroRestante(fonte) {
  if (!fonte || typeof fonte.difficult_days_remaining !== "number") return null;
  if (!isFinite(fonte.difficult_days_remaining)) return null;
  if (fonte.difficult_days_remaining <= 0) return null;
  return fonte.difficult_days_remaining;
}

function lerRestantes(sequencia, missao) {
  var daSequencia = numeroRestante(sequencia);
  if (daSequencia !== null) return daSequencia;
  return numeroRestante(missao);
}

function lerNumero(valor) {
  if (typeof valor !== "number" || !isFinite(valor)) return null;
  return valor;
}

function lerMissedDays(sequencia) {
  if (!sequencia) return null;
  return lerNumero(sequencia.missed_days);
}

/* null = o campo não veio. 0 é um número de verdade e não cai no recuo. */
function lerAntesDeHoje(sequencia) {
  if (!sequencia || !Object.prototype.hasOwnProperty.call(sequencia, "missed_days_before_today")) return null;
  return lerNumero(sequencia.missed_days_before_today);
}

/* Prefere missed_days_before_today. Sem o campo, missed_days - 1.
   Menos de 1 não vira frase com número: ontem verdadeiro usa o texto de 1 dia.
   Nunca «0», nunca negativo, nunca «1 dias». */
function contagemDaFalta(modelo) {
  if (!modelo) return null;
  if (typeof modelo.missedBefore === "number" && isFinite(modelo.missedBefore)) {
    return Math.floor(modelo.missedBefore);
  }
  if (typeof modelo.missedDays === "number" && isFinite(modelo.missedDays)) {
    return Math.floor(modelo.missedDays) - 1;
  }
  return null;
}

function textoDaFalta(modelo) {
  var ontem = !!(modelo && modelo.missedYesterday === true);
  var n = contagemDaFalta(modelo);
  if (n === null || n < 1) return ontem ? TEXTO_ONTEM : "";
  if (n === 1) return TEXTO_ONTEM;
  return "Ficaram " + n + " dias sem registro.";
}

function seguidosBloqueiam(modelo) {
  if (!modelo || !Array.isArray(modelo.dificeis)) return null;
  var dia = Number(modelo.dia);
  if (!isFinite(dia)) return null;
  var ontem = false;
  var anteontem = false;
  modelo.dificeis.forEach(function (item) {
    var n = Number(item);
    if (n === dia - 1) ontem = true;
    if (n === dia - 2) anteontem = true;
  });
  return ontem && anteontem;
}

function podeDiaDificil(modelo) {
  if (!modelo || typeof modelo.restantes !== "number" || modelo.restantes <= 0) return false;
  if (!Array.isArray(modelo.dificeis)) return false;
  return seguidosBloqueiam(modelo) === false;
}

function notaDeHoje(meus, dia) {
  for (var i = 0; i < meus.length; i++) {
    if (meus[i].day === dia && meus[i].completed && meus[i].note) return meus[i].note;
  }
  return "";
}

function diasFeitos(meus, dia, hojeFeito) {
  var lista = [];
  meus.forEach(function (item) {
    if (item.completed === true) lista.push(item.day);
  });
  if (hojeFeito && lista.indexOf(dia) === -1) lista.push(dia);
  return lista;
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

/* A sequência manda a lista já ordenada; a missão também, quando volta inteira. */
function lerDiasDaSemana(missao, sequencia) {
  if (sequencia && Array.isArray(sequencia.mission_weekdays)) return NexusDias.daMissao(sequencia.mission_weekdays);
  if (missao && Array.isArray(missao.mission_weekdays)) return NexusDias.daMissao(missao.mission_weekdays);
  return null;
}

/* (dia) => true quando o Dia N é dia livre. Hoje segue o servidor. */
function livreDe(modelo) {
  var daMissao = NexusDias.verificador(modelo.diasSemana, modelo.semanaDia1);
  return function (dia) {
    if (dia === modelo.dia) return modelo.diaLivre === true;
    return !daMissao(dia);
  };
}

function modeloDe(missao, progresso, sequencia) {
  var dia = numeroDoDia(missao.started_at);
  var duracao = duracaoDe(missao);
  var meus = checkinsMeus(missao, progresso);
  var hojeFeito = !!(sequencia && sequencia.today_done);
  var nomePar = typeof missao.partner_name === "string" ? missao.partner_name.trim() : "";
  var mostrarPar = modoDuo(missao) && nomePar && parFezHoje(progresso, nomePar, dia);
  return {
    recuperacao: !!(sequencia && sequencia.recovery_needed === true),
    missedYesterday: !!(sequencia && sequencia.missed_yesterday === true),
    missedDays: lerMissedDays(sequencia),
    missedBefore: lerAntesDeHoje(sequencia),
    diaLivre: !!(sequencia && sequencia.today_is_mission_day === false),
    diasSemana: lerDiasDaSemana(missao, sequencia),
    semanaDia1: NexusDias.diaDaSemana(missao.started_at),
    id: missao.id,
    category: typeof missao.category === "string" ? missao.category : "",
    proof_mode: typeof missao.proof_mode === "string" ? missao.proof_mode : "",
    dia: dia,
    duracao: duracao,
    titulo: typeof missao.title === "string" ? missao.title : "",
    minimo: typeof missao.daily_minimum === "string" ? missao.daily_minimum : "",
    porque: typeof missao.why_it_matters === "string" ? missao.why_it_matters.trim() : "",
    hojeFeito: hojeFeito,
    nota: hojeFeito ? notaDeHoje(meus, dia) : "",
    feitos: diasFeitos(meus, dia, hojeFeito),
    dificeis: lerDiasDificeis(sequencia, missao, meus),
    restantes: lerRestantes(sequencia, missao),
    parNome: mostrarPar ? nomePar : "",
    esperando: esperandoPar(missao),
    status: typeof missao.status === "string" ? missao.status : ""
  };
}

function guardarCache(modelo) {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({
      versao: 1,
      id: modelo.id,
      category: modelo.category || "",
      proof_mode: modelo.proof_mode || "",
      recuperacao: modelo.recuperacao,
      missedYesterday: modelo.missedYesterday === true,
      missedDays: typeof modelo.missedDays === "number" ? modelo.missedDays : null,
      missedBefore: typeof modelo.missedBefore === "number" ? modelo.missedBefore : null,
      diaLivre: modelo.diaLivre === true,
      diasSemana: Array.isArray(modelo.diasSemana) ? modelo.diasSemana : null,
      semanaDia1: typeof modelo.semanaDia1 === "number" ? modelo.semanaDia1 : null,
      dia: modelo.dia,
      duracao: modelo.duracao,
      titulo: modelo.titulo,
      minimo: modelo.minimo,
      porque: modelo.porque || "",
      hojeFeito: modelo.hojeFeito,
      nota: modelo.nota,
      feitos: modelo.feitos,
      dificeis: modelo.dificeis,
      restantes: modelo.restantes,
      parNome: modelo.parNome,
      esperando: modelo.esperando,
      status: modelo.status || ""
    }));
  } catch (erro) {
    /* Sem espaço neste aparelho, o dia segue na tela e não fica guardado. */
  }
}

function lerCache() {
  try {
    var bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || dados.versao !== 1 || typeof dados.titulo !== "string") return null;
    return dados;
  } catch (erro) {
    return null;
  }
}

/* Trilha de luz (trilha.js): 3 linhas de 10, fio entre os dias e a ponta
   em hoje. O leitor de tela ouve um resumo só, no aria-label da trilha; a
   linha «Dia X de 30» fica visível acima. */
function pintarRegua(modelo, idRegua, idDia) {
  var caixa = document.getElementById(idRegua);
  var linha = document.getElementById(idDia);
  if (!caixa || !linha) return;
  var duracao = modelo.duracao;
  var hoje = modelo.dia;
  linha.textContent = modelo.diaLivre === true
    ? NexusDias.preencher(NexusDias.TEXTOS.linhaDoDiaLivre, { dia: hoje, total: duracao })
    : "Dia " + hoje + " de " + duracao;
  var dificeis = Array.isArray(modelo.dificeis) ? modelo.dificeis : [];
  NexusTrilha.pintar(caixa, {
    duracao: duracao,
    hoje: hoje,
    feitos: modelo.feitos || [],
    dificeis: dificeis,
    ehLivre: livreDe(modelo),
    hojeFeito: modelo.hojeFeito === true
  });
}

function hojeEhDificil(modelo) {
  if (!modelo || !Array.isArray(modelo.dificeis)) return false;
  var dia = Number(modelo.dia);
  var i;
  for (i = 0; i < modelo.dificeis.length; i++) {
    if (Number(modelo.dificeis[i]) === dia) return true;
  }
  return false;
}

var DESENHO_CIRCULO = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z";
var DESENHO_CHECK = "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9";
var DESENHO_LUA = "M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z";

function pintarEstado(modelo) {
  var el = document.getElementById("estado");
  var texto = document.createElement("span");
  if (modelo && modelo.diaLivre === true && !modelo.hojeFeito) {
    /* Dia livre: só o fato, sem ícone de pendência e sem cor de aviso. */
    el.className = "estado estado-livre";
    texto.textContent = NexusDias.TEXTOS.hojeLivre;
    el.replaceChildren(texto);
    return;
  }
  if (modelo && modelo.hojeFeito && hojeEhDificil(modelo)) {
    el.className = "estado estado-dificil";
    texto.textContent = TEXTO_DIFICIL;
    el.replaceChildren(icone(DESENHO_LUA), texto);
    return;
  }
  if (modelo && modelo.hojeFeito) {
    el.className = "estado estado-feito";
    texto.textContent = TEXTO_FEITO;
    el.replaceChildren(icone(DESENHO_CHECK), texto);
    return;
  }
  el.className = "estado estado-pendente";
  texto.textContent = TEXTO_PENDENTE;
  el.replaceChildren(icone(DESENHO_CIRCULO), texto);
}

/* Urso de luz: firme antes do registro, contente com o dia feito. */
function pintarUrso(modelo) {
  var urso = document.getElementById("urso-hoje");
  if (!urso) return;
  var arquivo = modelo && modelo.hojeFeito ? "icons/urso-contente.svg" : "icons/urso-firme.svg";
  if (urso.getAttribute("src") !== arquivo) urso.setAttribute("src", arquivo);
}

function pintarAcao(modelo, semRede) {
  pintarUrso(modelo);
  var acoes = document.getElementById("acoes");
  var nota = document.getElementById("nota-hoje");
  acoes.replaceChildren();
  nota.hidden = true;
  nota.textContent = "";
  if (modelo.hojeFeito) {
    /* Feito: o botão vira secundário e só mostra a nota que já está no aparelho. */
    if (modelo.nota) {
      nota.textContent = modelo.nota;
      var ver = document.createElement("button");
      ver.type = "button";
      ver.className = "btn btn-secundario";
      ver.id = "btn-ver-nota";
      ver.textContent = "Ver a nota de hoje";
      ver.setAttribute("aria-expanded", "false");
      ver.setAttribute("aria-controls", "nota-hoje");
      ver.addEventListener("click", function () {
        var abrir = nota.hidden;
        nota.hidden = !abrir;
        ver.setAttribute("aria-expanded", abrir ? "true" : "false");
      });
      acoes.appendChild(ver);
    }
    return;
  }
  if (modelo.diaLivre === true) return;
  if (semRede) {
    acoes.appendChild(botaoRegistrarSemRede("alerta-registro"));
    return;
  }
  var link = document.createElement("a");
  /* Ponto de luz 1: o botão principal do Hoje. */
  link.className = "btn btn-primario btn-luz";
  link.id = "btn-registrar";
  link.href = "checkin.html" + NexusAbas.busca(["tema", "cenario", "ia"]);
  link.textContent = "Registrar o dia";
  acoes.appendChild(link);
}

function lerAvisoDeVolta() {
  try {
    var codigo = sessionStorage.getItem("nexus_v2_aviso_hoje") || "";
    if (codigo) sessionStorage.removeItem("nexus_v2_aviso_hoje");
    return codigo;
  } catch (erro) {
    return "";
  }
}

function pintarAvisoDeVolta() {
  var aviso = document.getElementById("aviso-volta");
  if (!aviso) return;
  var codigo = lerAvisoDeVolta();
  if (codigo === "ja-registrado") {
    aviso.hidden = false;
    aviso.className = "alerta";
    aviso.textContent = "Este dia já estava registrado.";
    return;
  }
  if (codigo === "voltou") {
    aviso.hidden = false;
    aviso.className = "alerta alerta-ok";
    aviso.textContent = TEXTO_VOLTOU;
    return;
  }
  aviso.hidden = true;
  aviso.className = "alerta";
  aviso.textContent = "";
}

function buscaDaTela() {
  return NexusAbas.busca(["tema", "cenario", "rede", "ia"]);
}

function pintarCalor(modelo) {
  var calor = document.getElementById("calor");
  var guardado = modelo && typeof modelo.minimo === "string" ? modelo.minimo : "";
  calor.replaceChildren();
  if (!guardado.trim()) {
    calor.textContent = "Acontece. O ciclo não acabou.";
    return;
  }
  var intro = document.createElement("span");
  intro.className = "calor-intro";
  intro.textContent = "Acontece. O ciclo não acabou. O mínimo de hoje:";
  var forte = document.createElement("strong");
  forte.className = "calor-minimo";
  forte.textContent = guardado;
  calor.appendChild(intro);
  calor.appendChild(forte);
}

function pintarAcoesRecuperacao(modelo, semRede) {
  var acoes = document.getElementById("acoes-recuperacao");
  var extra = buscaDaTela();
  acoes.replaceChildren();
  if (semRede && !modelo.hojeFeito) {
    acoes.appendChild(botaoRegistrarSemRede("alerta-registro-recuperacao"));
  } else {
    var link = document.createElement("a");
    link.className = "btn btn-primario";
    link.id = "btn-registrar";
    link.href = "checkin.html" + extra;
    link.textContent = "Registrar o dia";
    acoes.appendChild(link);
  }
  if (podeDiaDificil(modelo)) {
    var dificil = document.createElement("a");
    dificil.className = "btn btn-texto link-dificil";
    dificil.id = "link-dificil";
    dificil.href = "dia-dificil.html" + extra;
    dificil.textContent = "Hoje é dia difícil";
    acoes.appendChild(dificil);
  }
  var missao = document.createElement("a");
  missao.className = "btn btn-texto link-missao";
  missao.id = "link-missao";
  missao.href = "missao.html" + extra;
  missao.textContent = "Ver a missão";
  acoes.appendChild(missao);
}

function pintarRecuperacao(modelo, semRede) {
  marcarOrigemRecuperacao();
  pintarRegua(modelo, "regua-recuperacao", "dia-numero-recuperacao");
  var fato = document.getElementById("fato-falta");
  var frase = textoDaFalta(modelo);
  if (frase) {
    fato.hidden = false;
    fato.textContent = frase;
  } else {
    fato.hidden = true;
    fato.textContent = "";
  }
  pintarCalor(modelo);
  esconderAlertaRegistro();
  pintarAcoesRecuperacao(modelo, semRede);
  mostrarVista("recuperacao");
  mostrarFaixaRede(!!semRede);
  NexusAbas.focar(document.getElementById("titulo-recuperacao"));
  NexusAbas.concluirRolagem();
}

function pintarDia(modelo, semRede) {
  pintarAvisoDeVolta();
  pintarRegua(modelo, "regua", "dia-numero");
  document.getElementById("titulo-missao").textContent = modelo.titulo;
  var blocoMinimo = document.getElementById("bloco-minimo");
  var minimo = document.getElementById("minimo");
  var livre = modelo.diaLivre === true && !modelo.hojeFeito;
  if (modelo.minimo && !livre) {
    blocoMinimo.hidden = false;
    minimo.textContent = modelo.minimo;
  } else {
    blocoMinimo.hidden = true;
    minimo.textContent = "";
  }
  pintarEstado(modelo);

  var proximo = document.getElementById("linha-proximo");
  var nomeProximo = livre ? NexusDias.proximoNome(modelo.diasSemana, modelo.semanaDia1, modelo.dia, modelo.duracao) : "";
  if (nomeProximo) {
    proximo.hidden = false;
    proximo.textContent = NexusDias.preencher(NexusDias.TEXTOS.proximoDia, { dia: nomeProximo });
  } else {
    proximo.hidden = true;
    proximo.textContent = "";
  }

  var par = document.getElementById("linha-par");
  par.replaceChildren();
  if (modelo.parNome) {
    par.hidden = false;
    var frase = document.createElement("span");
    frase.textContent = modelo.parNome + " já registrou o dia de hoje.";
    par.appendChild(icone("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0"));
    par.appendChild(frase);
  } else {
    par.hidden = true;
  }

  document.getElementById("linha-espera").hidden = !modelo.esperando;

  var dificeis = document.getElementById("linha-dificeis");
  if (!livre && typeof modelo.restantes === "number" && modelo.restantes > 0) {
    dificeis.hidden = false;
    dificeis.textContent = "Dias difíceis: restam " + modelo.restantes + " de 4.";
  } else {
    dificeis.hidden = true;
    dificeis.textContent = "";
  }

  esconderAlertaRegistro();
  pintarAcao(modelo, semRede);
  mostrarVista("dia");
  mostrarFaixaRede(!!semRede);
  NexusAbas.focar(document.getElementById("titulo-hoje"));
  NexusAbas.concluirRolagem();
}

function abrirModelo(modelo, semRede) {
  if (modelo.recuperacao && modelo.diaLivre !== true) {
    pintarRecuperacao(modelo, semRede);
    return;
  }
  limparOrigemRecuperacao();
  pintarDia(modelo, semRede);
}

function abrirOffline() {
  var guardado = lerCache();
  if (!guardado) {
    mostrarFalha("rede", TEXTO_SEM_REDE);
    return;
  }
  if (fimDoCiclo(guardado.status, guardado.dia, guardado.duracao) && !consumirAdiamentoDoFim()) {
    irParaOFim();
    return;
  }
  abrirModelo(guardado, true);
}

function falhou(resultado) {
  if (resultado && resultado.semRede) {
    abrirOffline();
    return;
  }
  mostrarFalha("falha", TEXTO_ERRO);
}

async function carregar() {
  var meu = ++ciclo;
  mostrarVista("carregando");
  if (semRedeAgora()) {
    abrirOffline();
    return;
  }

  var lista = await NexusApi.listarMissoes();
  if (meu !== ciclo) return;
  if (!lista.ok) {
    falhou(lista);
    return;
  }

  var resumo = escolherMissao(lista.dados);
  if (!resumo) {
    if (primeiraConcluida(lista.dados) && !consumirAdiamentoDoFim()) {
      irParaOFim();
      return;
    }
    mostrarVista("vazia");
    document.getElementById("btn-comecar").href = "onboarding.html" + NexusAbas.busca(["tema"]);
    NexusAbas.focar(document.getElementById("titulo-hoje"));
    NexusAbas.concluirRolagem();
    return;
  }

  var respostas = await Promise.all([
    NexusApi.obterMissao(resumo.id),
    NexusApi.progressoDaMissao(resumo.id),
    NexusApi.sequenciaDaMissao(resumo.id)
  ]);
  if (meu !== ciclo) return;
  if (!respostas[0].ok || !respostas[1].ok || !respostas[2].ok) {
    falhou(respostas[0].semRede ? respostas[0] : respostas[1].semRede ? respostas[1] : respostas[2]);
    return;
  }

  var missao = respostas[0].dados;
  if (!missao || typeof missao !== "object") {
    mostrarFalha("falha", TEXTO_ERRO);
    return;
  }
  var modelo = modeloDe(missao, respostas[1].dados, respostas[2].dados);
  guardarCache(modelo);
  if (fimDoCiclo(modelo.status, modelo.dia, modelo.duracao) && !consumirAdiamentoDoFim()) {
    irParaOFim();
    return;
  }
  abrirModelo(modelo, false);
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#000000" : "#0B5F52");
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  NexusAbas.montar("hoje");
  document.getElementById("btn-tentar").addEventListener("click", function () {
    carregar();
  });
  NexusAbas.focar(document.getElementById("titulo-hoje"));
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  carregar();
}

iniciar();
