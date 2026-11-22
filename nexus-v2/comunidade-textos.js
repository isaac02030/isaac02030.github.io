/* Idade no cadastro, comunidade, denúncia, post escondido e área da equipe.
   Todos os textos destas telas ficam aqui, num lugar só, para trocar fácil.
   O cadastro (index.html), a comunidade, a área da equipe e a linha extra da
   tela de ajuda (crise.html, só depois de uma denúncia) leem daqui.

   Textos aprovados na spec da Clara (visual/spec-cadastro-idade-denuncia.md),
   com os ajustes decididos: «Obrigado por avisar»; sem caixa de 18+ para conta
   antiga (só o aviso); o aviso ao autor nunca diz quantas denúncias houve.
   Os marcados como NOVOS no fim ainda esperam aprovação. */

(function () {
  var LIMITE = 280;

  var TEXTOS = {
    /* Cadastro: data de nascimento. */
    dataLegenda: "Data de nascimento",
    dataDia: "Dia",
    dataMes: "Mês",
    dataAno: "Ano",
    dataAjuda: "O Nexus é para maiores de 18 anos. A data serve só para conferir isso e não fica guardada.",
    dataErro: "Confira a data. Exemplo: 07 / 03 / 1995.",
    menorTitulo: "Ainda não dá para criar sua conta",
    menorTexto: "O Nexus é para maiores de 18 anos. Nada foi guardado. Você pode voltar quando fizer 18.",
    menorVoltar: "Voltar ao início",
    cadastroIndisponivel: "Não foi possível criar a conta agora. Tente mais tarde.",

    /* Comunidade sem a confirmação de idade (403 adult_confirmation_required). */
    idadeTitulo: "Antes de entrar na comunidade",
    idadeAviso: "Sua conta ainda não tem a confirmação de idade. Crie a conta com a data de nascimento para usar a comunidade.",
    agoraNao: "Agora não",

    /* Denúncia. */
    denunciar: "Denunciar",
    denunciaTitulo: "Por que você quer denunciar?",
    explicarRotulo: "Quer explicar?",
    explicarOpcional: "(opcional)",
    enviarDenuncia: "Enviar denúncia",
    enviandoDenuncia: "Enviando…",
    cancelar: "Cancelar",
    denunciaOk: "Recebemos sua denúncia. Obrigado por avisar.",
    denunciaRepetida: "Você já denunciou este post.",
    denunciaErro: "Não foi possível enviar. Tente de novo.",
    denunciaSemRede: "Sem internet. A denúncia não foi enviada.",
    denunciaIndisponivel: "Não foi possível enviar agora. Tente mais tarde.",
    denunciaCrise: "Sua denúncia foi recebida. Se você está passando por um momento difícil, há quem possa ajudar agora.",

    /* Aviso ao autor do post escondido. */
    escondidoTitulo: "Este post está escondido por enquanto.",
    escondidoMotivo: "Motivo mais citado: {motivo}",
    escondidoEquipe: "Uma pessoa da equipe vai conferir. Ninguém além de você vê este post.",

    /* Área da equipe. */
    soEquipe: "Esta área é só da equipe.",
    prioridadeAlta: "Perigoso, conferir primeiro",
    alertaRepetido: "Atenção: quem ajudou a esconder este post escondeu vários posts hoje. Confira se a denúncia é justa.",
    restaurar: "Restaurar",
    apagar: "Apagar",
    /* Confirmações: título curto + explicação em corpo normal (revisão da Clara).
       Apagar: as mesmas palavras da spec, só divididas. Restaurar: texto novo da Clara, sem «feed». */
    restaurarTitulo: "Restaurar este post?",
    restaurarCorpo: "Ele volta para a comunidade. Só denúncias novas poderão escondê-lo de novo.",
    apagarTitulo: "Apagar este post para sempre?",
    apagarCorpo: "Isso não dá para desfazer.",
    adminVazio: "Nenhum post escondido agora.",

    /* 503 (migração ainda não aplicada no servidor). */
    indisponivel: "Esta parte ainda não está disponível. Tente mais tarde.",
    tentarDeNovo: "Tentar de novo",

    /* NOVOS: não estão na spec. Esperam a Clara e o sim do dono do projeto. */
    comunidadesTitulo: "Comunidades",
    comunidadesVazio: "Nenhuma comunidade por enquanto.",
    abrindo: "Abrindo…",
    comunidadeErro: "Não foi possível abrir a comunidade. Tente de novo.",
    semRede: "Sem internet. Tente de novo quando a conexão voltar.",
    feedVazio: "Ainda não há posts nesta comunidade.",
    feedFechado: "Você ainda não pode ver os posts desta comunidade.",
    voce: "Você",
    adminTitulo: "Posts escondidos",
    adminErro: "Não foi possível abrir a lista. Tente de novo.",
    acaoErro: "Não foi possível concluir. Tente de novo.",
    acaoSemRede: "Sem internet. Nada mudou. Tente de novo quando a conexão voltar.",
    restaurado: "Post restaurado.",
    apagado: "Post apagado."
  };

  /* Motivos da folha de denúncia. O código é o do servidor (PR 18). */
  var MOTIVOS = [
    { codigo: "perigoso", rotulo: "Conselho perigoso para a saúde", autor: "conselho perigoso para a saúde" },
    { codigo: "ofensa", rotulo: "Ofensa ou desrespeito", autor: "ofensa" },
    { codigo: "improprio", rotulo: "Conteúdo impróprio (sexual ou violento)", autor: "conteúdo impróprio" },
    { codigo: "spam", rotulo: "Spam", autor: "spam" },
    { codigo: "outro", rotulo: "Outro motivo", autor: "outro motivo" }
  ];

  /* Frases do servidor que o site reconhece (para pôr o erro no lugar certo). */
  var DO_SERVIDOR = {
    dataFalta: "Falta a data de nascimento. Preencha e envie de novo.",
    dataInvalida: "A data de nascimento não parece certa. Use o formato dia, mês e ano e envie de novo.",
    tokenInvalido: "Token inválido ou expirado.",
    codigoIdade: "adult_confirmation_required"
  };

  function preencher(modelo, valores) {
    return modelo.replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(valores, chave) ? String(valores[chave]) : "";
    });
  }

  function motivo(codigo) {
    for (var i = 0; i < MOTIVOS.length; i++) {
      if (MOTIVOS[i].codigo === codigo) return MOTIVOS[i];
    }
    return null;
  }

  /* Linha do motivo para o autor. Sem motivo conhecido, nada. Nunca a contagem. */
  function linhaDoMotivo(codigo) {
    var achado = motivo(codigo);
    return achado ? preencher(TEXTOS.escondidoMotivo, { motivo: achado.autor }) : "";
  }

  /* Só a forma: dia, mês e ano que existem. Quem decide a idade é o servidor.
     Devolve "AAAA-MM-DD" ou "" se a data não existe. */
  function dataDeNascimento(dia, mes, ano) {
    var d = String(dia || "").trim();
    var m = String(mes || "").trim();
    var a = String(ano || "").trim();
    if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m) || !/^\d{4}$/.test(a)) return "";
    var nd = Number(d);
    var nm = Number(m);
    var na = Number(a);
    if (na < 1000 || nm < 1 || nm > 12 || nd < 1) return "";
    var data = new Date(Date.UTC(na, nm - 1, nd));
    if (data.getUTCFullYear() !== na || data.getUTCMonth() !== nm - 1 || data.getUTCDate() !== nd) return "";
    return a + "-" + (nm < 10 ? "0" : "") + nm + "-" + (nd < 10 ? "0" : "") + nd;
  }

  /* Preenche [data-texto-comunidade="chave"] com o texto aprovado. */
  function aplicar(raiz) {
    var lista = (raiz || document).querySelectorAll("[data-texto-comunidade]");
    for (var i = 0; i < lista.length; i++) {
      var chave = lista[i].getAttribute("data-texto-comunidade");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave)) lista[i].textContent = TEXTOS[chave];
    }
  }

  window.NexusComunidade = {
    TEXTOS: TEXTOS,
    MOTIVOS: MOTIVOS,
    DO_SERVIDOR: DO_SERVIDOR,
    LIMITE: LIMITE,
    preencher: preencher,
    motivo: motivo,
    linhaDoMotivo: linhaDoMotivo,
    dataDeNascimento: dataDeNascimento,
    aplicar: aplicar
  };
})();
