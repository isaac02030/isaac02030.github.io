/* Pessoas bloqueadas (spec da Clara, parte 2, 26/11/2026).
   Textos novos: esperam o sim do Isaac junto com o PR.
   O 429 não estava na lista da spec; a frase segue o mesmo tom calmo. */

(function () {
  var TEXTOS = {
    titulo: "Pessoas bloqueadas",
    voltar: "Voltar",
    apoio: "Quem está nesta lista não forma Duo nem Rival com você.",
    bloqueioEm: "Bloqueio em {data}",
    desbloquear: "Desbloquear",
    desbloquearQuem: "Desbloquear {apelido}",
    confirmarTitulo: "Desbloquear {apelido}?",
    confirmarTexto: "Vocês poderão voltar a formar Duo ou Rival. A conversa antiga não volta. Depois, só dá para bloquear de novo se vocês formarem dupla outra vez.",
    cancelar: "Cancelar",
    desbloqueando: "Desbloqueando…",
    desbloqueada: "Pessoa desbloqueada.",
    vazio: "Você não bloqueou ninguém.",
    vazioApoio: "Para bloquear alguém, use as opções de uma mensagem no chat.",
    carregando: "Carregando a lista…",
    semRede: "Sem internet. A lista não abriu.",
    erro: "Não foi possível abrir a lista. Tente de novo.",
    /* O 503 da lista usa a frase que já está em comunidade-textos.js. */
    muitasLista: "Você pediu a lista muitas vezes. Espere um pouco e tente de novo.",
    tentar: "Tentar de novo",
    semRedeDesbloquear: "Sem internet. O desbloqueio não foi feito.",
    erroDesbloquear: "Não foi possível desbloquear agora. Tente de novo.",
    indisponivelDesbloquear: "O desbloqueio ainda não está disponível. Tente de novo mais tarde.",
    muitasDesbloquear: "Você tentou desbloquear muitas vezes. Espere um pouco e tente de novo."
  };

  function texto(chave, troca) {
    var t = TEXTOS[chave] || "";
    if (troca) {
      Object.keys(troca).forEach(function (k) {
        t = t.split("{" + k + "}").join(troca[k]);
      });
    }
    return t;
  }

  function aplicar(raiz) {
    (raiz || document).querySelectorAll("[data-texto-bloqueados]").forEach(function (el) {
      var chave = el.getAttribute("data-texto-bloqueados");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave)) el.textContent = TEXTOS[chave];
    });
  }

  window.NexusBloqueados = { TEXTOS: TEXTOS, texto: texto, aplicar: aplicar };
})();
