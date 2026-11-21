/* Começo da missão, em quatro passos.
   Os passos 1, 2 e 3 não falam com o servidor.
   O passo 3 escolhe os dias da missão (de 3 a 7; textos em dias-da-missao.js).
   O passo 4 cria a missão e, se a pessoa aceitou, liga o aviso.
   Com os 7 dias marcados, mission_weekdays não vai no pedido: a missão sem
   escolha nunca depende da migração 004 do servidor. */

var CHAVE_RASCUNHO = "nexus_v2_onboarding";
var CHAVE_LEMBRETE = "nexus_v2_lembrete";
var TEXTO_SEM_REDE = "Sem internet. Assim que a conexão voltar, tente de novo.";
var TEXTO_SEM_REDE_MISSAO = NexusDias.TEXTOS.semRedeMissao;
var TEXTO_FALHA_MISSAO = "Não foi possível criar a missão. Tente de novo.";
var LIMITE_AVISO_MS = 8000;
var HORA_PADRAO = "20:00";
var rascunhoExistia = false;

var estado = {
  passo: 1,
  category: "",
  title: "",
  why_it_matters: "",
  daily_minimum: "",
  mission_weekdays: NexusDias.TODOS.slice(),
  diasVistos: false,
  reminder_time: ""
};

function iconeAviso(tipo) {
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
  if (tipo === "ok") {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9");
  } else if (tipo === "info") {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01");
  } else if (tipo === "rede") {
    traco.setAttribute("d", "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18");
  } else {
    traco.setAttribute("d", "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
  }
  svg.appendChild(traco);
  return svg;
}

function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta alerta-" + tipo;
  el.replaceChildren(iconeAviso(tipo), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  if (!el) return;
  el.hidden = true;
  el.replaceChildren();
}

function definirErro(campo, aviso, texto) {
  if (texto) {
    aviso.hidden = false;
    aviso.textContent = texto;
    campo.setAttribute("aria-invalid", "true");
    return;
  }
  aviso.hidden = true;
  aviso.textContent = "";
  campo.removeAttribute("aria-invalid");
}

function definirCarregando(botao, ligado) {
  var rotulo = botao.querySelector(".btn-rotulo");
  var spinner = botao.querySelector(".spinner");
  botao.disabled = ligado;
  botao.setAttribute("aria-busy", ligado ? "true" : "false");
  if (rotulo) {
    rotulo.textContent = ligado ? botao.getAttribute("data-carregando") : botao.getAttribute("data-texto");
  }
  if (spinner) spinner.hidden = !ligado;
}

function textoLimpo(valor, maximo) {
  if (typeof valor !== "string") return "";
  var limpo = valor.replace(/[\u0000-\u001F]/g, "");
  if (limpo.length > maximo) limpo = limpo.slice(0, maximo);
  return limpo;
}

function lerRascunho() {
  try {
    var bruto = sessionStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return;
    rascunhoExistia = true;
    var dados = JSON.parse(bruto);
    if (!dados || typeof dados !== "object") return;
    var categoria = dados.category === "fitness" || dados.category === "aprendizagem" ? dados.category : "";
    var passo = dados.passo === 2 || dados.passo === 3 || dados.passo === 4 ? dados.passo : 1;
    var horario = normalizarHora(dados.reminder_time);
    estado.category = categoria;
    estado.title = textoLimpo(dados.title, 255);
    estado.why_it_matters = textoLimpo(dados.why_it_matters, 2000);
    estado.daily_minimum = textoLimpo(dados.daily_minimum, 120);
    estado.reminder_time = horario;
    if (Array.isArray(dados.mission_weekdays)) estado.mission_weekdays = NexusDias.limpar(dados.mission_weekdays);
    estado.diasVistos = dados.diasVistos === true;
    estado.passo = passo;
    if (estado.passo > 1 && (!estado.category || !estado.title.trim())) estado.passo = 1;
    if (estado.passo > 2 && (!estado.why_it_matters.trim() || !estado.daily_minimum.trim())) estado.passo = 2;
    if (estado.passo > 3 && !NexusDias.pedido(estado.mission_weekdays).ok) estado.passo = 3;
  } catch (erro) {
    estado.passo = 1;
  }
}

function guardarRascunho() {
  try {
    sessionStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({
      passo: estado.passo,
      category: estado.category,
      title: estado.title,
      why_it_matters: estado.why_it_matters,
      daily_minimum: estado.daily_minimum,
      mission_weekdays: estado.mission_weekdays,
      diasVistos: estado.diasVistos,
      reminder_time: estado.reminder_time
    }));
  } catch (erro) {
    /* Sem espaço no aparelho, os campos da página ainda guardam o que foi digitado. */
  }
}

