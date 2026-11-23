/* Ajustes › Meus dados (spec da Clara, seção 3).
   - Seus aceites: versão e data, do /me (user.legal, PR 28).
   - Interruptores: «Guardar minhas notas» (PR 27: desligar apaga as notas
     já guardadas) e «Lembretes do registro diário» (PR 29). O de novidades
     fica escondido até existir envio (decisão de 22/11).
   - Falar sobre seus dados: o e-mail de privacidade (dados-textos.js), com link.
   - Excluir conta com senha (PR 26). Depois de excluir: apaga tudo o que é
     nexus_v2_* deste aparelho e abre «Sua conta foi excluída».
   Nada aparece como salvo antes de o servidor confirmar. */

var D = window.NexusDados;
var estado = { notas: false, lembretes: false, mensagens: false, ocupado: {} };

function semRedeAgora() {
  var rede = "";
  try {
    rede = new URLSearchParams(location.search).get("rede") || "";
  } catch (erro) {
    rede = "";
  }
  return rede === "off" || navigator.onLine === false;
}

function buscaTema() {
  try {
    var tema = new URLSearchParams(location.search).get("tema") || "";
    if (tema === "claro" || tema === "escuro" || tema === "sistema") return "?tema=" + tema;
  } catch (erro) {}
  return "";
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
  traco.setAttribute("d", tipo === "ok"
    ? "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9"
    : "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01");
  svg.appendChild(traco);
  return svg;
}

/* Sucesso: role=status. Falha: role=alert, neutra (não é culpa de quem usa). */
function mostrarAviso(el, tipo, texto) {
  var paragrafo = document.createElement("p");
  paragrafo.textContent = texto;
  el.className = "alerta " + (tipo === "ok" ? "alerta-ok" : "alerta-neutro");
  el.setAttribute("role", tipo === "ok" ? "status" : "alert");
  el.replaceChildren(icone(tipo), paragrafo);
  el.hidden = false;
}

function esconderAviso(el) {
  el.hidden = true;
  el.replaceChildren();
}

function mostrarVista(qual) {
  ["carregando", "erro", "dados"].forEach(function (nome) {
    document.getElementById("vista-" + nome).hidden = nome !== qual;
  });
}

function doisDigitos(n) {
  return (n < 10 ? "0" : "") + n;
}

/* Data e hora do servidor, mostradas na hora de Lisboa (o texto diz o fuso). */
function formatarData(iso) {
  var data = new Date(iso);
  if (!iso || isNaN(data.getTime())) return "";
  var partes = {};
  try {
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "Europe/Lisbon", day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(data).forEach(function (p) { partes[p.type] = p.value; });
  } catch (erro) {
    return "";
  }
  return partes.day + "/" + partes.month + "/" + partes.year + ", " + partes.hour + ":" + partes.minute;
}

function linhaDeAceite(rotulo, versao, quando) {
  var data = formatarData(quando);
  if (!versao || !data) return rotulo + ": " + D.texto("semAceite");
  return rotulo + ": " + D.texto("aceitoEm", { versao: versao, data: data });
}

function pintarAceites(legal) {
  var l = legal || {};
  document.getElementById("aceite-termos").textContent = linhaDeAceite(D.texto("termosRotulo"), l.terms_version, l.terms_accepted_at);
  document.getElementById("aceite-privacidade").textContent = linhaDeAceite(D.texto("privacidadeRotulo"), l.privacy_version, l.privacy_accepted_at);
}

function pintarInterruptor(qual, ligado, salvando) {
  var botao = document.getElementById("sw-" + qual);
  var texto = document.getElementById(qual + "-estado");
  botao.setAttribute("aria-checked", ligado ? "true" : "false");
  botao.setAttribute("aria-busy", salvando ? "true" : "false");
  var estadoTexto = D.texto(ligado ? "ligado" : "desligado");
  /* Lembretes ligados num aparelho que ainda não permitiu avisos: dizer isso. */
  /* O mesmo vale para os avisos de mensagens (spec do chat, seção 4). */
  var deAviso = qual === "lembretes" || qual === "mensagens";
  if (deAviso && ligado && nexusEstadoDoAviso() === "pendente") estadoTexto = D.texto("ligadoSemPermissao");
  if (deAviso && ligado && nexusEstadoDoAviso() === "bloqueado") estadoTexto = D.texto("ligadoBloqueado");
  if (deAviso && ligado && nexusEstadoDoAviso() === "sem-suporte") estadoTexto = D.texto("ligadoSemSuporte");
  texto.textContent = salvando ? D.texto("salvando") : estadoTexto;
  if (qual === "lembretes") pintarAparelho();
}

