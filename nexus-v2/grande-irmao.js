/* Resposta do Grande Irmão. Só abre depois de um check-in ou de um dia difícil,
   e só quando a flag NEXUS_ABRIR_TELA_IA_APOS_CHECKIN está true,
   ou quando ?ia=1 está na URL e o host é localhost ou 127.0.0.1.
   A flag continua false. Em outro host, ?ia=1 não faz nada.

   Não há rota de IA. Não chamar GET /api/vertice/message nem POST /api/assistant/mission.
   A frase é fixa. O caminho render({ source: "fixed"|"ai", text, canContinue })
   fica pronto para um texto futuro.

   A volta ganha do dia cumprido e do dia difícil. Se a pessoa voltou ao ciclo
   e o dia também foi difícil, a frase é «Você voltou. O ciclo continua.»
   A volta é missed_days_before_today > 0, ou o estado gravado pelo check-in.
   Sem internet ou com erro, a frase fixa continua. Nenhum erro técnico aparece.
   A tela não fecha sozinha. */

var FRASE_CUMPRIU = "Registro feito. O mínimo de hoje estava escrito, e você cumpriu.";
var FRASE_DIFICIL = "Dia difícil registrado. O mínimo de hoje era pequeno, e valeu.";
var FRASE_VOLTA = "Você voltou. O ciclo continua.";
var CHAVE_PASSO = "nexus_v2_passo_grande_irmao";
var CHAVE_USUARIO = "nexus_v2_user";
var MS_DIA = 24 * 60 * 60 * 1000;
var saindo = false;
var ciclo = 0;

function cenarioDaPagina() {
  try {
    return new URLSearchParams(location.search).get("cenario") || "";
  } catch (erro) {
    return "";
  }
}

function redeOff() {
  try {
    return new URLSearchParams(location.search).get("rede") === "off";
  } catch (erro) {
    return false;
  }
}

function semRedeAgora() {
  if (redeOff() || cenarioDaPagina() === "offline") return true;
  return navigator.onLine === false;
}

function urlHoje() {
  return "hoje.html" + NexusAbas.busca(["tema", "cenario", "rede"]);
}

function lerPasso() {
  try {
    var bruto = sessionStorage.getItem(CHAVE_PASSO);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || (dados.tipo !== "checkin" && dados.tipo !== "dificil")) return null;
    return {
      tipo: dados.tipo,
      recuperacao: dados.recuperacao === true
    };
  } catch (erro) {
    return null;
  }
}

function limparPasso() {
  try {
    sessionStorage.removeItem(CHAVE_PASSO);
  } catch (erro) {}
}

function podeAbrir() {
  var nome = cenarioDaPagina();
  if (nome === "cumpriu" || nome === "dificil" || nome === "dia-dificil" || nome === "volta" || nome === "offline") {
    return true;
  }
  if (nome === "ia-exemplo" && NexusAbas.emDev()) return true;
  if (redeOff()) return true;
  return !!lerPasso();
}

function fixo(texto) {
  return { source: "fixed", text: texto, canContinue: false };
}

/* Os mocks da URL não pedem rede e não pedem IA. */
function mockDaUrl() {
  var nome = cenarioDaPagina();
  if (nome === "ia-exemplo" && NexusAbas.emDev() && window.NexusDevIa && typeof NexusDevIa.exemplo === "function") {
    return NexusDevIa.exemplo();
  }
  if (nome === "volta") return fixo(FRASE_VOLTA);
  if (nome === "dificil" || nome === "dia-dificil") return fixo(FRASE_DIFICIL);
  if (nome === "cumpriu") return fixo(FRASE_CUMPRIU);
  if (nome === "offline") return fixo(FRASE_CUMPRIU);
  return null;
}

/* A volta ganha. O dia difícil só entra quando não houve volta. */
function fraseDe(passo, api) {
  var recuperacao = !!(passo && passo.recuperacao);
  var dificil = !!(passo && passo.tipo === "dificil");
  if (api) {
    if (api.recuperacao) recuperacao = true;
    if (api.dificil) dificil = true;
  }
  if (recuperacao) return FRASE_VOLTA;
  if (dificil) return FRASE_DIFICIL;
  return FRASE_CUMPRIU;
}

/* TODO: crise vai para a tela 9 e a IA para.
   Esta tela não detecta crise e não lê a nota.
   Quando existir texto de IA, devolver { source: "ai", text: texto, canContinue: true }.
   Se falhar, devolver null para a frase fixa seguir na tela. */
function textoFuturoDaIa() {
  return null;
}

