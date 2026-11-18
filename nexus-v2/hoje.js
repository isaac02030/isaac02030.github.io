/* Tela Hoje. O que fazer neste dia, sem placar.
   O dia X sai de started_at e duration_days, do mesmo jeito que o servidor:
   floor((agora - started_at) / 1 dia) + 1.
   Não chama GET /api/checkins/:id/score.
   Dia difícil: só se a resposta trouxer difficult_days ou difficult_days_remaining.
   O servidor de verdade ainda não manda esses campos. O mock manda, nos cenários. */

var CHAVE_CACHE = "nexus_v2_hoje";
var CHAVE_USUARIO = "nexus_v2_user";
var MS_DIA = 24 * 60 * 60 * 1000;
var TEXTO_ERRO = "Não foi possível abrir o dia. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
var TEXTO_REGISTRO_OFF = "Sem internet. O registro fica para quando a conexão voltar.";
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
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function mostrarFalha(tipo, texto) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, texto);
  document.getElementById("titulo-hoje").focus();
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

/* Não inventa dia difícil. Se o campo não veio, devolve null. */
function lerDiasDificeis(sequencia, missao, meus) {
  if (sequencia && Array.isArray(sequencia.difficult_days)) return numerosDe(sequencia.difficult_days);
  if (missao && Array.isArray(missao.difficult_days)) return numerosDe(missao.difficult_days);
  var dosCheckins = [];
  meus.forEach(function (item) {
    if (item.difficult) dosCheckins.push(item.day);
  });
  if (dosCheckins.length) return dosCheckins;
  return null;
}

function lerRestantes(sequencia, missao) {
  if (sequencia && typeof sequencia.difficult_days_remaining === "number" && isFinite(sequencia.difficult_days_remaining)) {
    return sequencia.difficult_days_remaining;
  }
  if (missao && typeof missao.difficult_days_remaining === "number" && isFinite(missao.difficult_days_remaining)) {
    return missao.difficult_days_remaining;
  }
  return null;
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
    recuperacao: !!(sequencia && sequencia.recovery_needed),
    dia: dia,
    duracao: duracao,
    titulo: typeof missao.title === "string" ? missao.title : "",
    minimo: typeof missao.daily_minimum === "string" ? missao.daily_minimum : "",
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
      recuperacao: modelo.recuperacao,
      dia: modelo.dia,
      duracao: modelo.duracao,
      titulo: modelo.titulo,
      minimo: modelo.minimo,
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

function contarFeitos(feitos, duracao) {
  var vistos = {};
  var n = 0;
  (feitos || []).forEach(function (dia) {
    if (dia >= 1 && dia <= duracao && !vistos[dia]) {
      vistos[dia] = true;
      n += 1;
    }
  });
  return n;
}

function pintarMarcas(modelo) {
  var caixa = document.getElementById("marcas");
  var duracao = modelo.duracao;
  var feitos = {};
  var dificeis = {};
  (modelo.feitos || []).forEach(function (dia) { feitos[dia] = true; });
  if (Array.isArray(modelo.dificeis)) {
    modelo.dificeis.forEach(function (dia) { dificeis[dia] = true; });
  }
  caixa.style.setProperty("--dias", String(duracao));
  caixa.setAttribute("aria-label", contarFeitos(modelo.feitos, duracao) + " de " + duracao + " dias registrados");
  caixa.replaceChildren();
  for (var dia = 1; dia <= duracao; dia++) {
    var marca = document.createElement("span");
    marca.className = "marca-dia";
    marca.setAttribute("aria-hidden", "true");
    if (feitos[dia]) marca.classList.add("feito");
    if (modelo.dificeis && dificeis[dia]) marca.classList.add("dificil");
    caixa.appendChild(marca);
  }
}

function pintarStatus(hojeFeito) {
  var el = document.getElementById("status");
  var texto = document.createElement("span");
  if (hojeFeito) {
    el.className = "status status-feito";
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
    icone("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"),
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

function pintarDia(modelo, semRede) {
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
  pintarMarcas(modelo);
  pintarStatus(modelo.hojeFeito);

  var par = document.getElementById("linha-par");
  if (modelo.parNome) {
    par.hidden = false;
    par.textContent = modelo.parNome + " já registrou o dia de hoje.";
  } else {
    par.hidden = true;
    par.textContent = "";
  }

  document.getElementById("linha-espera").hidden = !modelo.esperando;

  var dificeis = document.getElementById("linha-dificeis");
  if (typeof modelo.restantes === "number" && isFinite(modelo.restantes) && modelo.restantes >= 0) {
    dificeis.hidden = false;
    dificeis.textContent = "Dias difíceis: restam " + modelo.restantes + " de 4.";
  } else {
    dificeis.hidden = true;
    dificeis.textContent = "";
  }

  var aviso = document.getElementById("aviso-rede");
  if (semRede && !modelo.hojeFeito) mostrarAviso(aviso, "rede", TEXTO_REGISTRO_OFF);
  else {
    aviso.hidden = true;
    aviso.replaceChildren();
  }

  pintarAcao(modelo, semRede);
  mostrarVista("dia");
  document.getElementById("titulo-hoje").focus();
}

function abrirModelo(modelo, semRede) {
  if (modelo.recuperacao) {
    location.replace("recuperacao.html" + NexusAbas.busca(["tema", "cenario"]));
    return;
  }
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
    document.getElementById("titulo-hoje").focus();
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
  document.getElementById("titulo-hoje").focus();
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  carregar();
}

iniciar();
