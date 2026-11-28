/* Textos e regras puras da Maratona, num lugar só.
   Segue o padrão de comunidade-textos.js: a tela não inventa frase no meio do
   código e nenhum nome de pessoa entra na tela.

   Decisões que valem mais que a spec antiga: sem «·», sem botão de sair, sem
   ranking individual, sem urso e sem barra colorida em cartão. A luz é o
   botão principal, mais a trilha quando ela é o assunto da tela. */

(function () {
  var C = window.NexusComunidade;
  var COMUM = C && C.TEXTOS ? C.TEXTOS : {};

  var TEXTOS = {
    /* Linha dentro da comunidade. */
    maratona: "Maratona",
    maratonaPrefixo: "Maratona: ",
    listaTitulo: "Maratonas da comunidade",
    criarLinha: "Criar uma maratona",
    comecaEmUm: "Começa em 1 dia",
    comecaEm: "Começa em {n} dias",
    diaDe: "Dia {n} de {m}",
    entrarNaMaratona: "Entrar na maratona",
    ver: "Ver",
    dialogoTitulo: "Entrar na maratona?",
    dialogoTexto: "É uma missão do grupo. Você cumpre o mínimo de cada dia e o grupo vê o total.",
    semMaratona: "Nenhuma maratona aberta nesta comunidade.",

    /* Tela da maratona. */
    abrindo: "Abrindo a maratona…",
    abrindoErro: "Não deu para abrir a maratona agora. Tente de novo daqui a pouco.",
    minimoRotulo: "Mínimo de cada dia",
    registroAntes: "A maratona ainda não começou. O registro abre no primeiro dia.",
    feitoHoje: "Seu dia de hoje: feito.",
    pendenteHoje: "Seu dia de hoje: ainda falta.",
    registrarDia: "Registrar o dia",
    registrando: "Registrando…",
    registrado: "Dia registrado.",
    grupoHojeUm: "Hoje, {feitos} de {total} pessoa cumpriu o dia.",
    grupoHoje: "Hoje, {feitos} de {total} pessoas cumpriram o dia.",
    trilhaResumo: "Trilha da maratona. Dia {n} de {m}. Hoje, {feitos} de {total} pessoas cumpriram o dia.",
    trilhaResumoAntes: "Trilha da maratona. Começa em {n} dias.",
    alterarDia: "Você já registrou o dia de hoje na maratona.",
    encerrada: "Esta maratona já terminou.",
    cheia: "Esta maratona já está cheia.",
    naoParticipa: "Entre na maratona para registrar o dia.",

    /* Criar. */
    criarTitulo: "Criar uma maratona",
    campoNome: "Nome da maratona",
    campoMinimo: "Mínimo de cada dia",
    campoDias: "Dias",
    campoPessoas: "Máximo de pessoas",
    campoInicio: "Dia de início (opcional)",
    campoInicioAjuda: "Escolha a data. Se ficar vazio, começa hoje.",
    criarBotao: "Criar maratona",
    criando: "Criando…",
    criada: "Maratona criada.",
    nomeAjuda: "Um nome que ajude o grupo a encontrar a maratona.",
    minimoAjuda: "O que cada pessoa precisa fazer por dia.",
    jaCriou: "Você já tem uma maratona aberta nesta comunidade. Quando ela terminar, você pode criar outra.",

    /* Respostas do servidor que valem como texto pronto. */
    entrou: "Você entrou na maratona.",
    jaRegistrou: "Você já registrou o dia de hoje na maratona.",
    semParticipar: "Entre na comunidade para participar da maratona.",
    indisponivel: "A maratona ainda não está disponível. Tente de novo mais tarde.",
    erroGenerico: "Não deu para concluir agora. Tente de novo daqui a pouco.",

    /* O servidor fala em «caracteres»; aqui o limite está no contador do campo. */
    nomeFalta: "Dê um nome à maratona.",
    minimoFalta: "Escreva o mínimo de cada dia.",
    diasFalta: "A maratona dura de 3 a 30 dias.",
    pessoasFalta: "A maratona aceita de 2 a 100 pessoas.",
    inicioFalta: "Escolha um dia de início entre hoje e daqui a 14 dias.",

    /* Palavras já aprovadas nas outras telas vêm de comunidade-textos.js. */
    voltar: COMUM.voltar,
    agoraNao: COMUM.agoraNao,
    entrar: COMUM.entrar,
    cancelar: COMUM.cancelar,
    tentarDeNovo: COMUM.tentarDeNovo,
    semRede: COMUM.semRede,
    idadeAviso: COMUM.idadeAviso,
    soLeitura: COMUM.soLeitura
  };

  function preencher(modelo, valores) {
    return String(modelo || "").replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(valores || {}, chave) ? String(valores[chave]) : "";
    });
  }

  function contarPessoas(n) {
    if (C && typeof C.contarPessoas === "function") return C.contarPessoas(n);
    var total = Number(n) || 0;
    return total === 1 ? "1 pessoa" : total + " pessoas";
  }

  /* A lista manda day_number (-1 antes de começar); o detalhe manda day e
     starts_in_days. Nenhuma das duas respostas é convertida em data do aparelho. */
  function quando(maratona) {
    if (!maratona) return "";
    var duracao = Number(maratona.duration_days) || 0;
    var bruto = maratona.day != null ? Number(maratona.day) : Number(maratona.day_number);
    var fase = maratona.phase || "";
    if (fase === "ended") return "";
    if (fase === "upcoming" || !(bruto >= 1)) {
      var n = maratona.starts_in_days != null ? Number(maratona.starts_in_days) : 1 - (isNaN(bruto) ? 0 : bruto);
      if (!(n > 0)) return "";
      return n === 1 ? TEXTOS.comecaEmUm : preencher(TEXTOS.comecaEm, { n: n });
    }
    if (!duracao || isNaN(bruto) || bruto < 1) return "";
    return preencher(TEXTOS.diaDe, { n: Math.min(bruto, duracao), m: duracao });
  }

  /* Quem saiu da comunidade sai da lista de participantes, mas os dias que
     marcou continuam no total do grupo. A tela nunca mostra mais gente tendo
     cumprido o dia do que gente participando (o caso «9 de 8»). */
  function contagemDoGrupo(grupo) {
    var g = grupo || {};
    var total = Math.max(0, Number(g.participants) || 0);
    var feitos = Math.max(0, Number(g.today_done) || 0);
    return { total: total, feitos: Math.min(feitos, total) };
  }

  /* Progresso do grupo, nunca nota individual. «p» quer dizer pouca gente:
     forma diferente, nunca vermelho e nunca apelido. */
  function estadosDaTrilha(maratona, grupo) {
    var m = maratona || {};
    var g = grupo || {};
    var duracao = Math.max(1, Number(m.duration_days) || 7);
    var fase = m.phase || "upcoming";
    var hoje = fase === "active" ? Math.max(1, Math.min(duracao, Number(m.day) || 1)) : (fase === "ended" ? duracao + 1 : 0);
    var total = Math.max(1, contagemDoGrupo(g).total);
    var contagens = {};
    (Array.isArray(g.days) ? g.days : []).forEach(function (dia) {
      if (dia) contagens[Number(dia.day)] = Math.min(Math.max(0, Number(dia.done) || 0), total);
    });
    var lista = [];
    for (var dia = 1; dia <= duracao; dia++) {
      var feitos = contagens[dia] || 0;
      var estado;
      /* Antes do início a trilha é só caminho: contorno vazio, sem lápis,
         sem falta e sem ponta acesa. */
      if (fase === "upcoming") estado = "o";
      else if (hoje > 0 && dia > hoje) estado = "o";
      else if (feitos === 0) estado = "x";
      else if (feitos * 2 < total) estado = "p";
      else estado = "f";
      lista.push({ dia: dia, estado: estado, hoje: dia === hoje, feitos: feitos });
    }
    lista.forEach(function (item, i) {
      if (i === lista.length - 1) {
        item.link = "lk-fim";
        return;
      }
      var proximo = lista[i + 1];
      var ligado = (item.estado === "f" || item.estado === "p") &&
        (proximo.estado === "f" || proximo.estado === "p") && proximo.dia <= hoje;
      item.link = ligado ? (proximo.hoje ? "lk-on" : "lk-dim") : "";
    });
    return lista;
  }

  /* Texto do servidor no lugar certo. Só os códigos de limite são trocados:
     o contador do campo já mostra o número. */
  function erroDoServidor(codigo, erro) {
    if (codigo === "invalid_title") return TEXTOS.nomeFalta;
    if (codigo === "invalid_minimum") return TEXTOS.minimoFalta;
    if (codigo === "invalid_days") return TEXTOS.diasFalta;
    if (codigo === "invalid_people") return TEXTOS.pessoasFalta;
    if (codigo === "invalid_start") return TEXTOS.inicioFalta;
    if (codigo === "open_marathon") return TEXTOS.jaCriou;
    if (codigo === "already_done") return TEXTOS.alterarDia;
    if (codigo === "ended") return TEXTOS.encerrada;
    if (codigo === "full") return TEXTOS.cheia;
    if (codigo === "not_participant") return TEXTOS.naoParticipa;
    if (codigo === "not_member") return TEXTOS.semParticipar;
    if (codigo === "unavailable") return TEXTOS.indisponivel;
    /* Código desconhecido nunca mostra texto cru do servidor na tela. */
    return TEXTOS.erroGenerico;
  }

  function aplicar(raiz) {
    var lista = (raiz || document).querySelectorAll("[data-texto-maratona]");
    for (var i = 0; i < lista.length; i++) {
      var chave = lista[i].getAttribute("data-texto-maratona");
      if (Object.prototype.hasOwnProperty.call(TEXTOS, chave) && TEXTOS[chave] != null) {
        lista[i].textContent = TEXTOS[chave];
      }
    }
  }

  window.NexusMaratonaTextos = {
    TEXTOS: TEXTOS,
    preencher: preencher,
    contarPessoas: contarPessoas,
    quando: quando,
    contagemDoGrupo: contagemDoGrupo,
    estadosDaTrilha: estadosDaTrilha,
    erroDoServidor: erroDoServidor,
    aplicar: aplicar
  };
})();
