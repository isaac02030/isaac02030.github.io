/* Lista de comunidades por área (Mente, Corpo, Rotina), com as recomendadas
   pela missão no topo. Ler é aberto (18+); entrar é um toque, sem confirmação.
   Rotas: GET /api/communities, GET /api/communities/recommended/:missionId,
   POST /api/communities/:slug/join (servidor, PRs 40 e 41).
   Nada aqui finge que entrou: só um 2xx do servidor muda o botão. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;
  var B = window.NexusComBase;
  var ciclo = 0;
  var todas = [];
  var recomendadas = [];
  var areaDaMissao = "";
  var areaAtual = "mente";
  var marcarSegmento = function () {};

  function mostrarVista(qual) {
    ["carregando", "aviso", "idade", "lista"].forEach(function (nome) {
      document.getElementById("vista-" + nome).hidden = nome !== qual;
    });
  }

  function focarTitulo() {
    NexusAbas.focar(document.getElementById("titulo"));
  }

  function abrirAviso(tipo, texto) {
    B.mostrarAviso(document.getElementById("alerta"), tipo, texto);
    mostrarVista("aviso");
    focarTitulo();
  }

  function falhouAoAbrir(resultado) {
    if (resultado.semRede) return abrirAviso("rede", T.listaSemRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) {
      mostrarVista("idade");
      return focarTitulo();
    }
    if (resultado.status === 503) return abrirAviso("falha", T.indisponivel);
    abrirAviso("falha", T.listaErro);
  }

  /* Uma linha por comunidade: nome, descrição curta e «42 pessoas» (o número
     de verdade, mesmo pequeno). À direita, «Entrar» ou «Você participa». */
  function linha(comunidade) {
    var item = document.createElement("li");
    item.className = "linha-comunidade";
    var link = document.createElement("a");
    link.className = "link-comunidade";
    link.href = B.link("comunidade.html", { c: comunidade.slug });
    var nome = document.createElement("span");
    nome.className = "comunidade-nome";
    if (typeof comunidade.icon === "string" && C.iconeValido(comunidade.icon)) {
      var simbolo = document.createElement("span");
      simbolo.className = "comunidade-icone";
      simbolo.setAttribute("aria-hidden", "true");
      simbolo.textContent = comunidade.icon;
      nome.appendChild(simbolo);
    }
    var texto = document.createElement("span");
    texto.textContent = typeof comunidade.name === "string" && comunidade.name ? comunidade.name : comunidade.slug;
    nome.appendChild(texto);
    link.appendChild(nome);
    if (typeof comunidade.description === "string" && comunidade.description.trim()) {
      var descricao = document.createElement("span");
      descricao.className = "comunidade-descricao";
      descricao.textContent = comunidade.description;
      link.appendChild(descricao);
    }
    var gente = document.createElement("span");
    gente.className = "comunidade-pessoas";
    gente.textContent = C.contarPessoas(comunidade.member_count);
    link.appendChild(gente);
    item.appendChild(link);
    item.appendChild(acaoDeEntrar(comunidade, gente));
    return item;
  }

  function marcaParticipa() {
    var participa = document.createElement("p");
    participa.className = "participa";
    participa.textContent = T.participa;
    return participa;
  }

  function acaoDeEntrar(comunidade, gente) {
    if (comunidade.is_member === true) return marcaParticipa();
    var botao = document.createElement("button");
    botao.type = "button";
    botao.className = "btn btn-secundario btn-entrar";
    botao.textContent = T.entrar;
    botao.setAttribute("aria-label", T.entrar + ": " + (comunidade.name || comunidade.slug));
    botao.addEventListener("click", function () {
      entrar(comunidade, botao, gente);
    });
    return botao;
  }

  async function entrar(comunidade, botao, gente) {
    if (botao.getAttribute("aria-busy") === "true") return;
    var alerta = document.getElementById("alerta-entrar");
    B.esconderAviso(alerta);
    if (B.semRedeAgora()) return B.mostrarAviso(alerta, "rede", T.entrarSemRede);
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.textContent = T.entrando;
    var resultado = await NexusApi.entrarNaComunidade(comunidade.slug);
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");
    botao.textContent = T.entrar;
    if (resultado.ok && resultado.dados && resultado.dados.success === true) {
      var jaEra = resultado.dados.already_member === true;
      marcarMembro(comunidade.slug, jaEra);
      var marca = marcaParticipa();
      marca.setAttribute("role", "status");
      marca.tabIndex = -1;
      botao.replaceWith(marca);
      if (!jaEra) gente.textContent = C.contarPessoas(Number(comunidade.member_count) || 0);
      NexusAbas.focar(marca);
      return;
    }
    if (resultado.semRede) return B.mostrarAviso(alerta, "rede", T.entrarSemRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return mostrarVista("idade");
    B.mostrarAviso(alerta, "falha", resultado.status === 503 ? T.indisponivel : T.entrarErro);
  }

  /* A mesma comunidade pode estar nas duas listas: muda nas duas. */
  function marcarMembro(slug, jaEra) {
    todas.concat(recomendadas).forEach(function (c) {
      if (c.slug !== slug) return;
      if (!c.is_member && !jaEra) c.member_count = (Number(c.member_count) || 0) + 1;
      c.is_member = true;
    });
  }

  function valida(c) {
    return c && typeof c.slug === "string" && c.slug;
  }

  function pintarArea(area) {
    areaAtual = area;
    var nome = C.nomeDaArea(area);
    document.getElementById("titulo-todas").textContent = C.preencher(T.todasDe, { area: nome });
    /* Recomendadas: só na área da missão ativa (no máximo 3). Elas não se
       repetem em «Todas de». */
    var bloco = document.getElementById("bloco-recomendadas");
    var listaRec = document.getElementById("lista-recomendadas");
    listaRec.replaceChildren();
    var jaMostradas = {};
    if (areaDaMissao && area === areaDaMissao) {
      recomendadas.slice(0, 3).forEach(function (c) {
        jaMostradas[c.slug] = true;
        listaRec.appendChild(linha(c));
      });
    }
    bloco.hidden = listaRec.children.length === 0;

    var listaTodas = document.getElementById("lista-todas");
    listaTodas.replaceChildren();
    var daArea = todas.filter(function (c) { return c.area === area; });
    daArea.filter(function (c) { return !jaMostradas[c.slug]; }).forEach(function (c) {
      listaTodas.appendChild(linha(c));
    });
    document.getElementById("area-vazia").hidden = daArea.length > 0;
    document.getElementById("titulo-todas").parentNode.hidden = daArea.length > 0 && listaTodas.children.length === 0;
    try {
      var url = new URL(location.href);
      url.searchParams.set("area", area);
      history.replaceState(null, "", url.pathname + url.search);
    } catch (erro) {}
  }

  async function carregar() {
    var meu = ++ciclo;
    mostrarVista("carregando");
    B.esconderAviso(document.getElementById("alerta-entrar"));
    if (B.semRedeAgora()) return abrirAviso("rede", T.listaSemRede);
    var pedidos = await Promise.all([NexusApi.listarComunidades(), NexusApi.listarMissoes()]);
    if (meu !== ciclo) return;
    var lista = pedidos[0];
    if (!lista.ok) return falhouAoAbrir(lista);
    var dados = lista.dados;
    todas = (Array.isArray(dados) ? dados : (dados && Array.isArray(dados.communities) ? dados.communities : [])).filter(valida);

    var missao = pedidos[1].ok ? B.missaoAtiva(pedidos[1].dados) : null;
    areaDaMissao = missao && C.areaValida(missao.area) ? missao.area : "";
    recomendadas = [];
    if (missao && areaDaMissao) {
      var rec = await NexusApi.comunidadesRecomendadas(missao.id);
      if (meu !== ciclo) return;
      /* Sem as recomendadas (erro ou 503), a lista abre do mesmo jeito. */
      if (rec.ok && rec.dados && Array.isArray(rec.dados.communities)) recomendadas = rec.dados.communities.filter(valida);
    }
    var semMissao = document.getElementById("sem-missao");
    semMissao.hidden = !!missao;

    var pedida = B.parametro("area");
    var area = C.areaValida(pedida) ? pedida : (areaDaMissao || "mente");
    marcarSegmento(area);
    pintarArea(area);
    mostrarVista("lista");
    focarTitulo();
    NexusAbas.concluirRolagem();
  }

  function iniciar() {
    B.iniciarCenario();
    C.aplicar(document);
    document.title = T.comunidadesTitulo + " — Nexus";
    document.getElementById("btn-agora-nao").href = "hoje.html" + B.busca();
    document.getElementById("link-comecar").href = B.link("onboarding.html");
    document.getElementById("link-criar").href = B.link("criar-comunidade.html");
    document.getElementById("btn-tentar").addEventListener("click", carregar);
    marcarSegmento = B.ligarSegmentos(document.getElementById("segmentos"), "mente", pintarArea);
    NexusAbas.montar("missao");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    carregar();
  }

  iniciar();
})();