function normalizarHora(valor) {
  if (typeof valor !== "string") return "";
  var achado = valor.match(/^([01]\d|2[0-3]):([0-5]\d)/);
  if (!achado) return "";
  return achado[1] + ":" + achado[2];
}

function categoriaEscolhida() {
  var marcado = document.querySelector('input[name="categoria"]:checked');
  if (!marcado) return "";
  if (marcado.value === "fitness" || marcado.value === "aprendizagem") return marcado.value;
  return "";
}

function lerCampos() {
  estado.category = categoriaEscolhida();
  estado.title = document.getElementById("objetivo").value;
  estado.why_it_matters = document.getElementById("porque").value;
  estado.daily_minimum = document.getElementById("minimo").value;
  estado.mission_weekdays = diasMarcados();
  estado.reminder_time = normalizarHora(document.getElementById("horario").value);
  guardarRascunho();
}

function aplicarRascunho() {
  document.querySelectorAll('input[name="categoria"]').forEach(function (radio) {
    radio.checked = radio.value === estado.category;
  });
  document.getElementById("objetivo").value = estado.title;
  document.getElementById("porque").value = estado.why_it_matters;
  document.getElementById("minimo").value = estado.daily_minimum;
  document.getElementById("horario").value = estado.reminder_time || (rascunhoExistia ? "" : HORA_PADRAO);
  aplicarDias(estado.mission_weekdays);
  marcarCartas();
  atualizarExemplo();
  atualizarPrevia();
  atualizarNotaIphone();
}

function marcarCartas() {
  document.querySelectorAll(".carta").forEach(function (carta) {
    var input = carta.querySelector("input");
    carta.classList.toggle("escolhida", !!(input && input.checked));
  });
}

function atualizarExemplo() {
  var dica = document.getElementById("objetivo-dica");
  dica.textContent = categoriaEscolhida() === "fitness"
    ? "Ex.: Treinar cinco vezes por semana"
    : "Ex.: Praticar inglês todos os dias";
}

function ehIOS() {
  var agente = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(agente)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function instaladoNaTelaInicial() {
  var modoSolto = false;
  try {
    modoSolto = window.matchMedia("(display-mode: standalone)").matches;
  } catch (erro) {
    modoSolto = false;
  }
  return navigator.standalone === true || modoSolto;
}

/* O recado do iPhone só aparece no iOS, e some se o app já está na Tela de Início. */
function atualizarNotaIphone() {
  var nota = document.getElementById("nota-iphone");
  if (!nota) return;
  nota.hidden = !(ehIOS() && !instaladoNaTelaInicial());
}

function preencherTrecho(el, valor) {
  var texto = valor.trim();
  if (!texto) {
    el.textContent = "…";
    el.classList.add("vazio");
    return;
  }
  el.textContent = texto;
  el.classList.remove("vazio");
}

function atualizarPrevia() {
  preencherTrecho(document.getElementById("previa-objetivo"), document.getElementById("objetivo").value);
  preencherTrecho(document.getElementById("previa-minimo"), document.getElementById("minimo").value);
  preencherTrecho(document.getElementById("previa-porque"), document.getElementById("porque").value);
  /* A linha «Dias» é preenchida depois que a pessoa passa pelo passo 3. */
  preencherTrecho(document.getElementById("previa-dias"), estado.diasVistos ? NexusDias.resumo(diasMarcados()) : "");
}

/* ---------- Passo 3: os dias ---------- */

var DESENHO_VISTO = "M5 12.5l4.5 4.5L19 7.5";

function montarDias() {
  var grade = document.getElementById("dias-grade");
  var pecas = NexusDias.CURTOS.map(function (curto, i) {
    var rotulo = document.createElement("label");
    rotulo.className = "dia";
    var caixa = document.createElement("input");
    caixa.type = "checkbox";
    caixa.name = "mission_weekdays";
    caixa.value = String(i + 1);
    caixa.checked = true;
    caixa.setAttribute("aria-label", NexusDias.LONGOS[i]);
    var visual = document.createElement("span");
    visual.className = "dia-caixa";
    visual.setAttribute("aria-hidden", "true");
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "dia-visto");
    var traco = document.createElementNS("http://www.w3.org/2000/svg", "path");
    traco.setAttribute("fill", "none");
    traco.setAttribute("stroke", "currentColor");
    traco.setAttribute("stroke-width", "2.5");
    traco.setAttribute("stroke-linecap", "round");
    traco.setAttribute("stroke-linejoin", "round");
    traco.setAttribute("d", DESENHO_VISTO);
    svg.appendChild(traco);
    var nome = document.createElement("span");
    nome.textContent = curto;
    visual.appendChild(svg);
    visual.appendChild(nome);
    rotulo.appendChild(caixa);
    rotulo.appendChild(visual);
    return rotulo;
  });
  grade.replaceChildren.apply(grade, pecas);
}

