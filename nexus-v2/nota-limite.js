/* Limite da frase do check-in e do dia difícil: 280 caracteres.
   O campo tem maxlength="280" e um contador discreto («120 de 280»).
   O contador conta como o maxlength do navegador (value.length), então o
   que cabe no campo sempre passa no servidor, que conta caracteres reais
   e devolve 400 com MSG_SERVIDOR se passar de 280.
   O contador não fala a cada tecla: entra no aria-describedby do campo
   (lido ao focar) e só o aviso de limite é anunciado. */
(function () {
  var LIMITE = 280;
  var MSG_SERVIDOR = "A frase passou de 280 caracteres. Encurte um pouco e envie de novo.";
  var AVISO_LIMITE = "Chegou ao limite de 280 caracteres.";
  var AVISO_PASSOU = "Passou do limite de 280 caracteres. Apague um pouco.";

  function tamanho(texto) {
    return typeof texto === "string" ? texto.length : 0;
  }

  function passou(texto) {
    return tamanho(texto) > LIMITE;
  }

  function atualizar(campo, contador, aviso) {
    if (!campo || !contador) return;
    var n = tamanho(campo.value);
    contador.textContent = n + " de " + LIMITE;
    var noLimite = n >= LIMITE;
    contador.classList.toggle("no-limite", noLimite);
    if (aviso) {
      var texto = n > LIMITE ? AVISO_PASSOU : (noLimite ? AVISO_LIMITE : "");
      if (aviso.textContent !== texto) aviso.textContent = texto;
    }
  }

  /* Liga o contador ao campo e devolve a função que o atualiza
     (para chamar depois de pôr ou apagar o rascunho por código). */
  function ligar(idCampo, idContador, idAviso) {
    var campo = document.getElementById(idCampo);
    var contador = document.getElementById(idContador);
    var aviso = idAviso ? document.getElementById(idAviso) : null;
    function agora() {
      atualizar(campo, contador, aviso);
    }
    if (campo) campo.addEventListener("input", agora);
    agora();
    return agora;
  }

  window.NexusNota = {
    LIMITE: LIMITE,
    MSG_SERVIDOR: MSG_SERVIDOR,
    passou: passou,
    ligar: ligar
  };
})();
