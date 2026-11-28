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
    alertaRepetido: "Atenção: quem escondeu este post escondeu vários hoje. Confira se a denúncia é justa.",
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
    apagado: "Post apagado.",

    /* NOVOS (telas da comunidade, 1.ª parte: spec da Clara de 27/11 e rotas
       dos PRs 40 a 44 do servidor). Esperam a Clara e o sim do dono do projeto.
       As frases que já vêm aprovadas do servidor estão marcadas com (srv). */

    /* Áreas. */
    areasRotulo: "Áreas",
    areaMente: "Mente",
    areaCorpo: "Corpo",
    areaRotina: "Rotina",

    /* Lista por área. */
    abrindoComunidades: "Abrindo as comunidades…",
    listaErro: "Não foi possível abrir as comunidades. Tente de novo.",
    listaSemRede: "Sem internet. As comunidades não abriram.",
    recomendadas: "Recomendadas para você",
    todasDe: "Todas de {area}",
    umaPessoa: "1 pessoa",
    pessoas: "{n} pessoas",
    entrar: "Entrar",
    entrando: "Entrando…",
    participa: "Você participa",
    sairDaComunidade: "Sair da comunidade",
    sairTitulo: "Sair da comunidade?",
    sairConfirmar: "Sair",
    sairErro: "Não foi possível sair agora. Tente de novo.",
    sairSemRede: "Sem internet. Você ainda participa.",
    entrarErro: "Não foi possível entrar agora. Tente de novo.",
    entrarSemRede: "Sem internet. Você ainda não entrou.",
    semMissaoLer: "Sem missão ativa você pode ler, mas não postar.",
    comecarMissao: "Começar uma missão",
    areaVazia: "Ainda não há comunidades nesta área.",
    criarLinha: "Criar uma comunidade",

    /* Comunidade por dentro. */
    voltar: "Voltar",
    escrevaDica: "Escreva uma dica ou pergunta",
    publicar: "Publicar",
    publicando: "Publicando…",
    publicado: "Post publicado.",
    postVazio: "Escreva alguma coisa antes de publicar.",
    postLimite: "Você já postou 3 vezes hoje. Volte amanhã.",
    postErro: "Não foi possível publicar agora. Tente de novo.",
    postSemRede: "Sem internet. O post não foi publicado.",
    soLeitura: "Aqui, por enquanto, só dá para ler.",
    faixaAlimentacao: "Aqui valem dicas. Promessa de emagrecer e números extremos não.",
    paraPostarEntre: "Para postar, entre na comunidade.",
    precisaMissao: "Para postar aqui você precisa de uma missão ativa em {area}.", /* (srv) */
    comecarMissaoDe: "Começar uma missão de {area}",
    outraArea: "Sua missão ativa é de {outra}. Esta comunidade é de {area}.", /* (srv) */
    verComunidadesDe: "Ver comunidades de {area}",
    irParaMissao: "Ver a missão",
    destaques: "Destaques da semana",
    recentes: "Recentes",
    verMais: "Ver mais",
    verMenos: "Ver menos",
    verAnteriores: "Ver anteriores",
    carregandoMais: "Carregando…",
    rolarSozinha: "Registre o dia para a lista rolar sozinha.", /* (srv) */
    irParaHoje: "Ir para Hoje",
    maisErro: "Não foi possível carregar mais. Tente de novo.",
    maisCursor: "Não deu para carregar mais posts. Abra a comunidade de novo.", /* (srv) */
    maisSemRede: "Sem internet. Nada novo carregou.",
    maisCarregados: "{n} posts carregados.",
    postsVaziosEscreva: "Ainda não há posts. Escreva o primeiro.",
    postsVazios: "Ainda não há posts.",
    apoiar: "Apoiar",
    umApoio: "1 apoio",
    apoios: "{n} apoios",
    apoiarRotulo: "Apoiar, {apoios}",
    apoioProprio: "Você não pode apoiar o seu próprio post.", /* (srv) */
    apoioErro: "Não foi possível apoiar agora. Tente de novo.",
    apoioSemRede: "Sem internet. O apoio não mudou.",
    agora: "agora",
    minutos: "{n} min",
    horas: "{n} h",
    dias: "{n} d",
    meritoERanking: "Meu mérito",

    /* Criar comunidade. */
    criarTitulo: "Criar uma comunidade",
    criarBloqueado: "Criar uma comunidade abre depois que você concluir uma missão de 30 dias.", /* (srv) */
    criarDia: "Sua missão: dia {n} de 30.",
    campoNome: "Nome",
    campoArea: "Área",
    campoAssunto: "Assunto",
    campoAssuntoAjuda: "Por exemplo: filosofia.",
    campoRegras: "Regras da comunidade",
    campoIcone: "Ícone",
    campoIconeAjuda: "Um emoji só. Ele aparece ao lado do nome.",
    opcional: "(opcional)",
    criarBotao: "Criar comunidade",
    criando: "Criando…",
    criada: "Você criou esta comunidade. Denúncias vão para a equipe do Nexus.", /* (srv) */
    abrirComunidade: "Abrir a comunidade",
    nomeFalta: "Dê um nome à comunidade, com até 40 caracteres.", /* (srv) */
    areaFalta: "Escolha uma área: Mente, Corpo ou Rotina.", /* (srv) */
    iconeInvalido: "O ícone precisa ser um emoji. Escolha outro e envie de novo.", /* (srv) */
    nomeRepetido: "Já existe uma comunidade com esse nome.", /* (srv) */
    criarErro: "Não foi possível criar agora. Tente de novo.",
    criarSemRede: "Sem internet. A comunidade não foi criada.",

    /* Mérito e ranking. */
    meritoTitulo: "Meu mérito",
    continuar: "Continuar",
    novoTitulo: "Novo título",
    abrindoMerito: "Abrindo o mérito…",
    meritoErro: "Não deu para abrir o mérito agora. Tente de novo daqui a pouco.", /* (srv) */
    meritoSemRede: "Sem internet. O mérito não abriu.",
    semTitulo: "Ainda sem título",
    semTituloTexto: "O primeiro título, Iniciante, vem com 1 missão de 30 dias concluída.",
    umaMissaoConcluida: "1 missão concluída",
    missoesConcluidas: "{n} missões concluídas",
    proximo: "Próximo: {nome}, com {n} missões. Faltam\u00A0{f}.",
    proximoFalta1: "Próximo: {nome}, com {n} missões. Falta\u00A01.",
    noTopo: "Este é o último título.",
    titulos: "Títulos",
    seuTitulo: "Seu título",
    umaMissao: "1 missão",
    missoes: "{n} missões",
    marcas: "{n} de 5 marcas",
    rankingDe: "Ranking de {nome}",
    posicao: "{n}.º",
    voceNoRanking: "Você",
    rankingVazio: "Ninguém aqui concluiu uma missão de 30 dias ainda.",
    rankingForaVoce: "Você entra no ranking quando concluir uma missão de 30 dias.",
    regraMerito: "Vale o número de missões. No empate, o tempo na comunidade.", /* (srv) */
    tituloMissoes: "{titulo}, {missoes}",
    entrouHoje: "entrou hoje",
    umDia: "1 dia",
    variosDias: "{n} dias",
    umMes: "1 mês",
    variosMeses: "{n} meses",
    umAno: "1 ano",
    variosAnos: "{n} anos",
    pontosEMoedas: "Pontos de esforço e moedas",
    aindaNao: "Ainda não disponível",

    /* NOVOS (fila do beta, item 4; PR 50 do servidor). Comentários são uma
       lista chata, sem respostas aninhadas. As frases do servidor (limite,
       crise, escondido) chegam na resposta e entram por textContent. */
    comentarios: "Comentários",
    comentariosAbrindo: "Abrindo comentários…",
    comentariosVazios: "Ainda não há comentários. Comece a conversa.",
    comentariosErro: "Não foi possível abrir os comentários. Tente de novo.",
    comentariosSemRede: "Sem internet. Os comentários não abriram.",
    comentariosSoLeitura: "Você pode ler os comentários, mas não escrever.",
    escrevaComentario: "Escreva um comentário",
    enviarComentario: "Enviar comentário",
    enviandoComentario: "Enviando…",
    comentarioEnviado: "Comentário enviado.",
    comentarioVazio: "Escreva alguma coisa antes de enviar.",
    comentarioErro: "Não foi possível enviar agora. Tente de novo.",
    comentarioSemRede: "Sem internet. O comentário não foi enviado.",
    comentarioLimite: "Você já enviou 10 comentários nas últimas 24 horas. Tente de novo mais tarde.",
    comentarioIndisponivel: "Os comentários ainda não estão disponíveis. Tente mais tarde.",
    comentarioEscondido: "Seu comentário foi escondido por enquanto.",
    comentarioEscondidoEquipe: "Ninguém além de você vê este comentário.",
    umComentario: "1 comentário",
    variosComentarios: "{n} comentários",
    apoioComentario: "Apoiar",
    apoioComentarioRotulo: "Apoiar comentário, {apoios}",
    apoioComentarioErro: "Não foi possível apoiar agora. Tente de novo.",
    apoioComentarioSemRede: "Sem internet. O apoio não foi registrado.",
    apoioComentarioProprio: "Você não pode apoiar o seu próprio comentário.",
    denunciaComentarioTitulo: "Denunciar comentário",
    fecharComentarios: "Fechar comentários",
    /* Compartilhar: o botão do celular abre o link da comunidade. */
    compartilhar: "Compartilhar",
    compartilharPost: "Compartilhar post",
    compartilharTitulo: "Post da comunidade no Nexus",
    linkCopiado: "Link copiado.",
    compartilharErro: "Não foi possível compartilhar agora.",
    /* Rodapé do post: o nome acessível do menu que guarda as ações discretas
       quando o rodapé não cabe (revisão da Clara das 03:05). */
    maisOpcoes: "Mais opções"
  };

  /* Áreas fixas do servidor (lib/community-access.js). */
  var AREAS = [
    { codigo: "mente", chave: "areaMente" },
    { codigo: "corpo", chave: "areaCorpo" },
    { codigo: "rotina", chave: "areaRotina" }
  ];

  /* Títulos do mérito (decisão de 27/11, opção A). Só para a lista da tela
     «Meu mérito»; o título de cada pessoa vem pronto do servidor. */
  var TITULOS = [
    { nome: "Iniciante", min: 1, nivel: 1 },
    { nome: "Praticante", min: 3, nivel: 2 },
    { nome: "Constante", min: 6, nivel: 3 },
    { nome: "Veterano", min: 12, nivel: 4 },
    { nome: "Referência", min: 24, nivel: 5 }
  ];

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

  /* Aviso ao autor do comentário escondido: uma frase corrida, sem ícone e
     sem contagem. O motivo vem do servidor; o resto é texto aprovado. */
  function textoDoComentarioEscondido(comentario) {
    var partes = [TEXTOS.comentarioEscondido];
    var linha = linhaDoMotivo(comentario && comentario.hidden_reason);
    if (linha) partes.push(linha.replace(/\s*$/, "") + ".");
    partes.push(TEXTOS.comentarioEscondidoEquipe);
    return partes.join(" ");
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

  /* ---------- Ajudantes das telas novas (sem relógio escondido: "agora" entra como parâmetro) ---------- */

  function areaValida(codigo) {
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].codigo === codigo) return true;
    }
    return false;
  }

  function nomeDaArea(codigo) {
    for (var i = 0; i < AREAS.length; i++) {
      if (AREAS[i].codigo === codigo) return TEXTOS[AREAS[i].chave];
    }
    return "";
  }

  function inteiro(valor) {
    var n = Number(valor);
    return isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function contarPessoas(valor) {
    var n = inteiro(valor);
    return n === 1 ? TEXTOS.umaPessoa : preencher(TEXTOS.pessoas, { n: n });
  }

  function contarApoios(valor) {
    var n = inteiro(valor);
    return n === 1 ? TEXTOS.umApoio : preencher(TEXTOS.apoios, { n: n });
  }

  function contarComentarios(valor) {
    var n = inteiro(valor);
    return n === 1 ? TEXTOS.umComentario : preencher(TEXTOS.variosComentarios, { n: n });
  }

  function contarMissoes(valor) {
    var n = inteiro(valor);
    return n === 1 ? TEXTOS.umaMissao : preencher(TEXTOS.missoes, { n: n });
  }

  function missoesConcluidas(valor) {
    var n = inteiro(valor);
    return n === 1 ? TEXTOS.umaMissaoConcluida : preencher(TEXTOS.missoesConcluidas, { n: n });
  }

  /* «Próximo: Constante, com 6 missões. Faltam 3.» Sem próximo: o topo. */
  function linhaDoProximo(proximo) {
    if (!proximo || typeof proximo.name !== "string") return TEXTOS.noTopo;
    var falta = inteiro(proximo.missing);
    var modelo = falta === 1 ? TEXTOS.proximoFalta1 : TEXTOS.proximo;
    return preencher(modelo, { nome: proximo.name, n: inteiro(proximo.missions), f: falta });
  }

  /* Tempo do post: «agora», «12 min», «3 h», «2 d». */
  function tempoCurto(valor, agora) {
    var data = new Date(valor);
    if (!valor || isNaN(data.getTime())) return "";
    var ms = (agora && typeof agora.getTime === "function" ? agora.getTime() : Date.now()) - data.getTime();
    var min = Math.floor(ms / 60000);
    if (min < 1) return TEXTOS.agora;
    if (min < 60) return preencher(TEXTOS.minutos, { n: min });
    var h = Math.floor(min / 60);
    if (h < 24) return preencher(TEXTOS.horas, { n: h });
    return preencher(TEXTOS.dias, { n: Math.floor(h / 24) });
  }

  /* Tempo na comunidade (dias inteiros do servidor): dias, meses ou anos. */
  function tempoNaComunidade(dias) {
    var d = inteiro(dias);
    if (d < 1) return TEXTOS.entrouHoje;
    if (d < 30) return d === 1 ? TEXTOS.umDia : preencher(TEXTOS.variosDias, { n: d });
    if (d < 365) {
      var m = Math.floor(d / 30);
      return m === 1 ? TEXTOS.umMes : preencher(TEXTOS.variosMeses, { n: m });
    }
    var a = Math.floor(d / 365);
    return a === 1 ? TEXTOS.umAno : preencher(TEXTOS.variosAnos, { n: a });
  }

  /* Ícone da comunidade: só emoji, a mesma regra do servidor (isEmojiIcon). */
  var SO_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️|[\u{1F3FB}-\u{1F3FF}])+$/u;
  function iconeValido(valor) {
    return typeof valor === "string" && valor.length >= 1 && valor.length <= 8 &&
      SO_EMOJI.test(valor) && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(valor);
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
    textoDoComentarioEscondido: textoDoComentarioEscondido,
    dataDeNascimento: dataDeNascimento,
    aplicar: aplicar,
    AREAS: AREAS,
    TITULOS: TITULOS,
    areaValida: areaValida,
    nomeDaArea: nomeDaArea,
    contarPessoas: contarPessoas,
    contarApoios: contarApoios,
    contarComentarios: contarComentarios,
    contarMissoes: contarMissoes,
    missoesConcluidas: missoesConcluidas,
    linhaDoProximo: linhaDoProximo,
    tempoCurto: tempoCurto,
    tempoNaComunidade: tempoNaComunidade,
    iconeValido: iconeValido
  };
})();
