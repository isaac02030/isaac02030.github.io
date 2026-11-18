/* Tela Hoje. O que fazer neste dia, sem placar.
   O dia X sai de started_at e duration_days, do mesmo jeito que o servidor:
   floor((agora - started_at) / 1 dia) + 1.
   Não chama GET /api/checkins/:id/score.
   Dia difícil, quando a sequência mandar:
   difficult_days (números do dia), difficult_days_remaining, difficult_days_used,
   e difficult (sim ou não) em cada check-in.
   Sem esses campos, a linha e o losango somem. Não mostramos 0 nem um valor vazio.

   Com recovery_needed true, o miolo do Hoje vira a volta ao ciclo.
   A barra de abas continua. Não é página separada nem modal.
   missed_days, nesta branch, inclui o dia de hoje quando ele está aberto.
   A frase usa só os dias que já passaram. Sem o número, não inventamos. */

var CHAVE_CACHE = "nexus_v2_hoje";
var CHAVE_USUARIO = "nexus_v2_user";
var CHAVE_ORIGEM = "nexus_v2_origem_recuperacao";
var TEXTO_ONTEM = "Ontem não houve registro.";
var TEXTO_VOLTOU = "Você voltou. O ciclo continua.";
var MS_DIA = 24 * 60 * 60 * 1000;
var TEXTO_ERRO = "Não foi possível abrir o dia. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
var TEXTO_REGISTRO_OFF = "Sem internet. Tente de novo quando a conexão voltar.";
var TEXTO_REGISTRO_OFF_NOTA = "Sem internet. Sua nota continua aqui. Tente de novo quando a conexão voltar.";
var ciclo = 0;

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

