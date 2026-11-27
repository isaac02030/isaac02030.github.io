/* Partes comuns das telas da comunidade (lista, por dentro, criar e mérito).
   Textos: comunidade-textos.js. Texto de outra pessoa entra só por textContent.
   ?cenario= e ?rede=off só valem em localhost, 127.0.0.1 e [::1]. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;

  function hostDeDesenvolvimento() {
    var host = location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  }

  function parametro(nome) {
    try {
      return new URLSearchParams(location.search).get(nome) || "";
    } catch (erro) {
      return "";
    }
  }

  function semRedeAgora() {
    var rede = hostDeDesenvolvimento() ? parametro("rede") : "";
    return rede === "off" || navigator.onLine === false;
  }

  function busca() {
    return NexusAbas.busca(["tema", "cenario", "rede"]);
  }

  /* Link para outra tela, levando tema/cenário/rede e os extras pedidos. */
  function link(pagina, extras) {
    var params = new URLSearchParams(busca().slice(1));
    Object.keys(extras || {}).forEach(function (chave) {
      if (extras[chave] != null && extras[chave] !== "") params.set(chave, String(extras[chave]));
    });
    var texto = params.toString();
    return pagina + (texto ? "?" + texto : "");
  }

  function icone(caminho, classe) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.setAttribute("class", classe || "icone");
    var traco = document.createElementNS("http://www.w3.org/2000/svg", "path");
    traco.setAttribute("fill", "none");
    traco.setAttribute("stroke", "currentColor");
    traco.setAttribute("stroke-width", "2");
    traco.setAttribute("stroke-linecap", "round");
    traco.setAttribute("stroke-linejoin", "round");
    traco.setAttribute("d", caminho);
    svg.appendChild(traco);
    return svg;
  }

  var DESENHOS = {
    falha: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v5M12 16.5h.01",
    rede: "M12 20h.01M8.5 16.4a5 5 0 0 1 7 0M5 12.6a10 10 0 0 1 4.2-2.2M19 12.6a10 10 0 0 0-2-.9M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-11.2-3.7M3 3l18 18",
    ok: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.6 2.6L16.5 9",
    seta: "M9 6l6 6-6 6",
    /* Mão de apoio (polegar), traço simples. */
    mao: "M7 11v9H4v-9h3zM7 11l4-7c1.4 0 2.3 1.1 2 2.5L12.5 10H18a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"
  };

  /* Erro calmo (neutro): o que aconteceu e o que fazer. */
  function mostrarAviso(el, tipo, texto) {
    var paragrafo = document.createElement("p");
    paragrafo.textContent = texto;
    el.className = "alerta alerta-" + (tipo === "rede" ? "rede" : (tipo === "ok" ? "ok" : "falha"));
    el.replaceChildren(icone(DESENHOS[tipo] || DESENHOS.falha), paragrafo);
    el.hidden = false;
  }

  function esconderAviso(el) {
    el.hidden = true;
    el.replaceChildren();
  }

  function irParaEntrada() {
    try {
      localStorage.removeItem("nexus_v2_token");
    } catch (erro) {}
    location.replace("./" + NexusAbas.busca(["tema"]));
  }

  function sessaoVencida(resultado) {
    if (resultado.status === 401) return true;
    return resultado.status === 403 && resultado.erro === C.DO_SERVIDOR.tokenInvalido;
  }

  function semIdade(resultado) {
    var dados = resultado && resultado.dados;
    return resultado.status === 403 && !!dados && (dados.code === C.DO_SERVIDOR.codigoIdade || dados.adult_confirmation_required === true);
  }

  /* Crise (crisis: true): nada foi gravado. A ajuda abre na hora. */
  function abrirAjuda() {
    var texto = busca();
    location.assign("crise.html" + texto);
  }

  /* Símbolo do título: a fita de 5 marcas, n acesas, sempre com o nome ao lado.
     Cor cheia, sem halo (a luz das listas fica plana). */
  function simboloDoTitulo(titulo, grande) {
    var nivel = titulo && Number(titulo.level) > 0 ? Math.min(5, Math.floor(Number(titulo.level))) : 0;
    var fita = document.createElement("span");
    fita.className = "fita-titulo" + (grande ? " fita-grande" : "");
    fita.setAttribute("role", "img");
    fita.setAttribute("aria-label", C.preencher(T.marcas, { n: nivel }));
    for (var i = 1; i <= 5; i++) {
      var marca = document.createElement("span");
      marca.className = "marca-titulo" + (i <= nivel ? " acesa" : "") + (i > 1 && i <= nivel ? " ligada" : "");
      fita.appendChild(marca);
    }
    return fita;
  }

  /* Liga os segmentos Mente, Corpo e Rotina (tablist local, setas mudam). */
  function ligarSegmentos(lugar, ativa, aoEscolher) {
    lugar.replaceChildren();
    lugar.setAttribute("role", "tablist");
    lugar.setAttribute("aria-label", T.areasRotulo);
    var botoes = [];
    C.AREAS.forEach(function (area) {
      var botao = document.createElement("button");
      botao.type = "button";
      botao.className = "segmento";
      botao.setAttribute("role", "tab");
      botao.dataset.area = area.codigo;
      botao.textContent = T[area.chave];
      botao.addEventListener("click", function () {
        marcar(area.codigo);
        aoEscolher(area.codigo);
      });
      botao.addEventListener("keydown", function (evento) {
        var i = botoes.indexOf(botao);
        var alvo = -1;
        if (evento.key === "ArrowRight") alvo = (i + 1) % botoes.length;
        if (evento.key === "ArrowLeft") alvo = (i + botoes.length - 1) % botoes.length;
        if (alvo === -1) return;
        evento.preventDefault();
        botoes[alvo].focus();
        botoes[alvo].click();
      });
      botoes.push(botao);
      lugar.appendChild(botao);
    });
    function marcar(codigo) {
      botoes.forEach(function (b) {
        var sim = b.dataset.area === codigo;
        b.setAttribute("aria-selected", sim ? "true" : "false");
        b.tabIndex = sim ? 0 : -1;
      });
    }
    marcar(ativa);
    return marcar;
  }

  function iniciarCenario() {
    window.NEXUS_CENARIO = hostDeDesenvolvimento() ? parametro("cenario") : "";
  }

  /* Missão ativa (a primeira), para a área e o «dia N de 30». */
  function missaoAtiva(lista) {
    var itens = Array.isArray(lista) ? lista : (lista && Array.isArray(lista.missions) ? lista.missions : []);
    for (var i = 0; i < itens.length; i++) {
      if (itens[i] && itens[i].status === "active") return itens[i];
    }
    return null;
  }

  /* Dia da missão: o mesmo cálculo da tela Hoje (numeroDoDia em hoje.js),
     floor((agora - started_at) / 1 dia) + 1. Fica entre 1 e 30. */
  function diaDaMissao(missao, agora) {
    if (!missao || !missao.started_at) return 0;
    var inicio = new Date(missao.started_at);
    if (isNaN(inicio.getTime())) return 0;
    var ms = (agora && typeof agora.getTime === "function" ? agora.getTime() : Date.now()) - inicio.getTime();
    var dia = Math.floor(ms / 86400000) + 1;
    return Math.max(1, Math.min(30, dia));
  }

  window.NexusComBase = {
    dev: hostDeDesenvolvimento,
    parametro: parametro,
    semRedeAgora: semRedeAgora,
    busca: busca,
    link: link,
    icone: icone,
    DESENHOS: DESENHOS,
    mostrarAviso: mostrarAviso,
    esconderAviso: esconderAviso,
    irParaEntrada: irParaEntrada,
    sessaoVencida: sessaoVencida,
    semIdade: semIdade,
    abrirAjuda: abrirAjuda,
    simboloDoTitulo: simboloDoTitulo,
    ligarSegmentos: ligarSegmentos,
    iniciarCenario: iniciarCenario,
    missaoAtiva: missaoAtiva,
    diaDaMissao: diaDaMissao
  };
})();