function caixasDosDias() {
  return Array.prototype.slice.call(document.querySelectorAll('input[name="mission_weekdays"]'));
}

function diasMarcados() {
  var caixas = caixasDosDias();
  if (!caixas.length) return estado.mission_weekdays.slice();
  return NexusDias.limpar(caixas.filter(function (c) { return c.checked; }).map(function (c) { return Number(c.value); }));
}

function aplicarDias(lista) {
  var marcados = {};
  NexusDias.limpar(lista).forEach(function (d) { marcados[d] = true; });
  caixasDosDias().forEach(function (caixa) {
    caixa.checked = !!marcados[Number(caixa.value)];
  });
  atualizarDias(false);
}

function mostrarErroDias(texto) {
  var aviso = document.getElementById("erro-dias");
  var grupo = document.getElementById("grupo-dias");
  if (!texto) {
    aviso.hidden = true;
    aviso.replaceChildren();
    grupo.removeAttribute("aria-invalid");
    return;
  }
  var frase = document.createElement("span");
  frase.textContent = texto;
  aviso.replaceChildren(iconeAviso("info"), frase);
  aviso.hidden = false;
  grupo.setAttribute("aria-invalid", "true");
}

/* Contador vivo. Abaixo de 3, o aviso aparece, mas o toque nunca é bloqueado. */
function atualizarDias(avisar) {
  var marcados = diasMarcados();
  document.getElementById("contador-dias").textContent = NexusDias.contador(marcados.length);
  if (marcados.length < NexusDias.MINIMO) {
    if (avisar) mostrarErroDias(NexusDias.TEXTOS.erroMinimo);
  } else {
    mostrarErroDias("");
  }
}

function focarGrupoDias() {
  var grupo = document.getElementById("grupo-dias");
  try {
    grupo.focus({ preventScroll: false });
  } catch (erro) {
    grupo.focus();
  }
}

function aplicarTextosDosDias() {
  document.querySelectorAll("[data-texto-dias]").forEach(function (el) {
    var chave = el.getAttribute("data-texto-dias");
    if (Object.prototype.hasOwnProperty.call(NexusDias.TEXTOS, chave)) el.textContent = NexusDias.TEXTOS[chave];
  });
}

function tituloDoPasso(numero) {
  if (numero === 2) return "O seu contrato — Nexus";
  if (numero === 3) return NexusDias.TEXTOS.titulo + " — Nexus";
  if (numero === 4) return "Quando te lembramos? — Nexus";
  return "O que você quer cumprir? — Nexus";
}

function mostrarPasso(numero, moverFoco) {
  estado.passo = numero;
  lerCampos();
  document.getElementById("passo-1").hidden = numero !== 1;
  document.getElementById("passo-2").hidden = numero !== 2;
  document.getElementById("passo-3").hidden = numero !== 3;
  document.getElementById("passo-4").hidden = numero !== 4;
  document.title = tituloDoPasso(numero);
  if (numero === 4) aplicarAviso();
  window.scrollTo(0, 0);
  if (!moverFoco) return;
  var titulo = document.getElementById("titulo-" + numero);
  try {
    titulo.focus({ preventScroll: true });
  } catch (erroFoco) {
    titulo.focus();
  }
}