/* O estado real do aparelho, só com os lembretes ligados. */
function pintarAparelho() {
  var estadoAviso = nexusEstadoDoAviso();
  var ligado = estado.lembretes === true;
  document.getElementById("lembretes-bloqueados").hidden = !(ligado && estadoAviso === "bloqueado");
  document.getElementById("lembretes-sem-suporte").hidden = !(ligado && estadoAviso === "sem-suporte");
  document.getElementById("btn-permitir-avisos").hidden = !(ligado && estadoAviso === "pendente");
}

/* «Permitir avisos neste aparelho»: o pedido do navegador e a inscrição. */
async function permitirAvisos() {
  var botao = document.getElementById("btn-permitir-avisos");
  if (botao.disabled) return;
  botao.disabled = true;
  try {
    if (typeof Notification.requestPermission === "function") await Promise.resolve(Notification.requestPermission());
    if (nexusEstadoDoAviso() === "permitido") await nexusInscreverAvisos();
  } catch (erro) {
    /* O estado abaixo diz o que o aparelho permitiu. */
  }
  botao.disabled = false;
  pintarInterruptor("lembretes", estado.lembretes, false);
}

async function carregar() {
  mostrarVista("carregando");
  var alerta = document.getElementById("alerta-erro");
  if (semRedeAgora()) {
    mostrarAviso(alerta, "falha", D.texto("carregarSemRede"));
    mostrarVista("erro");
    return;
  }
  var r = await Promise.all([NexusApi.eu(), NexusApi.escolhaDaNota(), NexusApi.escolhasDeAvisos()]);
  if (r.some(function (x) { return x.sessaoEncerrada; })) return;
  var falha = r.find(function (x) { return !x.ok; });
  if (falha) {
    var texto = D.texto("carregarDadosErro");
    if (falha.semRede) texto = D.texto("carregarSemRede");
    else if (falha === r[1]) texto = D.texto("carregarEscolhaErro");
    else if (falha === r[2]) texto = D.texto("carregarAvisosErro");
    mostrarAviso(alerta, "falha", texto);
    mostrarVista("erro");
    return;
  }
  var usuario = (r[0].dados && r[0].dados.user) || {};
  pintarAceites(usuario.legal);
  estado.notas = r[1].dados && r[1].dados.note_consent === "yes";
  /* Sem «sim», nenhuma cópia local da nota (também as de antes da escolha). */
  nexusLembrarEscolhaNota(estado.notas ? "yes" : "no");
  var avisos = r[2].dados || {};
  estado.lembretes = !!(avisos.reminders && avisos.reminders.choice === "yes");
  /* Só «yes» liga. null (nunca escolheu, ou servidor sem a migração 010) = desligado. */
  estado.mensagens = !!(avisos.messages && avisos.messages.choice === "yes");
  pintarInterruptor("notas", estado.notas, false);
  pintarInterruptor("lembretes", estado.lembretes, false);
  pintarInterruptor("mensagens", estado.mensagens, false);
  mostrarVista("dados");
}

/* Desligar as notas apaga as já guardadas: antes, a confirmação (revisão da
   Clara), com o foco em «Cancelar». Ligar e os lembretes: um toque só. */
function pedirParaDesligarNotas() {
  var dialogo = document.getElementById("dialogo-desligar");
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");
  document.getElementById("btn-cancelar-desligar").focus();
}

function fecharDialogoDesligar(confirmou) {
  var dialogo = document.getElementById("dialogo-desligar");
  if (typeof dialogo.close === "function") dialogo.close();
  else dialogo.removeAttribute("open");
  if (confirmou) alternar("notas", true);
  else document.getElementById("sw-notas").focus();
}

function tocarInterruptor(qual) {
  if (qual === "notas" && estado.notas && !estado.ocupado.notas) {
    pedirParaDesligarNotas();
    return;
  }
  alternar(qual);
}

