/* Trilha de luz dos 30 dias (spec da Clara, visual/spec-trilha-de-luz.md).
   3 linhas de 10. Um fio liga um dia ao seguinte, só dentro da mesma linha,
   e a ponta acesa para no dia de hoje. Estados (forma primeiro, luz depois):
   feito (cheio), difícil (cheio com ponto), livre (pontilhado), falta (traço;
   nunca vermelho), hoje (contorno duplo) e futuro (contorno).
   Para o leitor de tela: um resumo só (role="img" + aria-label), sem ler os
   30 dias. Sem animação. A trilha inteira conta como UMA das 4 luzes. */

(function () {
  var POR_LINHA = 10;

  /* dados: { duracao, hoje, feitos: [], dificeis: [], ehLivre(dia), hojeFeito }
     hoje > duracao = ciclo encerrado (Dia 30). */
  function estados(dados) {
    var duracao = Number(dados.duracao) || 30;
    var hoje = Number(dados.hoje) || 1;
    var fim = hoje > duracao;
    var feitos = {};
    var dificeis = {};
    (dados.feitos || []).forEach(function (d) { feitos[Number(d)] = true; });
    (dados.dificeis || []).forEach(function (d) { dificeis[Number(d)] = true; });
    var ehLivre = typeof dados.ehLivre === "function" ? dados.ehLivre : function () { return false; };
    var lista = [];
    for (var dia = 1; dia <= duracao; dia++) {
      var estado;
      if (dificeis[dia]) estado = "d";
      else if (feitos[dia]) estado = "f";
      else if (ehLivre(dia)) estado = "l";
      else if (dia < hoje) estado = "x";
      else if (dia === hoje) estado = "h";
      else estado = "o";
      lista.push({ dia: dia, estado: estado, hoje: !fim && dia === hoje });
    }
    return lista;
  }

  function cumprido(e) {
    return e === "f" || e === "d";
  }

  /* O fio que sai do dia a para o dia b (mesma linha). */
  function fio(a, b, hoje) {
    if (a.estado === "x" || b.estado === "x") return "off";
    if (b.dia > hoje) {
      /* Hoje já registrado: o fio de amanhã aponta para a frente, a 38%. */
      return a.hoje && cumprido(a.estado) ? "dim" : "off";
    }
    if (a.estado === "l" || b.estado === "l") return "dim";
    if (cumprido(a.estado) && (cumprido(b.estado) || b.estado === "h")) return "on";
    return "off";
  }

  function plural(n, um, outros) {
    return n === 1 ? um : outros;
  }

  /* «Trilha dos 30 dias. Dia 14 é hoje. Feitos: 10. Difíceis: 1. Dia livre: 1.
     Faltas: 1. Hoje ainda não foi registrado.» */
  function resumo(dados) {
    var duracao = Number(dados.duracao) || 30;
    var hoje = Number(dados.hoje) || 1;
    var fim = hoje > duracao;
    var n = { f: 0, d: 0, l: 0, x: 0 };
    estados(dados).forEach(function (item) {
      if (item.dia > hoje) return;
      if (n[item.estado] !== undefined) n[item.estado] += 1;
    });
    var partes = ["Trilha dos " + duracao + " dias."];
    if (!fim) partes.push("Dia " + hoje + " é hoje.");
    partes.push("Feitos: " + n.f + ".");
    partes.push(plural(n.d, "Difícil", "Difíceis") + ": " + n.d + ".");
    if (n.l > 0) partes.push(plural(n.l, "Dia livre", "Dias livres") + ": " + n.l + ".");
    partes.push(plural(n.x, "Falta", "Faltas") + ": " + n.x + ".");
    if (!fim) {
      var deHoje = estados(dados)[hoje - 1];
      if (deHoje && deHoje.estado === "l") partes.push("Hoje é dia livre.");
      else partes.push(dados.hojeFeito ? "Hoje já foi registrado." : "Hoje ainda não foi registrado.");
    }
    return partes.join(" ");
  }

  /* Contagem para o Dia 30: { feitos, dificeis, livres, faltas }. */
  function contagem(dados) {
    var n = { f: 0, d: 0, l: 0, x: 0 };
    estados(dados).forEach(function (item) {
      if (n[item.estado] !== undefined) n[item.estado] += 1;
    });
    return { feitos: n.f, dificeis: n.d, livres: n.l, faltas: n.x };
  }

  function pintar(caixa, dados) {
    if (!caixa) return;
    var lista = estados(dados);
    var duracao = lista.length;
    var hoje = Number(dados.hoje) || 1;
    var fim = hoje > duracao;
    var ate = Math.max(Math.min(hoje, duracao), 2);
    caixa.className = "trilha30" + (fim ? " trilha-fim" : "");
    caixa.setAttribute("role", "img");
    caixa.setAttribute("aria-label", resumo(dados));
    caixa.removeAttribute("aria-hidden");
    var pecas = lista.map(function (item, i) {
      var li = document.createElement("li");
      li.className = "c s-" + item.estado;
      li.setAttribute("aria-hidden", "true");
      if (item.hoje) li.classList.add("e-hoje");
      /* Posição no degradê aqua → ciano: do Dia 1 até hoje. */
      var t = Math.min(100, Math.max(0, Math.round(((item.dia - 1) / (ate - 1)) * 100)));
      li.style.setProperty("--t", t + "%");
      var coluna = i % POR_LINHA;
      if (coluna < POR_LINHA - 1 && i + 1 < lista.length) li.classList.add("lk-" + fio(item, lista[i + 1], hoje));
      else li.classList.add("lk-fim");
      if (item.hoje) {
        /* A ponta acesa: à esquerda de hoje antes do registro; à direita depois. */
        if (cumprido(item.estado)) {
          if (coluna < POR_LINHA - 1 && i + 1 < lista.length) li.classList.add("ponta-dir");
        } else if (coluna > 0) {
          li.classList.add("ponta-esq");
        }
      }
      if (fim && i === lista.length - 1) li.classList.add("ultimo");
      li.appendChild(document.createElement("i"));
      return li;
    });
    caixa.replaceChildren.apply(caixa, pecas);
  }

  window.NexusTrilha = { estados: estados, resumo: resumo, contagem: contagem, pintar: pintar, POR_LINHA: POR_LINHA };
})();