function aplicarAviso() {
  var permissao = "Notification" in window ? Notification.permission : "ausente";
  var ok = document.getElementById("aviso-ok");
  var recusa = document.getElementById("aviso-recusado");
  var botao = document.getElementById("btn-aviso");
  ok.hidden = permissao !== "granted";
  botao.hidden = permissao === "granted";
  if (permissao === "denied") {
    recusa.hidden = false;
    recusa.textContent = "O aviso não foi permitido. Você ainda pode começar a missão.";
    return;
  }
  if (permissao === "ausente") {
    recusa.hidden = false;
    recusa.textContent = "Este navegador não pediu o aviso. Você ainda pode começar a missão.";
    return;
  }
  recusa.hidden = true;
  recusa.textContent = "";
}

function pedirAviso() {
  if (!("Notification" in window) || typeof Notification.requestPermission !== "function") {
    aplicarAviso();
    return;
  }
  var pedido;
  try {
    pedido = Notification.requestPermission();
  } catch (erro) {
    aplicarAviso();
    return;
  }
  Promise.resolve(pedido).then(function () {
    aplicarAviso();
  }).catch(function () {
    aplicarAviso();
  });
}

function fusoHorario() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch (erro) {
    return "UTC";
  }
}

function guardarLembreteLocal(hora) {
  try {
    localStorage.setItem(CHAVE_LEMBRETE, JSON.stringify({
      reminder_time: hora,
      timezone: fusoHorario()
    }));
  } catch (erro) {
    /* O horário continua no campo da página. */
  }
}

function urlBase64ParaBytes(base64) {
  var limpo = String(base64 || "").trim();
  var padding = "=".repeat((4 - (limpo.length % 4)) % 4);
  var base = (limpo + padding).replace(/-/g, "+").replace(/_/g, "/");
  var cru = atob(base);
  var saida = new Uint8Array(cru.length);
  for (var i = 0; i < cru.length; i++) saida[i] = cru.charCodeAt(i);
  return saida;
}

function comTempo(promessa, ms) {
  return Promise.race([
    promessa,
    new Promise(function (_, rejeitar) {
      setTimeout(function () { rejeitar(new Error("tempo")); }, ms);
    })
  ]);
}

/* Só corre depois que a missão existe. Falha aqui não desfaz a missão. */
async function inscreverSeAceito() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  var chave = await NexusApi.chaveVapid();
  var publica = chave.ok && chave.dados && typeof chave.dados.publicKey === "string" ? chave.dados.publicKey : "";
  if (!publica) return;
  var registro = await navigator.serviceWorker.register("sw.js");
  var existente = await registro.pushManager.getSubscription();
  var inscricao = existente;
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaBytes(publica)
    });
  }
  if (!inscricao || typeof inscricao.toJSON !== "function") return;
  await NexusApi.inscreverNotificacao(inscricao.toJSON());
}

function travarPasso4(ligado) {
  document.querySelectorAll("[data-voltar]").forEach(function (botao) {
    botao.disabled = ligado;
  });
  var aviso = document.getElementById("btn-aviso");
  if (aviso && !aviso.hidden) aviso.disabled = ligado;
}

function enviarPasso1(evento) {
  evento.preventDefault();
  var objetivo = document.getElementById("objetivo");
  var grupo = document.getElementById("grupo-categoria");
  var erroCategoria = document.getElementById("erro-categoria");
  var erroObjetivo = document.getElementById("erro-objetivo");
  var alerta = document.getElementById("alerta-1");
  esconderAviso(alerta);
  lerCampos();
  var textoCategoria = estado.category ? "" : "Escolha estudo ou academia.";
  var textoObjetivo = estado.title.trim() ? "" : "Escreva o objetivo em uma frase.";
  definirErro(grupo, erroCategoria, textoCategoria);
  definirErro(objetivo, erroObjetivo, textoObjetivo);
  if (textoCategoria || textoObjetivo) {
    if (textoCategoria) {
      var primeiro = grupo.querySelector("input");
      if (primeiro) primeiro.focus();
    } else {
      objetivo.focus();
    }
    return;
  }
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }
  mostrarPasso(2, true);
}

function enviarPasso2(evento) {
  evento.preventDefault();
  var porque = document.getElementById("porque");
  var minimo = document.getElementById("minimo");
  var erroPorque = document.getElementById("erro-porque");
  var erroMinimo = document.getElementById("erro-minimo");
  var alerta = document.getElementById("alerta-2");
  esconderAviso(alerta);
  lerCampos();
  var textoPorque = estado.why_it_matters.trim() ? "" : "Diga por que isso importa para você.";
  var textoMinimo = estado.daily_minimum.trim() ? "" : "Escreva o mínimo de cada dia.";
  definirErro(porque, erroPorque, textoPorque);
  definirErro(minimo, erroMinimo, textoMinimo);
  if (textoPorque || textoMinimo) {
    (textoPorque ? porque : minimo).focus();
    return;
  }
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }
  mostrarPasso(3, true);
}

