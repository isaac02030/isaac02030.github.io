/* Tela da Maratona da comunidade.
   Sem nome de pessoa, sem ranking individual, sem botão de sair e sem cartão
   com barra colorida. O texto de terceiros entra só por textContent.
   ?cenario= e ?rede=off só valem em localhost (comunidade-base.js). */

(function () {
  var M = window.NexusMaratonaTextos;
  var T = M.TEXTOS;
  var B = window.NexusComBase;

  var slug = "";
  var id = "";
  var modo = "lista";
  var maratona = null;
  var grupo = null;
  var eu = null;
  var acesso = null;
  var botaoDaFolha = null;
  var inicioMin = "";
  var inicioMax = "";

  function parametro(nome) {
    return B.parametro(nome);
  }

  /* Datas da Maratona são em Lisboa, não em UTC: usar toISOString aqui pode
     mudar o dia no verão. O seletor do aparelho recebe o mesmo intervalo que
     a validação usa. */
  function dataLisboa(data) {
    var partes = new Intl.DateTimeFormat("pt-PT", {
      timeZone: "Europe/Lisbon",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(data);
    var ano = "";
    var mes = "";
    var dia = "";
    for (var i = 0; i < partes.length; i++) {
      if (partes[i].type === "year") ano = partes[i].value;
      if (partes[i].type === "month") mes = partes[i].value;
      if (partes[i].type === "day") dia = partes[i].value;
    }
    return ano + "-" + mes + "-" + dia;
  }

  function dataReal(valor) {
    var partes = valor.split("-");
    if (partes.length !== 3) return false;
    var ano = Number(partes[0]);
    var mes = Number(partes[1]);
    var dia = Number(partes[2]);
    var conferida = new Date(Date.UTC(ano, mes - 1, dia));
    return conferida.getUTCFullYear() === ano &&
      conferida.getUTCMonth() === mes - 1 &&
      conferida.getUTCDate() === dia;
  }

  function visivel(el, sim) {
    if (el) el.hidden = !sim;
  }

  /* Uma luz só por vista. O botão que não está disponível perde a classe;
     quem decide é o estado do grupo, não o HTML parado. */
  function luz(botao, sim) {
    if (botao) botao.classList.toggle("btn-luz", !!sim);
  }

  function mostrarVista(nome) {
    var vistas = document.querySelectorAll(".vista");
    for (var i = 0; i < vistas.length; i++) vistas[i].hidden = vistas[i].id !== "vista-" + nome;
  }

  function focarTitulo() {
    var titulo = document.querySelector("#vista-" + modo + " h1");
    if (!titulo) return;
    titulo.focus();
  }

  function aviso(el, texto) {
    if (texto) B.mostrarAviso(el, "falha", texto);
    else B.esconderAviso(el);
  }

  function status(texto) {
    var el = document.getElementById("aviso-registro");
    el.textContent = texto || "";
    visivel(el, !!texto);
  }

  /* Erro calmo: o que aconteceu e o caminho de volta. Sem cor de alarme. */
  function falhou(resultado, el) {
    if (resultado && resultado.semRede) return aviso(el, T.semRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) {
      mostrarVista("idade");
      document.getElementById("btn-agora-nao").href = "hoje.html" + B.busca();
      return;
    }
    aviso(el, M.erroDoServidor(resultado && resultado.dados && resultado.dados.code,
      (resultado && (resultado.dados && resultado.dados.error || resultado.erro)) || T.abrindoErro));
  }

  /* ---------- Lista ---------- */

  function pintarLista(resposta) {
    var itens = resposta.dados && Array.isArray(resposta.dados.marathons) ? resposta.dados.marathons : [];
    var lista = document.getElementById("lista-maratonas");
    lista.replaceChildren();
    itens.forEach(function (m) {
      var li = document.createElement("li");
      var link = document.createElement("a");
      link.className = "linha-seta";
      link.href = B.link("maratona.html", { c: slug, m: m.id });
      var nome = document.createElement("span");
      nome.className = "linha-maratona-nome";
      nome.textContent = typeof m.title === "string" && m.title ? m.title : T.maratona;
      var meta = document.createElement("span");
      meta.className = "linha-maratona-meta";
      var quando = document.createElement("span");
      quando.textContent = M.quando(m);
      var pessoas = document.createElement("span");
      pessoas.textContent = M.contarPessoas(m.participants);
      meta.append(quando, pessoas);
      link.append(nome, meta);
      li.appendChild(link);
      lista.appendChild(li);
    });
    visivel(document.getElementById("lista-vazia"), !itens.length);
    var podeCriar = resposta.dados && resposta.dados.can_create === true;
    var criar = document.getElementById("link-criar");
    criar.href = B.link("maratona.html", { c: slug, criar: "1" });
    visivel(criar, !!podeCriar);
    mostrarVista("lista");
    focarTitulo();
  }

  async function carregarLista() {
    var resposta = await NexusApi.listarMaratonas(slug);
    if (!resposta.ok) {
      mostrarVista("aviso");
      return falhou(resposta, document.getElementById("alerta"));
    }
    pintarLista(resposta);
  }

  /* ---------- Detalhe: progresso do grupo ---------- */

  function pintarTrilha() {
    var trilha = document.getElementById("trilha");
    trilha.replaceChildren();
    var dias = M.estadosDaTrilha(maratona, grupo);
    dias.forEach(function (dia) {
      var li = document.createElement("li");
      li.className = "tm-c s-" + dia.estado + (dia.hoje ? " hoje" : "") + (dia.link ? " " + dia.link : "");
      /* color-mix espera porcentagem, como em trilha.js; um número (0.14)
         deixa o fundo e o fio transparentes. */
      var t = Math.min(100, Math.max(0, Math.round((dia.dia / Math.max(1, dias.length)) * 100)));
      li.style.setProperty("--t", t + "%");
      var marca = document.createElement("i");
      marca.setAttribute("aria-hidden", "true");
      li.appendChild(marca);
      trilha.appendChild(li);
    });
    var feitos = Number(grupo && grupo.today_done) || 0;
    var total = Number(grupo && grupo.participants) || 0;
    var resumo = maratona.phase === "active"
      ? M.preencher(T.trilhaResumo, { n: maratona.day, m: maratona.duration_days, feitos: feitos, total: total })
      : M.preencher(T.trilhaResumoAntes, { n: maratona.starts_in_days || 1 });
    trilha.setAttribute("aria-label", resumo);
    document.getElementById("resumo-trilha").textContent = resumo;
  }

  function pintarDetalhe(resposta, comunidade) {
    maratona = resposta.dados.marathon || {};
    grupo = resposta.dados.group || {};
    eu = resposta.dados.me || {};
    acesso = (comunidade && comunidade.dados && comunidade.dados.access) || {};

    document.getElementById("nome-maratona").textContent =
      typeof maratona.title === "string" && maratona.title ? maratona.title : T.maratona;
    var diaTexto = M.quando(maratona);
    var dia = document.getElementById("texto-dia-maratona");
    dia.textContent = diaTexto;
    visivel(dia, !!diaTexto);
    document.getElementById("valor-minimo").textContent =
      typeof maratona.description === "string" ? maratona.description : "";

    var feitos = Number(grupo.today_done) || 0;
    var total = Number(grupo.participants) || 0;
    var grupoEl = document.getElementById("texto-grupo");
    /* Antes do início ninguém cumpriu nada: não há frase de hoje para mostrar. */
    visivel(grupoEl, maratona.phase !== "upcoming");
    if (maratona.phase !== "upcoming") {
      grupoEl.textContent = total === 1
        ? M.preencher(T.grupoHojeUm, { feitos: feitos, total: total })
        : M.preencher(T.grupoHoje, { feitos: feitos, total: total });
    }

    var membro = acesso.is_member === true;
    var soLeitura = acesso.post_code === "read_only";
    var participa = eu.is_participant === true;
    var meuDia = document.getElementById("texto-meu-dia");
    var registrar = document.getElementById("btn-registrar");
    var entrar = document.getElementById("btn-entrar");

    if (participa && eu.day_done === true) {
      meuDia.textContent = T.feitoHoje;
      visivel(meuDia, true);
    } else if (participa && maratona.phase === "upcoming") {
      meuDia.textContent = T.registroAntes;
      visivel(meuDia, true);
    } else if (participa && maratona.phase === "ended") {
      meuDia.textContent = T.encerrada;
      visivel(meuDia, true);
    } else if (participa && maratona.phase === "active") {
      meuDia.textContent = T.pendenteHoje;
      visivel(meuDia, true);
    } else {
      visivel(meuDia, false);
    }
    var podeRegistrar = participa && maratona.phase === "active" && eu.day_done !== true && membro && !soLeitura;
    var podeEntrar = membro && !soLeitura && !participa && maratona.phase !== "ended";
    visivel(registrar, podeRegistrar);
    visivel(entrar, podeEntrar);
    luz(registrar, podeRegistrar);
    luz(entrar, podeEntrar);
    if (!membro || soLeitura) {
      if (!participa) {
        meuDia.textContent = soLeitura ? T.soLeitura : T.semParticipar;
        visivel(meuDia, true);
      }
    }
    pintarTrilha();
    mostrarVista("detalhe");
    focarTitulo();
  }

  async function carregarDetalhe() {
    var respostas = await Promise.all([
      NexusApi.abrirMaratona(slug, id),
      NexusApi.abrirComunidade(slug)
    ]);
    if (!respostas[0].ok) {
      mostrarVista("aviso");
      return falhou(respostas[0], document.getElementById("alerta"));
    }
    pintarDetalhe(respostas[0], respostas[1]);
  }

  /* ---------- Entrar e registrar ---------- */

  function abrirDialogo(gatilho) {
    botaoDaFolha = gatilho || null;
    aviso(document.getElementById("alerta-maratona"), "");
    var dialogo = document.getElementById("dialogo-maratona");
    if (dialogo.showModal) dialogo.showModal();
    else dialogo.setAttribute("open", "");
    document.getElementById("btn-agora-nao-maratona").focus();
  }

  function fecharDialogo() {
    var dialogo = document.getElementById("dialogo-maratona");
    if (dialogo.close) dialogo.close();
    else dialogo.removeAttribute("open");
  }

  async function entrar() {
    var botao = document.getElementById("btn-entrar-maratona");
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    var resultado = await NexusApi.entrarNaMaratona(slug, id);
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");
    if (resultado.semRede) return aviso(document.getElementById("alerta-maratona"), T.semRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return B.abrirAjuda();
    if (!resultado.ok) {
      aviso(document.getElementById("alerta-maratona"), M.erroDoServidor(resultado.dados && resultado.dados.code, resultado.erro));
      return;
    }
    fecharDialogo();
    status(T.entrou);
    carregarDetalhe();
  }

  async function registrar() {
    var botao = document.getElementById("btn-registrar");
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    var rotulo = botao.querySelector(".btn-rotulo");
    var antes = rotulo.textContent;
    rotulo.textContent = T.registrando;
    var resultado = await NexusApi.registrarDiaMaratona(slug, id);
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");
    rotulo.textContent = antes;
    if (resultado.semRede) return status(T.semRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return B.abrirAjuda();
    if (!resultado.ok) {
      status(M.erroDoServidor(resultado.dados && resultado.dados.code, resultado.erro));
      return;
    }
    status(T.registrado);
    carregarDetalhe();
  }

  /* ---------- Criar ---------- */

  function contar(campo, contador) {
    contador.textContent = campo.value.length + " de " + campo.getAttribute("maxlength");
  }

  /* O erro de validação fica junto do campo: borda, texto e aria ligados.
     O aviso geral fica só para o que não é de um campo (rede, sessão, crise). */
  var CAMPOS_ERRO = {
    "nome-maratona-campo": "nome-erro",
    "minimo-campo": "minimo-erro",
    "dias-campo": "dias-erro",
    "pessoas-campo": "pessoas-erro",
    "inicio-campo": "inicio-erro"
  };
  var CAMPO_DO_CODIGO = {
    invalid_title: "nome-maratona-campo",
    invalid_minimum: "minimo-campo",
    invalid_days: "dias-campo",
    invalid_people: "pessoas-campo",
    invalid_start: "inicio-campo"
  };

  function limparCampos() {
    Object.keys(CAMPOS_ERRO).forEach(function (id) {
      var campo = document.getElementById(id);
      var texto = document.getElementById(CAMPOS_ERRO[id]);
      campo.setAttribute("aria-invalid", "false");
      texto.textContent = "";
      visivel(texto, false);
    });
  }

  function erroCriar(texto, campo) {
    visivel(document.getElementById("alerta-criar"), !!texto && !campo);
    if (texto && !campo) aviso(document.getElementById("alerta-criar"), texto);
    else aviso(document.getElementById("alerta-criar"), "");
    limparCampos();
    if (campo && Object.prototype.hasOwnProperty.call(CAMPOS_ERRO, campo)) {
      var input = document.getElementById(campo);
      var erro = document.getElementById(CAMPOS_ERRO[campo]);
      input.setAttribute("aria-invalid", "true");
      erro.textContent = texto || "";
      visivel(erro, !!texto);
    }
  }

  function campoDoCodigo(codigo) {
    return Object.prototype.hasOwnProperty.call(CAMPO_DO_CODIGO, codigo) ? CAMPO_DO_CODIGO[codigo] : "";
  }

  function dadosCriar() {
    var titulo = document.getElementById("nome-maratona-campo").value.trim();
    var minimo = document.getElementById("minimo-campo").value.trim();
    var dias = Number(document.getElementById("dias-campo").value);
    var pessoas = Number(document.getElementById("pessoas-campo").value);
    var inicio = document.getElementById("inicio-campo").value.trim();
    if (!titulo) return { erro: T.nomeFalta, campo: "nome-maratona-campo" };
    if (!minimo) return { erro: T.minimoFalta, campo: "minimo-campo" };
    if (!Number.isInteger(dias) || dias < 3 || dias > 30) return { erro: T.diasFalta, campo: "dias-campo" };
    if (!Number.isInteger(pessoas) || pessoas < 2 || pessoas > 100) return { erro: T.pessoasFalta, campo: "pessoas-campo" };
    if (inicio && (!/^\d{4}-\d{2}-\d{2}$/.test(inicio) || !dataReal(inicio) ||
      inicio < inicioMin || inicio > inicioMax)) return { erro: T.inicioFalta, campo: "inicio-campo" };
    var dados = { title: titulo, description: minimo, duration_days: dias, max_participants: pessoas };
    if (inicio) dados.start_day = inicio;
    return { dados: dados };
  }

  async function criar() {
    erroCriar("");
    var conferido = dadosCriar();
    if (conferido.erro) return erroCriar(conferido.erro, conferido.campo);
    var botao = document.getElementById("btn-criar");
    botao.disabled = true;
    botao.setAttribute("aria-busy", "true");
    botao.textContent = T.criando;
    var resultado = await NexusApi.criarMaratona(slug, conferido.dados);
    botao.disabled = false;
    botao.setAttribute("aria-busy", "false");
    botao.textContent = T.criarBotao;
    if (resultado.semRede) return erroCriar(T.semRede);
    if (B.sessaoVencida(resultado)) return B.irParaEntrada();
    if (B.semIdade(resultado)) return B.abrirAjuda();
    if (resultado.dados && resultado.dados.crisis === true) {
      document.getElementById("form-criar").reset();
      contar(document.getElementById("nome-maratona-campo"), document.getElementById("nome-contador"));
      contar(document.getElementById("minimo-campo"), document.getElementById("minimo-contador"));
      return B.abrirAjuda();
    }
    if (!resultado.ok) {
      var codigo = resultado.dados && resultado.dados.code;
      return erroCriar(M.erroDoServidor(codigo, resultado.erro), campoDoCodigo(codigo));
    }
    var criada = resultado.dados && resultado.dados.marathon;
    if (criada && criada.id) location.assign(B.link("maratona.html", { c: slug, m: criada.id }));
    else location.assign(B.link("maratona.html", { c: slug }));
  }

  /* ---------- Carga ---------- */

  async function carregar() {
    mostrarVista("carregando");
    aviso(document.getElementById("alerta"), "");
    if (!slug) {
      location.replace("comunidades.html" + B.busca());
      return;
    }
    if (B.semRedeAgora()) {
      mostrarVista("aviso");
      return aviso(document.getElementById("alerta"), T.semRede);
    }
    if (modo === "criar") {
      M.aplicar(document);
      mostrarVista("criar");
      focarTitulo();
      return;
    }
    if (modo === "detalhe" && id) return carregarDetalhe();
    return carregarLista();
  }

  function iniciar() {
    B.iniciarCenario();
    M.aplicar(document);
    slug = parametro("c");
    id = parametro("m");
    modo = parametro("criar") === "1" ? "criar" : (id ? "detalhe" : "lista");

    document.getElementById("link-voltar").href = B.link("comunidade.html", { c: slug });
    document.getElementById("btn-cancelar-criar").href = B.link("comunidade.html", { c: slug });
    document.getElementById("btn-agora-nao").href = "hoje.html" + B.busca();
    document.getElementById("btn-tentar").addEventListener("click", carregar);
    document.getElementById("btn-registrar").addEventListener("click", registrar);
    document.getElementById("btn-entrar").addEventListener("click", function () {
      abrirDialogo(this);
    });
    document.getElementById("btn-entrar-maratona").addEventListener("click", entrar);
    document.getElementById("btn-agora-nao-maratona").addEventListener("click", fecharDialogo);
    document.getElementById("dialogo-maratona").addEventListener("close", function () {
      if (botaoDaFolha && botaoDaFolha.isConnected && NexusAbas.focar) NexusAbas.focar(botaoDaFolha);
      botaoDaFolha = null;
    });
    document.getElementById("form-criar").addEventListener("submit", function (evento) {
      evento.preventDefault();
      criar();
    });
    var campoInicio = document.getElementById("inicio-campo");
    inicioMin = dataLisboa(new Date());
    var partes = inicioMin.split("-");
    var limite = new Date(Date.UTC(
      Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]) + 14, 12
    ));
    inicioMax = dataLisboa(limite);
    campoInicio.min = inicioMin;
    campoInicio.max = inicioMax;
    contar(document.getElementById("nome-maratona-campo"), document.getElementById("nome-contador"));
    contar(document.getElementById("minimo-campo"), document.getElementById("minimo-contador"));
    NexusAbas.montar("missao");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
    carregar();
  }

  iniciar();
})();
