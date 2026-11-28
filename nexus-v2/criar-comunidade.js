/* Criar comunidade: área, nome, assunto, regras e ícone (só emoji).
   Abre para quem concluiu uma missão de 30 dias; antes disso, o fato e
   «dia N de 30». O servidor decide de novo no POST (403 needs_completed_mission).
   Rotas: GET /api/communities/merit/me, GET /api/missions, POST /api/communities.
   Crise no nome, no assunto, nas regras ou no ícone: nada é criado, os campos
   ficam vazios e a ajuda abre. Nada aqui finge que criou: só um 201. */

(function () {
  var C = window.NexusComunidade;
  var T = C.TEXTOS;
  var B = window.NexusComBase;
  var ciclo = 0;
  var CAMPOS = { nome: "campo-nome", assunto: "campo-assunto", regras: "campo-regras", icone: "campo-icone" };

  function mostrarVista(qual) {
    ["carregando", "aviso", "idade", "bloqueado", "form", "criada"].forEach(function (nome) {
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

  /* Bloqueado: «Criar uma comunidade abre depois…» + «Sua missão: dia N de 30.» */
  function abrirBloqueado(missao) {
    var dia = B.diaDaMissao(missao);
    var linhaDia = document.getElementById("dia-da-missao");
    var link = document.getElementById("link-missao");
    if (missao && dia) {
      linhaDia.textContent = C.preencher(T.criarDia, { n: dia });
      linhaDia.hidden = false;
      link.textContent = T.irParaMissao;
      link.href = B.link("missao.html");
    } else {
      linhaDia.hidden = true;
      link.textContent = T.comecarMissao;
      link.href = B.link("onboarding.html");
    }
    mostrarVista("bloqueado");
    focarTitulo();
  }

  function montarAreas() {
    var lugar = document.getElementById("opcoes-area");
    C.AREAS.forEach(function (area) {
      var rotulo = document.createElement("label");
      rotulo.className = "motivo";
      var radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "area";
      radio.value = area.codigo;
      radio.addEventListener("change", function () {
        erroDoCampo("area", "");
      });
      var texto = document.createElement("span");
      texto.textContent = T[area.chave];
      rotulo.appendChild(radio);
      rotulo.appendChild(texto);
      lugar.appendChild(rotulo);
    });
  }

  function areaEscolhida() {
    var marcado = document.querySelector('input[name="area"]:checked');
    return marcado ? marcado.value : "";
  }

  /* Erro de campo: texto e borda (aria-invalid), nunca só cor. */
  function erroDoCampo(qual, texto) {
    var p = document.getElementById("erro-" + qual);
    p.textContent = texto;
    if (qual === "area") {
      document.querySelectorAll('input[name="area"]').forEach(function (r) {
        if (texto) r.setAttribute("aria-invalid", "true");
        else r.removeAttribute("aria-invalid");
      });
      return;
    }
    var campo = document.getElementById(CAMPOS[qual]);
    if (texto) campo.setAttribute("aria-invalid", "true");
    else campo.removeAttribute("aria-invalid");
  }

  function limparErros() {
    ["nome", "area", "assunto", "regras", "icone"].forEach(function (q) { erroDoCampo(q, ""); });
    B.esconderAviso(document.getElementById("alerta-criar"));
  }

  function focarCampo(qual) {
    if (qual === "area") {
      var primeiro = document.querySelector('input[name="area"]');
      if (primeiro) primeiro.focus();
      return;
    }
    document.getElementById(CAMPOS[qual]).focus();
  }

  function definirEnviando(ligado) {
    var form = document.getElementById("form-criar");
    var botao = document.getElementById("btn-criar");
    form.dataset.ocupado = ligado ? "sim" : "";
    botao.disabled = ligado;
    botao.setAttribute("aria-busy", ligado ? "true" : "false");
    botao.querySelector(".btn-rotulo").textContent = ligado ? T.criando : T.criarBotao;
  }

  function valor(id) {
    return document.getElementById(id).value.replace(/\s+/g, " ").trim();
  }

  /* Confere a forma antes de enviar (o servidor confere de novo). */
  function conferir(dados) {
    if (!dados.name || Array.from(dados.name).length > 40) return ["nome", T.nomeFalta];
    if (!C.areaValida(dados.area)) return ["area", T.areaFalta];
    if (dados.icon && !C.iconeValido(dados.icon)) return ["icone", T.iconeInvalido];
    return null;
  }

  function apagarCampos() {
    document.getElementById("form-criar").reset();
  }

  /* Código do 400 do servidor → o campo certo, com a frase do servidor. */
  var CAMPO_DO_CODIGO = {
    invalid_name: "nome", invalid_area: "area", invalid_topic: "assunto",
    invalid_description: "regras", invalid_icon: "icone", name_taken: "nome"
  };

  async function criar() {
    var form = document.getElementById("form-criar");
    if (form.dataset.ocupado === "sim") return;
    limparErros();
    var dados = {
      name: valor("campo-nome"),
      area: areaEscolhida(),
      category: valor("campo-assunto"),
      description: valor("campo-regras"),
      icon: document.getElementById("campo-icone").value.trim()
    };
    var erro = conferir(dados);
    if (erro) {
      erroDoCampo(erro[0], erro[1]);
      focarCampo(erro[0]);
      return;
    }
    var alerta = document.getElementById("alerta-criar");
    if (B.semRedeAgora()) return B.mostrarAviso(alerta, "rede", T.criarSemRede);
    definirEnviando(true);
    var resultado;
    try {
      resultado = await NexusApi.criarComunidade(dados);
    } finally {
      definirEnviando(false);
    }
    var resposta = resultado.dados || {};
    if (resultado.ok && resposta.crisis === true) {
      apagarCampos();
      B.abrirAjuda();
      return;
    }
    if (resultado.status === 201 && resposta.community && typeof resposta.community.slug === "string") {
      apagarCampos();
      document.getElementById("link-nova").href = B.link("comunidade.html", { c: resposta.community.slug });
      mostrarVista("criada");
      NexusAbas.focar(document.getElementById("texto-criada"));
      return;
    }
    if (resultado.ok) return B.mostrarAviso(alerta, "falha", T.criarErro);
    if (resultado.semRede) return B.mostrarAviso(alerta, "rede", T.criarSemRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return mostrarVista("idade");
    if (resultado.status === 403 && resposta.code === "needs_completed_mission") {
      var lista = await NexusApi.listarMissoes();
      return abrirBloqueado(lista.ok ? B.missaoAtiva(lista.dados) : null);
    }
    var campo = CAMPO_DO_CODIGO[resposta.code];
    if ((resultado.status === 400 || resultado.status === 409) && campo) {
      erroDoCampo(campo, resultado.status === 409 ? T.nomeRepetido : (resultado.erro || T.criarErro));
      focarCampo(campo);
      return;
    }
    if (resultado.status === 429 && resultado.erro) return B.mostrarAviso(alerta, "falha", resultado.erro);
    if (resultado.status === 503) return B.mostrarAviso(alerta, "falha", T.indisponivel);
    B.mostrarAviso(alerta, "falha", T.criarErro);
  }

  async function carregar() {
    var meu = ++ciclo;
    mostrarVista("carregando");
    if (B.semRedeAgora()) return abrirAviso("rede", T.semRede);
    var pedidos = await Promise.all([NexusApi.meuMerito(), NexusApi.listarMissoes()]);
    if (meu !== ciclo) return;
    var merito = pedidos[0];
    if (!merito.ok) {
      if (merito.semRede) return abrirAviso("rede", T.semRede);
      if (B.sessaoVencida(merito)) return B.irParaEntrada();
      if (B.semIdade(merito)) {
        mostrarVista("idade");
        return focarTitulo();
      }
      return abrirAviso("falha", merito.status === 503 ? T.indisponivel : T.meritoErro);
    }
    var missoes = Number(merito.dados && merito.dados.missions) || 0;
    if (missoes < 1) return abrirBloqueado(pedidos[1].ok ? B.missaoAtiva(pedidos[1].dados) : null);
    mostrarVista("form");
    focarTitulo();
  }

  function iniciar() {
    B.iniciarCenario();
    C.aplicar(document);
    document.title = T.criarTitulo + " — Nexus";
    document.getElementById("btn-agora-nao").href = "hoje.html" + B.busca();
    document.getElementById("link-voltar").href = B.link("comunidades.html");
    document.getElementById("btn-tentar").addEventListener("click", carregar);
    montarAreas();
    document.getElementById("form-criar").addEventListener("submit", function (evento) {
      evento.preventDefault();
      criar();
    });
    ["nome", "assunto", "regras", "icone"].forEach(function (q) {
      document.getElementById(CAMPOS[q]).addEventListener("input", function () { erroDoCampo(q, ""); });
    });
    NexusAbas.montar("comunidade");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    carregar();
  }

  iniciar();
})();
