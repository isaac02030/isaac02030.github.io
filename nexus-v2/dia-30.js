/* Tela 10. O ciclo de 30 dias chegou ao fim.
   Só abre quando o dia passou de duration_days ou o status é completed.
   Antes disso, volta para o Hoje.
   N é a contagem de check-ins completed desta pessoa, como no Hoje.
   Continuar pede POST /api/missions/:id/extend com { days: 36 }.
   Essa rota ainda não existe no servidor. Sem sucesso, a tela não diz que abriu.
   Encerrar não chama o servidor: não há rota de fim de ciclo no api.js.
   A Porta Aberta não entra neste corte. */

var CHAVE_USUARIO = "nexus_v2_user";
var CHAVE_CACHE = "nexus_v2_dia30";
var CHAVE_HOJE = "nexus_v2_hoje";
var CHAVE_ADIAR_FIM = "nexus_v2_adiar_fim";
var MS_DIA = 24 * 60 * 60 * 1000;
var TEXTO_ERRO_ABRIR = "Não foi possível abrir o fim do ciclo. Tente de novo.";
var TEXTO_ERRO_CONTINUAR = "Não foi possível abrir os próximos 36 dias. Tente de novo.";
var TEXTO_SEM_REDE = "Sem internet. O ciclo já terminou; continuar fica para quando a conexão voltar.";
var TEXTO_CUMPRIU = "Palavra cumprida neste ciclo.";
var TEXTO_FALHAS = "Houve falhas, e você chegou ao fim mesmo assim.";
/* Trilha (spec da Clara, seção 8): a segunda frase diz só o que é verdade. */
var TEXTO_UMA_FALTA = "Houve uma falta, e você chegou ao fim mesmo assim.";
var TEXTO_FALTAS = "Houve {n} faltas, e você chegou ao fim mesmo assim.";
var TEXTO_CONTINUAR = "Continuar mais 36 dias";
var TEXTO_ABRINDO = "Abrindo…";
var ciclo = 0;
var modeloAtual = null;

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

function buscaDaTela(chaves) {
  return NexusAbas.busca(chaves || ["tema", "cenario", "rede", "ia"]);
}

function irParaHoje() {
  location.replace("hoje.html" + buscaDaTela());
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
  /* O mesmo teto do Hoje: 30 dias e mais 36 ainda aparecem por inteiro. */
  return Math.min(Math.floor(n), 96);
}

function cicloEncerrado(status, dia, duracao) {
  if (status === "completed") return true;
  var d = Number(dia);
  var n = Number(duracao);
  if (!isFinite(d) || !isFinite(n)) return false;
  return d > n;
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
    var temDificil = item.difficult === true || item.difficult === false || item.is_difficult === true || item.is_difficult === false;
    saida.push({
      day: dia,
      completed: item.completed === true,
      difficult: item.difficult === true || item.is_difficult === true,
      temDificil: temDificil
    });
  });
  return saida;
}

/* O mesmo recorte do Hoje: os check-ins desta pessoa, não os do par. */
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

/* Cada dia completed entra uma vez, só dentro do ciclo.
   dificeis fica null quando o servidor não manda o campo. */
function resumirDias(meus, duracao) {
  var vistos = {};
  var dias = [];
  var dificeis = [];
  var temDificil = false;
  (meus || []).forEach(function (item) {
    if (!item) return;
    if (item.temDificil) temDificil = true;
    if (item.completed !== true) return;
    var dia = Number(item.day);
    if (!isFinite(dia) || dia < 1 || dia > duracao || vistos[dia]) return;
    vistos[dia] = true;
    dias.push(dia);
    if (item.difficult === true) dificeis.push(dia);
  });
  return {
    dias: dias,
    dificeis: temDificil ? dificeis : null,
    registrados: dias.length
  };
}

