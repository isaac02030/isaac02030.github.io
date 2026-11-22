/* Ajustes › Meus dados (spec da Clara, seção 3).
   - Seus aceites: versão e data, do /me (user.legal, PR 28).
   - Interruptores: «Guardar minhas notas» (PR 27: desligar apaga as notas
     já guardadas) e «Lembretes do registro diário» (PR 29). O de novidades
     fica escondido até existir envio (decisão de 22/11).
   - Falar sobre seus dados: o marcador do e-mail, nunca um endereço real.
   - Excluir conta com senha (PR 26). Depois de excluir: apaga tudo o que é
     nexus_v2_* deste aparelho e abre «Sua conta foi excluída».
   Nada aparece como salvo antes de o servidor confirmar. */

var D = window.NexusDados;
var estado = { notas: false, lembretes: false, ocupado: {} };

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

/* Data e hora do servidor, mostradas no relógio deste aparelho. */
function formatarData(iso) {
  var data = new Date(iso);
  if (!iso || isNaN(data.getTime())) return "";
  return doisDigitos(data.getDate()) + "/" + doisDigitos(data.getMonth() + 1) + "/" + data.getFullYear()
    + ", " + doisDigitos(data.getHours()) + ":" + doisDigitos(data.getMinutes());
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
  texto.textContent = salvando ? D.texto("salvando") : D.texto(ligado ? "ligado" : "desligado");
}

function pintarBloqueio() {
  var negado = "Notification" in window && Notification.permission === "denied";
  document.getElementById("lembretes-bloqueados").hidden = !negado;
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
  var avisos = r[2].dados || {};
  estado.lembretes = !!(avisos.reminders && avisos.reminders.choice === "yes");
  pintarInterruptor("notas", estado.notas, false);
  pintarInterruptor("lembretes", estado.lembretes, false);
  pintarBloqueio();
  mostrarVista("dados");
}

/* Um toque liga ou desliga, sem confirmação (retirar é tão fácil quanto dar).
   O interruptor só muda depois que o servidor confirma. */
async function alternar(qual) {
  if (estado.ocupado[qual]) return;
  var aviso = document.getElementById("aviso-dados");
  esconderAviso(aviso);
  var queroLigar = !estado[qual];
  if (semRedeAgora()) {
    mostrarAviso(aviso, "falha", D.texto("salvarSemRede"));
    return;
  }
  estado.ocupado[qual] = true;
  pintarInterruptor(qual, estado[qual], true);
  var resultado;
  if (qual === "notas") resultado = queroLigar ? await NexusApi.guardarNotas() : await NexusApi.naoGuardarNotas();
  else resultado = await NexusApi.mudarLembretes(queroLigar);
  estado.ocupado[qual] = false;
  if (resultado.sessaoEncerrada) return;
  var confirmou = resultado.ok && (qual === "notas"
    ? resultado.dados && resultado.dados.note_consent === (queroLigar ? "yes" : "no")
    : resultado.dados && resultado.dados.reminders && resultado.dados.reminders.choice === (queroLigar ? "yes" : "no"));
  if (!confirmou) {
    pintarInterruptor(qual, estado[qual], false);
    mostrarAviso(aviso, "falha", resultado.semRede ? D.texto("salvarSemRede") : D.texto("salvarErro"));
    return;
  }
  estado[qual] = queroLigar;
  pintarInterruptor(qual, estado[qual], false);
  var chave = qual === "notas"
    ? (queroLigar ? "notasLigou" : "notasDesligou")
    : (queroLigar ? "lembretesLigou" : "lembretesDesligou");
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

function iniciar() {
  D.aplicar(document);
  document.getElementById("voltar").href = "ajustes.html" + buscaTema();
  document.querySelectorAll(".link-ler").forEach(function (link) {
    link.href = link.getAttribute("href").split("?")[0] + buscaTema();
  });
  document.getElementById("btn-tentar").addEventListener("click", carregar);
  document.getElementById("sw-notas").addEventListener("click", function () { alternar("notas"); });
  document.getElementById("sw-lembretes").addEventListener("click", function () { alternar("lembretes"); });
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