function render(opcoes) {
  var source = opcoes && opcoes.source === "ai" ? "ai" : "fixed";
  var text = opcoes && typeof opcoes.text === "string" ? opcoes.text.trim() : "";
  if (!text) {
    source = "fixed";
    text = FRASE_CUMPRIU;
  }
  var podeContinuar = source === "ai" && !!(opcoes && opcoes.canContinue === true);
  var paragrafo = document.getElementById("texto");
  var apoio = document.getElementById("apoio-ia");
  var continuar = document.getElementById("continuar");
  if (paragrafo) paragrafo.textContent = text;
  if (apoio) apoio.hidden = source !== "ai";
  if (continuar) continuar.hidden = !podeContinuar;
}

function mostrar() {
  var mock = mockDaUrl();
  if (mock) {
    render(mock);
    return mock.source === "ai" ? "ai" : "fixed";
  }
  var futuro = textoFuturoDaIa();
  if (futuro && futuro.source === "ai" && typeof futuro.text === "string" && futuro.text.trim()) {
    render({
      source: "ai",
      text: futuro.text,
      canContinue: futuro.canContinue === true
    });
    return "ai";
  }
  render({ source: "fixed", text: fraseDe(lerPasso(), null), canContinue: false });
  return "fixed";
}

function focar() {
  NexusAbas.focar(document.getElementById("titulo"));
  NexusAbas.concluirRolagem();
}

function ligarContinuar() {
  var link = document.getElementById("continuar");
  if (!link) return;
  function segurar(evento) {
    evento.preventDefault();
  }
  link.addEventListener("click", segurar);
  link.addEventListener("auxclick", segurar);
}

function ligarVolta() {
  var url = urlHoje();
  var botao = document.getElementById("voltar-hoje");
  if (botao) botao.href = url;
  var armado = false;
  try {
    history.replaceState({ grandeIrmao: "base" }, "");
    history.pushState({ grandeIrmao: "topo" }, "");
    armado = true;
  } catch (erro) {
    armado = false;
  }
  function sair() {
    if (saindo) return;
    saindo = true;
    limparPasso();
    location.replace(url);
  }
  if (armado) window.addEventListener("popstate", sair);
  if (!botao) return;
  botao.addEventListener("click", function (evento) {
    evento.preventDefault();
    if (armado) {
      history.back();
      return;
    }
    sair();
  });
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function numeroDoDia(startedAt) {
  var inicio = new Date(startedAt);
  if (!startedAt || isNaN(inicio.getTime())) return 1;
  var dia = Math.floor((Date.now() - inicio.getTime()) / MS_DIA) + 1;
  if (dia < 1) return 1;
  return dia;
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

function recuperacaoDaSequencia(sequencia) {
  if (!sequencia || typeof sequencia !== "object") return false;
  if (!Object.prototype.hasOwnProperty.call(sequencia, "missed_days_before_today")) return false;
  var n = sequencia.missed_days_before_today;
  return typeof n === "number" && isFinite(n) && n > 0;
}

function checkinDeHojeDificil(missao, progresso) {
  var dia = numeroDoDia(missao && missao.started_at);
  var meus = checkinsMeus(missao, progresso);
  var i;
  for (i = 0; i < meus.length; i++) {
    if (meus[i].day === dia && meus[i].completed && meus[i].difficult) return true;
  }
  return false;
}

async function sinaisDaApi() {
  try {
    var lista = await NexusApi.listarMissoes();
    if (!lista || !lista.ok || !Array.isArray(lista.dados)) return null;
    var resumo = escolherMissao(lista.dados);
    if (!resumo || resumo.id == null) return null;
    var respostas = await Promise.all([
      NexusApi.obterMissao(resumo.id),
      NexusApi.sequenciaDaMissao(resumo.id),
      NexusApi.progressoDaMissao(resumo.id)
    ]);
    if (!respostas[0] || !respostas[0].ok || !respostas[1] || !respostas[1].ok || !respostas[2] || !respostas[2].ok) {
      return null;
    }
    var missao = respostas[0].dados;
    if (!missao || typeof missao !== "object") return null;
    return {
      recuperacao: recuperacaoDaSequencia(respostas[1].dados),
      dificil: checkinDeHojeDificil(missao, respostas[2].dados)
    };
  } catch (erro) {
    return null;
  }
}

async function refinarPelaApi() {
  if (mockDaUrl() || semRedeAgora()) return;
  var passo = lerPasso();
  if (!passo) return;
  var meu = ++ciclo;
  var sinais = await sinaisDaApi();
  if (meu !== ciclo || saindo || !sinais) return;
  render({ source: "fixed", text: fraseDe(passo, sinais), canContinue: false });
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  if (!podeAbrir()) {
    location.replace(urlHoje());
    return;
  }
  ligarContinuar();
  ligarVolta();
  var fonte = mostrar();
  focar();
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  if (fonte !== "ai") refinarPelaApi();
}

iniciar();