function mostrarVista(qual) {
  document.getElementById("vista-carregando").hidden = qual !== "carregando";
  document.getElementById("vista-erro").hidden = qual !== "erro";
  document.getElementById("vista-vazia").hidden = qual !== "vazia";
  document.getElementById("vista-dia").hidden = qual !== "dia";
  document.getElementById("vista-recuperacao").hidden = qual !== "recuperacao";
  document.getElementById("titulo-hoje").hidden = qual === "recuperacao";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
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
  return Math.min(Math.floor(n), 60);
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

function lerMissedDays(sequencia) {
  if (!sequencia || typeof sequencia.missed_days !== "number") return null;
  if (!isFinite(sequencia.missed_days) || sequencia.missed_days < 0) return null;
  return sequencia.missed_days;
}

/* missed_days da rota conta o vão desde hoje. Com o dia de hoje aberto,
   o hoje entra na conta. A frase fala dos dias que já passaram.
   Sem número utilizável: a frase de 1 dia só se missed_yesterday for true.
   Nunca escrevemos «1 dias». */
function textoDaFalta(modelo) {
  var ontem = !!(modelo && modelo.missedYesterday === true);
  var bruto = modelo ? modelo.missedDays : null;
  if (typeof bruto !== "number" || !isFinite(bruto)) return ontem ? TEXTO_ONTEM : "";
  var n = Math.floor(bruto);
  if (modelo.hojeFeito !== true && n >= 1) n -= 1;
  if (n <= 0) return ontem ? TEXTO_ONTEM : "";
  if (n === 1) return TEXTO_ONTEM;
  return "Ficaram " + n + " dias sem registro.";
}

function comecaMaiuscula(texto) {
  var limpo = String(texto || "").trim();
  if (!limpo) return false;
  var letra = limpo.charAt(0);
  return letra !== letra.toLowerCase();
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
    esperando: esperandoPar(missao)
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
      esperando: modelo.esperando
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

function palavraDeContagem(n, um, outros) {
  return n + " " + (n === 1 ? um : outros);
}

/* Cada dia entra uma vez: difícil, senão cumprido, senão falta.
   Falta é só dia passado. Hoje sem registro e o futuro ficam de fora da conta. */
function rotuloDasMarcas(modelo) {
  var duracao = modelo.duracao;
  var hoje = modelo.dia;
  var feitos = {};
  var dificeis = {};
  var temDificeis = Array.isArray(modelo.dificeis);
  (modelo.feitos || []).forEach(function (dia) {
    if (dia >= 1 && dia <= duracao) feitos[dia] = true;
  });
  if (temDificeis) {
    modelo.dificeis.forEach(function (dia) {
      if (dia >= 1 && dia <= duracao) dificeis[dia] = true;
    });
  }
  var nCumprido = 0;
  var nDificil = 0;
  var nFalta = 0;
  var dia;
  for (dia = 1; dia <= duracao; dia++) {
    var dificil = temDificeis && !!dificeis[dia];
    var feito = !!feitos[dia];
    if (dificil) nDificil += 1;
    else if (feito) nCumprido += 1;
    else if (dia < hoje) nFalta += 1;
  }
  return "Dia " + hoje + " de " + duracao + ": "
    + palavraDeContagem(nCumprido, "cumprido", "cumpridos") + ", "
    + palavraDeContagem(nDificil, "difícil", "difíceis") + ", "
    + palavraDeContagem(nFalta, "falta", "faltas");
}

function pintarMarcas(modelo, destino) {
  var caixa = destino ? document.getElementById(destino) : document.getElementById("marcas");
  if (!caixa) return;
  var duracao = modelo.duracao;
  var hoje = modelo.dia;
  var feitos = {};
  var dificeis = {};
  var temDificeis = Array.isArray(modelo.dificeis);
  (modelo.feitos || []).forEach(function (dia) { feitos[dia] = true; });
  if (temDificeis) {
    modelo.dificeis.forEach(function (dia) { dificeis[dia] = true; });
  }
  caixa.setAttribute("role", "img");
  caixa.setAttribute("aria-label", rotuloDasMarcas(modelo));
  caixa.removeAttribute("tabindex");
  caixa.replaceChildren();
  for (var dia = 1; dia <= duracao; dia++) {
    var marca = document.createElement("span");
    marca.className = "marca-dia";
    marca.setAttribute("aria-hidden", "true");
    var miolo = document.createElement("span");
    miolo.className = "marca-miolo";
    miolo.setAttribute("aria-hidden", "true");
    var feito = !!feitos[dia];
    var dificil = temDificeis && !!dificeis[dia];
    if (dificil) miolo.classList.add("dificil");
    if (feito) miolo.classList.add("feito");
    else if (!dificil && dia < hoje) miolo.classList.add("falta");
    else if (!dificil) miolo.classList.add("futuro");
    if (dia === hoje) marca.classList.add("hoje");
    marca.appendChild(miolo);
    caixa.appendChild(marca);
  }
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

function losangoDoDia() {
  var caixa = document.createElement("span");
  caixa.className = "status-losango";
  caixa.setAttribute("aria-hidden", "true");
  var miolo = document.createElement("span");
  miolo.className = "marca-miolo dificil feito";
  miolo.setAttribute("aria-hidden", "true");
  caixa.appendChild(miolo);
  return caixa;
}

function pintarStatus(modelo) {
  var el = document.getElementById("status");
  var texto = document.createElement("span");
  var hojeFeito = !!(modelo && modelo.hojeFeito);
  if (hojeFeito) {
    el.className = "status status-feito";
    if (hojeEhDificil(modelo)) {
      texto.textContent = "Dia difícil registrado. O mínimo valeu.";
      el.replaceChildren(losangoDoDia(), texto);
      return;
    }
    texto.textContent = "Registro feito. Palavra cumprida hoje.";
    el.replaceChildren(
      icone("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"),
      texto
    );
    return;
  }
  el.className = "status status-pendente";
  texto.textContent = "Ainda não registrou o dia.";
  el.replaceChildren(
    icone("M12 8v5l2.5 1.5M12 20.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z"),
    texto
  );
}

function pintarAcao(modelo, semRede) {
  var acoes = document.getElementById("acoes");
  acoes.replaceChildren();
  if (modelo.hojeFeito) {
    if (modelo.nota) {
      var nota = document.createElement("p");
      nota.className = "nota-hoje";
      nota.id = "nota-hoje";
      nota.textContent = modelo.nota;
      acoes.appendChild(nota);
    }
    return;
  }
  if (semRede) {
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-primario";
    botao.id = "btn-registrar";
    botao.textContent = "Registrar o dia";
    botao.setAttribute("aria-describedby", "aviso-rede");
    acoes.appendChild(botao);
    return;
  }
  var link = document.createElement("a");
  link.className = "btn btn-primario";
  link.id = "btn-registrar";
  link.href = "checkin.html" + NexusAbas.busca(["tema", "cenario"]);
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
  return NexusAbas.busca(["tema", "cenario", "rede"]);
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
  var forte = document.createElement("strong");
  forte.textContent = guardado;
  if (comecaMaiuscula(guardado)) {
    intro.textContent = "Acontece. O ciclo não acabou. O mínimo de hoje é";
    intro.className = "calor-intro";
    forte.className = "calor-minimo";
  } else {
    intro.textContent = "Acontece. O ciclo não acabou. O mínimo de hoje é ";
  }
  calor.appendChild(intro);
  calor.appendChild(forte);
}

function pintarAcoesRecuperacao(modelo, semRede) {
  var acoes = document.getElementById("acoes-recuperacao");
  var extra = buscaDaTela();
  acoes.replaceChildren();
  if (semRede && !modelo.hojeFeito) {
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-primario";
    botao.id = "btn-registrar";
    botao.textContent = "Registrar o dia";
    botao.setAttribute("aria-describedby", "aviso-rede-recuperacao");
    acoes.appendChild(botao);
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
  pintarMarcas(modelo, "marcas-recuperacao");
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
  var aviso = document.getElementById("aviso-rede-recuperacao");
  if (semRede && !modelo.hojeFeito) {
    var temNota = typeof modelo.nota === "string" && modelo.nota.trim() !== "";
    mostrarAviso(aviso, "rede", temNota ? TEXTO_REGISTRO_OFF_NOTA : TEXTO_REGISTRO_OFF);
  } else {
    aviso.hidden = true;
    aviso.replaceChildren();
  }
  pintarAcoesRecuperacao(modelo, semRede);
  mostrarVista("recuperacao");
  NexusAbas.focar(document.getElementById("titulo-recuperacao"));
  NexusAbas.concluirRolagem();
}

function pintarDia(modelo, semRede) {
  pintarAvisoDeVolta();
  document.getElementById("dia-numero").textContent = "Dia " + modelo.dia + " de " + modelo.duracao;
  document.getElementById("titulo-missao").textContent = modelo.titulo;
  var minimo = document.getElementById("minimo");
  if (modelo.minimo) {
    minimo.hidden = false;
    minimo.textContent = "O mínimo de hoje: " + modelo.minimo;
  } else {
    minimo.hidden = true;
    minimo.textContent = "";
  }
  var porque = document.getElementById("porque");
  if (modelo.porque) {
    porque.hidden = false;
    porque.textContent = "Porque: " + modelo.porque;
  } else {
    porque.hidden = true;
    porque.textContent = "";
  }
  pintarMarcas(modelo);
  pintarStatus(modelo);

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
  if (typeof modelo.restantes === "number" && modelo.restantes > 0) {
    dificeis.hidden = false;
    dificeis.textContent = "Dias difíceis: restam " + modelo.restantes + " de 4.";
  } else {
    dificeis.hidden = true;
    dificeis.textContent = "";
  }

  var aviso = document.getElementById("aviso-rede");
  if (semRede && !modelo.hojeFeito) {
    var temNota = typeof modelo.nota === "string" && modelo.nota.trim() !== "";
    mostrarAviso(aviso, "rede", temNota ? TEXTO_REGISTRO_OFF_NOTA : TEXTO_REGISTRO_OFF);
  }
  else {
    aviso.hidden = true;
    aviso.replaceChildren();
  }

  pintarAcao(modelo, semRede);
  mostrarVista("dia");
  NexusAbas.focar(document.getElementById("titulo-hoje"));
  NexusAbas.concluirRolagem();
}

function abrirModelo(modelo, semRede) {
  if (modelo.recuperacao) {
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
  abrirModelo(modelo, false);
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
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
