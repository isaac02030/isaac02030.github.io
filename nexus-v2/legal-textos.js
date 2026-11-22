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
  /* Fonte única da versão e da data em que ela passa a valer: o cadastro, a
     reaceitação e as páginas termos.html e privacidade.html (geradas a partir
     daqui) usam estas três linhas. */
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
    reaceiteTexto: "Para continuar, leia e aceite as versões novas. Elas valem a partir de " + DATA_VERSAO + ".",
    continuar: "Continuar",
    continuando: "Enviando…",
    sairDaConta: "Sair da conta",

    /* Aprovados (PR 28 do servidor). versaoMudou foi ajustado na revisão da
       Clara (no app instalado não há botão de recarregar): o servidor ainda
       manda «…Recarregue a página…» no campo error; o site mostra este texto
       pelo code legal_version_outdated. Igualar o servidor num PR pequeno. */
    erroCadastro: "Para criar a conta, marque que você leu e aceita os termos e a política de privacidade.",
    erroReaceite: "Para continuar, marque que você leu e aceita os termos e a política de privacidade.",
    versaoMudou: "Os termos ou a política de privacidade mudaram. Atualize a página (ou feche e abra o app) para ver a versão atual e aceite de novo.",
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
