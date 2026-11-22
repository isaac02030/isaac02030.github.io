/* Aceite dos Termos de uso e da Política de privacidade (cadastro e
   reaceitação). Todos os textos destas partes ficam aqui, num lugar só.
   O index.html preenche os elementos com data-texto-legal="chave".

   Versões: as mesmas do servidor (lib/legal-acceptance.js, PR 28):
   o cadastro e a reaceitação mandam estas duas. Ao publicar texto novo,
   o servidor e este arquivo sobem juntos.

   Textos aprovados (decisão de 22/11, PR 28 e PR 26 do servidor):
   erroCadastro, erroReaceite, versaoMudou, falhaAceite, sessaoEncerrada e
   sessaoIndisponivel. Os da spec da Clara (visual/spec-aceite-legal.md)
   esperam o sim junto com este PR. */

(function () {
  var VERSAO_TERMOS = "beta-1";
  var VERSAO_PRIVACIDADE = "beta-1";
  var DATA_VERSAO = "22/11/2026";

  var TEXTOS = {
    /* Cadastro: bloco obrigatório (spec da Clara, seção 1). */
    aceiteLegenda: "Termos e privacidade",
    aceiteCaixa: "Li e aceito os Termos de uso e a Política de privacidade.",
    lerTermos: "Ler os Termos de uso",
    lerPrivacidade: "Ler a Política de privacidade",
    aceiteApoio: "Guardamos a versão e a data do seu aceite. Versão atual: Termos " + VERSAO_TERMOS + ", Privacidade " + VERSAO_PRIVACIDADE + ".",

    /* Reaceitação (spec da Clara, «Contas que já existem»). */
    reaceiteTitulo: "Atualizamos os termos e a privacidade",
    reaceiteTexto: "Para continuar, leia e aceite as versões novas. Foram atualizadas em " + DATA_VERSAO + ".",
    continuar: "Continuar",
    continuando: "Enviando…",
    sairDaConta: "Sair da conta",

    /* Aprovados (PR 28 do servidor). */
    erroCadastro: "Para criar a conta, marque que você leu e aceita os termos e a política de privacidade.",
    erroReaceite: "Para continuar, marque que você leu e aceita os termos e a política de privacidade.",
    versaoMudou: "Os termos ou a política de privacidade mudaram. Recarregue a página para ver a versão atual e aceite de novo.",
    falhaAceite: "Não foi possível guardar seu aceite. Tente de novo.",

    /* Aprovados (PR 26 do servidor). Também ficam em api.js, que roda em
       todas as telas; a checagem confere que são iguais. */
    sessaoEncerrada: "Sessão encerrada. Entre de novo.",
    sessaoIndisponivel: "Não foi possível conferir sua sessão agora. Tente de novo em instantes."
  };

  /* Códigos que o servidor manda (PR 26 e PR 28). */
  var DO_SERVIDOR = {
    aceiteFaltando: "legal_acceptance_required",
    versaoAntiga: "legal_version_outdated"
  };

  function aplicar(raiz) {
    (raiz || document).querySelectorAll("[data-texto-legal]").forEach(function (el) {
      var chave = el.getAttribute("data-texto-legal");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave)) el.textContent = TEXTOS[chave];
    });
  }

  window.NexusLegal = {
    VERSAO_TERMOS: VERSAO_TERMOS,
    VERSAO_PRIVACIDADE: VERSAO_PRIVACIDADE,
    DATA_VERSAO: DATA_VERSAO,
    TEXTOS: TEXTOS,
    DO_SERVIDOR: DO_SERVIDOR,
    aplicar: aplicar
  };
})();
