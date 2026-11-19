/* Exemplo de IA. Só entra na página quando o host é localhost ou 127.0.0.1.
   Em outro host, grande-irmao.html não carrega este arquivo. */

var NexusDevIa = {
  exemplo: function () {
    return {
      source: "ai",
      text: "EXEMPLO — texto de IA fictício.",
      canContinue: true
    };
  }
};