function enviarPasso3(evento) {
  evento.preventDefault();
  var alerta = document.getElementById("alerta-3");
  esconderAviso(alerta);
  lerCampos();
  var conferido = NexusDias.pedido(estado.mission_weekdays);
  if (!conferido.ok) {
    /* Menos de 3: não segue e não envia nada. O foco volta ao grupo com a mesma frase. */
    mostrarErroDias(conferido.erro);
    focarGrupoDias();
    return;
  }
  mostrarErroDias("");
  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE);
    return;
  }
  estado.diasVistos = true;
  guardarRascunho();
  atualizarPrevia();
  mostrarPasso(4, true);
}

/* 503: a escolha dos dias ainda não existe no servidor (migração 004).
   O alerta explica e dá dois caminhos. Nada do que foi digitado some. */
function mostrarIndisponivel(alerta, aoTodos, aoTentar) {
  var corpo = document.createElement("div");
  corpo.className = "alerta-corpo";
  var frase = document.createElement("p");
  frase.textContent = NexusDias.TEXTOS.indisponivel;
  var acoes = document.createElement("div");
  acoes.className = "alerta-acoes";
  var todos = document.createElement("button");
  todos.type = "button";
  todos.className = "btn btn-primario";
  todos.id = "btn-todos-os-dias";
  todos.textContent = NexusDias.TEXTOS.comecarComTodos;
  todos.addEventListener("click", aoTodos);
  var tentar = document.createElement("button");
  tentar.type = "button";
  tentar.className = "btn btn-secundario";
  tentar.id = "btn-tentar-dias";
  tentar.textContent = NexusDias.TEXTOS.tentarDeNovo;
  tentar.addEventListener("click", aoTentar);
  acoes.appendChild(todos);
  acoes.appendChild(tentar);
  corpo.appendChild(frase);
  corpo.appendChild(acoes);
  alerta.className = "alerta alerta-rede";
  alerta.replaceChildren(iconeAviso("info"), corpo);
  alerta.hidden = false;
}

function enviarPasso4(evento) {
  evento.preventDefault();
  criarAMissao({ semDias: false });
}

async function criarAMissao(opcoes) {
  var form = document.getElementById("form-4");
  if (form.dataset.ocupado === "sim") return;
  var horario = document.getElementById("horario");
  var erroHorario = document.getElementById("erro-horario");
  var alerta = document.getElementById("alerta-4");
  var botao = document.getElementById("btn-comecar");
  esconderAviso(alerta);
  lerCampos();
  /* «Começar com todos os dias»: os 7 voltam a ficar marcados e o campo não vai. */
  if (opcoes && opcoes.semDias) {
    aplicarDias(NexusDias.TODOS);
    lerCampos();
    atualizarPrevia();
  }
  var conferido = NexusDias.pedido(estado.mission_weekdays);
  if (!conferido.ok) {
    /* Proteção: com menos de 3 dias nada é enviado. */
    mostrarPasso(3, false);
    mostrarErroDias(conferido.erro);
    focarGrupoDias();
    return;
  }
  var querAviso = "Notification" in window && Notification.permission === "granted";
  var textoHora = querAviso && !estado.reminder_time ? "Escolha o horário do lembrete." : "";
  definirErro(horario, erroHorario, textoHora);

  if (navigator.onLine === false) {
    mostrarAviso(alerta, "rede", TEXTO_SEM_REDE_MISSAO);
    return;
  }

  form.dataset.ocupado = "sim";
  definirCarregando(botao, true);
  travarPasso4(true);
  var indo = false;
  try {
    var prova = estado.category === "fitness" ? "workout_proof" : "study_note";
    var pedido = {
      title: estado.title.trim(),
      category: estado.category,
      daily_minimum: estado.daily_minimum.trim(),
      why_it_matters: estado.why_it_matters.trim(),
      proof_mode: prova
    };
    if (conferido.campo) pedido.mission_weekdays = conferido.campo;
    var resultado = await NexusApi.criarMissao(pedido);
    if (resultado.semRede) {
      mostrarAviso(alerta, "rede", TEXTO_SEM_REDE_MISSAO);
      return;
    }
    if (!resultado.ok && resultado.status === 503 && conferido.campo) {
      mostrarIndisponivel(alerta, function () {
        criarAMissao({ semDias: true });
      }, function () {
        criarAMissao({ semDias: false });
      });
      return;
    }
    if (!resultado.ok && resultado.status === 400 && NexusDias.erroDoServidor(resultado.erro)) {
      /* O texto do servidor aparece no lugar do aviso dos dias, no passo 3. */
      mostrarPasso(3, false);
      mostrarErroDias(resultado.erro);
      focarGrupoDias();
      return;
    }
    if (!resultado.ok) {
      mostrarAviso(alerta, "falha", TEXTO_FALHA_MISSAO);
      return;
    }
    if (querAviso) {
      try {
        await comTempo(inscreverSeAceito(), LIMITE_AVISO_MS);
      } catch (erroAviso) {
        /* A missão já existe. O aviso pode ser ligado depois. */
      }
    }
    if (estado.reminder_time) {
      guardarLembreteLocal(estado.reminder_time);
      try {
        await NexusApi.saveReminderTime({
          reminder_time: estado.reminder_time,
          timezone: fusoHorario()
        });
      } catch (erroLembrete) {
        /* A rota ainda pode não existir. O horário fica neste aparelho. */
      }
    }
    indo = true;
    try {
      sessionStorage.removeItem(CHAVE_RASCUNHO);
    } catch (erroLimpar) {
      /* A página seguinte abre mesmo assim. */
    }
    location.href = "hoje.html" + location.search;
  } finally {
    if (!indo) {
      form.dataset.ocupado = "";
      definirCarregando(botao, false);
      travarPasso4(false);
    }
  }
}