function escolherAtiva(lista) {
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

function escolherConcluida(lista) {
  if (!Array.isArray(lista)) return null;
  var i;
  for (i = 0; i < lista.length; i++) {
    if (lista[i] && lista[i].status === "completed") return lista[i];
  }
  return null;
}

function icone(tipo) {
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
  traco.setAttribute("d", tipo === "rede"
    ? "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18"
    : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
  svg.appendChild(traco);
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-rede";
  el.setAttribute("role", "alert");
  el.setAttribute("aria-live", "assertive");
  el.tabIndex = -1;
  el.replaceChildren(icone(tipo), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  document.getElementById("vista-carregando").hidden = qual !== "carregando";
  document.getElementById("vista-erro").hidden = qual !== "erro";
  document.getElementById("vista-fim").hidden = qual !== "fim";
  document.getElementById("conteudo").setAttribute("aria-busy", qual === "carregando" ? "true" : "false");
}

function mostrarFalha(tipo, texto) {
  mostrarVista("erro");
  mostrarAviso(document.getElementById("alerta-erro"), tipo, texto);
  NexusAbas.focar(document.getElementById("alerta-erro"));
}

function textoDoFato(n, duracao) {
  return "Você registrou " + n + " de " + duracao + " dias.";
}

function guardarCache(modelo) {
  try {
    localStorage.setItem(CHAVE_CACHE, JSON.stringify({
      versao: 2,
      id: modelo.id,
      status: modelo.status,
      dia: modelo.dia,
      duracao: modelo.duracao,
      registrados: modelo.registrados,
      dias: modelo.dias,
      dificeis: modelo.dificeis,
      diasSemana: modelo.diasSemana || null,
      semanaDia1: typeof modelo.semanaDia1 === "number" ? modelo.semanaDia1 : null
    }));
  } catch (erro) {}
}

function lerCacheProprio() {
  try {
    var bruto = localStorage.getItem(CHAVE_CACHE);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || dados.versao !== 2 || typeof dados.registrados !== "number" || !Array.isArray(dados.dias)) return null;
    return dados;
  } catch (erro) {
    return null;
  }
}

function lerCacheDoHoje() {
  try {
    var bruto = localStorage.getItem(CHAVE_HOJE);
    if (!bruto) return null;
    var dados = JSON.parse(bruto);
    if (!dados || dados.versao !== 1 || !Array.isArray(dados.feitos)) return null;
    var duracao = Number(dados.duracao);
    if (!isFinite(duracao) || duracao < 1) duracao = 30;
    var resumo = resumirDias(dados.feitos.map(function (dia) {
      return { day: dia, completed: true, difficult: false, temDificil: Array.isArray(dados.dificeis) };
    }), duracao);
    if (Array.isArray(dados.dificeis)) {
      resumo.dificeis = dados.dificeis.filter(function (dia) {
        return resumo.dias.indexOf(dia) !== -1;
      });
    }
    return {
      versao: 2,
      id: dados.id,
      status: typeof dados.status === "string" ? dados.status : "",
      dia: dados.dia,
      duracao: duracao,
      registrados: resumo.registrados,
      dias: resumo.dias,
      dificeis: resumo.dificeis
    };
  } catch (erro) {
    return null;
  }
}

function lerCache() {
  return lerCacheProprio() || lerCacheDoHoje();
}

/* A trilha inteira e real (trilha.js): com as faltas e os dias livres.
   O último quadrado recebe o único halo maior da tela. */
function dadosDaTrilha(modelo) {
  var duracao = modelo.duracao;
  var daMissao = NexusDias.verificador(modelo.diasSemana || null, modelo.semanaDia1);
  return {
    duracao: duracao,
    hoje: duracao + 1,
    feitos: modelo.dias || [],
    dificeis: Array.isArray(modelo.dificeis) ? modelo.dificeis : [],
    ehLivre: function (dia) { return !daMissao(dia); },
    hojeFeito: true
  };
}

function plural(n, um, outros) {
  return n + " " + (n === 1 ? um : outros);
}

function pintarGrade(modelo) {
  var caixa = document.getElementById("marcas");
  if (!caixa) return null;
  var dados = dadosDaTrilha(modelo);
  NexusTrilha.pintar(caixa, dados);
  var n = NexusTrilha.contagem(dados);
  /* «26 feitos · 2 difíceis · 2 livres · 1 falta»: só o que existe. */
  var partes = [plural(n.feitos, "feito", "feitos")];
  if (n.dificeis) partes.push(plural(n.dificeis, "difícil", "difíceis"));
  if (n.livres) partes.push(plural(n.livres, "livre", "livres"));
  if (n.faltas) partes.push(plural(n.faltas, "falta", "faltas"));
  document.getElementById("contagem").textContent = partes.join(" · ");
  /* Legenda: só os estados que aparecem na trilha. */
  var itens = [["lf", "Feito", n.feitos], ["ld", "Dia difícil", n.dificeis], ["ll", "Dia livre", n.livres], ["lx", "Falta", n.faltas]];
  var legenda = document.getElementById("legenda");
  legenda.replaceChildren.apply(legenda, itens.filter(function (i) { return i[2] > 0; }).map(function (i) {
    var li = document.createElement("li");
    var marca = document.createElement("i");
    marca.className = i[0];
    li.append(marca, document.createTextNode(i[1]));
    return li;
  }));
  return n;
}

function textoDoRitmo(faltas) {
  if (!faltas) return TEXTO_CUMPRIU;
  if (faltas === 1) return TEXTO_UMA_FALTA;
  return TEXTO_FALTAS.replace("{n}", String(faltas));
}

function pintarFim(modelo) {
  modeloAtual = modelo;
  var n = pintarGrade(modelo);
  document.getElementById("fato").textContent = textoDoFato(modelo.registrados, modelo.duracao);
  /* Dia livre não é falta: a frase segue a contagem real da trilha. */
  document.getElementById("ritmo").textContent = n ? textoDoRitmo(n.faltas) : (modelo.registrados >= modelo.duracao ? TEXTO_CUMPRIU : TEXTO_FALHAS);
  esconderAviso(document.getElementById("aviso-continuar"));
  var botao = document.getElementById("btn-continuar");
  botao.disabled = false;
  botao.textContent = TEXTO_CONTINUAR;
  mostrarVista("fim");
  NexusAbas.focar(document.getElementById("titulo"));
}

function definirCarregando(ativo) {
  var botao = document.getElementById("btn-continuar");
  var form = document.getElementById("vista-fim");
  if (ativo) {
    form.dataset.ocupado = "sim";
    botao.disabled = true;
    botao.textContent = TEXTO_ABRINDO;
    botao.setAttribute("aria-busy", "true");
    return;
  }
  form.dataset.ocupado = "";
  botao.disabled = false;
  botao.textContent = TEXTO_CONTINUAR;
  botao.removeAttribute("aria-busy");
}

/* Sem rota de encerrar. «Agora não» só volta ao Hoje.
   TODO: quando existir a rota de encerrar, voltar o rótulo para
   «Encerrar esta missão» e pedir confirmação de uma frase, como em Sair da conta. */
function agoraNao() {
  try {
    sessionStorage.setItem(CHAVE_ADIAR_FIM, "1");
  } catch (erro) {}
  location.assign("hoje.html" + buscaDaTela(["tema", "cenario", "ia"]));
}

async function continuar() {
  var vista = document.getElementById("vista-fim");
  var aviso = document.getElementById("aviso-continuar");
  if (!modeloAtual || vista.dataset.ocupado === "sim" || document.getElementById("btn-continuar").disabled) return;
  if (semRedeAgora()) {
    mostrarAviso(aviso, "rede", TEXTO_SEM_REDE);
    NexusAbas.focar(aviso);
    return;
  }
  var saiu = false;
  definirCarregando(true);
  try {
    var resultado = await NexusApi.estenderMissao(modeloAtual.id);
    if (!resultado || !resultado.ok) {
      var tipo = resultado && resultado.semRede ? "rede" : "falha";
      var texto = resultado && resultado.semRede ? TEXTO_SEM_REDE : TEXTO_ERRO_CONTINUAR;
      mostrarAviso(aviso, tipo, texto);
      NexusAbas.focar(aviso);
      return;
    }
    saiu = true;
    location.assign("hoje.html" + buscaDaTela(["tema", "cenario", "ia"]));
  } catch (erro) {
    mostrarAviso(aviso, "falha", TEXTO_ERRO_CONTINUAR);
    NexusAbas.focar(aviso);
  } finally {
    if (!saiu) definirCarregando(false);
  }
}

function modeloDe(missao, progresso) {
  var duracao = duracaoDe(missao);
  var dia = numeroDoDia(missao.started_at);
  var status = typeof missao.status === "string" ? missao.status : "";
  var resumo = resumirDias(checkinsMeus(missao, progresso), duracao);
  return {
    id: missao.id,
    status: status,
    dia: dia,
    duracao: duracao,
    registrados: resumo.registrados,
    dias: resumo.dias,
    dificeis: resumo.dificeis,
    /* Dias da missão (dias livres na trilha). Sem escolha, todo dia é da missão. */
    diasSemana: Array.isArray(missao.mission_weekdays) ? missao.mission_weekdays : null,
    semanaDia1: NexusDias.diaDaSemana(missao.started_at)
  };
}

async function carregar() {
  var meu = ++ciclo;
  mostrarVista("carregando");
  if (semRedeAgora()) {
    var guardado = lerCache();
    if (guardado && cicloEncerrado(guardado.status, guardado.dia, guardado.duracao)) {
      pintarFim(guardado);
      return;
    }
    irParaHoje();
    return;
  }

  var lista = await NexusApi.listarMissoes();
  if (meu !== ciclo) return;
  if (!lista.ok) {
    if (lista.semRede) {
      var offline = lerCache();
      if (offline && cicloEncerrado(offline.status, offline.dia, offline.duracao)) {
        pintarFim(offline);
        return;
      }
      irParaHoje();
      return;
    }
    mostrarFalha("falha", TEXTO_ERRO_ABRIR);
    return;
  }

  var resumo = escolherAtiva(lista.dados) || escolherConcluida(lista.dados);
  if (!resumo) {
    irParaHoje();
    return;
  }

  var respostas = await Promise.all([
    NexusApi.obterMissao(resumo.id),
    NexusApi.progressoDaMissao(resumo.id)
  ]);
  if (meu !== ciclo) return;
  if (!respostas[0].ok || !respostas[1].ok) {
    var falha = respostas[0].semRede ? respostas[0] : respostas[1];
    if (falha && falha.semRede) {
      var cache = lerCache();
      if (cache && cicloEncerrado(cache.status, cache.dia, cache.duracao)) {
        pintarFim(cache);
        return;
      }
      irParaHoje();
      return;
    }
    mostrarFalha("falha", TEXTO_ERRO_ABRIR);
    return;
  }

  var missao = respostas[0].dados;
  if (!missao || typeof missao !== "object") {
    mostrarFalha("falha", TEXTO_ERRO_ABRIR);
    return;
  }
  var modelo = modeloDe(missao, respostas[1].dados);
  if (!cicloEncerrado(modelo.status, modelo.dia, modelo.duracao)) {
    irParaHoje();
    return;
  }
  guardarCache(modelo);
  pintarFim(modelo);
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#000000" : "#0B5F52");
}

function iniciar() {
  window.NEXUS_CENARIO = cenarioDaPagina();
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("btn-continuar").addEventListener("click", continuar);
  document.getElementById("btn-agora").addEventListener("click", agoraNao);
  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
  carregar();
}

iniciar();
