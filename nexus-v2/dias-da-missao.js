/* Dias da missão: os dias fixos da semana em que a missão acontece.
   De 3 a 7 por semana (1 = segunda ... 7 = domingo, como no servidor).
   Os outros são dias livres: sem check-in, sem lembrete, não contam como falta.
   A missão continua com 30 dias corridos.

   Todos os textos desta escolha ficam aqui, num lugar só, para trocar fácil.
   O começo (onboarding), o Hoje, a Missão, o check-in e o dia difícil leem daqui. */

(function () {
  var TEXTOS = {
    titulo: "Em quais dias da semana?",
    apoio: "Escolha de 3 a 7 dias. Nos outros dias você não faz check-in e não recebe lembrete. Esses dias não contam como falta.",
    contadorUm: "1 dia por semana.",
    contadorVarios: "{n} dias por semana.",
    erroMinimo: "Escolha pelo menos 3 dias por semana.",
    atalhoTodos: "Todos os dias",
    atalhoUteis: "Segunda a sexta",
    hojeLivre: "Hoje é dia livre. Não precisa de check-in.",
    proximoDia: "O próximo dia da missão é {dia}.",
    linhaDoDiaLivre: "Dia {dia} de {total}, dia livre",
    legendaLivre: "Dia livre",
    /* Textos novos pedidos pela Clara na revisão do PR 21 (ainda esperam o sim do Isaac). */
    legendaMissao: "Dia da missão",
    tituloPlano: "Plano dos 30 dias",
    rotuloPrevia: "Dias",
    previaTodos: "todos os dias",
    indisponivel: "A escolha dos dias ainda não está disponível. Você pode começar a missão com todos os dias ou tentar mais tarde.",
    comecarComTodos: "Começar com todos os dias",
    tentarDeNovo: "Tentar de novo",
    semRedeMissao: "Sem internet. A missão não foi criada. Tente de novo quando a conexão voltar.",
    avisoLembrete: "O aviso só toca nos dias da missão."
  };

  /* Mensagens 400 do servidor (PR 16 do servidor) para dias inválidos. */
  var ERROS_DO_SERVIDOR = [
    "Escolha os dias da missão de segunda (1) a domingo (7), sem repetir.",
    "Escolha pelo menos 3 dias da missão por semana."
  ];

  var CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  var LONGOS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
  var MINIMO = 3;
  var TODOS = [1, 2, 3, 4, 5, 6, 7];
  var UTEIS = [1, 2, 3, 4, 5];

  function preencher(modelo, valores) {
    return modelo.replace(/\{(\w+)\}/g, function (_, chave) {
      return Object.prototype.hasOwnProperty.call(valores, chave) ? String(valores[chave]) : "";
    });
  }

  function ehDia(valor) {
    return typeof valor === "number" && Math.floor(valor) === valor && valor >= 1 && valor <= 7;
  }

  /* Lista limpa, em ordem, sem repetir. Qualquer coisa fora de 1 a 7 sai. */
  function limpar(lista) {
    if (!Array.isArray(lista)) return [];
    var visto = {};
    var saida = [];
    lista.forEach(function (item) {
      var n = Number(item);
      if (ehDia(n) && !visto[n]) {
        visto[n] = true;
        saida.push(n);
      }
    });
    return saida.sort(function (a, b) { return a - b; });
  }

  /* Dias guardados pelo servidor. null, inválido ou os 7: todos os dias (null). */
  function daMissao(valor) {
    if (!Array.isArray(valor)) return null;
    var dias = limpar(valor);
    if (dias.length !== valor.length || dias.length < MINIMO || dias.length >= 7) return null;
    return dias;
  }

  /* O que o pedido de criar a missão leva.
     Menos de 3 dias: não envia nada (ok false).
     Os 7 dias: ok true sem o campo, para a missão não depender da migração.
     De 3 a 6: o campo com a lista em ordem. */
  function pedido(lista) {
    var dias = limpar(lista);
    if (dias.length < MINIMO) return { ok: false, erro: TEXTOS.erroMinimo };
    if (dias.length === 7) return { ok: true, campo: null };
    return { ok: true, campo: dias };
  }

  function contador(n) {
    if (n === 1) return TEXTOS.contadorUm;
    return preencher(TEXTOS.contadorVarios, { n: n });
  }

  /* «seg, qua e sex». Os 7: «todos os dias». */
  function resumo(lista) {
    var dias = limpar(lista);
    if (!dias.length) return "";
    if (dias.length === 7) return TEXTOS.previaTodos;
    var nomes = dias.map(function (d) { return CURTOS[d - 1]; });
    if (nomes.length === 1) return nomes[0];
    return nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  }

  /* Dia da semana (1 a 7) de uma data, no relógio deste aparelho. */
  function diaDaSemana(data) {
    var d = data instanceof Date ? data : new Date(data);
    if (isNaN(d.getTime())) return null;
    var domingo0 = d.getDay();
    return domingo0 === 0 ? 7 : domingo0;
  }

  /* Dia da semana do Dia N, sabendo o do Dia 1 (o Dia N cai N - 1 dias depois). */
  function semanaDoDia(semanaDia1, dia) {
    if (!ehDia(semanaDia1) || typeof dia !== "number" || !isFinite(dia)) return null;
    return (((semanaDia1 - 1 + dia - 1) % 7) + 7) % 7 + 1;
  }

  /* Devolve (dia) => true quando o Dia N é dia da missão.
     Sem dias escolhidos ou sem o dia da semana do Dia 1, todo dia é da missão. */
  function verificador(dias, semanaDia1) {
    var lista = daMissao(dias);
    if (!lista || !ehDia(semanaDia1)) return function () { return true; };
    var escolhidos = {};
    lista.forEach(function (d) { escolhidos[d] = true; });
    return function (dia) {
      return !!escolhidos[semanaDoDia(semanaDia1, dia)];
    };
  }

  /* Nome do próximo dia da missão depois de hoje, até o fim. Sem próximo: "". */
  function proximoNome(dias, semanaDia1, hoje, duracao) {
    var ehDaMissao = verificador(dias, semanaDia1);
    for (var dia = hoje + 1; dia <= duracao; dia++) {
      if (ehDaMissao(dia)) {
        var semana = semanaDoDia(semanaDia1, dia);
        return semana ? LONGOS[semana - 1] : "";
      }
    }
    return "";
  }

  /* Check-in ou dia difícil num dia livre: as frases já aprovadas do Hoje,
     com o próximo dia calculado aqui (o servidor só diz «no dia da missão»).
     diasDaSequencia: mission_weekdays da sequência, quando houver.
     agora (opcional, em ms) só serve para a checagem automática. */
  function fraseDiaLivre(missao, diasDaSequencia, agora) {
    var frase = TEXTOS.hojeLivre;
    if (!missao || !missao.started_at) return frase;
    var inicio = new Date(missao.started_at);
    if (isNaN(inicio.getTime())) return frase;
    var dias = daMissao(diasDaSequencia) || daMissao(missao.mission_weekdays);
    var duracao = Number(missao.duration_days);
    if (!isFinite(duracao) || duracao < 1) duracao = 30;
    var hoje = Math.floor(((typeof agora === "number" ? agora : Date.now()) - inicio.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    var nome = dias ? proximoNome(dias, diaDaSemana(inicio), hoje, Math.floor(duracao)) : "";
    if (!nome) return frase;
    return frase + " " + preencher(TEXTOS.proximoDia, { dia: nome });
  }

  function erroDoServidor(texto) {
    return ERROS_DO_SERVIDOR.indexOf(texto) !== -1;
  }

  window.NexusDias = {
    TEXTOS: TEXTOS,
    CURTOS: CURTOS,
    LONGOS: LONGOS,
    TODOS: TODOS,
    UTEIS: UTEIS,
    MINIMO: MINIMO,
    preencher: preencher,
    limpar: limpar,
    daMissao: daMissao,
    pedido: pedido,
    contador: contador,
    resumo: resumo,
    diaDaSemana: diaDaSemana,
    semanaDoDia: semanaDoDia,
    verificador: verificador,
    proximoNome: proximoNome,
    fraseDiaLivre: fraseDiaLivre,
    erroDoServidor: erroDoServidor
  };
})();