/* O interruptor só muda depois que o servidor confirma. */
async function alternar(qual, confirmado) {
  if (estado.ocupado[qual]) return;
  var aviso = document.getElementById("aviso-dados");
  esconderAviso(aviso);
  var queroLigar = !estado[qual];
  /* Proteção: desligar as notas só passa pela confirmação. */
  if (qual === "notas" && !queroLigar && confirmado !== true) return;
  if (semRedeAgora()) {
    mostrarAviso(aviso, "falha", D.texto("salvarSemRede"));
    return;
  }
  estado.ocupado[qual] = true;
  pintarInterruptor(qual, estado[qual], true);
  var resultado;
  if (qual === "notas") resultado = queroLigar ? await NexusApi.guardarNotas() : await NexusApi.naoGuardarNotas();
  else if (qual === "mensagens") resultado = await NexusApi.mudarAvisosDeMensagem(queroLigar);
  else resultado = await NexusApi.mudarLembretes(queroLigar);
  estado.ocupado[qual] = false;
  if (resultado.sessaoEncerrada) return;
  var chaveServidor = qual === "mensagens" ? "messages" : "reminders";
  var confirmou = resultado.ok && (qual === "notas"
    ? resultado.dados && resultado.dados.note_consent === (queroLigar ? "yes" : "no")
    : resultado.dados && resultado.dados[chaveServidor] && resultado.dados[chaveServidor].choice === (queroLigar ? "yes" : "no"));
  if (!confirmou) {
    pintarInterruptor(qual, estado[qual], false);
    mostrarAviso(aviso, "falha", resultado.semRede ? D.texto("salvarSemRede") : D.texto("salvarErro"));
    return;
  }
  estado[qual] = queroLigar;
  pintarInterruptor(qual, estado[qual], false);
  var chave;
  if (qual === "notas" && queroLigar) chave = "notasLigou";
  else if (qual === "notas") {
    /* O servidor apagou as notas guardadas: nenhuma cópia fica no aparelho. */
    nexusLembrarEscolhaNota("no");
    chave = resultado.dados.notes_deleted > 0 ? "notasDesligouApagou" : "notasDesligou";
  } else if (qual === "mensagens") chave = queroLigar ? "mensagensLigou" : "mensagensDesligou";
  else chave = queroLigar ? "lembretesLigou" : "lembretesDesligou";
  if (qual === "notas" && queroLigar) nexusLembrarEscolhaNota("yes");
  mostrarAviso(aviso, "ok", D.texto(chave));
}

/* ---------- Excluir conta ---------- */

function abrirDialogo() {
  var dialogo = document.getElementById("dialogo-excluir");
  var senha = document.getElementById("senha-excluir");
  senha.value = "";
  senha.removeAttribute("aria-invalid");
  esconderAviso(document.getElementById("erro-excluir"));
  document.getElementById("btn-confirmar-excluir").disabled = true;
  if (typeof dialogo.showModal === "function") dialogo.showModal();
  else dialogo.setAttribute("open", "");
  /* Foco inicial em «Cancelar», a ação segura. */
  document.getElementById("btn-cancelar-excluir").focus();
}

function fecharDialogo() {
  var dialogo = document.getElementById("dialogo-excluir");
  if (dialogo.dataset.ocupado === "sim") return;
  if (typeof dialogo.close === "function") dialogo.close();
  else dialogo.removeAttribute("open");
  document.getElementById("senha-excluir").value = "";
  document.getElementById("btn-excluir").focus();
}

/* Depois de excluir: nada do Nexus fica neste aparelho (nexus_v2_*). */
function limparAparelho() {
  [localStorage, sessionStorage].forEach(function (area) {
    try {
      var i = area.length;
      while (i > 0) {
        i -= 1;
        var chave = area.key(i);
        if (chave && chave.indexOf("nexus_v2_") === 0) area.removeItem(chave);
      }
    } catch (erro) {}
  });
}

function erroDaExclusao(resultado) {
  if (resultado.semRede) return { texto: D.texto("excluirSemRede") };
  var codigo = resultado.dados && typeof resultado.dados.code === "string" ? resultado.dados.code : "";
  if (codigo === "wrong_password") return { texto: D.texto("excluirSenhaErrada"), campo: true };
  if (codigo === "password_required") return { texto: D.texto("excluirSemSenha"), campo: true };
  if (codigo === "too_many_attempts" || resultado.status === 429) return { texto: D.texto("excluirMuitas") };
  if (codigo === "admin_account") return { texto: D.texto("excluirAdmin") };
  return { texto: D.texto("excluirFalha") };
}

