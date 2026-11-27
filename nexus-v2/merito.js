/* Meu mérito (só o próprio) e, com ?c=<slug>, o ranking da comunidade.
   Rotas: GET /api/communities/merit/me e GET /api/communities/:slug/ranking
   (PR 44 do servidor). Contam só as missões pessoais de 30 dias concluídas.
   O ranking mostra os 3 primeiros e a posição de quem pede, nunca a lista
   toda: ninguém vê quem está em último. Sem coroa, sem cor para o 1.º. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;
  var B = window.NexusComBase;
  var ciclo = 0;

  function mostrarVista(qual) {
    ["carregando", "aviso", "idade", "merito"].forEach(function (nome) {
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

  function pintarMerito(dados) {
    var titulo = dados && dados.title && typeof dados.title.name === "string" ? dados.title : null;
    var missoes = Number(dados && dados.missions) || 0;
    var simbolo = document.getElementById("simbolo-atual");
    simbolo.replaceChildren(B.simboloDoTitulo(titulo, true));
    document.getElementById("nome-atual").textContent = titulo ? titulo.name : T.semTitulo;
    document.getElementById("conta-atual").textContent = titulo ? C.missoesConcluidas(missoes) : T.semTituloTexto;
    var proximo = document.getElementById("linha-proximo");
    proximo.textContent = titulo ? C.linhaDoProximo(dados.next) : "";
    proximo.hidden = !titulo;

    var lista = document.getElementById("lista-titulos");
    lista.replaceChildren();
    C.TITULOS.forEach(function (t) {
      var item = document.createElement("li");
      item.className = "linha-titulo-merito";
      var meu = !!titulo && titulo.name === t.nome;
      if (meu) item.classList.add("e-meu");
      item.appendChild(B.simboloDoTitulo({ level: t.nivel }, false));
      var nome = document.createElement("span");
      nome.className = "titulo-nome";
      nome.textContent = t.nome;
      item.appendChild(nome);
      var direita = document.createElement("span");
      direita.className = "titulo-direita";
      direita.textContent = meu ? T.seuTitulo : C.contarMissoes(t.min);
      item.appendChild(direita);
      lista.appendChild(item);
    });
  }

  function linhaDoRanking(linha) {
    var item = document.createElement("li");
    item.className = "linha-ranking" + (linha.is_me === true ? " e-voce" : "");
    var posicao = document.createElement("span");
    posicao.className = "ranking-posicao";
    posicao.textContent = C.preencher(T.posicao, { n: Number(linha.position) || 0 });
    item.appendChild(posicao);
    var meio = document.createElement("span");
    meio.className = "ranking-meio";
    var nome = document.createElement("span");
    nome.className = "ranking-nome";
    nome.textContent = linha.is_me === true ? T.voceNoRanking : (typeof linha.username === "string" ? linha.username : "");
    meio.appendChild(nome);
    var detalhe = document.createElement("span");
    detalhe.className = "ranking-detalhe";
    var nomeTitulo = linha.title && typeof linha.title.name === "string" ? linha.title.name : "";
    detalhe.textContent = nomeTitulo
      ? C.preencher(T.tituloMissoes, { titulo: nomeTitulo, missoes: C.contarMissoes(linha.missions) })
      : C.contarMissoes(linha.missions);
    meio.appendChild(detalhe);
    item.appendChild(meio);
    var tempo = document.createElement("span");
    tempo.className = "ranking-tempo";
    tempo.textContent = C.tempoNaComunidade(linha.days_in_community);
    item.appendChild(tempo);
    return item;
  }

  function pintarRanking(nomeDaComunidade, resultado) {
    var bloco = document.getElementById("bloco-ranking");
    var lista = document.getElementById("lista-ranking");
    var aviso = document.getElementById("ranking-aviso");
    var alerta = document.getElementById("alerta-ranking");
    lista.replaceChildren();
    aviso.hidden = true;
    B.esconderAviso(alerta);
    document.getElementById("titulo-ranking").textContent = C.preencher(T.rankingDe, { nome: nomeDaComunidade });
    bloco.hidden = false;
    if (!resultado.ok) {
      if (resultado.semRede) return B.mostrarAviso(alerta, "rede", T.meritoSemRede);
      return B.mostrarAviso(alerta, "falha", resultado.status === 503 ? T.indisponivel : T.meritoErro);
    }
    var dados = resultado.dados || {};
    var topo = Array.isArray(dados.top) ? dados.top : [];
    topo.forEach(function (linha) { lista.appendChild(linhaDoRanking(linha)); });
    var eu = dados.me && typeof dados.me === "object" ? dados.me : null;
    if (eu && !topo.some(function (l) { return l.is_me === true; })) lista.appendChild(linhaDoRanking(eu));
    if (!topo.length) {
      aviso.textContent = T.rankingVazio;
      aviso.hidden = false;
    } else if (!eu) {
      aviso.textContent = T.rankingForaVoce;
      aviso.hidden = false;
    }
  }

  async function carregar() {
    var meu = ++ciclo;
    mostrarVista("carregando");
    if (B.semRedeAgora()) return abrirAviso("rede", T.meritoSemRede);
    var slug = B.parametro("c");
    var pedidos = [NexusApi.meuMerito()];
    if (slug) pedidos.push(NexusApi.rankingDaComunidade(slug), NexusApi.listarComunidades());
    var r = await Promise.all(pedidos);
    if (meu !== ciclo) return;
    var merito = r[0];
    if (!merito.ok) {
      if (merito.semRede) return abrirAviso("rede", T.meritoSemRede);
      if (B.sessaoVencida(merito)) return B.irParaEntrada();
      if (B.semIdade(merito)) {
        mostrarVista("idade");
        return focarTitulo();
      }
      return abrirAviso("falha", merito.status === 503 ? T.indisponivel : T.meritoErro);
    }
    pintarMerito(merito.dados);
    document.getElementById("bloco-ranking").hidden = true;
    if (slug && r[1].status !== 404) {
      var nome = slug;
      var lista = r[2].ok && Array.isArray(r[2].dados) ? r[2].dados : [];
      lista.forEach(function (c) {
        if (c && c.slug === slug && typeof c.name === "string" && c.name) nome = c.name;
      });
      pintarRanking(nome, r[1]);
      document.getElementById("link-voltar").href = B.link("comunidade.html", { c: slug });
    }
    mostrarVista("merito");
    focarTitulo();
    NexusAbas.concluirRolagem();
  }

  function iniciar() {
    B.iniciarCenario();
    C.aplicar(document);
    document.title = T.meritoTitulo + " — Nexus";
    document.getElementById("btn-agora-nao").href = "hoje.html" + B.busca();
    document.getElementById("link-voltar").href = B.link("comunidades.html");
    document.getElementById("btn-tentar").addEventListener("click", carregar);
    NexusAbas.montar("missao");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    carregar();
  }

  iniciar();
})();
