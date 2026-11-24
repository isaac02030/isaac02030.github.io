/* Seus dados: a pergunta da nota no check-in, Meus dados, a confirmação dos
   lembretes no começo da missão e a exclusão da conta. Todos os textos
   destas partes ficam aqui, num lugar só (data-texto-dados="chave").

   Aprovados pelo dono do projeto:
   - PR 27 do servidor: carregarEscolhaErro, guardarEscolhaErro, desligarApaga;
   - PR 29 do servidor: carregarAvisosErro, salvarErro, querLembretes;
   - PR 26 do servidor: excluirAdmin, excluirMuitas.
   Os da spec da Clara (visual/spec-aceite-legal.md, seções 2 e 3) e os
   marcados como NOVOS esperam o sim junto com este PR. */

(function () {
  var TEXTOS = {
    /* Check-in: a pergunta da nota (spec, seção 2). */
    perguntaTitulo: "Guardar suas notas?",
    perguntaTexto: "Ao registrar o dia, você escreve uma nota curta. Podemos guardá-la para você rever depois. A nota pode falar de saúde, treino ou humor, por isso só guardamos se você deixar.",
    perguntaTexto2: "Se disser não, o registro funciona igual. A nota só não fica guardada.",
    sim: "Sim, guardar minhas notas",
    nao: "Não guardar",
    comoTratamos: "Como tratamos seus dados",
    apoioSim: "Esta nota será guardada. Você muda isso em Ajustes › Meus dados.",
    apoioNao: "Esta nota não será guardada. Você muda isso em Ajustes › Meus dados.",
    escolhaSemRede: "Sem internet. Sua escolha não foi enviada.",
    guardarEscolhaErro: "Não foi possível guardar sua escolha. Tente de novo.",
    carregarEscolhaErro: "Não foi possível carregar sua escolha sobre as notas. Tente de novo.",

    /* Ajustes › Meus dados (spec, seção 3). */
    linhaMeusDados: "Meus dados",
    titulo: "Meus dados",
    voltar: "Voltar",
    aceitesTitulo: "Seus aceites",
    termosRotulo: "Termos de uso",
    privacidadeRotulo: "Política de privacidade",
    /* Hora do servidor mostrada em Lisboa, com o fuso escrito (revisão da Clara). */
    aceitoEm: "versão {versao}, aceita em {data} (hora de Lisboa)",
    semAceite: "Sem registro de aceite.",
    ler: "Ler",
    ligadoTitulo: "O que você deixou ligado",
    notasRotulo: "Guardar minhas notas",
    notasApoio: "As notas do registro diário ficam guardadas para você rever. Desligado: o registro funciona igual e a nota não é guardada.",
    desligarApaga: "Desligar apaga as notas já guardadas.",
    lembretesRotulo: "Lembretes do registro diário",
    lembretesApoio: "Avisos neste aparelho no horário que você escolheu.",
    lembretesBloqueados: "O navegador bloqueou os avisos. Libere nas configurações do aparelho.",
    /* Estado real do aparelho com os lembretes ligados (revisão da Clara). */
    ligadoSemPermissao: "Ligado, mas este aparelho ainda não permitiu avisos.",
    ligadoBloqueado: "Ligado, mas o navegador bloqueou os avisos",
    ligadoSemSuporte: "Ligado, mas este navegador não mostra avisos",
    permitirAvisos: "Permitir avisos neste aparelho",
    /* Aparelho que não recebe avisos do navegador (revisão da Clara, PR 26). */
    lembretesSemSuporte: "No iPhone, só funciona com o Nexus adicionado à Tela de Início.",
    ligado: "Ligado",
    desligado: "Desligado",
    salvando: "Salvando…",
    notasLigou: "Pronto. Você ligou as notas.",
    notasDesligou: "Pronto. Você desligou as notas.",
    /* Revisão da Clara: desligar apaga as notas guardadas, com confirmação. */
    notasDesligouApagou: "Pronto. Você desligou as notas e apagou as que estavam guardadas.",
    desligarTitulo: "Desligar e apagar as notas guardadas?",
    /* NOVO: o corpo do diálogo. */
    desligarTexto: "As notas que você já guardou serão apagadas, e isso não dá para desfazer. O registro dos dias continua.",
    desligarConfirmar: "Desligar e apagar",
    /* NOVOS (mesmo molde dos de cima). */
    lembretesLigou: "Pronto. Você ligou os lembretes.",
    lembretesDesligou: "Pronto. Você desligou os lembretes.",
    /* Aviso de mensagem do chat (spec do chat, seção 4): começa desligado. */
    mensagensRotulo: "Avisos de mensagens do chat",
    mensagensApoio: "O aviso não mostra o que foi escrito. Só diz que há mensagem nova.",
    mensagensLigou: "Pronto. Você ligou os avisos de mensagens.",
    mensagensDesligou: "Pronto. Você desligou os avisos de mensagens.",
    salvarErro: "Não foi possível salvar. Tente de novo.",
    salvarSemRede: "Sem internet. A mudança não foi salva.",
    carregarAvisosErro: "Não foi possível carregar suas escolhas de avisos. Tente de novo.",
    /* NOVOS: abrir a tela, e quando ela não abre. */
    abrindo: "Abrindo seus dados…",
    carregarDadosErro: "Não foi possível abrir seus dados. Tente de novo.",
    carregarSemRede: "Sem internet. Seus dados não puderam ser abertos.",
    tentarDeNovo: "Tentar de novo",
    falarTitulo: "Falar sobre seus dados",
    /* {email} vira um link mailto: com o contato abaixo (meus-dados.js). */
    falarTexto: "Dúvidas ou pedidos sobre seus dados? Escreva para {email}.",
    /* Contato de privacidade (decisão do dono do projeto, 22/11). Fonte única:
       as páginas termos.html e privacidade.html são geradas com o mesmo. */
    contatoEmail: "nexusatendimento10@gmail.com",
    /* Prazo da Política de privacidade, seção 1. */
    falarPrazo: "Respondemos em até 15 dias.",

    /* Excluir conta (spec, seção 3). */
    excluirTitulo: "Excluir conta",
    excluirTexto: "Apaga sua conta e seus registros. Não dá para desfazer.",
    excluirBotao: "Excluir minha conta…",
    dialogoTitulo: "Excluir sua conta?",
    dialogoTexto: "Vamos apagar sua conta, suas missões, seus registros e suas notas. Isso não dá para desfazer.",
    /* NOVO: o que acontece no Duo (decisão do PR 26). */
    dialogoDuo: "Se você está num Duo, a outra pessoa continua com a missão.",
    senhaRotulo: "Digite sua senha para confirmar",
    cancelar: "Cancelar",
    excluirConfirmar: "Excluir minha conta",
    excluindo: "Excluindo…",
    excluirSenhaErrada: "Senha incorreta. Sua conta não foi excluída.",
    excluirSemSenha: "Digite sua senha para confirmar.",
    excluirSemRede: "Sem internet. Sua conta não foi excluída.",
    excluirFalha: "Não foi possível excluir agora. Tente de novo.",
    excluirMuitas: "Muitas tentativas com a senha errada. Sua conta não foi excluída. Tente de novo em 15 minutos.",
    excluirAdmin: "A conta de administração não pode ser excluída por aqui.",
    excluidaTitulo: "Sua conta foi excluída",
    excluidaTexto: "Seus dados serão apagados conforme a Política de privacidade.",
    lerPolitica: "Ler a Política de privacidade",
    voltarInicio: "Voltar ao início",

    /* Instrução do iPhone: a mesma em Ajustes e no começo da missão (revisão da Clara). */
    iphoneIntro: "No iPhone (iOS 16.4 ou mais novo), o aviso só chega com o Nexus na Tela de Início:",
    iphonePasso1: "Abra o Nexus no Safari.",
    iphonePasso2: "Toque em Compartilhar.",
    iphonePasso3: "Toque em “Adicionar à Tela de Início”.",

    /* Começo da missão, passo do aviso (decisão do PR 29). */
    querLembretes: "Quero receber lembretes do meu registro diário neste aparelho."
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
    (raiz || document).querySelectorAll("[data-texto-dados]").forEach(function (el) {
      var chave = el.getAttribute("data-texto-dados");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave)) el.textContent = TEXTOS[chave];
    });
  }

  window.NexusDados = { TEXTOS: TEXTOS, texto: texto, aplicar: aplicar };
})();