async function enviarExclusao(evento) {
  evento.preventDefault();
  var dialogo = document.getElementById("dialogo-excluir");
  if (dialogo.dataset.ocupado === "sim") return;
  var senha = document.getElementById("senha-excluir");
  var erro = document.getElementById("erro-excluir");
  var confirmar = document.getElementById("btn-confirmar-excluir");
  var cancelar = document.getElementById("btn-cancelar-excluir");
  esconderAviso(erro);
  senha.removeAttribute("aria-invalid");
  if (!senha.value) {
    mostrarAviso(erro, "falha", D.texto("excluirSemSenha"));
    senha.focus();
    return;
  }
  if (semRedeAgora()) {
    mostrarAviso(erro, "falha", D.texto("excluirSemRede"));
    return;
  }
  dialogo.dataset.ocupado = "sim";
  confirmar.disabled = true;
  cancelar.disabled = true;
  confirmar.setAttribute("aria-busy", "true");
  confirmar.textContent = D.texto("excluindo");
  var resultado = await NexusApi.excluirConta(senha.value);
  if (resultado.ok && resultado.dados && resultado.dados.deleted === true) {
    senha.value = "";
    limparAparelho();
    location.replace("conta-excluida.html" + buscaTema());
    return;
  }
  dialogo.dataset.ocupado = "";
  cancelar.disabled = false;
  confirmar.setAttribute("aria-busy", "false");
  confirmar.textContent = D.texto("excluirConfirmar");
  confirmar.disabled = !senha.value;
  if (resultado.sessaoEncerrada) return;
  var problema = erroDaExclusao(resultado);
  mostrarAviso(erro, "falha", problema.texto);
  if (problema.campo) {
    /* Erro de quem digitou: borda do campo em --danger e o foco volta nele. */
    senha.setAttribute("aria-invalid", "true");
    senha.select();
    senha.focus();
  }
}

/* «… Escreva para {email}.»: o endereço vira link mailto:, visível e copiável. */
function pintarContato() {
  var p = document.getElementById("falar-texto");
  var email = D.texto("contatoEmail");
  var partes = D.texto("falarTexto").split("{email}");
  var link = document.createElement("a");
  link.className = "link-email";
  link.href = "mailto:" + email;
  link.textContent = email;
  /* O endereço e o ponto final ficam juntos numa linha própria (não sobra
     «.» sozinho a 200%); a linha dá respiro ao anel de foco. */
  var linha = document.createElement("span");
  linha.className = "linha-email";
  linha.append(link, document.createTextNode(partes[1] || ""));
  p.replaceChildren(document.createTextNode((partes[0] || "").replace(/\s+$/, "")), linha);
}

function iniciar() {
  D.aplicar(document);
  pintarContato();
  document.getElementById("voltar").href = "ajustes.html" + buscaTema();
  document.querySelectorAll(".link-ler").forEach(function (link) {
    link.href = link.getAttribute("href").split("?")[0] + buscaTema();
  });
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("sw-notas").addEventListener("click", function () { tocarInterruptor("notas"); });
  document.getElementById("sw-lembretes").addEventListener("click", function () { tocarInterruptor("lembretes"); });
  document.getElementById("sw-mensagens").addEventListener("click", function () { tocarInterruptor("mensagens"); });
  document.getElementById("btn-permitir-avisos").addEventListener("click", permitirAvisos);
  document.getElementById("btn-cancelar-desligar").addEventListener("click", function () { fecharDialogoDesligar(false); });
  document.getElementById("btn-confirmar-desligar").addEventListener("click", function () { fecharDialogoDesligar(true); });
  document.getElementById("dialogo-desligar").addEventListener("cancel", function (evento) {
    evento.preventDefault();
    fecharDialogoDesligar(false);
  });
  document.getElementById("btn-excluir").addEventListener("click", abrirDialogo);
  document.getElementById("btn-cancelar-excluir").addEventListener("click", fecharDialogo);
  var dialogo = document.getElementById("dialogo-excluir");
  /* Esc fecha como «Cancelar»; enquanto envia, não fecha. */
  dialogo.addEventListener("cancel", function (evento) {
    evento.preventDefault();
    fecharDialogo();
  });
  document.getElementById("form-excluir").addEventListener("submit", enviarExclusao);
  document.getElementById("senha-excluir").addEventListener("input", function () {
    var senha = document.getElementById("senha-excluir");
    if (dialogo.dataset.ocupado !== "sim") document.getElementById("btn-confirmar-excluir").disabled = !senha.value;
    senha.removeAttribute("aria-invalid");
  });
  NexusAbas.iniciar("ajustes");
  NexusAbas.focar(document.getElementById("titulo"));
  carregar();
}

iniciar();