function limparErroAoDigitar(campo, aviso) {
  campo.addEventListener("input", function () {
    if (campo.getAttribute("aria-invalid") === "true") definirErro(campo, aviso, "");
    lerCampos();
    atualizarPrevia();
  });
}

function atualizarBarra() {
  var tema = document.documentElement.getAttribute("data-theme");
  var escuro = tema === "dark" || (tema !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var meta = document.getElementById("cor-da-barra");
  if (meta) meta.setAttribute("content", escuro ? "#161411" : "#0B5F52");
}

function iniciar() {
  aplicarTextosDosDias();
  montarDias();
  lerRascunho();
  aplicarRascunho();
  mostrarPasso(estado.passo, false);

  document.getElementById("form-1").addEventListener("submit", enviarPasso1);
  document.getElementById("form-2").addEventListener("submit", enviarPasso2);
  document.getElementById("form-3").addEventListener("submit", enviarPasso3);
  document.getElementById("form-4").addEventListener("submit", enviarPasso4);
  caixasDosDias().forEach(function (caixa) {
    caixa.addEventListener("change", function () {
      atualizarDias(true);
      lerCampos();
    });
  });
  document.getElementById("atalho-todos").addEventListener("click", function () {
    aplicarDias(NexusDias.TODOS);
    lerCampos();
  });
  document.getElementById("atalho-uteis").addEventListener("click", function () {
    aplicarDias(NexusDias.UTEIS);
    lerCampos();
  });
  document.getElementById("btn-aviso").addEventListener("click", pedirAviso);

  document.querySelectorAll("[data-voltar]").forEach(function (botao) {
    botao.addEventListener("click", function () {
      mostrarPasso(Number(botao.getAttribute("data-voltar")), true);
    });
  });

  document.querySelectorAll('input[name="categoria"]').forEach(function (radio) {
    radio.addEventListener("change", function () {
      marcarCartas();
      atualizarExemplo();
      var grupo = document.getElementById("grupo-categoria");
      if (grupo.getAttribute("aria-invalid") === "true") {
        definirErro(grupo, document.getElementById("erro-categoria"), "");
      }
      lerCampos();
    });
  });

  limparErroAoDigitar(document.getElementById("objetivo"), document.getElementById("erro-objetivo"));
  limparErroAoDigitar(document.getElementById("porque"), document.getElementById("erro-porque"));
  limparErroAoDigitar(document.getElementById("minimo"), document.getElementById("erro-minimo"));
  limparErroAoDigitar(document.getElementById("horario"), document.getElementById("erro-horario"));

  atualizarBarra();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", atualizarBarra);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
  }
}

iniciar();
